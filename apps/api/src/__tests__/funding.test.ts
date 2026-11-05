import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { initDb, AppDatabase } from '../db/index.js';
import { seedDatabase } from '../db/seed.js';
import { buildServer } from '../server.js';
import { MockPayPalAdapter } from '../paypal/mockAdapter.js';
import { projects, milestones, ledgerEntries, paypalEvents } from '../db/schema.js';
import { createSessionToken } from '../auth/index.js';
import { LedgerService } from '../services/ledger.js';

describe('M3 Funding, Webhooks, and Ledger Test Suite', () => {
  let db: AppDatabase;
  let server: FastifyInstance;
  let mockPayPal: MockPayPalAdapter;
  let clientCookie: string;
  let freelancerCookie: string;

  const testProjectId = 'proj_unfunded';

  beforeAll(async () => {
    // 1. Initialize hermetic in-memory PGlite database once
    db = await initDb({ useMemory: true });
    await seedDatabase(db);

    // 2. Setup mock PayPal adapter
    mockPayPal = new MockPayPalAdapter({ defaultWebhookDelayMs: 0 });

    // 3. Build Fastify server
    server = buildServer(
      {
        NODE_ENV: 'test',
        PORT: 8080,
        APP_BASE_URL: 'http://localhost:5173',
        DATABASE_URL: '',
        SESSION_SECRET: 'development-session-secret-at-least-32-chars',
        PAYPAL_ENV: 'mock',
        PAYPAL_CLIENT_ID: '',
        PAYPAL_CLIENT_SECRET: '',
        PAYPAL_WEBHOOK_ID: '',
        DEMO_FREELANCER_PAYPAL_EMAIL: '',
        LLM_PROVIDER: 'fixture',
        LLM_API_KEY: '',
        LLM_MODEL: '',
        LLM_BASE_URL: '',
        REVIEW_MIN_CONFIDENCE: 0.75,
        ASSISTED_RELEASE_WINDOW_SECONDS: 20,
        BRYNTUM_PACKAGE: 'trial',
      },
      { paypalAdapter: mockPayPal }
    );
    await server.ready();

    // 4. Generate auth cookies
    const clientToken = await createSessionToken({
      userId: 'user_client_01',
      role: 'client',
    });
    clientCookie = `milestone_session=${clientToken}`;

    const freelancerToken = await createSessionToken({
      userId: 'user_freelancer_01',
      role: 'freelancer',
    });
    freelancerCookie = `milestone_session=${freelancerToken}`;
  }, 60000);

  afterAll(async () => {
    await server.close();
  });

  beforeEach(async () => {
    // Reset mock adapter flags
    mockPayPal.failNextCapture = false;
    mockPayPal.failNextPayout = false;
    mockPayPal.duplicateWebhook = false;

    // Reset clean unfunded test project
    await db.delete(ledgerEntries).where(eq(ledgerEntries.projectId, testProjectId));
    await db.delete(milestones).where(eq(milestones.projectId, testProjectId));
    await db.delete(projects).where(eq(projects.id, testProjectId));

    await db.insert(projects).values({
      id: testProjectId,
      title: 'Unfunded Test Project',
      brief: 'Test project brief',
      clientId: 'user_client_01',
      freelancerId: 'user_freelancer_01',
      totalCents: 120000, // $1,200.00
      currency: 'USD',
      status: 'unfunded',
      autonomyMode: 'manual',
      releaseWindowSeconds: 20,
    });

    await db.insert(milestones).values([
      {
        id: 'ms_test_01',
        projectId: testProjectId,
        name: 'Milestone 1',
        amountCents: 60000,
        percent: 50,
        criteria: [{ id: 'c1', description: 'Deliverable complete' }],
        status: 'unfunded',
      },
      {
        id: 'ms_test_02',
        projectId: testProjectId,
        name: 'Milestone 2',
        amountCents: 60000,
        percent: 50,
        criteria: [{ id: 'c2', description: 'Milestone 2 criteria met' }],
        status: 'unfunded',
      },
    ]);
  });

  it('allows a client to create a funding order for the project budget', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/projects/${testProjectId}/fund/order`,
      headers: {
        cookie: clientCookie,
        'paypal-request-id': 'req_test_create_01',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.orderId).toMatch(/^mock_order_/);
    expect(body.status).toBe('CREATED');
    expect(body.amountCents).toBe(120000);
  });

  it('rejects funding order creation by freelancers with 403 Forbidden', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/projects/${testProjectId}/fund/order`,
      headers: {
        cookie: freelancerCookie,
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('captures funding order, writes ledger entry, and updates project & milestones to funded', async () => {
    // 1. Create order
    const orderRes = await server.inject({
      method: 'POST',
      url: `/api/projects/${testProjectId}/fund/order`,
      headers: { cookie: clientCookie },
    });
    const { orderId } = orderRes.json();

    // 2. Capture order
    const captureRes = await server.inject({
      method: 'POST',
      url: `/api/projects/${testProjectId}/fund/capture`,
      headers: { cookie: clientCookie },
      payload: { orderId },
    });

    expect(captureRes.statusCode).toBe(200);
    const body = captureRes.json();
    expect(body.success).toBe(true);
    expect(body.captureId).toMatch(/^mock_cap_/);
    expect(body.holdingBalanceCents).toBe(120000);

    // 3. Verify project status in DB
    const [project] = await db.select().from(projects).where(eq(projects.id, testProjectId));
    expect(project.status).toBe('funded');

    // 4. Verify milestones status in DB
    const msList = await db.select().from(milestones).where(eq(milestones.projectId, testProjectId));
    for (const ms of msList) {
      expect(ms.status).toBe('funded');
    }

    // 5. Verify ledger entry
    const entries = await db.select().from(ledgerEntries).where(eq(ledgerEntries.projectId, testProjectId));
    const fundedEntry = entries.find((e) => e.type === 'funded');
    expect(fundedEntry).toBeDefined();
    expect(fundedEntry?.amountCents).toBe(120000);
    expect(fundedEntry?.idempotencyKey).toBe(`fund:${testProjectId}:${body.captureId}`);
  });

  it('handles duplicate webhook calls idempotently without duplicate ledger entries', async () => {
    const eventId = `WH-TEST-DUP-${Date.now()}`;
    const captureId = `CAP-DUP-${Date.now()}`;
    const webhookEvent = {
      id: eventId,
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: {
        id: captureId,
        status: 'COMPLETED',
        custom_id: testProjectId,
        amount: { value: '1200.00', currency_code: 'USD' },
        supplementary_data: {
          related_ids: { order_id: 'ORD-DUP-01' },
        },
      },
    };

    // First webhook call
    const res1 = await server.inject({
      method: 'POST',
      url: '/api/webhooks/paypal',
      headers: { 'content-type': 'application/json' },
      payload: webhookEvent,
    });
    expect(res1.statusCode).toBe(200);
    expect(res1.json().status).toBe('received');

    // Second webhook call with identical event ID
    const res2 = await server.inject({
      method: 'POST',
      url: '/api/webhooks/paypal',
      headers: { 'content-type': 'application/json' },
      payload: webhookEvent,
    });
    expect(res2.statusCode).toBe(200);
    expect(res2.json().status).toBe('ignored_duplicate');

    // Verify only 1 ledger entry exists
    const entries = await db.select().from(ledgerEntries).where(eq(ledgerEntries.projectId, testProjectId));
    const fundedEntries = entries.filter((e) => e.type === 'funded');
    expect(fundedEntries.length).toBe(1);

    // Verify only 1 paypal_events row exists
    const events = await db.select().from(paypalEvents).where(eq(paypalEvents.paypalEventId, eventId));
    expect(events.length).toBe(1);
  });

  it('handles webhook arriving before capture response safely (out-of-order execution)', async () => {
    const captureId = `CAP-EARLY-${Date.now()}`;
    const orderId = `ORD-EARLY-${Date.now()}`;

    // 1. Webhook arrives first
    const webhookRes = await server.inject({
      method: 'POST',
      url: '/api/webhooks/paypal',
      headers: { 'content-type': 'application/json' },
      payload: {
        id: `WH-EARLY-${Date.now()}`,
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: captureId,
          status: 'COMPLETED',
          custom_id: testProjectId,
          amount: { value: '1200.00', currency_code: 'USD' },
          supplementary_data: {
            related_ids: { order_id: orderId },
          },
        },
      },
    });
    expect(webhookRes.statusCode).toBe(200);

    // 2. Synchronous capture response arrives after
    const ledger = new LedgerService(db);
    const result = await ledger.recordProjectFunding({
      projectId: testProjectId,
      captureId,
      orderId,
      amountCents: 120000,
    });

    // Idempotent: applied = false because key already existed
    expect(result.applied).toBe(false);
    expect(result.summary.holdingBalanceCents).toBe(120000);

    // Verify exactly one ledger row exists
    const entries = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.idempotencyKey, `fund:${testProjectId}:${captureId}`));
    expect(entries.length).toBe(1);
  });

  it('rejects capture failure cleanly and leaves project status intact', async () => {
    mockPayPal.failNextCapture = true;

    const res = await server.inject({
      method: 'POST',
      url: `/api/projects/${testProjectId}/fund/capture`,
      headers: { cookie: clientCookie },
      payload: { orderId: 'ord_should_fail' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('PayPal capture was not completed');

    // Verify project is still unfunded
    const [project] = await db.select().from(projects).where(eq(projects.id, testProjectId));
    expect(project.status).toBe('unfunded');

    // Verify no ledger entries were created
    const entries = await db.select().from(ledgerEntries).where(eq(ledgerEntries.projectId, testProjectId));
    const funded = entries.filter((e) => e.type === 'funded');
    expect(funded.length).toBe(0);
  });

  it('rejects webhooks with invalid signatures with 401 Unauthorized', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/webhooks/paypal',
      headers: {
        'content-type': 'application/json',
        'x-mock-signature-invalid': 'true',
      },
      payload: {
        id: `WH-INVALID-${Date.now()}`,
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
      },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('Invalid webhook signature');
  });
});
