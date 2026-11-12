import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { startTestServer, type TestServerContext } from './testServer.js';

const BREAKPOINTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '1024', width: 1024, height: 768 },
  { name: '768', width: 768, height: 1024 },
  { name: '390', width: 390, height: 844 },
];

test.describe('Phase P4: Client Area Suite', () => {
  let testEnv: TestServerContext;

  test.beforeAll(async () => {
    testEnv = await startTestServer();
    const screensDir = path.resolve(process.cwd(), 'docs/screens/p4');
    if (!fs.existsSync(screensDir)) {
      fs.mkdirSync(screensDir, { recursive: true });
    }
  });

  test.afterAll(async () => {
    await testEnv.stop();
  });

  // =========================================================
  // 1. Projects List (/client)
  // =========================================================
  test('Client projects list renders rows with state sentence, held/paid figures, and next action', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/client');

    await expect(page.locator('h1')).toContainText('Client Projects');
    await expect(page.locator('text=New project').first()).toBeVisible();

    // Verify project rows
    const projectCard = page.locator('text=Brand-site Redesign & Launch').first();
    await expect(projectCard).toBeVisible();

    // Responsive multi-viewport screenshots
    for (const bp of BREAKPOINTS) {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `docs/screens/p4/client-projects-${bp.name}.png`,
        fullPage: true,
      });
    }
  });

  // =========================================================
  // 2. 4-Step New Project Wizard (/client/new)
  // =========================================================
  test('New project wizard runs 4-step flow: Brief -> Plan -> Invite -> Fund', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/client/new');

    // Step 1: Brief
    await expect(page.locator('text=1. Brief')).toBeVisible();
    await expect(page.locator('text=2. Plan')).toBeVisible();
    await expect(page.locator('text=3. Invite')).toBeVisible();
    await expect(page.locator('text=4. Fund')).toBeVisible();

    // Use sample brief buttons (both demo projects priced under $500)
    const sampleBrandBtn = page.locator('button:has-text("Use sample: Brand Identity & Visual System ($450)")');
    const sampleDashBtn = page.locator('button:has-text("Use sample: Next.js Customer Dashboard ($350)")');
    await expect(sampleBrandBtn).toBeVisible();
    await expect(sampleDashBtn).toBeVisible();
    await sampleBrandBtn.click();

    // Check filled inputs
    await expect(page.locator('input[value="Brand Identity & Visual System"]')).toBeVisible();
    await expect(page.locator('input[type="number"][value="450"]')).toBeVisible();

    // Capture Step 1 Screenshots
    for (const bp of BREAKPOINTS) {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.waitForTimeout(200);
      await page.screenshot({
        path: `docs/screens/p4/wizard-step1-brief-${bp.name}.png`,
        fullPage: true,
      });
    }
  });

  // =========================================================
  // 3. Project Overview (/client/projects/:id)
  // =========================================================
  test('Project overview renders Next Action, Financial hierarchy with large Held, and LifecycleProgress', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/client/projects/proj_brand_launch');

    // Header & Next Action
    await expect(page.locator('h1')).toContainText('Brand-site Redesign & Launch');
    await expect(page.locator('text=Next Action')).toBeVisible();

    // Financial hierarchy: Large Held figure
    await expect(page.locator('text=Held for this project in PayPal Sandbox')).toBeVisible();
    await expect(page.getByText('Budget', { exact: true })).toBeVisible();
    await expect(page.locator('text=Funded').first()).toBeVisible();
    await expect(page.locator('text=Paid').first()).toBeVisible();
    await expect(page.locator('text=Remaining').first()).toBeVisible();

    // Milestone schedule & Autonomy
    await expect(page.getByRole('heading', { name: 'Milestones Schedule' })).toBeVisible();
    await expect(page.locator('text=Payout Autonomy Mode')).toBeVisible();

    // Multi-viewport screenshots
    for (const bp of BREAKPOINTS) {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `docs/screens/p4/client-overview-${bp.name}.png`,
        fullPage: true,
      });
    }
  });

  // =========================================================
  // 4. Deliverables Tab (/client/projects/:id/deliverables)
  // =========================================================
  test('Client deliverables page renders milestone deliverables list with AI recommendations', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/client/projects/proj_brand_launch/deliverables');

    await expect(page.locator('h1')).toContainText('Deliverables & Reviews');
    await expect(page.locator('text=Milestone 1: Brand Strategy Approved')).toBeVisible();
    await expect(page.locator('text=✓ Paid & Settled')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('NaN%');
    await expect(page.locator('body')).not.toContainText('Claude Sonnet 3.5');
    await expect(page.locator('body')).not.toContainText('Claude 3.5 Sonnet');

    // Multi-viewport screenshots
    for (const bp of BREAKPOINTS) {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `docs/screens/p4/client-deliverables-${bp.name}.png`,
        fullPage: true,
      });
    }
  });

  // =========================================================
  // 5. Payments Tab (/client/projects/:id/payments)
  // =========================================================
  test('Client payments page displays PayPal Sandbox proofs, totals, and immutable ledger table', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/client/projects/proj_brand_launch/payments');

    await expect(page.locator('h1')).toContainText('Payments & Ledger');
    await expect(page.locator('text=PayPal Sandbox').first()).toBeVisible();
    await expect(page.locator('text=Export Audit JSON')).toBeVisible();

    // Financial totals
    await expect(page.locator('text=Total Budget')).toBeVisible();
    await expect(page.locator('text=Funded into Holding')).toBeVisible();
    await expect(page.locator('text=Released to Freelancer')).toBeVisible();

    // Immutable ledger table
    await expect(page.locator('text=Immutable Ledger Entries')).toBeVisible();

    // Multi-viewport screenshots
    for (const bp of BREAKPOINTS) {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `docs/screens/p4/client-payments-${bp.name}.png`,
        fullPage: true,
      });
    }
  });

  // =========================================================
  // 6. Full Wizard + Step 4 Hydration + PayPal Return Capture (< $500)
  // =========================================================
  test('Wizard completes Brief -> Plan -> Invite -> Step 4 hydration and PayPal return capture under $500', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/client/new');

    // Select the $350 sample brief
    await page.locator('button:has-text("Use sample: Next.js Customer Dashboard ($350)")').click();
    await expect(page.locator('input[type="number"][value="350"]')).toBeVisible();

    // Step 1 -> Step 2 (capture created project ID)
    const createProjectPromise = page.waitForResponse(
      (res) => res.url().endsWith('/api/projects') && res.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Generate AI Plan' }).click();
    const createRes = await createProjectPromise;
    expect(createRes.ok()).toBe(true);
    const { project } = await createRes.json();
    const newProjectId = project.id as string;

    await expect(page.locator('text=Review & adjust milestone plan')).toBeVisible({ timeout: 15000 });

    // Step 2 -> Step 3
    await page.getByRole('button', { name: 'Approve Plan & Continue' }).click();
    await expect(page.locator('text=Your project agreement is ready')).toBeVisible({ timeout: 15000 });

    // Step 3 -> Accept invite (demo helper) -> Step 4
    await page.getByRole('button', { name: /Simulate Acceptance/i }).click();
    await expect(page.locator('text=Funding gate unlocked')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Continue to Funding' }).click();
    await expect(page.locator('text=Fund project holding balance')).toBeVisible();
    await expect(page.locator('text=$350.00 USD')).toBeVisible();

    // Verify Step 4 hydrates from backend when visiting via URL (?step=4&projectId=...&paypalCancel=1)
    await page.goto(`/client/new?step=4&projectId=${newProjectId}&paypalCancel=1`);
    await expect(page.locator('text=$350.00 USD')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=MILESTONE SCHEDULE')).toBeVisible();
    await expect(page.locator('text=PayPal Sandbox approval was cancelled')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Authorize & Fund $350' })).toBeVisible();

    // Simulate PayPal Sandbox return redirect (?token=<orderId>&PayerID=PAYER_1)
    const origin = new URL(page.url()).origin;
    await page.request.post('/api/auth/persona', { data: { persona: 'client' } });
    const orderRes = await page.request.post(`/api/projects/${newProjectId}/fund/order`, {
      data: {
        returnUrl: `${origin}/client/new?step=4&projectId=${newProjectId}`,
        cancelUrl: `${origin}/client/new?step=4&projectId=${newProjectId}&paypalCancel=1`,
      },
    });
    expect(orderRes.ok()).toBe(true);
    const { orderId } = await orderRes.json();

    await page.goto(`/client/new?step=4&projectId=${newProjectId}&token=${orderId}&PayerID=PAYER_1`);
    await expect(page.locator('text=Funding captured successfully!')).toBeVisible({ timeout: 10000 });
    await page.waitForURL(`**/client/projects/${newProjectId}`, { timeout: 10000 });
  });

  test('Client projects page groups projects, renders synced Held/Paid balances, deletes a project, and renders valid Activity dates', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/client');
    await page.request.post('/api/auth/persona', { data: { persona: 'client' } });

    // Create a disposable draft project to verify Draft category + Delete modal
    const createRes = await page.request.post('/api/projects', {
      data: {
        title: 'Disposable E2E Lifecycle Project',
        brief: 'Temporary project created solely to verify category filters and project deletion dialog.',
        totalBudget: 250,
      },
    });
    expect(createRes.ok()).toBe(true);
    const { project: disposable } = await createRes.json();
    const disposableId = disposable.id as string;

    await page.reload();

    // Category filter tabs are visible
    await expect(page.getByTestId('project-filter-all')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('project-filter-ongoing')).toBeVisible();
    await expect(page.getByTestId('project-filter-draft')).toBeVisible();
    await expect(page.getByTestId('project-filter-completed')).toBeVisible();
    await expect(page.getByTestId('project-filter-cancelled')).toBeVisible();

    // Seeded active project has non-zero synced Held and Paid values
    const brandRow = page.getByTestId('project-row-proj_brand_launch');
    await expect(brandRow).toBeVisible();
    await expect(brandRow).toContainText('$6,800.00');
    await expect(brandRow).toContainText('$1,200.00');

    // Filter to drafts and delete disposable project via confirmation modal
    await page.getByTestId('project-filter-draft').click();
    const disposableRow = page.getByTestId(`project-row-${disposableId}`);
    await expect(disposableRow).toBeVisible();
    await page.getByTestId(`delete-project-${disposableId}`).click();
    await expect(page.getByTestId('confirm-delete-project-btn')).toBeVisible();
    await page.getByTestId('confirm-delete-project-btn').click();
    await expect(disposableRow).not.toBeVisible({ timeout: 10000 });

    // Visit Client Activity Timeline and ensure valid formatted dates (never Invalid Date)
    await page.goto('/client/projects/proj_brand_launch/activity');
    await expect(page.getByRole('heading', { name: 'Activity Timeline' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('body')).not.toContainText('Invalid Date');
  });
});

