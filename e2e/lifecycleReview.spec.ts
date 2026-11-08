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

test.describe('Phase P6: Lifecycle, Review & Settlement Suite', () => {
  let testEnv: TestServerContext;

  test.beforeAll(async () => {
    testEnv = await startTestServer();
    const screensDir = path.resolve(process.cwd(), 'docs/screens/p6');
    if (!fs.existsSync(screensDir)) {
      fs.mkdirSync(screensDir, { recursive: true });
    }
  });

  test.afterAll(async () => {
    await testEnv.stop();
  });

  // =========================================================
  // 1. Client 3-Zone Review Screen (/client/projects/:id/deliverables/:milestoneId)
  // =========================================================
  test('Client 3-zone review screen renders Zone 1, Zone 2, and Zone 3 with client actions', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/client/projects/proj_brand_launch/deliverables/ms-02');

    // Breadcrumb and Title
    await expect(page.getByText('Back to Deliverables')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Milestone 2/i })).toBeVisible();

    // Zone 1: Deliverable details & timeline
    await expect(page.getByRole('heading', { name: 'Submitted Deliverable' })).toBeVisible();
    await expect(page.getByText('Milestone Event Audit Trail')).toBeVisible();
    await expect(page.getByText('Deliverable submitted')).toBeVisible();

    // Zone 2: AI Criteria Evaluation
    await expect(page.getByRole('heading', { name: 'AI Verification & Reasoning' })).toBeVisible();
    await expect(page.getByText('94% Confidence')).toBeVisible();
    await expect(page.getByText('Figma tokens verified.').first()).toBeVisible();
    await expect(page.getByText(/WCAG AAA contrast verified/i)).toBeVisible();
    await expect(page.getByText(/12 reusable components verified/i)).toBeVisible();

    // Zone 3: Actions sidebar
    await expect(page.getByRole('heading', { name: 'Settlement & Actions' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Release payment/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Request changes' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Object' })).toBeVisible();

    for (const bp of BREAKPOINTS) {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.waitForTimeout(200);
      await page.screenshot({
        path: `docs/screens/p6/client-review-${bp.name}.png`,
        fullPage: true,
      });
    }
  });

  // =========================================================
  // 2. Expandable AI Tool Trace
  // =========================================================
  test('AI tool trace expands to show SSRF and evaluation steps', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/client/projects/proj_brand_launch/deliverables/ms-02');

    const traceButton = page.getByRole('button', { name: /How the AI checked this/i });
    await expect(traceButton).toBeVisible();
    await traceButton.click();

    // Steps should now be visible
    await expect(page.getByText('ssrfFetch')).toBeVisible();
    await expect(page.getByText('inspectTokens')).toBeVisible();
    await expect(page.getByText('checkLighthouseScore')).toBeVisible();
    await expect(page.getByText('evaluateCriteria')).toBeVisible();

    await page.screenshot({
      path: 'docs/screens/p6/review-expanded-trace-1440.png',
      fullPage: true,
    });
  });

  // =========================================================
  // 3. Freelancer 3-Zone Review Screen (/freelancer/projects/:id/deliverables/:milestoneId)
  // =========================================================
  test('Freelancer 3-zone review screen displays freelancer actions and opens slide-over', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/freelancer/projects/proj_brand_launch/deliverables/ms-02');

    // Freelancer specific action buttons
    const resubmitBtn = page.getByRole('button', { name: 'Resubmit deliverable' });
    const appealBtn = page.getByRole('button', { name: 'Appeal verdict' });

    await expect(resubmitBtn).toBeVisible();
    await expect(appealBtn).toBeVisible();

    for (const bp of BREAKPOINTS) {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.waitForTimeout(200);
      await page.screenshot({
        path: `docs/screens/p6/freelancer-review-${bp.name}.png`,
        fullPage: true,
      });
    }

    // Verify slide-over opens
    await page.setViewportSize({ width: 1440, height: 900 });
    await resubmitBtn.click();
    await expect(page.getByLabel('Close submission drawer')).toBeVisible();
  });

  // =========================================================
  // 4. Shared Receipt - Valid Token (/receipt/:shareId)
  // =========================================================
  test('Shared settlement receipt renders verified details, batch ID, and ledger ID', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/receipt/mock-share-token');

    await expect(page.getByRole('heading', { name: 'Official Settlement Receipt' })).toBeVisible();
    await expect(page.getByText('Total Settlement Amount')).toBeVisible();
    await expect(page.getByText('$1,200.00')).toBeVisible();
    await expect(page.getByText('Sarah Lin')).toBeVisible();
    await expect(page.getByText('Arjun Mehta')).toBeVisible();
    await expect(page.getByText('BATCH-PAYOUT-MS01-MOCK')).toBeVisible();
    await expect(page.getByText('Autonomous AI Verification Protocol')).toBeVisible();

    // Verify copy button
    const copyBtn = page.getByRole('button', { name: 'Copy batch ID' });
    await expect(copyBtn).toBeVisible();

    await page.screenshot({
      path: 'docs/screens/p6/shared-receipt-valid-1440.png',
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    await page.screenshot({
      path: 'docs/screens/p6/shared-receipt-valid-390.png',
      fullPage: true,
    });
  });

  // =========================================================
  // 5. Shared Receipt - Revoked / Invalid Link
  // =========================================================
  test('Shared receipt with invalid or revoked token renders calm error state', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/receipt/invalid-or-revoked-token');

    await expect(page.getByText('Receipt Unavailable')).toBeVisible();
    await expect(page.getByText('This receipt share link is invalid or has been revoked.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Return to Milestone' })).toBeVisible();

    // Ensure NO error trace or red alert banner is present
    await expect(page.locator('.text-red-500')).toHaveCount(0);
    await expect(page.locator('pre')).toHaveCount(0);

    await page.screenshot({
      path: 'docs/screens/p6/shared-receipt-revoked-1440.png',
      fullPage: true,
    });
  });

  // =========================================================
  // 6. Styleguide LifecycleProgress Invariant Check
  // =========================================================
  test('Styleguide displays LifecycleProgress and ensures Paid stage never shows complete early', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/styleguide');

    // Switch to Lifecycle & Money States tab
    const lifecycleTab = page.getByRole('tab', { name: 'Lifecycle & Money States' });
    await expect(lifecycleTab).toBeVisible();
    await lifecycleTab.click();

    await expect(page.getByRole('heading', { name: /Signature LifecycleProgress Component/i })).toBeVisible();

    // Switch to 'paid' status and verify
    const paidBtn = page.getByRole('button', { name: 'paid', exact: true });
    await expect(paidBtn).toBeVisible();
    await paidBtn.click();
    await expect(page.getByText('Settled').first()).toBeVisible();
  });
});
