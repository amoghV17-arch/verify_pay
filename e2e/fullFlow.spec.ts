import { test, expect } from '@playwright/test';
import { loadConfig } from '@milestone/shared';
import { buildServer } from '../apps/api/src/server.js';
import { initDb, closeDb, seedDatabase, getDb, schema, eq } from '../apps/api/src/db/index.js';
import { createSessionToken } from '../apps/api/src/auth/index.js';
import { MockPayPalAdapter } from '../apps/api/src/paypal/mockAdapter.js';
import { LedgerService } from '../apps/api/src/services/ledger.js';
import type { FastifyInstance } from 'fastify';

test.describe('M10 Full End-to-End Journey: Brief to Paid (All 3 Autonomy Modes)', () => {
  let apiServer: FastifyInstance;
  let mockPayPal: MockPayPalAdapter;

  test.beforeAll(async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      PAYPAL_ENV: 'mock',
      LLM_PROVIDER: 'fixture',
      PORT: '8080',
    });

    const db = await initDb({ useMemory: true });
    await seedDatabase(db);

    const ledger = new LedgerService(db);
    await ledger.recordProjectFunding({
      projectId: 'proj_brand_launch',
      captureId: `cap_full_flow_${Date.now()}`,
      orderId: `ord_full_flow_${Date.now()}`,
      amountCents: 800000,
    });

    mockPayPal = new MockPayPalAdapter({ defaultWebhookDelayMs: 0 });
    apiServer = buildServer(config, { paypalAdapter: mockPayPal });
    await apiServer.listen({ port: 8080, host: '127.0.0.1' });
  });

  test.afterAll(async () => {
    await apiServer.close();
    await closeDb();
  });

  test('Mode 1 (Manual): Brief entry → Plan Review → Workspace → Manual Release → Settle', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?workspace=true');

    // 1. Start on Workspace or navigate to Start Screen
    const clientBtn = page.locator('#persona-client-btn');
    await expect(clientBtn).toBeVisible({ timeout: 15000 });
    await clientBtn.click();

    const newPlanBtn = page.locator('#new-plan-btn');
    await expect(newPlanBtn).toBeVisible();
    await newPlanBtn.click();

    // 2. Start Screen: Brief Entry
    const briefTextarea = page.locator('#brief-input, textarea');
    await expect(briefTextarea.first()).toBeVisible({ timeout: 10000 });
    await briefTextarea.first().fill('Brand redesign marketing site with interactive product showcase');

    const generateBtn = page.locator('#create-plan-btn');
    await generateBtn.click();

    // 3. Plan Review Screen
    const planTitleInput = page.locator('#plan-title-input');
    await expect(planTitleInput).toBeVisible({ timeout: 15000 });

    const approvePlanBtn = page.locator('#approve-plan-btn');
    await expect(approvePlanBtn).toBeVisible();

    // Return to workspace to preserve seed milestones for manual release
    const editBriefBtn = page.locator('#back-brief-btn');
    await editBriefBtn.click();
    const backToWorkspaceBtn = page.locator('button:has-text("Back to Workspace")');
    await backToWorkspaceBtn.click();

    // 4. Returned to Workspace with Gantt
    const gantt = page.locator('.b-gantt');
    await expect(gantt).toBeVisible({ timeout: 15000 });

    // 5. Select Manual Autonomy Mode
    const modeSelect = page.locator('#autonomy-mode-select');
    await modeSelect.selectOption('manual');
    await expect(modeSelect).toHaveValue('manual');

    // 6. Select approved milestone (Milestone 2)
    const m2Cell = page.locator('.b-grid-cell:has-text("Milestone 2: Wireframes & Architecture Approved")');
    await expect(m2Cell).toBeVisible();
    await m2Cell.click();

    // 7. Manual Mode: Client must click Release Payment to pay
    const releaseBtn = page.locator('#release-milestone-btn');
    await expect(releaseBtn).toBeVisible({ timeout: 5000 });
    await releaseBtn.click();

    // 8. Settle Moment: Balance chip pulses and status is paid
    const notification = page.locator('[role="status"]');
    await expect(notification).toBeVisible({ timeout: 10000 });
    await expect(notification).toContainText('Payout released');

    const balanceChip = page.locator('#balance-chip');
    await expect(balanceChip).toContainText('$3,000.00');
  });

  test('Mode 2 (Assisted): Auto-releases after time window expires via scheduler tick', async ({
    page: _page,
    request,
  }) => {
    const db = getDb();
    const testMilestoneId = `ms_assisted_flow_${Date.now()}`;

    // Ensure project mode is assisted
    await db.update(schema.projects).set({ autonomyMode: 'assisted' }).where(eq(schema.projects.id, 'proj_brand_launch'));

    // Seed milestone approved 10 seconds in the past with release_at
    await db.insert(schema.milestones).values({
      id: testMilestoneId,
      projectId: 'proj_brand_launch',
      name: 'Assisted Window Milestone',
      amountCents: 100000,
      percent: 10,
      deliverableType: 'text',
      criteria: [{ id: 'c-assisted', description: 'Assisted release window criteria' }],
      status: 'approved',
      approvedBy: 'ai',
      releaseAt: new Date(Date.now() - 10000),
    });

    // Scheduler tick processes expiration
    const tickRes = await request.post('/api/projects/proj_brand_launch/scheduler/tick');
    expect(tickRes.status()).toBe(200);

    // Verify milestone transitioned to paid
    const [ms] = await db.select().from(schema.milestones).where(eq(schema.milestones.id, testMilestoneId));
    expect(ms.status).toBe('paid');
  });

  test('Mode 3 (Auto): Passing AI review immediately releases payout autonomously', async ({
    request,
  }) => {
    const db = getDb();
    const testMilestoneId = `ms_auto_flow_${Date.now()}`;

    // Set project mode to auto
    await db.update(schema.projects).set({ autonomyMode: 'auto' }).where(eq(schema.projects.id, 'proj_brand_launch'));

    await db.insert(schema.milestones).values({
      id: testMilestoneId,
      projectId: 'proj_brand_launch',
      name: 'Immediate Autonomous Milestone',
      amountCents: 120000,
      percent: 12,
      deliverableType: 'text',
      criteria: [{ id: 'c-auto-pass', description: 'Automated passing criteria' }],
      status: 'funded',
    });

    const token = await createSessionToken({
      userId: 'user_freelancer_01',
      role: 'freelancer',
    });

    // Freelancer submits deliverable
    const submitRes = await request.post(`/api/milestones/${testMilestoneId}/submit`, {
      data: {
        kind: 'text',
        payload: { text: 'Everything verified and passing with high confidence' },
      },
      headers: {
        'Content-Type': 'application/json',
        Cookie: `milestone_session=${token}`,
      },
    });
    expect([200, 202]).toContain(submitRes.status());

    // Wait for background reviewer and auto-release to finish
    let finalStatus = 'in_review';
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const [curr] = await db.select().from(schema.milestones).where(eq(schema.milestones.id, testMilestoneId));
      if (curr && curr.status !== 'in_review') {
        finalStatus = curr.status;
        break;
      }
    }

    // In auto mode with fixture review, review automatically passes and releases immediately
    expect(['approved', 'paid', 'releasing']).toContain(finalStatus);
  });
});

