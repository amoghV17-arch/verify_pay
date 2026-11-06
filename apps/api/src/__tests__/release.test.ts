import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { initDb, closeDb, AppDatabase } from '../db/index.js';
import { seedDatabase } from '../db/seed.js';
import { projects, milestones, ledgerEntries, payoutBatches, activity } from '../db/schema.js';
import { MockPayPalAdapter } from '../paypal/mockAdapter.js';
import { ReleaseService } from '../services/release.js';
import { LedgerService } from '../services/ledger.js';
import { ReconcilerService } from '../services/reconciler.js';
import { buildServer } from '../server.js';
import { loadConfig } from '@milestone/shared';
import { createSessionToken } from '../auth/index.js';
import type { FastifyInstance } from 'fastify';

describe('Milestone M4 Payout Release Suite', () => {
  let db: AppDatabase;
  let mockPayPal: MockPayPalAdapter;
  let releaseService: ReleaseService;
  let ledgerService: LedgerService;
  let reconcilerService: ReconcilerService;
  let server: FastifyInstance;
  let clientCookie: string;

  const testProjectId = 'proj_m4_release_test';
  const testMilestoneId = 'ms_m4_test_01';
  const testMilestoneAmount = 150000; // $1,500.00

  beforeAll(async () => {
    db = await initDb({ useMemory: true });
    await seedDatabase(db);
    mockPayPal = new MockPayPalAdapter({ defaultWebhookDelayMs: 0 });
    releaseService = new ReleaseService(db, mockPayPal);
    ledgerService = new LedgerService(db);
    reconcilerService = new ReconcilerService(db, mockPayPal);

    const config = loadConfig({
      NODE_ENV: 'test',
      PAYPAL_ENV: 'mock',
      PORT: '8080',
      LLM_PROVIDER: 'fixture',
    });

    server = buildServer(config, { paypalAdapter: mockPayPal });
    await server.ready();

    // Create client session token for HTTP endpoint tests
    const token = await createSessionToken({ userId: 'user_client_01', role: 'client' });
    clientCookie = `milestone_session=${token}`;
  }, 35000);

  afterAll(async () => {
    await server.close();
    await closeDb();
  });

  beforeEach(async () => {
    // Reset test data
    await db.delete(activity).where(eq(activity.projectId, testProjectId));
    await db.delete(payoutBatches).where(eq(payoutBatches.milestoneId, testMilestoneId));
    await db.delete(ledgerEntries).where(eq(ledgerEntries.projectId, testProjectId));
    await db.delete(milestones).where(eq(milestones.id, testMilestoneId));
    await db.delete(projects).where(eq(projects.id, testProjectId));

    // Seed test project & milestone
    const now = new Date();
    await db.insert(projects).values({
      id: testProjectId,
      title: 'M4 Release Test Project',
      brief: 'Test project brief for M4 payout releases',
      currency: 'USD',
      totalCents: 500000, // $5,000.00
      status: 'active',
      clientId: 'user_client_01',
      freelancerId: 'user_freelancer_01',
      freelancerPaypalEmail: 'arjun-sandbox@freelance.dev',
      version: 1,
    });

    await db.insert(milestones).values({
      id: testMilestoneId,
      projectId: testProjectId,
      name: 'Deliverable 1: Core Architecture Approved',
      amountCents: testMilestoneAmount,
      percent: 30,
      criteria: [{ id: 'c1', description: 'Architecture verified' }],
      status: 'approved',
      deliverableType: 'document',
      createdAt: now,
      updatedAt: now,
      version: 1,
    });

    // Fund project with $3,000.00 holding balance
    await ledgerService.recordProjectFunding({
      projectId: testProjectId,
      captureId: `cap_fund_${Date.now()}`,
      orderId: `ord_fund_${Date.now()}`,
      amountCents: 300000,
    });
  });

  it('1. releases payout for an approved milestone, updating ledger and setting status to paid', async () => {
    const result = await releaseService.releaseMilestone(testMilestoneId, mockPayPal, 'client');
    expect(result.success).toBe(true);
    expect(result.status).toBe('paid');

    // Verify milestone record
    const [m] = await db.select().from(milestones).where(eq(milestones.id, testMilestoneId));
    expect(m.status).toBe('paid');

    // Verify ledger summary
    const summary = await ledgerService.getProjectLedgerSummary(testProjectId);
    expect(summary.fundedCents).toBe(300000);
    expect(summary.releasedCents).toBe(testMilestoneAmount);
    expect(summary.holdingBalanceCents).toBe(300000 - testMilestoneAmount);

    // Verify exactly one released entry
    const entries = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.milestoneId, testMilestoneId));
    const releasedEntries = entries.filter((e) => e.type === 'released');
    expect(releasedEntries.length).toBe(1);
    expect(releasedEntries[0].amountCents).toBe(testMilestoneAmount);
  });

  it('2. [ACCEPTANCE CHECK] fires 10 parallel releases and creates exactly one payout and one released entry', async () => {
    // Fire 10 concurrent release calls simultaneously
    const promises = Array.from({ length: 10 }).map(() =>
      releaseService.releaseMilestone(testMilestoneId, mockPayPal, 'client')
    );

    const results = await Promise.all(promises);

    // All promises must resolve without unhandled crash
    expect(results.length).toBe(10);
    for (const res of results) {
      expect(res.success).toBe(true);
      expect(['paid', 'releasing']).toContain(res.status);
    }

    // Verify milestone status is 'paid'
    const [m] = await db.select().from(milestones).where(eq(milestones.id, testMilestoneId));
    expect(m.status).toBe('paid');

    // Invariant: Exactly ONE 'released' ledger entry exists for this milestone
    const entries = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.milestoneId, testMilestoneId));
    const releasedEntries = entries.filter((e) => e.type === 'released');
    expect(releasedEntries.length).toBe(1);
    expect(releasedEntries[0].amountCents).toBe(testMilestoneAmount);

    // Holding balance invariant holds
    const summary = await ledgerService.getProjectLedgerSummary(testProjectId);
    expect(summary.holdingBalanceCents).toBe(300000 - testMilestoneAmount);
    expect(summary.holdingBalanceCents).toBeGreaterThanOrEqual(0);
  });

  it('3. rejects release when milestone status is not approved (e.g. unfunded or in_review)', async () => {
    await db
      .update(milestones)
      .set({ status: 'in_review' })
      .where(eq(milestones.id, testMilestoneId));

    await expect(
      releaseService.releaseMilestone(testMilestoneId, mockPayPal, 'client')
    ).rejects.toThrow(/must be in 'approved' status/);
  });

  it('4. rejects release if project holding balance is less than milestone amount', async () => {
    // Update milestone amount to $5,000.00 while holding balance is only $3,000.00
    await db
      .update(milestones)
      .set({ amountCents: 500000 })
      .where(eq(milestones.id, testMilestoneId));

    await expect(
      releaseService.releaseMilestone(testMilestoneId, mockPayPal, 'client')
    ).rejects.toThrow(/Insufficient.*holding balance/i);

    // Milestone should remain approved
    const [m] = await db.select().from(milestones).where(eq(milestones.id, testMilestoneId));
    expect(m.status).toBe('approved');
  });

  it('5. handles payout failure injection: catches rejection, records release_failed, and reverts to approved', async () => {
    mockPayPal.failNextPayout = true;

    const result = await releaseService.releaseMilestone(testMilestoneId, mockPayPal, 'client');
    expect(result.success).toBe(false);
    expect(result.status).toBe('approved');

    // Milestone must be reverted to 'approved' so client can retry
    const [m] = await db.select().from(milestones).where(eq(milestones.id, testMilestoneId));
    expect(m.status).toBe('approved');

    // Verify release_failed ledger entry exists
    const entries = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.milestoneId, testMilestoneId));
    const failedEntries = entries.filter((e) => e.type === 'release_failed');
    expect(failedEntries.length).toBeGreaterThan(0);

    // Holding balance remains intact
    const summary = await ledgerService.getProjectLedgerSummary(testProjectId);
    expect(summary.releasedCents).toBe(0);
    expect(summary.holdingBalanceCents).toBe(300000);
  });

  it('6. reconciler resolves stale releasing milestones via getPayoutBatch', async () => {
    // Put milestone in 'releasing' with an updatedAt in the past
    const twentyFiveSecsAgo = new Date(Date.now() - 25000);
    await db
      .update(milestones)
      .set({ status: 'releasing', updatedAt: twentyFiveSecsAgo })
      .where(eq(milestones.id, testMilestoneId));

    // Register a mock batch
    await db.insert(payoutBatches).values({
      id: `pb_test_${Date.now()}`,
      milestoneId: testMilestoneId,
      senderBatchId: `ms_${testMilestoneId}`,
      paypalBatchId: 'mock_batch_reconcile_01',
      status: 'PENDING',
      createdAt: twentyFiveSecsAgo,
    });

    const report = await reconcilerService.reconcileStaleReleases(mockPayPal, 20);
    expect(report.checked).toBeGreaterThanOrEqual(1);
    expect(report.resolved).toBeGreaterThanOrEqual(1);

    // Verify milestone is now marked paid
    const [m] = await db.select().from(milestones).where(eq(milestones.id, testMilestoneId));
    expect(m.status).toBe('paid');
  });

  it('7. client can trigger milestone release via POST /api/milestones/:id/release', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/milestones/${testMilestoneId}/release`,
      headers: {
        cookie: clientCookie,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.milestoneId).toBe(testMilestoneId);

    const [m] = await db.select().from(milestones).where(eq(milestones.id, testMilestoneId));
    expect(m.status).toBe('paid');
  });

  it('8. freelancer cannot trigger milestone release (HTTP 403 Forbidden)', async () => {
    const freelancerToken = await createSessionToken({ userId: 'user_freelancer_01', role: 'freelancer' });
    const res = await server.inject({
      method: 'POST',
      url: `/api/milestones/${testMilestoneId}/release`,
      headers: {
        cookie: `milestone_session=${freelancerToken}`,
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Forbidden');
  });

  it('9. payout retries: after a failed release, use attempt-numbered keys and sender_batch_id so retry succeeds with exactly one payout', async () => {
    // 1. Configure mock PayPal to fail the next payout attempt
    mockPayPal.failNextPayout = true;

    // 2. Initial attempt fails
    const failResult = await releaseService.releaseMilestone(testMilestoneId, mockPayPal, 'client');
    expect(failResult.success).toBe(false);

    // Verify milestone was reverted to 'approved' and release_failed recorded
    const [mAfterFail] = await db.select().from(milestones).where(eq(milestones.id, testMilestoneId));
    expect(mAfterFail.status).toBe('approved');

    const failedLedgerEntries = await db
      .select()
      .from(ledgerEntries)
      .where(and(eq(ledgerEntries.milestoneId, testMilestoneId), eq(ledgerEntries.type, 'release_failed')));
    expect(failedLedgerEntries.length).toBe(1);

    // 3. Retry the release payout (mock adapter default succeeds)
    const retryResult = await releaseService.releaseMilestone(testMilestoneId, mockPayPal, 'client');
    expect(retryResult.success).toBe(true);
    expect(retryResult.status).toBe('paid');
    expect(retryResult.idempotencyKey).toBe(`release:${testMilestoneId}:att2`);

    // Verify milestone is now marked 'paid'
    const [mAfterRetry] = await db.select().from(milestones).where(eq(milestones.id, testMilestoneId));
    expect(mAfterRetry.status).toBe('paid');

    // 4. Verify exactly ONE 'released' ledger entry exists (no double payout)
    const releasedLedgerEntries = await db
      .select()
      .from(ledgerEntries)
      .where(and(eq(ledgerEntries.milestoneId, testMilestoneId), eq(ledgerEntries.type, 'released')));
    expect(releasedLedgerEntries.length).toBe(1);
    expect(releasedLedgerEntries[0].amountCents).toBe(testMilestoneAmount);

    // Verify attempt 2 payout batch was recorded with attempt-numbered sender_batch_id
    const batches = await db
      .select()
      .from(payoutBatches)
      .where(eq(payoutBatches.milestoneId, testMilestoneId));
    expect(batches.length).toBeGreaterThanOrEqual(1);
    const retryBatch = batches.find((b) => b.senderBatchId === `ms_${testMilestoneId}_att2`);
    expect(retryBatch).toBeDefined();

    // 5. Subsequent release calls are idempotent and return status paid
    const idempotentCall = await releaseService.releaseMilestone(testMilestoneId, mockPayPal, 'client');
    expect(idempotentCall.success).toBe(true);
    expect(idempotentCall.status).toBe('paid');
    expect(idempotentCall.message).toBe('Milestone is already paid');
  });
});

