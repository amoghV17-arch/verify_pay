import type { FastifyPluginAsync } from 'fastify';
import { requireRole } from '../auth/index.js';
import { ReleaseService } from '../services/release.js';
import { ReconcilerService } from '../services/reconciler.js';
import { PayPalPort } from '@milestone/shared';

export interface MilestoneRoutesOptions {
  paypalAdapter?: PayPalPort;
}

export const registerMilestoneRoutes: FastifyPluginAsync<MilestoneRoutesOptions> = async (
  server,
  options
) => {
  const releaseService = new ReleaseService();
  const reconcilerService = new ReconcilerService();

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

