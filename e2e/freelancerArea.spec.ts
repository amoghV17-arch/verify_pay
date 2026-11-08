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

test.describe('Phase P5: Freelancer Area Suite', () => {
  let testEnv: TestServerContext;

  test.beforeAll(async () => {
    testEnv = await startTestServer();
    const screensDir = path.resolve(process.cwd(), 'docs/screens/p5');
    if (!fs.existsSync(screensDir)) {
      fs.mkdirSync(screensDir, { recursive: true });
    }
  });

  test.afterAll(async () => {
    await testEnv.stop();
  });

  // =========================================================
  // 1. Join Flow - Code Input (/join)
  // =========================================================
  test('Freelancer join flow code input page renders lookup and sample code', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/join');

    await expect(page.getByRole('heading', { name: 'Join a project agreement' })).toBeVisible();
    await expect(page.locator('input[placeholder="e.g. MILE-XXXXXXXXXX"]')).toBeVisible();

    // Verify sample invite button
    const sampleBtn = page.getByRole('button', { name: 'Try sample invite code: MILE-MOCKINVITE' });
    await expect(sampleBtn).toBeVisible();

    for (const bp of BREAKPOINTS) {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.waitForTimeout(200);
      await page.screenshot({
        path: `docs/screens/p5/freelancer-join-input-${bp.name}.png`,
        fullPage: true,
      });
    }
  });

  // =========================================================
  // 2. Join Flow - Preview & Acceptance (/join/:token)
  // =========================================================
  test('Freelancer join preview renders project details, criteria, and acceptance form', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/join/MILE-MOCKINVITE');

    await expect(page.getByRole('heading', { name: 'Project Agreement Invitation' })).toBeVisible();
    await expect(page.locator('text=Brand-site Redesign & Launch')).toBeVisible();
    await expect(page.locator('text=Agreed Milestones & Acceptance Criteria')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accept invitation & Start' })).toBeVisible();

    for (const bp of BREAKPOINTS) {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.waitForTimeout(200);
      await page.screenshot({
        path: `docs/screens/p5/freelancer-join-preview-${bp.name}.png`,
        fullPage: true,
      });
    }
  });

  // =========================================================
  // 3. Freelancer Projects List (/freelancer)
  // =========================================================
  test('Freelancer projects list renders top quick-join input, project rows with locked/earned figures', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/freelancer');

    await expect(page.getByRole('heading', { name: 'Freelancer Projects' })).toBeVisible();
    await expect(page.locator('input[placeholder="e.g. MILE-XXXXXXXXXX"]')).toBeVisible();

    // Check project row
    const projectRow = page.locator('text=Brand-site Redesign & Launch').first();
    await expect(projectRow).toBeVisible();

    for (const bp of BREAKPOINTS) {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.waitForTimeout(200);
      await page.screenshot({
        path: `docs/screens/p5/freelancer-projects-${bp.name}.png`,
        fullPage: true,
      });
    }
  });

  // =========================================================
  // 4. Freelancer Overview (/freelancer/projects/:id)
  // =========================================================
  test('Freelancer overview renders Next Up card, LifecycleProgress, and financial hierarchy', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/freelancer/projects/proj_brand_launch');

    // Header & Next Up Card
    await expect(page.locator('h1')).toContainText('Brand-site Redesign & Launch');
    await expect(page.locator('text=Next Up for Delivery')).toBeVisible();
    await expect(page.locator('text=Funded and locked. You can start')).toBeVisible();

    // Financial hierarchy: Large "Locked for you" & "Earned"
    await expect(page.locator('text=Locked for you')).toBeVisible();
    await expect(page.locator('text=Earned to Date')).toBeVisible();

    for (const bp of BREAKPOINTS) {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.waitForTimeout(200);
      await page.screenshot({
        path: `docs/screens/p5/freelancer-overview-${bp.name}.png`,
        fullPage: true,
      });
    }
  });

  // =========================================================
  // 5. Freelancer Deliverables (/freelancer/projects/:id/deliverables)
  // =========================================================
  test('Freelancer deliverables renders milestone cards, review status, and opens slide-over drawer', async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/freelancer/projects/proj_brand_launch/deliverables');

    await expect(page.getByRole('heading', { name: 'My Deliverables & AI Reviews' })).toBeVisible();
    await expect(page.locator('text=Brand Strategy Approved')).toBeVisible();

    for (const bp of BREAKPOINTS) {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.waitForTimeout(200);
      await page.screenshot({
        path: `docs/screens/p5/freelancer-deliverables-${bp.name}.png`,
        fullPage: true,
      });
    }

    // Open submit slide-over drawer
    const submitBtn = page.getByRole('button', { name: 'Submit deliverable' }).first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(300);

      await expect(page.locator('text=Submit for AI review')).toBeVisible();

      // Capture drawer screenshots
      for (const bp of BREAKPOINTS) {
        await page.setViewportSize({ width: bp.width, height: bp.height });
        await page.waitForTimeout(200);
        await page.screenshot({
          path: `docs/screens/p5/freelancer-submit-slideover-${bp.name}.png`,
        });
      }

      // Close drawer
      const closeBtn = page.locator('button[aria-label="Close submission drawer"]');
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      }
    }
  });

  // =========================================================
  // 6. Freelancer Payments (/freelancer/projects/:id/payments)
  // =========================================================
  test('Freelancer payments renders top totals (Earned, Locked for you), settlement breakdown, and receipts', async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/freelancer/projects/proj_brand_launch/payments');

    await expect(page.getByRole('heading', { name: 'Payments & Earnings' })).toBeVisible();
    await expect(page.locator('span:text-is("Earned")')).toBeVisible();
    await expect(page.locator('span:text-is("Locked for you")')).toBeVisible();
    await expect(page.locator('span:text-is("Total agreement")')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Milestone Settlement Breakdown' })).toBeVisible();

    // Verify PayPal transaction ID and Receipt button
    const receiptBtn = page.getByRole('button', { name: 'Receipt' }).first();
    if (await receiptBtn.isVisible()) {
      await receiptBtn.click();
      await expect(page.getByRole('heading', { name: 'Payment Settlement Receipt' })).toBeVisible();
      const doneBtn = page.getByRole('button', { name: 'Done' });
      await doneBtn.click();
    }

    for (const bp of BREAKPOINTS) {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.waitForTimeout(200);
      await page.screenshot({
        path: `docs/screens/p5/freelancer-payments-${bp.name}.png`,
        fullPage: true,
      });
    }
  });
});
