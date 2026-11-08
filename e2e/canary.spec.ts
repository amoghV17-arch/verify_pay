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
import type { FastifyInstance } from 'fastify';

test.describe('Automated Canary Test: Hardcode Purge & DOM Purity (LIVE_PROOF.md §1.5)', () => {
  let apiServer: FastifyInstance;
  let mockPayPal: MockPayPalAdapter;

  const CANARY_PROJECT_ID = 'proj_canary_zebra_133742';
  const CANARY_TITLE = 'Distributed Autonomous Drone Fleet Telemetry Engine';
  const CANARY_BRIEF = 'Build an event-driven telemetry stream engine for autonomous delivery drones using Rust and WebSockets.';
  const CANARY_CLIENT_NAME = 'Zebra Co';
  const CANARY_FREELANCER_NAME = 'Quill';

  // Deliberately unusual currency values (§1.5: budget 1337.42)
  const TOTAL_BUDGET_CENTS = 133742; // $1,337.42
  const MS1_CENTS = 60000;           // $600.00
  const MS2_CENTS = 73742;           // $737.42
  // Invariants:
  // MS1_CENTS + MS2_CENTS === TOTAL_BUDGET_CENTS (60000 + 73742 === 133742)
  // After releasing MS1: paid = 60000, held = 73742, funded = 133742

  const FORBIDDEN_OLD_LITERALS = [
    'Brand-site',
    'Acme',
    'Arjun',
    '$8,000',
    '$1,200',
    '$6,800',
  ];

  let clientToken: string;
  let freelancerToken: string;

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

    const { users, projects, milestones, deliverables, reviews, ledgerEntries } = schema;

    // Clean up any existing canary rows from previous runs
    await db.delete(deliverables).where(eq(deliverables.submittedBy, 'user_quill_freelancer')).catch(() => {});
    await db.delete(ledgerEntries).where(eq(ledgerEntries.projectId, CANARY_PROJECT_ID)).catch(() => {});
    await db.delete(projects).where(eq(projects.id, CANARY_PROJECT_ID)).catch(() => {});
    await db.delete(users).where(eq(users.id, 'user_zebra_client')).catch(() => {});
    await db.delete(users).where(eq(users.id, 'user_quill_freelancer')).catch(() => {});

    // 1. Create client and freelancer users
    await db.insert(users).values([
      {
        id: 'user_zebra_client',
        role: 'client',
        name: CANARY_CLIENT_NAME,
        email: 'billing@zebraco.test',
      },
      {
        id: 'user_quill_freelancer',
        role: 'freelancer',
        name: CANARY_FREELANCER_NAME,
        email: 'quill@freelancer.test',
      },
    ]);

    // 2. Create project
    await db.insert(projects).values({
      id: CANARY_PROJECT_ID,
      title: CANARY_TITLE,
      brief: CANARY_BRIEF,
      totalCents: TOTAL_BUDGET_CENTS,
      status: 'active',
      clientId: 'user_zebra_client',
      freelancerId: 'user_quill_freelancer',
      autonomyMode: 'manual',
      releaseWindowSeconds: 30,
      isDemo: false,
    });

    // 3. Create 2 milestones
    const ms1Id = 'ms_canary_01';
    const ms2Id = 'ms_canary_02';

    await db.insert(milestones).values([
      {
        id: ms1Id,
        projectId: CANARY_PROJECT_ID,
        name: 'Telemetry Ingestion Protocol & Schema',
        amountCents: MS1_CENTS,
        percent: 45,
        criteria: [{ id: 'crit_1', description: 'Binary protocol decoding meets 100k msg/sec throughput without drops' }],
        deliverableType: 'code_repo',
        status: 'paid',
      },
      {
        id: ms2Id,
        projectId: CANARY_PROJECT_ID,
        name: 'Real-time WebSocket PubSub Broker',
        amountCents: MS2_CENTS,
        percent: 55,
        criteria: [{ id: 'crit_2', description: 'PubSub fanout latency stays under 10ms at 50k concurrent listeners' }],
        deliverableType: 'url',
        status: 'funded',
      },
    ]);

    // 4. Record ledger funding and release
    const ledger = new LedgerService(db);
    await ledger.recordProjectFunding({
      projectId: CANARY_PROJECT_ID,
      captureId: 'cap_canary_133742',
      orderId: 'ord_canary_133742',
      amountCents: TOTAL_BUDGET_CENTS,
    });

    await db.insert(ledgerEntries).values({
      id: 'led_canary_release_ms1',
      projectId: CANARY_PROJECT_ID,
      milestoneId: ms1Id,
      type: 'released',
      amountCents: MS1_CENTS,
      paypalRef: 'batch_canary_ms1',
      idempotencyKey: 'release:ms_canary_01',
    });

    // 5. Create deliverable and passing review for MS1
    await db.insert(deliverables).values({
      id: 'deliv_canary_01',
      milestoneId: ms1Id,
      kind: 'code_repo',
      payload: { url: 'https://github.com/zebraco/drone-telemetry-engine' },
      submittedBy: 'user_quill_freelancer',
      submittedAt: new Date(),
    });

    await db.insert(reviews).values({
      id: 'rev_canary_01',
      milestoneId: ms1Id,
      deliverableId: 'deliv_canary_01',
      kind: 'initial',
      model: 'canary-evaluator',
      promptVersion: 'review.v1',
      trace: [{ info: 'Telemetry schema verified against criteria' }],
      criteriaResults: [{ id: 'crit_1', satisfied: true, reasoning: 'Decodes at wire speed' }],
      verdict: 'pass',
      minConfidence: 0.98,
      injectionSuspected: false,
      latencyMs: 120,
      tokens: { input: 1200, output: 250 },
    });

    // 6. Generate auth session tokens
    clientToken = await createSessionToken({
      userId: 'user_zebra_client',
      role: 'client',
      name: CANARY_CLIENT_NAME,
    });

    freelancerToken = await createSessionToken({
      userId: 'user_quill_freelancer',
      role: 'freelancer',
      name: CANARY_FREELANCER_NAME,
    });

    // 7. Start server
    mockPayPal = new MockPayPalAdapter({ defaultWebhookDelayMs: 0 });
    apiServer = buildServer(config, { paypalAdapter: mockPayPal });
    await apiServer.listen({ port: 8080, host: '127.0.0.1' });
  });

  test.afterAll(async () => {
    if (apiServer) {
      await apiServer.close();
    }
    await closeDb();
  });

  test('Mathematical financial invariant check (cents)', async () => {
    const db = getDb();
    const ledger = new LedgerService(db);
    const summary = await ledger.getProjectLedgerSummary(CANARY_PROJECT_ID);

    expect(summary.fundedCents).toBe(TOTAL_BUDGET_CENTS);
    expect(summary.releasedCents).toBe(MS1_CENTS);
    expect(summary.holdingBalanceCents).toBe(MS2_CENTS);
    expect(summary.refundedCents).toBe(0);

    // Invariant: holding + paid + refunded === funded
    expect(summary.holdingBalanceCents + summary.releasedCents + summary.refundedCents).toBe(summary.fundedCents);
  });

  test('Client pages reflect canary values with zero old demo literals in DOM', async ({ page, context }) => {
    await context.addCookies([
      {
        name: 'ms_client',
        value: clientToken,
        url: 'http://localhost:5173',
      },
    ]);

    await page.setViewportSize({ width: 1440, height: 900 });

    // 1. Client Project Overview
    await page.goto(`/client/projects/${CANARY_PROJECT_ID}`);
    await page.waitForLoadState('networkidle');

    // Assert exact project title, client name, and canary amounts
    await expect(page.locator('h1')).toContainText(CANARY_TITLE);
    await expect(page.locator(`text=${CANARY_CLIENT_NAME}`).first()).toBeVisible();
    await expect(page.locator('text=$1,337.42').first()).toBeVisible();
    await expect(page.locator('text=$600.00').first()).toBeVisible();
    await expect(page.locator('text=$737.42').first()).toBeVisible();

    // Verify milestone titles in schedule list
    await expect(page.locator('text=Telemetry Ingestion Protocol & Schema').first()).toBeVisible();
    await expect(page.locator('text=Real-time WebSocket PubSub Broker').first()).toBeVisible();

    // Assert zero old demo literals in DOM
    const overviewContent = await page.content();
    for (const literal of FORBIDDEN_OLD_LITERALS) {
      expect(overviewContent).not.toContain(literal);
    }

    // 2. Client Deliverables Page
    await page.goto(`/client/projects/${CANARY_PROJECT_ID}/deliverables`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=Telemetry Ingestion Protocol & Schema').first()).toBeVisible();
    await expect(page.locator('text=Real-time WebSocket PubSub Broker').first()).toBeVisible();

    const deliverablesContent = await page.content();
    for (const literal of FORBIDDEN_OLD_LITERALS) {
      expect(deliverablesContent).not.toContain(literal);
    }

    // 3. Client Payments Page
    await page.goto(`/client/projects/${CANARY_PROJECT_ID}/payments`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=$1,337.42').first()).toBeVisible();
    await expect(page.locator('text=$600.00').first()).toBeVisible();

    const paymentsContent = await page.content();
    for (const literal of FORBIDDEN_OLD_LITERALS) {
      expect(paymentsContent).not.toContain(literal);
    }
  });

  test('Freelancer pages reflect canary values with zero old demo literals in DOM', async ({ page, context }) => {
    // Clear cookies and set freelancer cookie
    await context.clearCookies();
    await context.addCookies([
      {
        name: 'ms_freelancer',
        value: freelancerToken,
        url: 'http://localhost:5173',
      },
    ]);

    await page.setViewportSize({ width: 1440, height: 900 });

    // 1. Freelancer Project Overview
    await page.goto(`/freelancer/projects/${CANARY_PROJECT_ID}`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toContainText(CANARY_TITLE);
    await expect(page.locator(`text=${CANARY_FREELANCER_NAME}`)).toBeVisible();
    await expect(page.locator('text=$600.00').first()).toBeVisible();
    await expect(page.locator('text=$737.42').first()).toBeVisible();
    await expect(page.locator('text=$1,337.42').first()).toBeVisible();

    const freelancerOverviewContent = await page.content();
    for (const literal of FORBIDDEN_OLD_LITERALS) {
      expect(freelancerOverviewContent).not.toContain(literal);
    }

    // 2. Freelancer Deliverables Page
    await page.goto(`/freelancer/projects/${CANARY_PROJECT_ID}/deliverables`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=Telemetry Ingestion Protocol & Schema').first()).toBeVisible();
    await expect(page.locator('text=Real-time WebSocket PubSub Broker').first()).toBeVisible();

    const freelancerDelivContent = await page.content();
    for (const literal of FORBIDDEN_OLD_LITERALS) {
      expect(freelancerDelivContent).not.toContain(literal);
    }

    // 3. Freelancer Payments Page
    await page.goto(`/freelancer/projects/${CANARY_PROJECT_ID}/payments`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=$600.00').first()).toBeVisible();

    const freelancerPaymentsContent = await page.content();
    for (const literal of FORBIDDEN_OLD_LITERALS) {
      expect(freelancerPaymentsContent).not.toContain(literal);
    }
  });
});

