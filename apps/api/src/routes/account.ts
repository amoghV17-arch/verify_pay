import crypto from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import type { AppConfig } from '@milestone/shared';
import { getDb } from '../db/index.js';
import {
  activity,
  authEvents,
  ledgerEntries,
  milestones,
  notificationPrefs,
  notifications,
  projects,
  sessions,
  users,
} from '../db/schema.js';
import {
  clearSessionCookies,
  recordAuthEvent,
  requireAuth,
  resolveRequestedSlot,
  revokeAllUserSessions,
  revokeOtherSessions,
} from '../auth/index.js';
import { hashPassword, validatePasswordStrength, verifyPassword } from '../auth/crypto.js';
import { sseHub } from '../services/sse.js';
import { getUserWorkspaceStats } from './auth.js';

const UpdateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  company: z.string().trim().max(120).nullable().optional(),
  avatarColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  lastWorkspace: z.enum(['client', 'freelancer']).optional(),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(10).max(128),
});

const UpdatePayoutSchema = z.object({
  payoutPaypalEmail: z.string().trim().email('Enter a valid PayPal sandbox email address').max(254),
});

const UpdateNotificationPrefsSchema = z.object({
  emailInviteAccepted: z.boolean().optional(),
  emailFunded: z.boolean().optional(),
  emailSubmitted: z.boolean().optional(),
  emailReviewed: z.boolean().optional(),
  emailReleasePending: z.boolean().optional(),
  emailChangesRequested: z.boolean().optional(),
  emailPaid: z.boolean().optional(),
});

const DeleteAccountSchema = z.object({
  password: z.string().optional(),
  confirmation: z.literal('DELETE', {
    errorMap: () => ({ message: 'Type DELETE to confirm account deletion.' }),
  }),
});

export const registerAccountRoutes: FastifyPluginAsync = async (server) => {
  const getConfig = (): AppConfig =>
    (server as unknown as { appConfig: AppConfig }).appConfig;

  // GET /api/me
  server.get('/api/me', { preHandler: [requireAuth()] }, async (request, reply) => {
    const u = request.user!;
    const memberships = await getUserWorkspaceStats(u.userId);
    return reply.send({
      user: {
        id: u.userId,
        name: u.displayName || u.name,
        displayName: u.displayName || u.name,
        email: u.email,
        company: u.company,
        avatarColor: u.avatarColor,
        emailVerified: u.emailVerified,
        payoutPaypalEmail: u.payoutPaypalEmail,
        payoutEmailChangedAt: u.payoutEmailChangedAt,
        lastWorkspace: u.lastWorkspace,
        isDemo: u.isDemo,
        memberships,
      },
    });
  });

  // PATCH /api/me
  server.patch<{ Body: unknown }>('/api/me', { preHandler: [requireAuth()] }, async (request, reply) => {
    const parsed = UpdateProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: parsed.error.issues[0]?.message || 'Invalid profile update payload.',
      });
    }

    const db = getDb();
    const u = request.user!;
    const updates: Partial<typeof users.$inferInsert> = {};
    if (parsed.data.displayName !== undefined) {
      updates.displayName = parsed.data.displayName;
      updates.name = parsed.data.displayName;
    }
    if (parsed.data.company !== undefined) {
      updates.company = parsed.data.company;
    }
    if (parsed.data.avatarColor !== undefined) {
      updates.avatarColor = parsed.data.avatarColor;
    }
    if (parsed.data.lastWorkspace !== undefined) {
      updates.lastWorkspace = parsed.data.lastWorkspace;
    }

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, u.userId))
      .returning();

    return reply.send({
      ok: true,
      user: {
        id: updated.id,
        name: updated.displayName || updated.name,
        displayName: updated.displayName || updated.name,
        email: updated.email,
        company: updated.company,
        avatarColor: updated.avatarColor,
        emailVerified: Boolean(updated.emailVerifiedAt),
        payoutPaypalEmail: updated.payoutPaypalEmail,
        payoutEmailChangedAt: updated.payoutEmailChangedAt,
        lastWorkspace: updated.lastWorkspace,
        isDemo: updated.isDemo,
      },
    });
  });

  // PUT /api/me/payout
  server.put<{ Body: unknown }>('/api/me/payout', { preHandler: [requireAuth()] }, async (request, reply) => {
    const cfg = getConfig();
    const parsed = UpdatePayoutSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: parsed.error.issues[0]?.message || 'Invalid PayPal sandbox email.',
      });
    }

    const db = getDb();
    const u = request.user!;

    // Block payout destination changes while a release is in progress on any freelancer project (§4.8 & §6)
    const pendingReleases = await db
      .select({ milestoneId: milestones.id, projectId: projects.id })
      .from(milestones)
      .innerJoin(projects, eq(milestones.projectId, projects.id))
      .where(
        and(
          eq(projects.freelancerId, u.userId),
          eq(milestones.status, 'release_pending')
        )
      )
      .limit(1);

    if (pendingReleases.length > 0) {
      return reply.status(409).send({
        error: 'ReleaseInProgress',
        message:
          'You cannot change your payout email while a milestone payout release is pending. Wait until the current settlement finishes.',
      });
    }

    const now = new Date();
    const normalizedPayout = parsed.data.payoutPaypalEmail.trim().toLowerCase();
    const [updated] = await db
      .update(users)
      .set({
        payoutPaypalEmail: normalizedPayout,
        payoutEmailChangedAt: now,
      })
      .where(eq(users.id, u.userId))
      .returning();

    await recordAuthEvent({
      userId: u.userId,
      type: 'payout_email_updated',
      ip: request.ip,
      secret: cfg.SESSION_SECRET,
    });

    return reply.send({
      ok: true,
      payoutPaypalEmail: updated.payoutPaypalEmail,
      payoutEmailChangedAt: updated.payoutEmailChangedAt,
    });
  });

  // POST /api/me/password
  server.post<{ Body: unknown }>('/api/me/password', { preHandler: [requireAuth()] }, async (request, reply) => {
    const cfg = getConfig();
    const parsed = ChangePasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Current password and new password are required.',
      });
    }

    const db = getDb();
    const u = request.user!;
    const [userRow] = await db.select().from(users).where(eq(users.id, u.userId)).limit(1);
    if (!userRow) {
      return reply.status(404).send({ error: 'NotFound', message: 'Account not found.' });
    }

    if (userRow.passwordHash) {
      const currentValid = await verifyPassword(parsed.data.currentPassword, userRow.passwordHash);
      if (!currentValid) {
        return reply.status(400).send({
          error: 'InvalidPassword',
          message: 'Your current password is incorrect.',
        });
      }
    }

    const strength = validatePasswordStrength(parsed.data.newPassword);
    if (!strength.valid) {
      return reply.status(400).send({
        error: 'WeakPassword',
        message: strength.reason,
      });
    }

    const nextHash = await hashPassword(parsed.data.newPassword);
    await db.update(users).set({ passwordHash: nextHash }).where(eq(users.id, u.userId));
    await revokeOtherSessions(u.userId, u.sessionId);

    await recordAuthEvent({
      userId: u.userId,
      type: 'password_changed',
      ip: request.ip,
      secret: cfg.SESSION_SECRET,
    });

    return reply.send({
      ok: true,
      message: 'Password updated. All other sessions have been signed out.',
    });
  });

  // GET /api/me/sessions
  server.get('/api/me/sessions', { preHandler: [requireAuth()] }, async (request, reply) => {
    const db = getDb();
    const u = request.user!;
    const rows = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, u.userId), isNull(sessions.revokedAt)))
      .orderBy(desc(sessions.lastSeenAt));

    return reply.send({
      sessions: rows.map((s) => ({
        id: s.id,
        userAgentSummary: s.userAgentSummary || 'Browser session',
        lastSeenAt: s.lastSeenAt.toISOString(),
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        slot: s.slot,
        isCurrent: s.id === u.sessionId,
      })),
    });
  });

  // GET /api/me/security-events
  server.get('/api/me/security-events', { preHandler: [requireAuth()] }, async (request, reply) => {
    const db = getDb();
    const u = request.user!;
    const rows = await db
      .select()
      .from(authEvents)
      .where(eq(authEvents.userId, u.userId))
      .orderBy(desc(authEvents.at))
      .limit(25);

    return reply.send({
      events: rows.map((e) => ({
        id: e.id,
        type: e.type,
        at: e.at.toISOString(),
      })),
    });
  });

  // GET /api/me/export
  server.get('/api/me/export', { preHandler: [requireAuth()] }, async (request, reply) => {
    const db = getDb();
    const u = request.user!;
    const [profile] = await db.select().from(users).where(eq(users.id, u.userId)).limit(1);
    const memberships = await db
      .select({
        id: projects.id,
        title: projects.title,
        status: projects.status,
        currency: projects.currency,
        totalCents: projects.totalCents,
        clientId: projects.clientId,
        freelancerId: projects.freelancerId,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .where(or(eq(projects.clientId, u.userId), eq(projects.freelancerId, u.userId)));

    const projectIds = memberships.map((p) => p.id);
    const projectActivity =
      projectIds.length > 0
        ? await db
            .select()
            .from(activity)
            .where(inArray(activity.projectId, projectIds))
            .orderBy(desc(activity.ts))
            .limit(200)
        : [];

    const userNotifications = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, u.userId))
      .orderBy(desc(notifications.createdAt))
      .limit(200);

    const exportDoc = {
      exportedAt: new Date().toISOString(),
      notice: 'Milestone Sandbox Prototype Data Export',
      profile: profile
        ? {
            id: profile.id,
            name: profile.name,
            displayName: profile.displayName,
            email: profile.email,
            company: profile.company,
            avatarColor: profile.avatarColor,
            emailVerifiedAt: profile.emailVerifiedAt,
            payoutPaypalEmail: profile.payoutPaypalEmail,
            lastWorkspace: profile.lastWorkspace,
            createdAt: profile.createdAt,
          }
        : null,
      memberships: memberships.map((p) => ({
        ...p,
        myRole: p.clientId === u.userId ? 'client' : 'freelancer',
      })),
      notifications: userNotifications,
      projectActivity,
    };

    reply.header('Content-Disposition', 'attachment; filename="milestone-account-export.json"');
    return reply.send(exportDoc);
  });

  // DELETE /api/me
  server.delete<{ Body: unknown }>('/api/me', { preHandler: [requireAuth()] }, async (request, reply) => {
    const cfg = getConfig();
    const parsed = DeleteAccountSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: parsed.error.issues[0]?.message || 'Confirm account deletion.',
      });
    }

    const db = getDb();
    const u = request.user!;
    const [userRow] = await db.select().from(users).where(eq(users.id, u.userId)).limit(1);
    if (!userRow) {
      return reply.status(404).send({ error: 'NotFound', message: 'Account not found.' });
    }

    if (userRow.passwordHash) {
      const ok = await verifyPassword(parsed.data.password || '', userRow.passwordHash);
      if (!ok) {
        return reply.status(400).send({
          error: 'InvalidPassword',
          message: 'Password is incorrect.',
        });
      }
    }

    // Refuse deletion while any member project has funded unreleased milestones (§4.8)
    const activeMilestones = await db
      .select({ id: milestones.id, status: milestones.status })
      .from(milestones)
      .innerJoin(projects, eq(milestones.projectId, projects.id))
      .where(
        and(
          or(eq(projects.clientId, u.userId), eq(projects.freelancerId, u.userId)),
          inArray(milestones.status, [
            'funded',
            'submitted',
            'in_review',
            'approved',
            'release_pending',
            'changes_requested',
          ])
        )
      )
      .limit(1);

    if (activeMilestones.length > 0) {
      return reply.status(409).send({
        error: 'ActiveHeldFunds',
        message:
          'Your account cannot be deleted while you are on a project with funded, unreleased milestones.',
      });
    }

    // Double-check ledger balances on member projects
    const memberProjects = await db
      .select({ id: projects.id })
      .from(projects)
      .where(or(eq(projects.clientId, u.userId), eq(projects.freelancerId, u.userId)));

    for (const p of memberProjects) {
      const entries = await db.select().from(ledgerEntries).where(eq(ledgerEntries.projectId, p.id));
      let funded = 0;
      let released = 0;
      let refunded = 0;
      for (const e of entries) {
        if (e.type === 'funded') funded += e.amountCents;
        if (e.type === 'released') released += e.amountCents;
        if (e.type === 'refunded') refunded += e.amountCents;
      }
      if (funded - released - refunded > 0) {
        return reply.status(409).send({
          error: 'ActiveHeldFunds',
          message:
            'Your account cannot be deleted while a project you belong to holds an unreleased balance.',
        });
      }
    }

    const now = new Date();
    const anonSuffix = crypto.randomBytes(8).toString('hex');
    await db
      .update(users)
      .set({
        name: 'Deleted user',
        displayName: 'Deleted user',
        email: `deleted-${anonSuffix}@anonymized.invalid`,
        passwordHash: null,
        company: null,
        payoutPaypalEmail: null,
        deletedAt: now,
      })
      .where(eq(users.id, u.userId));

    await revokeAllUserSessions(u.userId);
    const slot = resolveRequestedSlot(request, cfg);
    clearSessionCookies(reply, cfg, slot);

    await recordAuthEvent({
      userId: u.userId,
      type: 'account_deleted',
      ip: request.ip,
      secret: cfg.SESSION_SECRET,
    });

    return reply.send({ ok: true, message: 'Account deleted and personal data anonymized.' });
  });

  // GET /api/notifications
  server.get<{ Querystring: { unreadOnly?: string; limit?: string } }>(
    '/api/notifications',
    { preHandler: [requireAuth()] },
    async (request, reply) => {
      const db = getDb();
      const u = request.user!;
      const limit = Math.min(100, Math.max(1, Number(request.query.limit || 40)));
      const unreadOnly = request.query.unreadOnly === 'true';

      const rows = await db
        .select()
        .from(notifications)
        .where(
          unreadOnly
            ? and(eq(notifications.userId, u.userId), isNull(notifications.readAt))
            : eq(notifications.userId, u.userId)
        )
        .orderBy(desc(notifications.createdAt))
        .limit(limit);

      const unreadRows = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(and(eq(notifications.userId, u.userId), isNull(notifications.readAt)));

      return reply.send({
        unreadCount: unreadRows.length,
        notifications: rows.map((n) => ({
          id: n.id,
          type: n.type,
          projectId: n.projectId,
          milestoneId: n.milestoneId,
          payload: n.payload,
          readAt: n.readAt ? n.readAt.toISOString() : null,
          createdAt: n.createdAt.toISOString(),
        })),
      });
    }
  );

  // POST /api/notifications/:id/read
  server.post<{ Params: { id: string } }>(
    '/api/notifications/:id/read',
    { preHandler: [requireAuth()] },
    async (request, reply) => {
      const db = getDb();
      const u = request.user!;
      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(and(eq(notifications.id, request.params.id), eq(notifications.userId, u.userId)));

      return reply.send({ ok: true });
    }
  );

  // POST /api/notifications/read-all
  server.post('/api/notifications/read-all', { preHandler: [requireAuth()] }, async (request, reply) => {
    const db = getDb();
    const u = request.user!;
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, u.userId), isNull(notifications.readAt)));

    return reply.send({ ok: true });
  });

  // GET /api/notifications/prefs
  server.get('/api/notifications/prefs', { preHandler: [requireAuth()] }, async (request, reply) => {
    const db = getDb();
    const u = request.user!;
    let [prefs] = await db
      .select()
      .from(notificationPrefs)
      .where(eq(notificationPrefs.userId, u.userId))
      .limit(1);

    if (!prefs) {
      [prefs] = await db.insert(notificationPrefs).values({ userId: u.userId }).returning();
    }

    return reply.send({ prefs });
  });

  // PUT /api/notifications/prefs
  server.put<{ Body: unknown }>('/api/notifications/prefs', { preHandler: [requireAuth()] }, async (request, reply) => {
    const parsed = UpdateNotificationPrefsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationError', message: 'Invalid notification preferences.' });
    }

    const db = getDb();
    const u = request.user!;
    await db.insert(notificationPrefs).values({ userId: u.userId }).onConflictDoNothing();
    const [updated] = await db
      .update(notificationPrefs)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(notificationPrefs.userId, u.userId))
      .returning();

    return reply.send({ ok: true, prefs: updated });
  });

  // GET /api/notifications/events (SSE stream for live bell badge)
  server.get('/api/notifications/events', { preHandler: [requireAuth()] }, async (request, reply) => {
    const u = request.user!;
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');

    const channel = `user:${u.userId}`;
    const clientId = `notif_sse_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    reply.raw.write(`: sse connected for user ${u.userId}\n\n`);

    const unsubscribe = sseHub.subscribe(channel, {
      id: clientId,
      projectId: channel,
      reply,
    });

    request.raw.on('close', () => {
      unsubscribe();
    });
  });
};

