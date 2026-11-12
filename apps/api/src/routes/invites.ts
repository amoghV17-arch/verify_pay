import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { formatCents, type AppConfig } from '@milestone/shared';
import { getDb } from '../db/index.js';
import { projects, users, invites } from '../db/schema.js';
import {
  requireAuth,
  requireProjectMember,
  requireVerifiedEmailIfNeeded,
} from '../auth/index.js';
import { InviteService, checkInviteRateLimit } from '../services/invite.js';
import { createRateLimitHandler } from '../services/abuseGuards.js';
import { fetchOrderedMilestones } from '../services/milestoneOrder.js';
import { sseHub } from '../services/sse.js';
import { isRealEmailConfigured, type EmailPort } from '../email/index.js';
import { renderEmailTemplate } from '../email/templates.js';

const CreateInviteSchema = z
  .object({
    expiryDays: z.number().int().min(1).max(90).optional(),
    maxUses: z.number().int().min(1).max(100).optional(),
    invitedEmail: z.union([z.string().trim().email(), z.literal('')]).optional(),
  })
  .optional();

const AcceptBodySchema = z
  .object({
    paypalEmail: z.string().trim().email('Valid PayPal payout email is required').optional(),
  })
  .optional();

function maskEmailHint(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return 'a designated email';
  const head = local.slice(0, 2);
  return `${head}***@${domain}`;
}

export const registerInviteRoutes: FastifyPluginAsync = async (server) => {
  const inviteService = new InviteService();
  const getConfig = (): AppConfig =>
    (server as unknown as { appConfig: AppConfig }).appConfig;
  const getEmailPort = (): EmailPort | undefined =>
    (server as unknown as { emailPort?: EmailPort }).emailPort;

  // 1. POST /api/projects/:id/invites (Client creates an invite)
  server.post<{
    Params: { id: string };
    Body?: unknown;
  }>(
    '/api/projects/:id/invites',
    {
      preHandler: [
        requireVerifiedEmailIfNeeded(),
        requireProjectMember('client'),
        createRateLimitHandler('invite', 20, 60_000),
      ],
    },
    async (request, reply) => {
      const { id: projectId } = request.params;
      const project = request.project!;

      const parsed = CreateInviteSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'ValidationError',
          message: parsed.error.issues[0]?.message || 'Invalid invite parameters.',
        });
      }

      const expiryDays = parsed.data?.expiryDays ?? 7;
      const maxUses = parsed.data?.maxUses ?? 1;
      const invitedEmail = parsed.data?.invitedEmail ? parsed.data.invitedEmail.trim() : undefined;

      const invite = await inviteService.createInvite({
        projectId,
        createdBy: request.user!.userId,
        invitedEmail,
        expiryDays,
        maxUses,
      });

      const cfg = getConfig();
      const emailPort = getEmailPort();
      if (invitedEmail && emailPort && (isRealEmailConfigured(cfg) || request.user!.isDemo || cfg.NODE_ENV !== 'production')) {
        const baseUrl = cfg.APP_BASE_URL.replace(/\/$/, '');
        const rendered = renderEmailTemplate('project_invite', {
          inviterName: request.user!.displayName || request.user!.name,
          projectTitle: project.title,
          amountFormatted: formatCents(project.totalCents),
          code: invite.code,
          actionUrl: `${baseUrl}/join/${invite.token}`,
        });
        await emailPort.send({
          to: invitedEmail,
          template: 'project_invite',
          subject: rendered.subject,
          bodyText: rendered.bodyText,
          bodyHtml: rendered.bodyHtml,
        });
      }

      return reply.status(201).send({
        success: true,
        invite: {
          id: invite.id,
          projectId: invite.projectId,
          invitedEmail: invite.invitedEmail,
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
    { preHandler: [requireProjectMember('client')] },
    async (request, reply) => {
      const { id: projectId } = request.params;
      const db = getDb();

      const projectInvites = await db
        .select({
          id: invites.id,
          projectId: invites.projectId,
          invitedEmail: invites.invitedEmail,
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

    const db = getDb();
    const [invRow] = await db
      .select({
        invite: invites,
        clientId: projects.clientId,
      })
      .from(invites)
      .innerJoin(projects, eq(invites.projectId, projects.id))
      .where(eq(invites.id, inviteId))
      .limit(1);

    if (!invRow) {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'Invitation not found or already revoked.',
      });
    }

    if (invRow.clientId !== request.user!.userId && invRow.invite.createdBy !== request.user!.userId) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Only the project client can revoke this invitation.',
      });
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
    { preHandler: [requireAuth()] },
    revokeHandler
  );

  server.post<{ Params: { id: string; inviteId: string } }>(
    '/api/projects/:id/invites/:inviteId/revoke',
    { preHandler: [requireAuth()] },
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

      const projectMilestones = await fetchOrderedMilestones(db, project.id);

      const formattedMilestones = projectMilestones.map((m) => {
        const criteriaList: string[] = Array.isArray(m.criteria)
          ? m.criteria.map((c: unknown) => {
              if (typeof c === 'string') return c;
              if (c && typeof c === 'object') {
                const obj = c as { description?: string; id?: string };
                return obj.description || obj.id || '';
              }
              return '';
            })
          : [];
        return {
          id: m.id,
          name: m.name,
          amountCents: m.amountCents,
          percent: m.percent,
          criteria: m.criteria,
          deliverableType: m.deliverableType,
          title: m.name,
          acceptanceCriteria: criteriaList,
        };
      });

      const isOwnInvite = Boolean(
        request.user && (project.clientId === request.user.userId || invite.createdBy === request.user.userId)
      );

      return reply.send({
        success: true,
        valid: true,
        invite: {
          id: invite.id,
          expiresAt: invite.expiresAt,
          hasTargetEmail: Boolean(invite.invitedEmail),
          invitedEmailHint: invite.invitedEmail ? maskEmailHint(invite.invitedEmail) : null,
          isOwnInvite,
        },
        client: {
          id: client?.id || '',
          name: client?.displayName || client?.name || 'Client',
        },
        project: {
          id: project.id,
          title: project.title,
          brief: project.brief,
          clientName: client?.displayName || client?.name || 'Client',
          totalCents: project.totalCents,
          currency: project.currency,
          status: project.status,
          milestones: formattedMilestones,
        },
        milestones: formattedMilestones,
      });
    }
  );

  // 5. POST /api/invites/:tokenOrCode/accept (Authenticated freelancer accepts invite)
  server.post<{ Params: { tokenOrCode: string }; Body: unknown }>(
    '/api/invites/:tokenOrCode/accept',
    { preHandler: [requireAuth()] },
    async (request, reply) => {
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
          message: parsedBody.error.issues[0]?.message || 'Enter a valid PayPal payout email.',
          details: parsedBody.error.flatten(),
        });
      }

      const user = request.user!;
      const { tokenOrCode } = request.params;
      const result = await inviteService.acceptInviteForUser(
        tokenOrCode,
        {
          userId: user.userId,
          name: user.displayName || user.name,
          email: user.email,
          payoutPaypalEmail: user.payoutPaypalEmail,
        },
        parsedBody.data
      );

      if (!result.ok) {
        return reply.status(result.status).send({
          error: result.error,
          message: result.message,
        });
      }

      sseHub.broadcast(result.project.id, 'invite.accepted', {
        projectId: result.project.id,
        freelancerId: user.userId,
      });

      return reply.send({
        success: true,
        project: result.project,
        paypalEmail: result.paypalEmail,
      });
    }
  );
};
