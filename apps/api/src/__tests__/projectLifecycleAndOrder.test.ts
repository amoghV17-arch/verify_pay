import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { initDb, closeDb, type AppDatabase } from '../db/index.js';
import { seedDatabase } from '../db/seed.js';
import {
  projects,
  tasks,
  dependencies,
  milestones,
  ledgerEntries,
  payoutBatches,
  activity,
  deliverables,
  reviews,
  invites,
  receiptShares,
} from '../db/schema.js';
import { MockPayPalAdapter } from '../paypal/mockAdapter.js';
import { ReleaseService } from '../services/release.js';
import { LedgerService } from '../services/ledger.js';
import {
  fetchOrderedMilestones,
  computeDerivedTaskPercentMap,
  syncMilestoneProgress,
  syncProjectCompletionStatus,
} from '../services/milestoneOrder.js';
import { formatActivityRecord } from '../services/activityFormatter.js';
import { buildServer } from '../server.js';
import { createTestUserSession } from './helpers/authTestHelper.js';
import { loadConfig } from '@milestone/shared';
import type { FastifyInstance } from 'fastify';

describe('Project Lifecycle, Synced Balances, Schedule Progress & Milestone Ordering', () => {
  let db: AppDatabase;
  let mockPayPal: MockPayPalAdapter;
  let releaseService: ReleaseService;
  let ledgerService: LedgerService;
  let server: FastifyInstance;
  let clientHeaders: Record<string, string>;
  let freelancerHeaders: Record<string, string>;

  const testProjectId = 'proj_lifecycle_order_test';

  beforeAll(async () => {
    db = await initDb({ useMemory: true });
    await seedDatabase(db);

    mockPayPal = new MockPayPalAdapter({ defaultWebhookDelayMs: 0 });
    releaseService = new ReleaseService(db, mockPayPal);
    ledgerService = new LedgerService(db);

    const config = loadConfig({
      NODE_ENV: 'test',
      PAYPAL_ENV: 'mock',
      PORT: '8080',
      LLM_PROVIDER: 'fixture',
    });

    server = buildServer(config, { paypalAdapter: mockPayPal });
    await server.ready();

    const clientUser = await createTestUserSession({
      userId: 'user_client_01',
      role: 'client',
      name: 'Sarah Lin (Acme Corp)',
      email: 'sarah@acme-corp.com',
    });
    const freelancerUser = await createTestUserSession({
      userId: 'user_freelancer_01',
      role: 'freelancer',
      name: 'Arjun Mehta',
      email: 'arjun@freelance.dev',
    });
    clientHeaders = clientUser.headers;
    freelancerHeaders = freelancerUser.headers;
  }, 60000);

  afterAll(async () => {
    await server.close();
    await closeDb();
  });

  beforeEach(async () => {
    // Clean up test project cascade in dependency order
    const msRows = await db.select({ id: milestones.id }).from(milestones).where(eq(milestones.projectId, testProjectId));
    for (const m of msRows) {
      await db.delete(receiptShares).where(eq(receiptShares.milestoneId, m.id));
      await db.delete(payoutBatches).where(eq(payoutBatches.milestoneId, m.id));
      await db.delete(reviews).where(eq(reviews.milestoneId, m.id));
      await db.delete(deliverables).where(eq(deliverables.milestoneId, m.id));
    }
    await db.delete(ledgerEntries).where(eq(ledgerEntries.projectId, testProjectId));
    await db.delete(activity).where(eq(activity.projectId, testProjectId));
    await db.delete(invites).where(eq(invites.projectId, testProjectId));
    await db.delete(dependencies).where(eq(dependencies.projectId, testProjectId));
    await db.delete(milestones).where(eq(milestones.projectId, testProjectId));
    await db.delete(tasks).where(eq(tasks.projectId, testProjectId));
    await db.delete(projects).where(eq(projects.id, testProjectId));

    const sameTimestamp = new Date('2026-11-12T10:00:00.000Z');

    await db.insert(projects).values({
      id: testProjectId,
      title: 'Lifecycle Ordering & Sync Verification Project',
      brief: 'PostgreSQL schema + OpenAPI spec + curl verification suite',
      currency: 'USD',
      totalCents: 30000, // $300.00
      status: 'active',
      autonomyMode: 'assisted',
      releaseWindowSeconds: 20,
      clientId: 'user_client_01',
      freelancerId: 'user_freelancer_01',
      freelancerPaypalEmail: 'arjun-sandbox@freelance.dev',
      createdAt: sameTimestamp,
      updatedAt: sameTimestamp,
      version: 1,
    });

    // Two milestones with identical createdAt (tests sortOrder tie-breaking and MVCC update stability)
    // Plus a third milestone added at the same createdAt
    await db.insert(tasks).values([
      {
        id: 't_lc_1',
        projectId: testProjectId,
        name: 'Draft PostgreSQL DDL',
        startDate: '2026-11-14',
        durationDays: 2,
        percentDone: 0,
        sortOrder: 1,
        createdAt: sameTimestamp,
        updatedAt: sameTimestamp,
      },
      {
        id: 't_lc_ms1',
        projectId: testProjectId,
        name: 'Database Schema & Seed Data',
        startDate: '2026-11-16',
        durationDays: 0,
        percentDone: 0,
        milestoneId: 'ms_lc_1',
        sortOrder: 2,
        createdAt: sameTimestamp,
        updatedAt: sameTimestamp,
      },
      {
        id: 't_lc_2',
        projectId: testProjectId,
        name: 'Write OpenAPI 3.0 Spec',
        startDate: '2026-11-16',
        durationDays: 3,
        percentDone: 0,
        sortOrder: 3,
        createdAt: sameTimestamp,
        updatedAt: sameTimestamp,
      },
      {
        id: 't_lc_ms2',
        projectId: testProjectId,
        name: 'OpenAPI 3.0 Specification',
        startDate: '2026-11-19',
        durationDays: 0,
        percentDone: 0,
        milestoneId: 'ms_lc_2',
        sortOrder: 4,
        createdAt: sameTimestamp,
        updatedAt: sameTimestamp,
      },
      {
        id: 't_lc_3',
        projectId: testProjectId,
        name: 'Curl Verification Suite',
        startDate: '2026-11-19',
        durationDays: 2,
        percentDone: 0,
        sortOrder: 5,
        createdAt: sameTimestamp,
        updatedAt: sameTimestamp,
      },
      {
        id: 't_lc_ms3',
        projectId: testProjectId,
        name: 'Test Cases & Curl Guide',
        startDate: '2026-11-21',
        durationDays: 0,
        percentDone: 0,
        milestoneId: 'ms_lc_3',
        sortOrder: 6,
        createdAt: sameTimestamp,
        updatedAt: sameTimestamp,
      },
    ]);

    await db.insert(dependencies).values([
      { id: 'dep_lc_1', projectId: testProjectId, fromTaskId: 't_lc_1', toTaskId: 't_lc_ms1', type: 2, lag: 0 },
      { id: 'dep_lc_2', projectId: testProjectId, fromTaskId: 't_lc_ms1', toTaskId: 't_lc_2', type: 2, lag: 0 },
      { id: 'dep_lc_3', projectId: testProjectId, fromTaskId: 't_lc_2', toTaskId: 't_lc_ms2', type: 2, lag: 0 },
      { id: 'dep_lc_4', projectId: testProjectId, fromTaskId: 't_lc_ms2', toTaskId: 't_lc_3', type: 2, lag: 0 },
      { id: 'dep_lc_5', projectId: testProjectId, fromTaskId: 't_lc_3', toTaskId: 't_lc_ms3', type: 2, lag: 0 },
    ]);

    await db.insert(milestones).values([
      {
        id: 'ms_lc_1',
        projectId: testProjectId,
        taskId: 't_lc_ms1',
        name: 'Database Schema & Seed Data',
        amountCents: 9000,
        percent: 30,
        criteria: [
          { id: 'c1', description: 'PostgreSQL DDL script exists' },
          { id: 'c2', description: 'Seed INSERT statements valid' },
        ],
        status: 'funded',
        deliverableType: 'text',
        createdAt: sameTimestamp,
        updatedAt: sameTimestamp,
        version: 1,
      },
      {
        id: 'ms_lc_2',
        projectId: testProjectId,
        taskId: 't_lc_ms2',
        name: 'OpenAPI 3.0 Specification',
        amountCents: 12000,
        percent: 40,
        criteria: [{ id: 'c3', description: 'OpenAPI YAML covers CRUD' }],
        status: 'funded',
        deliverableType: 'text',
        createdAt: sameTimestamp,
        updatedAt: sameTimestamp,
        version: 1,
      },
      {
        id: 'ms_lc_3',
        projectId: testProjectId,
        taskId: 't_lc_ms3',
        name: 'Test Cases & Curl Guide',
        amountCents: 9000,
        percent: 30,
        criteria: [{ id: 'c4', description: '6 test scenarios documented' }],
        status: 'funded',
        deliverableType: 'text',
        createdAt: sameTimestamp,
        updatedAt: sameTimestamp,
        version: 1,
      },
    ]);

    await ledgerService.recordProjectFunding({
      projectId: testProjectId,
      captureId: 'CAP_LC_001',
      orderId: 'ORD_LC_001',
      amountCents: 30000,
    });
  });

  it('preserves deterministic Milestone 1/2/3 ordering even after Milestone 1 is updated/paid with identical createdAt', async () => {
    // Mutate Milestone 1 status & updatedAt (simulating PostgreSQL MVCC tuple relocation)
    await db
      .update(milestones)
      .set({ status: 'approved', updatedAt: new Date('2026-11-12T12:00:00.000Z') })
      .where(eq(milestones.id, 'ms_lc_1'));

    const ordered = await fetchOrderedMilestones(db, testProjectId);
    expect(ordered.map((m) => m.id)).toEqual(['ms_lc_1', 'ms_lc_2', 'ms_lc_3']);

    // Check REST endpoint order too
    const res = await server.inject({
      method: 'GET',
      url: `/api/projects/${testProjectId}/milestones`,
      headers: { ...clientHeaders },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as Array<{ id: string }>;
    expect(body.map((m) => m.id)).toEqual(['ms_lc_1', 'ms_lc_2', 'ms_lc_3']);
  });

  it('returns synced non-zero ledger balances and normalized ISO timestamps + PayPal references', async () => {
    await db.update(milestones).set({ status: 'approved' }).where(eq(milestones.id, 'ms_lc_1'));
    await releaseService.releaseMilestone('ms_lc_1', mockPayPal, 'client');

    const res = await server.inject({
      method: 'GET',
      url: `/api/projects/${testProjectId}/ledger`,
      headers: { ...clientHeaders },
    });
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);

    expect(data.balances).toEqual(
      expect.objectContaining({
        fundedCents: 30000,
        paidCents: 9000,
        heldCents: 21000,
      })
    );
    expect(data.entries.length).toBeGreaterThanOrEqual(2);
    for (const entry of data.entries) {
      expect(entry.timestamp).toBeTruthy();
      expect(Number.isNaN(new Date(entry.timestamp).getTime())).toBe(false);
      expect(entry.referenceId).toBeTruthy();
    }
    const releasedEntry = data.entries.find((e: { type: string }) => e.type === 'released');
    expect(releasedEntry).toBeDefined();
    expect(releasedEntry.paypalPayoutBatchId || releasedEntry.paypalRef).toBeTruthy();
  });

  it('returns normalized activity fields (timestamp, description, type, metadata) preventing Invalid Date', async () => {
    const sampleRow = formatActivityRecord({
      id: 'act_unit_1',
      projectId: testProjectId,
      actor: 'ai',
      kind: 'ai_review',
      text: 'AI review passed all acceptance criteria.',
      meta: { verdict: 'release' },
      ts: new Date('2026-11-12T10:05:00.000Z'),
    });
    expect(sampleRow.timestamp).toBe('2026-11-12T10:05:00.000Z');
    expect(sampleRow.description).toBe('AI review passed all acceptance criteria.');
    expect(sampleRow.type).toBe('ai_review');
    expect(sampleRow.metadata).toEqual({ verdict: 'release' });

    const res = await server.inject({
      method: 'GET',
      url: `/api/projects/${testProjectId}/activity`,
      headers: { ...clientHeaders },
    });
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.activity.length).toBeGreaterThanOrEqual(1);
    for (const item of data.activity) {
      expect(typeof item.timestamp).toBe('string');
      expect(Number.isNaN(new Date(item.timestamp).getTime())).toBe(false);
      expect(typeof item.description).toBe('string');
      expect(item.description.length).toBeGreaterThan(0);
    }
  });

  it('syncs 100% schedule progress on paid milestones + upstream tasks, hydrates criteria, uses dynamic startDate, and auto-closes project', async () => {
    // 1. Pay milestone 1 via ReleaseService -> updates ms_lc_1 + upstream t_lc_1 without touching ms_lc_2 or t_lc_2
    await db.update(milestones).set({ status: 'approved' }).where(eq(milestones.id, 'ms_lc_1'));
    await releaseService.releaseMilestone('ms_lc_1', mockPayPal, 'client');

    const ganttRes1 = await server.inject({
      method: 'GET',
      url: `/api/gantt/${testProjectId}/load`,
      headers: { ...clientHeaders },
    });
    expect(ganttRes1.statusCode).toBe(200);
    const gantt1 = JSON.parse(ganttRes1.body);
    expect(gantt1.project.startDate).toBe('2026-11-14');
    expect(gantt1.project.status).toBe('funded');

    const rootChildren1 = gantt1.tasks.rows as Array<{
      id: string;
      percentDone: number;
      acceptanceCriteria?: Array<{ id: string; description: string; passed?: boolean; evidence?: string }>;
    }>;
    const byId1 = new Map(rootChildren1.map((t) => [t.id, t]));
    expect(byId1.get('t_lc_ms1')?.percentDone).toBe(100);
    expect(byId1.get('t_lc_1')?.percentDone).toBe(100);
    expect(byId1.get('t_lc_2')?.percentDone).toBe(0);
    expect(byId1.get('t_lc_ms2')?.percentDone).toBe(0);
    expect(byId1.get('t_lc_ms1')?.acceptanceCriteria?.every((c) => c.passed === true)).toBe(true);

    // 2. Simulate pre-existing completed project whose DB status was stale ('active' even though all milestones are 'paid')
    await db.update(milestones).set({ status: 'paid' }).where(eq(milestones.projectId, testProjectId));

    // Confirm lazy auto-close triggers cleanly on /gantt/:projectId/load and /api/projects
    const ganttRes2 = await server.inject({
      method: 'GET',
      url: `/api/gantt/${testProjectId}/load`,
      headers: { ...clientHeaders },
    });
    expect(ganttRes2.statusCode).toBe(200);
    const gantt2 = JSON.parse(ganttRes2.body);
    expect(gantt2.project.status).toBe('closed');

    const rootChildren2 = gantt2.tasks.rows as Array<{ id: string; percentDone: number }>;
    expect(rootChildren2.every((t) => t.percentDone === 100)).toBe(true);

    // Verify helper idempotency
    const transitionedAgain = await syncProjectCompletionStatus(db, testProjectId);
    expect(transitionedAgain).toBe(false);

    // Verify syncMilestoneProgress helper + computeDerivedTaskPercentMap work independently too
    await syncMilestoneProgress(db, testProjectId, 'ms_lc_2', 'paid');
    const [taskRows, depRows, msRows] = await Promise.all([
      db.select().from(tasks).where(eq(tasks.projectId, testProjectId)),
      db.select().from(dependencies).where(eq(dependencies.projectId, testProjectId)),
      db.select().from(milestones).where(eq(milestones.projectId, testProjectId)),
    ]);
    const derived = computeDerivedTaskPercentMap(taskRows, depRows, msRows);
    expect(derived.get('t_lc_2')).toBe(100);
  });

  it('syncs GET /api/projects balances + milestoneStats and enforces auth on PATCH/DELETE lifecycle endpoints', async () => {
    await db.update(milestones).set({ status: 'approved' }).where(eq(milestones.id, 'ms_lc_1'));
    await releaseService.releaseMilestone('ms_lc_1', mockPayPal, 'client');

    // GET /api/projects returns synced balances & milestoneStats
    const listRes = await server.inject({
      method: 'GET',
      url: '/api/projects',
      headers: { ...freelancerHeaders },
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = JSON.parse(listRes.body);
    const targetProj = listBody.projects.find((p: { id: string }) => p.id === testProjectId);
    expect(targetProj).toBeDefined();
    expect(targetProj.balances).toEqual(
      expect.objectContaining({
        fundedCents: 30000,
        paidCents: 9000,
        heldCents: 21000,
      })
    );
    expect(targetProj.milestoneStats).toEqual({
      total: 3,
      paid: 1,
      active: 2,
    });

    // Freelancer cannot PATCH status or DELETE project
    const freelancerPatch = await server.inject({
      method: 'PATCH',
      url: `/api/projects/${testProjectId}`,
      headers: { ...freelancerHeaders },
      payload: { status: 'cancelled' },
    });
    expect(freelancerPatch.statusCode).toBe(403);

    const freelancerDelete = await server.inject({
      method: 'DELETE',
      url: `/api/projects/${testProjectId}`,
      headers: { ...freelancerHeaders },
    });
    expect(freelancerDelete.statusCode).toBe(403);

    // Client can PATCH status to cancelled
    const clientPatch = await server.inject({
      method: 'PATCH',
      url: `/api/projects/${testProjectId}`,
      headers: { ...clientHeaders },
      payload: { status: 'cancelled' },
    });
    expect(clientPatch.statusCode).toBe(200);
    const patchedBody = JSON.parse(clientPatch.body);
    expect(patchedBody.project.status).toBe('cancelled');

    // Client can DELETE project with full cascade cleanup
    const clientDelete = await server.inject({
      method: 'DELETE',
      url: `/api/projects/${testProjectId}`,
      headers: { ...clientHeaders },
    });
    expect(clientDelete.statusCode).toBe(200);
    expect(JSON.parse(clientDelete.body)).toEqual({
      success: true,
      deletedProjectId: testProjectId,
    });

    const [remainingProj, remainingMs, remainingTasks, remainingLedger] = await Promise.all([
      db.select().from(projects).where(eq(projects.id, testProjectId)),
      db.select().from(milestones).where(eq(milestones.projectId, testProjectId)),
      db.select().from(tasks).where(eq(tasks.projectId, testProjectId)),
      db.select().from(ledgerEntries).where(eq(ledgerEntries.projectId, testProjectId)),
    ]);
    expect(remainingProj).toHaveLength(0);
    expect(remainingMs).toHaveLength(0);
    expect(remainingTasks).toHaveLength(0);
    expect(remainingLedger).toHaveLength(0);
  });

  it('hides unaccepted client drafts and awaiting-invite projects from freelancer project list', async () => {
    const unacceptedId = 'proj_unaccepted_freelancer_hide';
    await db.delete(projects).where(eq(projects.id, unacceptedId));
    await db.insert(projects).values({
      id: unacceptedId,
      title: 'Unaccepted Brand Identity Draft',
      brief: 'Client created this draft without any freelancer accepting the invite yet.',
      currency: 'USD',
      totalCents: 40000,
      status: 'planned',
      autonomyMode: 'assisted',
      releaseWindowSeconds: 20,
      clientId: 'user_client_01',
      freelancerId: null,
      version: 1,
    });

    const clientListRes = await server.inject({
      method: 'GET',
      url: '/api/projects',
      headers: { ...clientHeaders },
    });
    expect(clientListRes.statusCode).toBe(200);
    const clientList = JSON.parse(clientListRes.body).projects as Array<{ id: string }>;
    expect(clientList.some((p) => p.id === unacceptedId)).toBe(true);

    const freelancerListRes = await server.inject({
      method: 'GET',
      url: '/api/projects',
      headers: { ...freelancerHeaders },
    });
    expect(freelancerListRes.statusCode).toBe(200);
    const freelancerList = JSON.parse(freelancerListRes.body).projects as Array<{ id: string }>;
    expect(freelancerList.some((p) => p.id === unacceptedId)).toBe(false);

    await db.delete(projects).where(eq(projects.id, unacceptedId));
  });
});
