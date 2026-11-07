import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { projects, ledgerEntries } from '../db/schema.js';
import { requireRole } from '../auth/index.js';
import { LedgerService } from '../services/ledger.js';
import { sseHub } from '../services/sse.js';
import { PayPalPort } from '@milestone/shared';

const CaptureBodySchema = z.object({
  orderId: z.string().min(1),
});

export interface FundRoutesOptions {
  paypalAdapter?: PayPalPort;
}

export const registerFundRoutes: FastifyPluginAsync<FundRoutesOptions> = async (
  server,
  options
) => {
  const ledgerService = new LedgerService();

  // 1. Create Funding Order
  server.post<{ Params: { id: string } }>(
    '/api/projects/:id/fund/order',
    { preHandler: [requireRole(['client'])] },
    async (request, reply) => {
      const { id: projectId } = request.params;
      const paypal = (request.server as unknown as { paypalAdapter: PayPalPort }).paypalAdapter || options.paypalAdapter;

      if (!paypal) {
        return reply.status(500).send({ error: 'PayPal adapter not initialized' });
      }

      const db = getDb();
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (!project) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      if (!project.freelancerId) {
        return reply.status(400).send({
          error: 'BadRequest',
          message: 'Project must have an accepted freelancer before funding.',
        });
      }

      const clientRequestId =
        (request.headers['paypal-request-id'] as string) ||
        `fund:${projectId}:${Date.now()}`;

      try {
        const orderResult = await paypal.createFundingOrder(
          {
            projectId: project.id,
            title: project.title,
            amountCents: project.totalCents,
            currency: 'USD',
            customId: project.id,
          },
          clientRequestId
        );

        return reply.send({
          orderId: orderResult.orderId,
          status: orderResult.status,
          amountCents: project.totalCents,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown PayPal error';
        return reply.status(502).send({ error: `PayPal order creation failed: ${msg}` });
      }
    }
  );

  // 2. Capture Funding Order
  server.post<{ Params: { id: string }; Body: unknown }>(
    '/api/projects/:id/fund/capture',
    { preHandler: [requireRole(['client'])] },
    async (request, reply) => {
      const { id: projectId } = request.params;
      const parsed = CaptureBodySchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.issues });
      }

      const { orderId } = parsed.data;
      const paypal = (request.server as unknown as { paypalAdapter: PayPalPort }).paypalAdapter || options.paypalAdapter;

      if (!paypal) {
        return reply.status(500).send({ error: 'PayPal adapter not initialized' });
      }

      const db = getDb();
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (!project) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      if (!project.freelancerId) {
        return reply.status(400).send({
          error: 'BadRequest',
          message: 'Project must have an accepted freelancer before funding.',
        });
      }

      const clientRequestId =
        (request.headers['paypal-request-id'] as string) ||
        `fund:${projectId}:${orderId}`;

      try {
        const captureResult = await paypal.captureFundingOrder(orderId, clientRequestId);

        if (captureResult.status !== 'COMPLETED') {
          return reply.status(400).send({
            error: 'PayPal capture was not completed',
            status: captureResult.status,
          });
        }

        // Apply to ledger atomically (idempotent)
        const record = await ledgerService.recordProjectFunding({
          projectId,
          captureId: captureResult.captureId,
          orderId,
          amountCents: captureResult.amountCents,
        });

        // Broadcast real-time events over SSE
        sseHub.broadcast(projectId, 'project.funded', {
          projectId,
          captureId: captureResult.captureId,
          amountCents: captureResult.amountCents,
          holdingBalanceCents: record.summary.holdingBalanceCents,
        });

        sseHub.broadcast(projectId, 'ledger.entry', {
          type: 'funded',
          amountCents: captureResult.amountCents,
          paypalRef: captureResult.captureId,
        });

        return reply.send({
          success: true,
          captureId: captureResult.captureId,
          status: captureResult.status,
          holdingBalanceCents: record.summary.holdingBalanceCents,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown capture error';
        return reply.status(502).send({ error: `PayPal capture failed: ${msg}` });
      }
    }
  );

  // 3. Project Ledger & Summary
  server.get<{ Params: { id: string } }>(
    '/api/projects/:id/ledger',
    async (request, reply) => {
      const { id: projectId } = request.params;
      const db = getDb();

      const summary = await ledgerService.getProjectLedgerSummary(projectId);
      const entries = await db
        .select()
        .from(ledgerEntries)
        .where(eq(ledgerEntries.projectId, projectId))
        .orderBy(desc(ledgerEntries.createdAt));

      return reply.send({
        summary,
        entries,
      });
    }
  );

  // 4. Server-Sent Events (SSE) Stream
  server.get<{ Params: { id: string } }>(
    '/api/projects/:id/events',
    async (request, reply) => {
      const { id: projectId } = request.params;

      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('Access-Control-Allow-Origin', '*');

      const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      reply.raw.write(`: sse connected for project ${projectId}\n\n`);

      const unsubscribe = sseHub.subscribe(projectId, {
        id: clientId,
        projectId,
        reply,
      });

      request.raw.on('close', () => {
        unsubscribe();
      });
    }
  );
};
