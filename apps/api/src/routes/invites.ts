import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { projects, users, milestones, invites } from '../db/schema.js';
import { requireRole, createSessionToken, setRoleSessionCookie } from '../auth/index.js';
import { InviteService, checkInviteRateLimit } from '../services/invite.js';

const AcceptBodySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Valid email is required'),
  paypalEmail: z.string().email('Valid PayPal email is required').optional(),
});

export const registerInviteRoutes: FastifyPluginAsync = async (server) => {
  const inviteService = new InviteService();

  // 1. POST /api/projects/:id/invites (Client creates an invite)
  server.post<{
    Params: { id: string };
    Body?: { expiryDays?: number; maxUses?: number };
  }>(
    '/api/projects/:id/invites',
    { preHandler: [requireRole(['client'])] },
    async (request, reply) => {
      const { id: projectId } = request.params;
      const db = getDb();

      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (!project) {
        return reply.status(404).send({ error: 'NotFound', message: `Project "${projectId}" not found.` });
      }

      const expiryDays = request.body?.expiryDays ?? 7;
      const maxUses = request.body?.maxUses ?? 1;

      const invite = await inviteService.createInvite({
        projectId,
        createdBy: request.user?.userId,
        expiryDays,
        maxUses,
      });

      return reply.status(201).send({
        success: true,
        invite: {
          id: invite.id,
          projectId: invite.projectId,
          token: invite.token,
          code: invite.code,
          expiresAt: invite.expiresAt,
          maxUses: invite.maxUses,
          inviteUrl: `/join/${invite.token}`,
        },
      });
    }
  );

  // 2. GET /api/projects/:id/invites (Client lists project invites)
  server.get<{ Params: { id: string } }>(
    '/api/projects/:id/invites',
    { preHandler: [requireRole(['client'])] },
    async (request, reply) => {
      const { id: projectId } = request.params;
      const db = getDb();

      const projectInvites = await db
        .select({
          id: invites.id,
          projectId: invites.projectId,
          expiresAt: invites.expiresAt,
          maxUses: invites.maxUses,
          usedCount: invites.usedCount,
          acceptedBy: invites.acceptedBy,
          acceptedAt: invites.acceptedAt,
          revokedAt: invites.revokedAt,
          createdAt: invites.createdAt,
        })
        .from(invites)
        .where(eq(invites.projectId, projectId))
        .orderBy(desc(invites.createdAt));

      return reply.send({ success: true, invites: projectInvites });
    }
  );

  // 3. POST /api/invites/:id/revoke & /api/projects/:id/invites/:inviteId/revoke (Client revokes invite)
  const revokeHandler = async (
    request: FastifyRequest<{ Params: { id?: string; inviteId?: string } }>,
    reply: FastifyReply
  ) => {
    const inviteId = request.params.inviteId || request.params.id;
    if (!inviteId) {
      return reply.status(400).send({ error: 'BadRequest', message: 'Invite ID required.' });
    }

    const success = await inviteService.revokeInvite(inviteId);
    if (!success) {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'Invitation not found or already revoked.',
      });
    }

    return reply.send({ success: true, message: 'Invitation revoked successfully.' });
  };

  server.post<{ Params: { id: string } }>(
    '/api/invites/:id/revoke',
    { preHandler: [requireRole(['client'])] },
    revokeHandler
  );

  server.post<{ Params: { id: string; inviteId: string } }>(
    '/api/projects/:id/invites/:inviteId/revoke',
    { preHandler: [requireRole(['client'])] },
    revokeHandler
  );

  // 4. GET /api/invites/:tokenOrCode (Public project preview, rate-limited)
  server.get<{ Params: { tokenOrCode: string } }>(
    '/api/invites/:tokenOrCode',
    async (request, reply) => {
      const ip = request.ip || '127.0.0.1';
      const rate = checkInviteRateLimit(ip);
      if (!rate.allowed) {
        return reply.status(429).send({
          error: 'RateLimitExceeded',
          message: 'Too many attempts. Please try again later.',
        });
      }

      const { tokenOrCode } = request.params;
      const invite = await inviteService.findValidInvite(tokenOrCode);

      // Generic response for all invalid states
      if (!invite) {
        return reply.status(404).send({
          error: 'InvalidInvitation',
          message: 'This invitation is no longer valid.',
        });
      }

      const db = getDb();
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, invite.projectId))
        .limit(1);

      if (!project) {
        return reply.status(404).send({
          error: 'InvalidInvitation',
          message: 'This invitation is no longer valid.',
        });
      }

      const [client] = await db
        .select()
        .from(users)
        .where(eq(users.id, project.clientId))
        .limit(1);

      const projectMilestones = await db
        .select({
          id: milestones.id,
          name: milestones.name,
          amountCents: milestones.amountCents,
          percent: milestones.percent,
          criteria: milestones.criteria,
          deliverableType: milestones.deliverableType,
        })
        .from(milestones)
        .where(eq(milestones.projectId, project.id));

      const formattedMilestones = projectMilestones.map((m) => {
        const criteriaList: string[] = Array.isArray(m.criteria)
          ? m.criteria.map((c: any) => (typeof c === 'string' ? c : c?.description || c?.id || ''))
          : [];
        return {
          ...m,
          title: m.name,
          acceptanceCriteria: criteriaList,
        };
      });

      return reply.send({
        success: true,
        valid: true,
        invite: {
          id: invite.id,
          expiresAt: invite.expiresAt,
        },
        client: {
          id: client?.id || '',
          name: client?.name || 'Client',
        },
        project: {
          id: project.id,
          title: project.title,
          brief: project.brief,
          clientName: client?.name || 'Client',
          totalCents: project.totalCents,
          currency: project.currency,
          status: project.status,
          milestones: formattedMilestones,
        },
        milestones: formattedMilestones,
      });
    }
  );

  // 5. POST /api/invites/:tokenOrCode/accept (Freelancer accepts invite, issues ms_freelancer cookie)
  server.post<{ Params: { tokenOrCode: string }; Body: unknown }>(
    '/api/invites/:tokenOrCode/accept',
    async (request, reply) => {
      // Role guard: clients cannot accept invites
      const personaHeader = (request.headers['x-persona'] as string | undefined)?.toLowerCase();
      if (personaHeader === 'client' || (request.user && request.user.role === 'client' && !personaHeader)) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Client accounts cannot accept project invitations. Please join as a freelancer.',
        });
      }

      const ip = request.ip || '127.0.0.1';
      const rate = checkInviteRateLimit(ip);
      if (!rate.allowed) {
        return reply.status(429).send({
          error: 'RateLimitExceeded',
          message: 'Too many attempts. Please try again later.',
        });
      }

      const parsedBody = AcceptBodySchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.status(400).send({
          error: 'ValidationError',
          details: parsedBody.error.flatten(),
        });
      }

      const { tokenOrCode } = request.params;
      const result = await inviteService.acceptInvite(tokenOrCode, parsedBody.data);

      if (!result) {
        return reply.status(400).send({
          error: 'InvalidInvitation',
          message: 'This invitation is no longer valid.',
        });
      }

      // Issue ms_freelancer session cookie
      const sessionToken = await createSessionToken({
        userId: result.user.id,
        role: 'freelancer',
        name: result.user.name,
        email: result.user.email,
      });

      setRoleSessionCookie(reply, 'freelancer', sessionToken);

      return reply.send({
        success: true,
        user: result.user,
        project: result.project,
      });
    }
  );
};
