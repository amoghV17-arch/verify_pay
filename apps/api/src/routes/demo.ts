import type { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import { desc, eq, or } from 'drizzle-orm';
import type { AppConfig } from '@milestone/shared';
import { getDb } from '../db/index.js';
import {
  users,
  notificationPrefs,
  projects,
  milestones,
  tasks,
  dependencies,
  ledgerEntries,
  emailOutbox,
} from '../db/schema.js';
import {
  createUserSession,
  requireAuth,
  setSessionCookies,
} from '../auth/index.js';
import {
  createRateLimitHandler,
  getDailyLlmUsage,
  cleanupOldDemoSessions,
  MAX_DEMO_BUDGET_CENTS,
  validateBriefLength,
} from '../services/abuseGuards.js';
import { resetDemoDatabase, PREPARED_DELIVERABLES } from '../db/seed.js';

export const registerDemoRoutes: FastifyPluginAsync = async (server) => {
  const getConfig = (): AppConfig =>
    (server as unknown as { appConfig: AppConfig }).appConfig;

  // Enforce DEMO_MODE=true across every /api/demo/* route
  server.addHook('preHandler', async (request, reply) => {
    if (request.url.startsWith('/api/demo') && !getConfig().DEMO_MODE) {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'Demo endpoints are disabled.',
      });
    }
  });

  // 1. POST /api/demo/session - Per-visitor isolated demo session creation
  server.post<{
    Body?: {
      title?: string;
      brief?: string;
      totalBudget?: number;
    };
  }>(
    '/api/demo/session',
    {
      preHandler: [createRateLimitHandler('demo_session', 20, 60_000)],
    },
    async (request, reply) => {
      const db = getDb();
      const cfg = getConfig();
      const body = request.body || {};
      const brief =
        body.brief ||
        'Build and launch a responsive marketing website with automated AI review and verified PayPal milestone payouts.';

      const briefValidation = validateBriefLength(brief);
      if (!briefValidation.valid) {
        return reply.status(400).send({ error: 'ValidationError', message: briefValidation.error });
      }

      const visId = randomUUID().slice(0, 8);
      const clientId = `client_vis_${visId}`;
      const freelancerId = `freelancer_vis_${visId}`;
      const projectId = `proj_demo_${visId}`;

      const clientName = `Demo Client (${visId})`;
      const freelancerName = `Demo Freelancer (${visId})`;
      const freelancerPaypalEmail =
        cfg.DEMO_FREELANCER_PAYPAL_EMAIL || 'sb-freelancer@personal.example.com';
      const now = new Date();

      const [clientUser] = await db
        .insert(users)
        .values({
          id: clientId,
          name: clientName,
          displayName: clientName,
          email: `client-${visId}@demo.example.invalid`,
          avatarColor: '#337D70',
          emailVerifiedAt: now,
          lastWorkspace: 'client',
          isDemo: true,
        })
        .returning();

      const [freelancerUser] = await db
        .insert(users)
        .values({
          id: freelancerId,
          name: freelancerName,
          displayName: freelancerName,
          email: `freelancer-${visId}@demo.example.invalid`,
          avatarColor: '#2A6358',
          emailVerifiedAt: now,
          lastWorkspace: 'freelancer',
          payoutPaypalEmail: freelancerPaypalEmail,
          payoutEmailChangedAt: now,
          isDemo: true,
        })
        .returning();

      await db
        .insert(notificationPrefs)
        .values([{ userId: clientId }, { userId: freelancerId }])
        .onConflictDoNothing();

      const totalCents = Math.min(
        MAX_DEMO_BUDGET_CENTS,
        body.totalBudget ? Math.round(body.totalBudget * 100) : 30000
      );

      const [demoProject] = await db
        .insert(projects)
        .values({
          id: projectId,
          title: body.title || `Demo Project (${visId})`,
          brief,
          currency: 'USD',
          totalCents,
          status: 'draft',
          autonomyMode: 'assisted',
          releaseWindowSeconds: 20,
          clientId,
          freelancerId,
          freelancerPaypalEmail,
          isDemo: true,
        })
        .returning();

      const ms1Id = `ms1_${visId}`;
      const ms2Id = `ms2_${visId}`;
      const t1Id = `t1_${visId}`;
      const t2Id = `t2_${visId}`;
      const m1TaskId = `m1_${visId}`;
      const m2TaskId = `m2_${visId}`;

      const ms1Cents = Math.round(totalCents * 0.4);
      const ms2Cents = totalCents - ms1Cents;

      await db.insert(tasks).values([
        { id: t1Id, projectId, name: 'Brand narrative & identity architecture', startDate: '2026-11-10', durationDays: 3, sortOrder: 1 },
        { id: m1TaskId, projectId, name: 'Milestone 1: Design System & Tokens', startDate: '2026-11-13', durationDays: 0, sortOrder: 2, milestoneId: ms1Id },
        { id: t2Id, projectId, name: 'Component library implementation', startDate: '2026-11-13', durationDays: 4, sortOrder: 3 },
        { id: m2TaskId, projectId, name: 'Milestone 2: Frontend Staging & Verification', startDate: '2026-11-17', durationDays: 0, sortOrder: 4, milestoneId: ms2Id },
      ]);

      await db.insert(dependencies).values([
        { id: `dep1_${visId}`, projectId, fromTaskId: t1Id, toTaskId: m1TaskId, type: 2 },
        { id: `dep2_${visId}`, projectId, fromTaskId: m1TaskId, toTaskId: t2Id, type: 2 },
        { id: `dep3_${visId}`, projectId, fromTaskId: t2Id, toTaskId: m2TaskId, type: 2 },
      ]);

      const msBaseTime = Date.now();
      await db.insert(milestones).values([
        {
          id: ms1Id,
          projectId,
          taskId: m1TaskId,
          name: 'Milestone 1: Design System & Tokens',
          amountCents: ms1Cents,
          percent: 40,
          deliverableType: 'figma',
          status: 'unfunded',
          createdAt: new Date(msBaseTime),
          criteria: [
            { id: 'c1-1', description: 'Design tokens exported with primary and secondary color scale' },
            { id: 'c1-2', description: 'WCAG AAA contrast verified on core text elements' },
          ],
        },
        {
          id: ms2Id,
          projectId,
          taskId: m2TaskId,
          name: 'Milestone 2: Frontend Staging & Verification',
          amountCents: ms2Cents,
          percent: 60,
          deliverableType: 'url',
          status: 'unfunded',
          createdAt: new Date(msBaseTime + 1000),
          criteria: [
            { id: 'c2-1', description: 'Deployment live with valid HTTPS certificate' },
            { id: 'c2-2', description: 'At least 12 reusable UI components documented with interactive variants' },
          ],
        },
      ]);

      const clientSess = await createUserSession({
        userId: clientId,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        slot: 'client',
        config: cfg,
      });
      const freelancerSess = await createUserSession({
        userId: freelancerId,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        slot: 'freelancer',
        config: cfg,
      });

      setSessionCookies(reply, clientSess.rawToken, clientSess.csrfToken, cfg, 'client');
      setSessionCookies(reply, freelancerSess.rawToken, freelancerSess.csrfToken, cfg, 'freelancer');

      return reply.status(201).send({
        success: true,
        session: {
          visitorId: visId,
          projectId,
          project: demoProject,
          client: clientUser,
          freelancer: freelancerUser,
          tokens: {
            clientToken: clientSess.rawToken,
            freelancerToken: freelancerSess.rawToken,
          },
        },
      });
    }
  );

  // 2. GET /api/demo/status - Evaluator guidance, sandbox buyer, and safeguards info
  server.get('/api/demo/status', async () => {
    const cfg = getConfig();
    return {
      success: true,
      demoMode: true,
      sandboxBuyer: {
        email: cfg.DEMO_SANDBOX_BUYER_EMAIL || 'sb-buyer@personal.example.com',
        password: cfg.DEMO_SANDBOX_BUYER_PASSWORD || 'SandboxPass123!',
        note: 'Sandbox test account. No real money.',
      },
      freelancerPayoutEmail:
        cfg.DEMO_FREELANCER_PAYPAL_EMAIL || 'sb-freelancer@personal.example.com',
      llmUsage: getDailyLlmUsage(),
      budgetCapCents: MAX_DEMO_BUDGET_CENTS,
      personas: {
        client: {
          id: 'user_client_01',
          name: 'Sarah Lin (Acme Corp)',
          email: 'sarah-demo@example.invalid',
          role: 'client',
        },
        freelancer: {
          id: 'user_freelancer_01',
          name: 'Arjun Mehta',
          email: 'arjun-demo@example.invalid',
          paypalEmail: cfg.DEMO_FREELANCER_PAYPAL_EMAIL || 'sb-freelancer@personal.example.com',
          role: 'freelancer',
        },
      },
    };
  });

  // 3. POST /api/demo/login-as - Demo-only one-click login into an isDemo=true user
  server.post<{ Body: { persona?: 'client' | 'freelancer'; userId?: string } }>(
    '/api/demo/login-as',
    async (request, reply) => {
      const cfg = getConfig();
      const db = getDb();
      const persona = request.body?.persona === 'freelancer' ? 'freelancer' : 'client';
      const requestedId = request.body?.userId || (persona === 'client' ? 'user_client_01' : 'user_freelancer_01');

      const [targetUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, requestedId))
        .limit(1);

      if (!targetUser || !targetUser.isDemo || targetUser.deletedAt) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'One-click demo sign-in is restricted to seeded demo accounts.',
        });
      }

      const sess = await createUserSession({
        userId: targetUser.id,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        slot: persona,
        config: cfg,
      });
      setSessionCookies(reply, sess.rawToken, sess.csrfToken, cfg, persona);
      // Also set default session cookie when not split-slot specific so normal workspace routes work seamlessly
      setSessionCookies(reply, sess.rawToken, sess.csrfToken, cfg, null);

      return reply.send({
        success: true,
        user: {
          id: targetUser.id,
          role: persona,
          name: targetUser.displayName || targetUser.name,
          email: targetUser.email,
        },
      });
    }
  );

  // 4. GET /api/demo/mailbox - Scoped virtual outbox for the signed-in demo account (or any user in dev/outbox mode)
  server.get(
    '/api/demo/mailbox',
    { preHandler: [requireAuth()] },
    async (request, reply) => {
      const cfg = getConfig();
      const u = request.user!;
      const isDevOrOutbox = cfg.EMAIL_PROVIDER === 'outbox' || process.env.NODE_ENV !== 'production';
      if (!u.isDemo && !isDevOrOutbox) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'The virtual mailbox is only available for demo accounts.',
        });
      }

      const db = getDb();
      const messages = await db
        .select()
        .from(emailOutbox)
        .where(
          or(
            eq(emailOutbox.recipientUserId, u.userId),
            eq(emailOutbox.toAddress, u.email.toLowerCase())
          )
        )
        .orderBy(desc(emailOutbox.createdAt))
        .limit(30);

      return reply.send({
        success: true,
        messages,
      });
    }
  );

  // 5. POST /api/demo/reset - Reset demo database to canonical state
  server.post('/api/demo/reset', async (_request, reply) => {
    const db = getDb();
    await resetDemoDatabase(db);
    return reply.send({ success: true, message: 'Demo environment reset successfully.' });
  });

  // 6. GET /api/demo/prepared-deliverables - Prepared deliverables for reviewers
  server.get('/api/demo/prepared-deliverables', async () => {
    return { success: true, deliverables: PREPARED_DELIVERABLES };
  });

  // 7. POST /api/demo/cleanup - Trigger 24h demo sessions cleanup
  server.post('/api/demo/cleanup', async (_request, reply) => {
    const db = getDb();
    const result = await cleanupOldDemoSessions(db);
    return reply.send({
      success: true,
      message: `Cleaned up ${result.purgedProjectsCount} stale demo session(s).`,
      ...result,
    });
  });

  // 8. GET /api/demo/live-feed - Public live feed of last 5 sandbox settlements
  server.get('/api/demo/live-feed', async () => {
    const db = getDb();
    const recentSettlements = await db
      .select({
        id: ledgerEntries.id,
        milestoneId: ledgerEntries.milestoneId,
        amountCents: ledgerEntries.amountCents,
        createdAt: ledgerEntries.createdAt,
      })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.type, 'released'))
      .orderBy(desc(ledgerEntries.createdAt))
      .limit(5);

    return {
      success: true,
      feed: recentSettlements.map((s) => ({
        id: s.id,
        milestoneId: s.milestoneId,
        amountCents: s.amountCents,
        timestamp: s.createdAt.toISOString(),
      })),
    };
  });
};
