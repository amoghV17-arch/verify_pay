import type { FastifyPluginAsync } from 'fastify';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { eq, and, isNull } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { receiptShares, milestones, projects, ledgerEntries, users } from '../db/schema.js';
import { requireMilestoneMember } from '../auth/index.js';

function hashShareId(shareId: string): string {
  return createHash('sha256').update(shareId.trim()).digest('hex');
}

export const registerReceiptShareRoutes: FastifyPluginAsync = async (server) => {
  // 1. POST /api/milestones/:id/share (Client creates receipt share link)
  server.post<{ Params: { id: string } }>(
    '/api/milestones/:id/share',
    { preHandler: [requireMilestoneMember('client')] },
    async (request, reply) => {
      const { id: milestoneId } = request.params;
      const db = getDb();

      const [milestone] = await db
        .select()
        .from(milestones)
        .where(eq(milestones.id, milestoneId))
        .limit(1);

      if (!milestone) {
        return reply.status(404).send({ error: 'NotFound', message: 'Milestone not found.' });
      }

      const rawShareId = randomBytes(16).toString('base64url');
      const shareIdHash = hashShareId(rawShareId);
      const id = `rcpt_${randomUUID().slice(0, 10)}`;

      await db.insert(receiptShares).values({
        id,
        milestoneId,
        shareIdHash,
        createdBy: request.user?.userId || null,
      });

      return reply.status(201).send({
        success: true,
        shareId: rawShareId,
        shareUrl: `/receipts/shared/${rawShareId}`,
      });
    }
  );

  // 2. GET /api/receipts/shared/:shareId (Public receipt view)
  server.get<{ Params: { shareId: string } }>(
    '/api/receipts/shared/:shareId',
    async (request, reply) => {
      const { shareId } = request.params;
      const shareIdHash = hashShareId(shareId);
      const db = getDb();

      const [share] = await db
        .select()
        .from(receiptShares)
        .where(and(eq(receiptShares.shareIdHash, shareIdHash), isNull(receiptShares.revokedAt)))
        .limit(1);

      if (!share) {
        return reply.status(404).send({
          error: 'NotFound',
          message: 'This receipt share link is invalid or has been revoked.',
        });
      }

      const [milestone] = await db
        .select()
        .from(milestones)
        .where(eq(milestones.id, share.milestoneId))
        .limit(1);

      if (!milestone) {
        return reply.status(404).send({ error: 'NotFound', message: 'Milestone not found.' });
      }

      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, milestone.projectId))
        .limit(1);

      const [client] = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.id, project?.clientId || ''))
        .limit(1);

      const [freelancer] = project?.freelancerId
        ? await db
            .select({ id: users.id, name: users.name })
            .from(users)
            .where(eq(users.id, project.freelancerId))
            .limit(1)
        : [null];

      const [payoutEntry] = await db
        .select()
        .from(ledgerEntries)
        .where(and(eq(ledgerEntries.milestoneId, milestone.id), eq(ledgerEntries.type, 'released')))
        .limit(1);

      return reply.send({
        success: true,
        receipt: {
          shareId,
          createdAt: share.createdAt,
          sharedAt: share.createdAt,
          milestone: {
            id: milestone.id,
            name: milestone.name,
            amountCents: milestone.amountCents,
            status: milestone.status,
            criteria: milestone.criteria,
          },
          client: {
            id: client?.id,
            name: client?.name || 'Client',
          },
          freelancer: {
            id: freelancer?.id,
            name: freelancer?.name || 'Freelancer',
          },
          project: {
            id: project?.id,
            title: project?.title,
            clientName: client?.name || 'Client',
            freelancerName: freelancer?.name || 'Freelancer',
          },
          ledger: payoutEntry
            ? {
                amountCents: payoutEntry.amountCents,
                timestamp: payoutEntry.createdAt.toISOString(),
                paypalPayoutBatchId: payoutEntry.paypalRef || null,
              }
            : {
                amountCents: milestone.amountCents,
                timestamp: share.createdAt.toISOString(),
                paypalPayoutBatchId: null,
              },
          settlement: payoutEntry
            ? {
                type: payoutEntry.type,
                amountCents: payoutEntry.amountCents,
                paypalRef: payoutEntry.paypalRef || null,
                settledAt: payoutEntry.createdAt,
              }
            : null,
        },
      });
    }
  );

  // 3. POST /api/milestones/:id/share/revoke (Client revokes receipt share link)
  server.post<{ Params: { id: string } }>(
    '/api/milestones/:id/share/revoke',
    { preHandler: [requireMilestoneMember('client')] },
    async (request, reply) => {
      const { id: milestoneId } = request.params;
      const db = getDb();

      const [revoked] = await db
        .update(receiptShares)
        .set({ revokedAt: new Date() })
        .where(and(eq(receiptShares.milestoneId, milestoneId), isNull(receiptShares.revokedAt)))
        .returning();

      if (!revoked) {
        return reply.status(404).send({
          error: 'NotFound',
          message: 'No active share link found to revoke.',
        });
      }

      return reply.send({ success: true, message: 'Receipt share revoked successfully.' });
    }
  );
};

