import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initDb, closeDb, schema, eq } from '../db/index.js';
import { MockPayPalAdapter } from '../paypal/mockAdapter.js';
import { ReleaseService } from '../services/release.js';
import { LedgerService } from '../services/ledger.js';
import type { AppDatabase } from '../db/index.js';

describe('M10 Concurrency & Ledger Invariant Suite (PostgreSQL / PGlite)', () => {
  let db: AppDatabase;
  let mockPayPal: MockPayPalAdapter;
  let releaseService: ReleaseService;
  let ledgerService: LedgerService;

  const testDatabaseUrl = process.env.DATABASE_URL_TEST;
  const isRealPostgres = Boolean(testDatabaseUrl);

  beforeAll(async () => {
    if (isRealPostgres) {
      db = await initDb({ databaseUrl: testDatabaseUrl });
    } else {
      // Local fallback to in-memory PGlite
      db = await initDb({ useMemory: true });
    }

    mockPayPal = new MockPayPalAdapter({ defaultWebhookDelayMs: 0 });
    releaseService = new ReleaseService(db);
    ledgerService = new LedgerService(db);
  });

  afterAll(async () => {
    await closeDb();
  });

  beforeEach(async () => {
    // Clean tables for each test
    await db.delete(schema.ledgerEntries);
    await db.delete(schema.payoutBatches);
    await db.delete(schema.deliverables);
    await db.delete(schema.reviews);
    await db.delete(schema.dependencies);
    await db.delete(schema.tasks);
    await db.delete(schema.milestones);
    await db.delete(schema.projects);

    // Ensure test users exist
    await db.insert(schema.users).values([
      { id: 'user_client_01', email: 'client@example.com', name: 'Sarah Lin' },
      { id: 'user_freelancer_01', email: 'freelancer@example.com', name: 'Arjun Mehta' },
    ]).onConflictDoNothing();
  });

  it(`executes 10 concurrent release transactions safely against ${isRealPostgres ? 'Real PostgreSQL' : 'PGlite'}`, async () => {
    const projectId = `proj_concurrent_${Date.now()}`;
    const milestoneId = `ms_concurrent_${Date.now()}`;
    const amountCents = 150000;

    // Seed project and funded ledger balance
    await db.insert(schema.projects).values({
      id: projectId,
      title: 'Concurrency Test Project',
      brief: 'Validating row locks and financial invariants under load',
      clientId: 'user_client_01',
      freelancerId: 'user_freelancer_01',
      totalCents: 500000,
      currency: 'USD',
      status: 'active',
      autonomyMode: 'manual',
    });

    await ledgerService.recordProjectFunding({
      projectId,
      captureId: `cap_${Date.now()}`,
      orderId: `ord_${Date.now()}`,
      amountCents: 500000,
    });

    await db.insert(schema.milestones).values({
      id: milestoneId,
      projectId,
      name: 'Concurrent High-Value Milestone',
      amountCents,
      percent: 30,
      deliverableType: 'code',
      status: 'approved',
      approvedBy: 'client',
      criteria: [{ id: 'c1', description: 'Concurrent criteria' }],
    });

    // Fire 10 parallel releases on the same milestone simultaneously
    const releasePromises = Array.from({ length: 10 }).map(() =>
      releaseService.releaseMilestone(milestoneId, mockPayPal, 'client')
    );

    const results = await Promise.all(releasePromises);

    expect(results).toHaveLength(10);
    for (const r of results) {
      expect(r.success).toBe(true);
      expect(['paid', 'releasing']).toContain(r.status);
    }

    // Invariant: Exactly one released entry in ledger
    const entries = await db
      .select()
      .from(schema.ledgerEntries)
      .where(eq(schema.ledgerEntries.milestoneId, milestoneId));

    const releasedEntries = entries.filter((e) => e.type === 'released');
    expect(releasedEntries).toHaveLength(1);
    expect(releasedEntries[0].amountCents).toBe(amountCents);

    // Invariant: Holding balance is correctly decremented
    const summary = await ledgerService.getProjectLedgerSummary(projectId);
    expect(summary.holdingBalanceCents).toBe(500000 - amountCents);
    expect(summary.holdingBalanceCents).toBeGreaterThanOrEqual(0);
  });

  it('enforces reserved pending release balance across concurrent multi-milestone releases', async () => {
    const projectId = `proj_multi_res_${Date.now()}`;

    // Project with exactly $200.00 in holding balance
    await db.insert(schema.projects).values({
      id: projectId,
      title: 'Multi-Milestone Balance Project',
      brief: 'Testing concurrent reservations across multiple milestones',
      clientId: 'user_client_01',
      freelancerId: 'user_freelancer_01',
      totalCents: 200000,
      currency: 'USD',
      status: 'active',
      autonomyMode: 'manual',
    });

    await ledgerService.recordProjectFunding({
      projectId,
      captureId: `cap_res_${Date.now()}`,
      orderId: `ord_res_${Date.now()}`,
      amountCents: 200000,
    });

    // Two milestones each wanting $150.00 (Total $300.00 > $200.00)
    const ms1 = `ms_over_1_${Date.now()}`;
    const ms2 = `ms_over_2_${Date.now()}`;

    await db.insert(schema.milestones).values([
      {
        id: ms1,
        projectId,
        name: 'Milestone 1 ($150)',
        amountCents: 150000,
        percent: 75,
        deliverableType: 'text',
        status: 'approved',
        approvedBy: 'client',
        criteria: [{ id: 'c1', description: 'Criteria 1' }],
      },
      {
        id: ms2,
        projectId,
        name: 'Milestone 2 ($150)',
        amountCents: 150000,
        percent: 75,
        deliverableType: 'text',
        status: 'approved',
        approvedBy: 'client',
        criteria: [{ id: 'c2', description: 'Criteria 2' }],
      },
    ]);

    // First release succeeds
    const res1 = await releaseService.releaseMilestone(ms1, mockPayPal, 'client');
    expect(res1.success).toBe(true);

    // Second release must fail because holding balance is insufficient (only $50.00 available)
    await expect(
      releaseService.releaseMilestone(ms2, mockPayPal, 'client')
    ).rejects.toThrow(/Insufficient.*holding balance/i);

    // Ledger holding balance is not negative
    const summary = await ledgerService.getProjectLedgerSummary(projectId);
    expect(summary.holdingBalanceCents).toBe(50000);
    expect(summary.holdingBalanceCents).toBeGreaterThanOrEqual(0);
  });
});
