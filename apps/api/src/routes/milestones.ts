import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { eq, or } from 'drizzle-orm';
import { requireRole } from '../auth/index.js';
import { ReleaseService } from '../services/release.js';
import { ReconcilerService } from '../services/reconciler.js';
import { ReviewerService } from '../services/reviewer.js';
import { getDb } from '../db/index.js';
import { milestones, deliverables } from '../db/schema.js';
import { createLlmPort } from '../ai/llmFactory.js';
import { DeliverableKindSchema, assertTransition, type PayPalPort, type MilestoneStatus } from '@milestone/shared';
import { z } from 'zod';

export interface MilestoneRoutesOptions {
  paypalAdapter?: PayPalPort;
}

const SubmitBodySchema = z.object({
  kind: DeliverableKindSchema,
  payload: z.unknown(),
});

export const registerMilestoneRoutes: FastifyPluginAsync<MilestoneRoutesOptions> = async (
  server,
  options
) => {
  const releaseService = new ReleaseService();
  const reconcilerService = new ReconcilerService();

  // POST /api/milestones/:id/submit (Freelancer submits a deliverable)
  server.post<{ Params: { id: string } }>(
    '/api/milestones/:id/submit',
    { preHandler: [requireRole(['freelancer'])] },
    async (request, reply) => {
      const { id: milestoneIdParam } = request.params;
      const userId = request.user?.userId ?? 'user_freelancer_01';

      const bodyParsed = SubmitBodySchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({ error: 'Invalid body', details: bodyParsed.error.flatten() });
      }
      const { kind, payload } = bodyParsed.data;

      const db = getDb();

      // Load milestone (match by id or taskId)
      const [milestone] = await db
        .select()
        .from(milestones)
        .where(or(eq(milestones.id, milestoneIdParam), eq(milestones.taskId, milestoneIdParam)))
        .limit(1);

      if (!milestone) {
        return reply.status(404).send({ error: 'Milestone not found' });
      }

      // Assert milestone is in a submittable state
      const submittableStates = ['funded', 'changes_requested'];
      if (!submittableStates.includes(milestone.status)) {
        return reply.status(409).send({
          error: `Milestone is not in a submittable state. Current status: ${milestone.status}`,
        });
      }

      // Assert transition is valid
      try {
        assertTransition(milestone.status as MilestoneStatus, 'submitted');
      } catch (err) {
        return reply.status(409).send({ error: String(err) });
      }

      // Insert deliverable
      const deliverableId = randomUUID();
      await db.insert(deliverables).values({
        id: deliverableId,
        milestoneId: milestone.id,
        kind,
        payload: payload as Record<string, unknown>,
        submittedBy: userId,
        submittedAt: new Date(),
      });

      // Transition: funded/changes_requested → submitted → in_review
      await db
        .update(milestones)
        .set({ status: 'submitted', updatedAt: new Date() })
        .where(eq(milestones.id, milestone.id));

      await db
        .update(milestones)
        .set({ status: 'in_review', updatedAt: new Date() })
        .where(eq(milestones.id, milestone.id));

      // Kick off reviewer asynchronously (do not await — returns 202 immediately)
      const projectId = milestone.projectId;
      setImmediate(async () => {
        try {
          const llm = createLlmPort();
          const reviewer = new ReviewerService(db);
          await reviewer.review(milestone.id, deliverableId, llm, projectId);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          server.log.error({ err, milestoneId: milestone.id }, `Reviewer failed: ${msg}`);
        }
      });

      return reply.status(202).send({ deliverableId, status: 'in_review' });
    }
  );

  // POST /api/milestones/:id/release (Client manual release trigger)
  server.post<{ Params: { id: string } }>(
    '/api/milestones/:id/release',
    { preHandler: [requireRole(['client'])] },
    async (request, reply) => {
      const { id: milestoneId } = request.params;
      const paypal =
        (request.server as unknown as { paypalAdapter: PayPalPort }).paypalAdapter ||
        options.paypalAdapter;

      if (!paypal) {
        return reply.status(500).send({ error: 'PayPal adapter not initialized' });
      }

      try {
        const result = await releaseService.releaseMilestone(milestoneId, paypal, 'client');
        if (!result.success) {
          return reply.status(400).send(result);
        }
        return reply.send(result);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Release failed';
        return reply.status(400).send({ error: msg });
      }
    }
  );

  // POST /api/projects/:id/reconcile (Reconciliation trigger)
  server.post<{ Params: { id: string } }>(
    '/api/projects/:id/reconcile',
    async (request, reply) => {
      const paypal =
        (request.server as unknown as { paypalAdapter: PayPalPort }).paypalAdapter ||
        options.paypalAdapter;

      if (!paypal) {
        return reply.status(500).send({ error: 'PayPal adapter not initialized' });
      }

      try {
        const report = await reconcilerService.reconcileStaleReleases(paypal, 0);
        return reply.send({ success: true, ...report });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Reconciliation error';
        return reply.status(500).send({ error: msg });
      }
    }
  );
};

