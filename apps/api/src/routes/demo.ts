import type { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { users, projects, milestones, tasks, dependencies, ledgerEntries } from '../db/schema.js';
import { createSessionToken, setRoleSessionCookie } from '../auth/index.js';
import {
  createRateLimitHandler,
  getDailyLlmUsage,
  cleanupOldDemoSessions,
  MAX_DEMO_BUDGET_CENTS,
  validateBriefLength,
} from '../services/abuseGuards.js';
import { resetDemoDatabase, PREPARED_DELIVERABLES } from '../db/seed.js';

export const registerDemoRoutes: FastifyPluginAsync = async (server) => {
  // 1. POST /api/demo/session - Per-visitor isolated demo session creation (docs/LIVE_PROOF.md §2)
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
      const body = request.body || {};
      const brief = body.brief || 'Build and launch a responsive marketing website with automated AI review and verified PayPal milestone payouts.';

      const briefValidation = validateBriefLength(brief);
      if (!briefValidation.valid) {
        return reply.status(400).send({ error: 'ValidationError', message: briefValidation.error });
      }

      const visId = randomUUID().slice(0, 8);
      const clientId = `client_vis_${visId}`;
      const freelancerId = `freelancer_vis_${visId}`;
      const projectId = `proj_demo_${visId}`;

      const clientName = `Judge Client (${visId})`;
      const freelancerName = `Judge Freelancer (${visId})`;
      const freelancerPaypalEmail =
        process.env.DEMO_FREELANCER_PAYPAL_EMAIL || 'sb-freelancer@personal.example.com';

      // 1. Create isolated client user
      const [clientUser] = await db
        .insert(users)
        .values({
          id: clientId,
          name: clientName,
          email: `client-${visId}@demo.milestone.dev`,
          avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
        })
        .returning();

      // 2. Create isolated freelancer user
      const [freelancerUser] = await db
        .insert(users)
        .values({
          id: freelancerId,
          name: freelancerName,
          email: `freelancer-${visId}@demo.milestone.dev`,
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        })
        .returning();

      const totalCents = Math.min(
        MAX_DEMO_BUDGET_CENTS,
        body.totalBudget ? Math.round(body.totalBudget * 100) : 30000
      );

      // 3. Create isolated demo project space
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

      // 4. Seed initial topological milestones and tasks for this demo project
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

      // 5. Generate dual JWT session tokens
      const clientToken = await createSessionToken({
        userId: clientId,
        role: 'client',
        name: clientName,
      });

      const freelancerToken = await createSessionToken({
        userId: freelancerId,
        role: 'freelancer',
        name: freelancerName,
      });

      // Set cookies for dual persona access
      setRoleSessionCookie(reply, 'client', clientToken);
      setRoleSessionCookie(reply, 'freelancer', freelancerToken);

      return reply.status(201).send({
        success: true,
        session: {
          visitorId: visId,
          projectId,
          project: demoProject,
          client: clientUser,
          freelancer: freelancerUser,
          tokens: {
            clientToken,
            freelancerToken,
          },
        },
      });
    }
  );

  // 2. GET /api/demo/status - Evaluator guidance, sandbox buyer, and safeguards info
  server.get('/api/demo/status', async () => {
    return {
      success: true,
      demoMode: true,
      sandboxBuyer: {
        email: process.env.DEMO_SANDBOX_BUYER_EMAIL || 'sb-buyer@personal.example.com',
        password: process.env.DEMO_SANDBOX_BUYER_PASSWORD || 'SandboxPass123!',
        note: 'Sandbox test account. No real money.',
      },
      freelancerPayoutEmail:
        process.env.DEMO_FREELANCER_PAYPAL_EMAIL || 'sb-freelancer@personal.example.com',
      llmUsage: getDailyLlmUsage(),
      budgetCapCents: MAX_DEMO_BUDGET_CENTS,
      personas: {
        client: {
          id: 'user_client_01',
          name: 'Sarah Lin (Acme Corp)',
          email: 'sarah@acme-corp.com',
          role: 'client',
        },
        freelancer: {
          id: 'user_freelancer_01',
          name: 'Arjun Mehta',
          email: 'arjun@freelance.dev',
          paypalEmail: process.env.DEMO_FREELANCER_PAYPAL_EMAIL || 'arjun-sandbox@freelance.dev',
          role: 'freelancer',
        },
      },
    };
  });

  // 3. POST /api/demo/login-as - Switch active demo persona cookie
  server.post<{ Body: { persona?: 'client' | 'freelancer'; userId?: string; name?: string } }>(
    '/api/demo/login-as',
    async (request, reply) => {
      const persona = request.body?.persona || 'client';
      const isClient = persona === 'client';
      const userId = request.body?.userId || (isClient ? 'user_client_01' : 'user_freelancer_01');
      const name = request.body?.name || (isClient ? 'Sarah Lin (Acme Corp)' : 'Arjun Mehta');

      const token = await createSessionToken({
        userId,
        role: isClient ? 'client' : 'freelancer',
        name,
      });

      setRoleSessionCookie(reply, isClient ? 'client' : 'freelancer', token);

      return reply.send({
        success: true,
        user: { id: userId, role: persona, name },
      });
    }
  );

  // 4. POST /api/demo/reset - Reset demo database to canonical state
  server.post('/api/demo/reset', async (_request, reply) => {
    const db = getDb();
    await resetDemoDatabase(db);
    return reply.send({ success: true, message: 'Demo environment reset successfully.' });
  });

  // 5. GET /api/demo/prepared-deliverables - Prepared deliverables for judges (docs/LIVE_PROOF.md §2)
  server.get('/api/demo/prepared-deliverables', async () => {
    return { success: true, deliverables: PREPARED_DELIVERABLES };
  });

  // 6. POST /api/demo/cleanup - Trigger 24h demo sessions cleanup
  server.post('/api/demo/cleanup', async (_request, reply) => {
    const db = getDb();
    const result = await cleanupOldDemoSessions(db);
    return reply.send({
      success: true,
      message: `Cleaned up ${result.purgedProjectsCount} stale demo session(s).`,
      ...result,
    });
  });

  // 7. GET /api/demo/live-feed - Public live feed of last 5 sandbox settlements (docs/LIVE_PROOF.md §2)
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
