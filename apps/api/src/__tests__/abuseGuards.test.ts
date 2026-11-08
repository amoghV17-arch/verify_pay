import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import {
  checkRateLimit,
  resetRateLimits,
  getDailyLlmUsage,
  checkAndRecordLlmCall,
  resetDailyLlmUsage,
  validateBriefLength,
  validateDemoBudget,
  cleanupOldDemoSessions,
  MAX_BRIEF_LENGTH,
  MAX_DEMO_BUDGET_CENTS,
} from '../services/abuseGuards.js';
import { initDb, seedDatabase, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { buildServer } from '../server.js';
import { loadConfig } from '@milestone/shared';

describe('Abuse Guards & Demo Session Isolation (docs/LIVE_PROOF.md §2)', () => {
  beforeEach(() => {
    resetRateLimits();
    resetDailyLlmUsage();
    process.env.DAILY_LLM_CAP = '200';
  });

  describe('1. Rate Limiting Logic (Sliding Window)', () => {
    it('allows requests within limit and tracks count', () => {
      const ip = '192.168.1.100';
      const category = 'test_cat';
      const limit = 3;

      const r1 = checkRateLimit(ip, category, limit, 10000);
      expect(r1.allowed).toBe(true);
      expect(r1.current).toBe(1);

      const r2 = checkRateLimit(ip, category, limit, 10000);
      expect(r2.allowed).toBe(true);
      expect(r2.current).toBe(2);

      const r3 = checkRateLimit(ip, category, limit, 10000);
      expect(r3.allowed).toBe(true);
      expect(r3.current).toBe(3);

      const r4 = checkRateLimit(ip, category, limit, 10000);
      expect(r4.allowed).toBe(false);
      expect(r4.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('isolates rate limits between distinct client IPs', () => {
      const ipA = '10.0.0.1';
      const ipB = '10.0.0.2';
      const limit = 2;

      checkRateLimit(ipA, 'login', limit, 10000);
      checkRateLimit(ipA, 'login', limit, 10000);
      const rA3 = checkRateLimit(ipA, 'login', limit, 10000);
      expect(rA3.allowed).toBe(false);

      // ipB should not be blocked
      const rB1 = checkRateLimit(ipB, 'login', limit, 10000);
      expect(rB1.allowed).toBe(true);
      expect(rB1.current).toBe(1);
    });

    it('resets rate limits completely when requested', () => {
      const ip = '172.16.0.5';
      checkRateLimit(ip, 'test', 1, 10000);
      expect(checkRateLimit(ip, 'test', 1, 10000).allowed).toBe(false);

      resetRateLimits();
      expect(checkRateLimit(ip, 'test', 1, 10000).allowed).toBe(true);
    });
  });

  describe('2. Daily LLM Usage & Cap Protection', () => {
    it('tracks usage and enforces daily cap with a calm message', () => {
      const origCap = process.env.DAILY_LLM_CAP;
      try {
        process.env.DAILY_LLM_CAP = '3';
        resetDailyLlmUsage();

        const u0 = getDailyLlmUsage();
        expect(u0.used).toBe(0);
        expect(u0.cap).toBe(3);
        expect(u0.remaining).toBe(3);

        expect(checkAndRecordLlmCall().allowed).toBe(true);
        expect(checkAndRecordLlmCall().allowed).toBe(true);
        expect(checkAndRecordLlmCall().allowed).toBe(true);

        const u3 = getDailyLlmUsage();
        expect(u3.used).toBe(3);
        expect(u3.remaining).toBe(0);

        const blocked = checkAndRecordLlmCall();
        expect(blocked.allowed).toBe(false);
        expect(blocked.message).toContain('reached its daily AI processing limit');
      } finally {
        process.env.DAILY_LLM_CAP = origCap || '200';
        resetDailyLlmUsage();
      }
    });
  });

  describe('3. Brief Length Validation', () => {
    it('rejects briefs exceeding MAX_BRIEF_LENGTH (5,000 chars)', () => {
      const shortBrief = 'Design and build an ecommerce store with Stripe checkout';
      expect(validateBriefLength(shortBrief).valid).toBe(true);

      const massiveBrief = 'x'.repeat(MAX_BRIEF_LENGTH + 1);
      const invalid = validateBriefLength(massiveBrief);
      expect(invalid.valid).toBe(false);
      expect(invalid.error).toContain(`exceeds maximum allowed length of ${MAX_BRIEF_LENGTH}`);
    });

    it('rejects empty or whitespace-only briefs', () => {
      expect(validateBriefLength('').valid).toBe(false);
      expect(validateBriefLength('   ').valid).toBe(false);
    });
  });

  describe('4. Demo Budget Cap Validation', () => {
    it('enforces 50,000 cents ($500 USD) cap in demo mode', () => {
      expect(validateDemoBudget(30000, true).valid).toBe(true);
      expect(validateDemoBudget(MAX_DEMO_BUDGET_CENTS, true).valid).toBe(true);

      const overLimit = validateDemoBudget(MAX_DEMO_BUDGET_CENTS + 100, true);
      expect(overLimit.valid).toBe(false);
      expect(overLimit.error).toContain('maximum project budget is $500.00 USD');
    });

    it('does not enforce demo budget cap in non-demo mode', () => {
      const nonDemo = validateDemoBudget(1000000, false);
      expect(nonDemo.valid).toBe(true);
    });
  });

  describe('5. 24-Hour Demo Sessions Cleanup', () => {
    it('cleans up stale demo projects and visitor users while preserving canonical proj_brand_launch', async () => {
      const db = await initDb({ useMemory: true });
      await seedDatabase(db);

      const staleVisId = 'stale01';
      const staleClientId = `client_vis_${staleVisId}`;
      const staleFreelancerId = `freelancer_vis_${staleVisId}`;
      const staleProjectId = `proj_demo_${staleVisId}`;

      // Insert stale demo visitor client and freelancer
      await db.insert(schema.users).values([
        {
          id: staleClientId,
          name: 'Stale Judge Client',
          email: 'stale-client@example.com',
        },
        {
          id: staleFreelancerId,
          name: 'Stale Judge Freelancer',
          email: 'stale-freelancer@example.com',
        },
      ]);

      // Insert stale demo project created 25 hours ago
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
      await db.insert(schema.projects).values({
        id: staleProjectId,
        title: 'Stale Demo Project',
        brief: 'Stale brief',
        currency: 'USD',
        totalCents: 20000,
        status: 'draft',
        clientId: staleClientId,
        freelancerId: staleFreelancerId,
        isDemo: true,
        createdAt: twentyFiveHoursAgo,
        updatedAt: twentyFiveHoursAgo,
      });

      // Execute cleanup for sessions older than 24h
      const cleanupResult = await cleanupOldDemoSessions(db, 24 * 60 * 60 * 1000);
      expect(cleanupResult.purgedProjectsCount).toBeGreaterThanOrEqual(1);
      expect(cleanupResult.purgedUserIds).toContain(staleClientId);
      expect(cleanupResult.purgedUserIds).toContain(staleFreelancerId);

      // Verify stale project and visitor users are gone
      const [projCheck] = await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, staleProjectId));
      expect(projCheck).toBeUndefined();

      const [clientCheck] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, staleClientId));
      expect(clientCheck).toBeUndefined();

      // Verify canonical demo project 'proj_brand_launch' was NOT purged
      const [canonicalCheck] = await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, 'proj_brand_launch'));
      expect(canonicalCheck).toBeDefined();
    });
  });

  describe('6. Demo API Endpoints Integration', () => {
    let server: Awaited<ReturnType<typeof buildServer>>;

    beforeAll(async () => {
      const config = loadConfig({
        NODE_ENV: 'test',
        PAYPAL_ENV: 'mock',
        PORT: '8080',
        LLM_PROVIDER: 'fixture',
      });
      const db = await initDb({ useMemory: true });
      await seedDatabase(db);
      server = buildServer(config);
    });

    it('GET /api/demo/status returns evaluator sandbox buyer credentials and safeguards info', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/demo/status',
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(true);
      expect(data.demoMode).toBe(true);
      expect(data.sandboxBuyer).toBeDefined();
      expect(data.sandboxBuyer.email).toBeDefined();
      expect(data.sandboxBuyer.password).toBeDefined();
      expect(data.sandboxBuyer.note).toContain('Sandbox test account. No real money.');
      expect(data.budgetCapCents).toBe(MAX_DEMO_BUDGET_CENTS);
      expect(data.llmUsage).toBeDefined();
    });

    it('GET /api/demo/prepared-deliverables returns prepared evaluator test cases', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/demo/prepared-deliverables',
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(true);
      expect(data.deliverables.good).toBeDefined();
      expect(data.deliverables.weak).toBeDefined();
      expect(data.deliverables.injection).toBeDefined();
    });

    it('GET /api/demo/live-feed returns recent settlements array', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/demo/live-feed',
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.feed)).toBe(true);
    });

    it('POST /api/demo/session creates isolated demo space with dual tokens and returns 201', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/demo/session',
        payload: {
          title: 'Judge Isolation Test Project',
          brief: 'Build an automated AI reviewer test workspace with PayPal checkout',
          totalBudget: 400,
        },
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(true);
      expect(data.session.visitorId).toBeDefined();
      expect(data.session.projectId).toContain('proj_demo_');
      expect(data.session.client.id).toContain('client_vis_');
      expect(data.session.freelancer.id).toContain('freelancer_vis_');
      expect(data.session.tokens.clientToken).toBeDefined();
      expect(data.session.tokens.freelancerToken).toBeDefined();

      // Check cookies set on response
      const cookieHeader = res.headers['set-cookie'];
      expect(cookieHeader).toBeDefined();
    });

    it('POST /api/demo/session rejects brief exceeding 5,000 characters with HTTP 400', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/demo/session',
        payload: {
          brief: 'a'.repeat(MAX_BRIEF_LENGTH + 10),
        },
      });

      expect(res.statusCode).toBe(400);
      const data = JSON.parse(res.body);
      expect(data.error).toBe('ValidationError');
      expect(data.message).toContain('exceeds maximum allowed length');
    });

    it('POST /api/projects/plan enforces IP rate limiting (10 requests per minute)', async () => {
      const clientIp = '198.51.100.42';

      // Fire 10 allowed requests
      for (let i = 0; i < 10; i++) {
        const res = await server.inject({
          method: 'POST',
          url: '/api/projects/plan',
          headers: {
            'x-forwarded-for': clientIp,
          },
          payload: {
            brief: 'Build a mobile responsive landing page',
            totalBudget: 1000,
          },
        });
        expect(res.statusCode).toBe(200);
      }

      // 11th request must be rejected with 429 TooManyRequests
      const blockedRes = await server.inject({
        method: 'POST',
        url: '/api/projects/plan',
        headers: {
          'x-forwarded-for': clientIp,
        },
        payload: {
          brief: 'Build a mobile responsive landing page',
          totalBudget: 1000,
        },
      });

      expect(blockedRes.statusCode).toBe(429);
      const data = JSON.parse(blockedRes.body);
      expect(data.error).toBe('TooManyRequests');
      expect(data.message).toContain('Rate limit exceeded for planner');
      expect(blockedRes.headers['retry-after']).toBeDefined();
    });
  });
});
