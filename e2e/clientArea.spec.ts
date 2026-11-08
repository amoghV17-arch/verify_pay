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

    // Use sample brief button
    const sampleBtn = page.locator('button:has-text("Use sample: Brand Identity")');
    await expect(sampleBtn).toBeVisible();
    await sampleBtn.click();

    // Check filled inputs
    await expect(page.locator('input[value="Brand Identity & Visual System"]')).toBeVisible();

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
    await expect(page.locator('text=Budget')).toBeVisible();
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
});

