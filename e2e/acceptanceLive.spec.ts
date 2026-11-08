import { test, expect } from '@playwright/test';
import { buildServer } from '../apps/api/src/server.js';
import { loadConfig } from '../packages/shared/src/config/env.js';
import { MockPayPalAdapter } from '../apps/api/src/paypal/mockAdapter.js';
import {
  initDb,
  closeDb,
  getDb,
  schema,
  eq,
  resetDemoDatabase,
} from '../apps/api/src/db/index.js';
import { createSessionToken } from '../apps/api/src/auth/index.js';
import { LedgerService } from '../apps/api/src/services/ledger.js';
import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

test.describe('M8q L5: Live Acceptance & Proof Verification Suite (LIVE_PROOF.md §7)', () => {
  let apiServer: FastifyInstance;
  let mockPayPal: MockPayPalAdapter;

  const ACCEPTANCE_PROJECT_ID = 'proj_acceptance_live_133742';
  const ACCEPTANCE_TITLE = 'Autonomous Drone Delivery Fleet Control Plane';
  const ACCEPTANCE_BRIEF = 'Build a telemetry stream control plane for delivery drones with WebSockets and Rust.';
  const CLIENT_ID = 'client_acceptance_live';
  const FREELANCER_ID = 'freelancer_acceptance_live';

  const TOTAL_BUDGET_CENTS = 133742; // $1,337.42 USD
  const MS1_CENTS = 60000;           // $600.00
  const MS2_CENTS = 73742;           // $737.42

  let clientToken: string;

  test.beforeAll(async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      PORT: '8080',
      APP_BASE_URL: 'http://localhost:5173',
      PAYPAL_ENV: 'mock',
      LLM_PROVIDER: 'fixture',
      DEMO_MODE: 'true',
    });

    const db = await initDb();
    await resetDemoDatabase(db);

    const { users, projects, milestones, payoutBatches, tasks } = schema;

    // Clean up any previous test artifacts
    await db.delete(projects).where(eq(projects.id, ACCEPTANCE_PROJECT_ID));
    await db.delete(users).where(eq(users.id, CLIENT_ID));
    await db.delete(users).where(eq(users.id, FREELANCER_ID));

    await db.insert(users).values([
      { id: CLIENT_ID, name: 'Zebra Co', email: 'director@zebra.corp' },
      { id: FREELANCER_ID, name: 'Quill', email: 'quill@autonomous.dev' },
    ]);

    await db.insert(projects).values({
      id: ACCEPTANCE_PROJECT_ID,
      title: ACCEPTANCE_TITLE,
      brief: ACCEPTANCE_BRIEF,
      currency: 'USD',
      totalCents: TOTAL_BUDGET_CENTS,
      status: 'funded',
      autonomyMode: 'assisted',
      clientId: CLIENT_ID,
      freelancerId: FREELANCER_ID,
      freelancerPaypalEmail: 'quill-sandbox@autonomous.dev',
      isDemo: true,
    });

    await db.insert(tasks).values([
      {
        id: 't_acc_1',
        projectId: ACCEPTANCE_PROJECT_ID,
        name: 'Architecture & Stream Engine',
        startDate: '2026-11-01',
        durationDays: 3,
        percentDone: 100,
        sortOrder: 1,
      },
      {
        id: 't_acc_2',
        projectId: ACCEPTANCE_PROJECT_ID,
        name: 'Telemetry Ingestion & Integration',
        startDate: '2026-11-04',
        durationDays: 4,
        percentDone: 50,
        sortOrder: 2,
      },
    ]);

    await db.insert(milestones).values([
      {
        id: 'ms_acc_1',
        projectId: ACCEPTANCE_PROJECT_ID,
        taskId: 't_acc_1',
        name: 'Stream Ingestion Engine',
        amountCents: MS1_CENTS,
        percent: 45,
        criteria: [{ id: 'c1', description: 'WebSockets engine supports 10k concurrent streams', passed: true }],
        deliverableType: 'repo',
        status: 'paid',
        approvedBy: 'client',
      },
      {
        id: 'ms_acc_2',
        projectId: ACCEPTANCE_PROJECT_ID,
        taskId: 't_acc_2',
        name: 'E2E Fleet Telemetry Integration',
        amountCents: MS2_CENTS,
        percent: 55,
        criteria: [{ id: 'c2', description: 'Integration tests pass with <15ms latency' }],
        deliverableType: 'url',
        status: 'funded',
      },
    ]);

    // Record ledger entries
    const ledger = new LedgerService(db);
    await ledger.recordProjectFunding({
      projectId: ACCEPTANCE_PROJECT_ID,
      captureId: 'ord_acceptance_capture_133742',
      orderId: 'ord_acceptance_capture_133742',
      amountCents: TOTAL_BUDGET_CENTS,
    });

    await db.insert(schema.ledgerEntries).values({
      id: 'led_acc_release_ms1',
      projectId: ACCEPTANCE_PROJECT_ID,
      milestoneId: 'ms_acc_1',
      type: 'released',
      amountCents: MS1_CENTS,
      paypalRef: 'batch_acceptance_payout_60000',
      idempotencyKey: 'release:ms_acc_1',
    });

    await db.insert(payoutBatches).values({
      id: 'batch_acc_payout_1',
      milestoneId: 'ms_acc_1',
      paypalBatchId: 'batch_acceptance_payout_60000',
      senderBatchId: 'sb_ms_acc_1_att1',
      status: 'SUCCESS',
    });

    mockPayPal = new MockPayPalAdapter();
    (mockPayPal as any).orders.set('ord_acceptance_capture_133742', {
      id: 'ord_acceptance_capture_133742',
      status: 'COMPLETED',
      amountCents: TOTAL_BUDGET_CENTS,
      customId: ACCEPTANCE_PROJECT_ID,
    });

    apiServer = buildServer(config, { paypalAdapter: mockPayPal });
    await apiServer.listen({ port: 8080, host: '127.0.0.1' });

    clientToken = await createSessionToken({
      userId: CLIENT_ID,
      email: 'director@zebra.corp',
      name: 'Zebra Co',
      role: 'client',
    });
  });

  test.afterAll(async () => {
    if (apiServer) await apiServer.close();
    await closeDb();
  });

  test('1. System mode and public status endpoints return healthy telemetry', async ({ request }) => {
    const modeRes = await request.get('http://127.0.0.1:8080/api/system/mode');
    expect(modeRes.status()).toBe(200);
    const modeJson = await modeRes.json();
    expect(modeJson).toHaveProperty('paypal');
    expect(modeJson).toHaveProperty('llm');
    expect(modeJson).toHaveProperty('version', '0.9.0');

    const statusRes = await request.get('http://127.0.0.1:8080/api/system/status');
    expect(statusRes.status()).toBe(200);
    const statusJson = await statusRes.json();
    expect(statusJson.api).toBe('ok');
    expect(statusJson.database).toBe('ok');
  });

  test('2. Proof API reconciles project ledger against PayPal truth (matches: true)', async ({ request }) => {
    const proofRes = await request.get(`http://127.0.0.1:8080/api/proof/projects/${ACCEPTANCE_PROJECT_ID}`);
    expect(proofRes.status()).toBe(200);
    const proof = await proofRes.json();

    expect(proof.projectId).toBe(ACCEPTANCE_PROJECT_ID);
    expect(proof.reconciliation.matches).toBe(true);

    // Verify money reconciliation math
    const { ledger } = proof.reconciliation;
    expect(ledger.fundedCents).toBe(TOTAL_BUDGET_CENTS);
    expect(ledger.paidCents).toBe(MS1_CENTS);
    expect(ledger.heldCents).toBe(MS2_CENTS);
    expect(ledger.paidCents + ledger.heldCents).toBe(ledger.fundedCents);

    // Verify checks
    const checkIds = proof.checks.map((c: any) => c.id);
    expect(checkIds).toContain('paypal_reachable');
    expect(checkIds).toContain('database');
    expect(checkIds).toContain('milestone_amounts_sum');
    expect(checkIds).toContain('held_balance_non_negative');

    // Save acceptance results to evals/results/acceptance-latest.json per §7.9
    const resultsDir = path.resolve(process.cwd(), 'evals/results');
    if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });
    fs.writeFileSync(
      path.join(resultsDir, 'acceptance-latest.json'),
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          projectId: ACCEPTANCE_PROJECT_ID,
          totalBudget: '$1,337.42 USD',
          reconciliationMatches: proof.reconciliation.matches,
          checksPassed: proof.checks.filter((c: any) => c.status === 'pass').length,
          totalChecks: proof.checks.length,
          externalCallsCount: proof.externalCalls.length,
        },
        null,
        2
      )
    );
  });

  test('3. Proof API detects artificially introduced discrepancy (matches: false)', async ({ request }) => {
    const db = getDb();
    const { ledgerEntries } = schema;

    // Artificially tamper with a ledger row (modify released amount to $999.99)
    await db.insert(ledgerEntries).values({
      id: 'led_tampered_entry',
      projectId: ACCEPTANCE_PROJECT_ID,
      milestoneId: 'ms_acc_2',
      type: 'released',
      amountCents: 99999, // $999.99 discrepancy
      paypalRef: 'forged_batch_99999',
      idempotencyKey: 'idemp_tamper_99999',
    });

    const proofRes = await request.get(`http://127.0.0.1:8080/api/proof/projects/${ACCEPTANCE_PROJECT_ID}`);
    expect(proofRes.status()).toBe(200);
    const proof = await proofRes.json();

    // The tampered ledger row must trigger matches: false
    expect(proof.reconciliation.matches).toBe(false);

    // Clean up tampered row
    await db.delete(ledgerEntries).where(eq(ledgerEntries.id, 'led_tampered_entry'));
  });

  test('4. Live UI displays Proof dashboard and Three-Pane Split view', async ({ page }) => {
    // Set cookie
    await page.context().addCookies([
      {
        name: 'milestone_client_session',
        value: clientToken,
        domain: 'localhost',
        path: '/',
      },
    ]);

    // Visit /demo/proof
    await page.goto(`http://localhost:5173/demo/proof?projectId=${ACCEPTANCE_PROJECT_ID}`);
    await expect(page.locator('h1')).toContainText('Proof & Reconciliation Dashboard');
    await expect(page.locator('text=100% Reconciled')).toBeVisible();

    // Visit /demo/split
    await page.goto(`http://localhost:5173/demo/split?projectId=${ACCEPTANCE_PROJECT_ID}`);
    await expect(page.locator('#split-toggle-truth-btn')).toBeVisible();
    await expect(page.locator('.split-pane-truth')).toBeVisible();
    await expect(page.locator('text=Sandbox Portal')).toBeVisible();

    // Visit /status
    await page.goto('http://localhost:5173/status');
    await expect(page.locator('h1')).toContainText('Milestone System Status');
    await expect(page.locator('text=All Systems Operational')).toBeVisible();
  });
});
