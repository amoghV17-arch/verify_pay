import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'fs';
import path from 'path';

const BREAKPOINTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '1024', width: 1024, height: 768 },
  { name: '768', width: 768, height: 1024 },
  { name: '390', width: 390, height: 844 },
];

test.describe('Phase P2: Public Marketing and Entry Suite', () => {
  test.beforeAll(() => {
    const screensDir = path.resolve(process.cwd(), 'docs/screens/p2');
    if (!fs.existsSync(screensDir)) {
      fs.mkdirSync(screensDir, { recursive: true });
    }
  });

  // =========================================================
  // 1. Landing Page (/) Tests
  // =========================================================
  test('Landing page renders all 7 narrative sections and satisfies accessibility at 1440px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    // 1. Header & Navigation
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('header')).toContainText('Milestone');
    await expect(page.locator('header')).toContainText('How it works');
    await expect(page.locator('header')).toContainText('For clients');
    await expect(page.locator('header')).toContainText('For freelancers');
    await expect(page.locator('header')).toContainText('Safety');
    await expect(page.locator('header')).toContainText('Get started');
    await expect(page.locator('header')).toContainText('Join a project');

    // 2. Section 1: Hero
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();
    await expect(h1).toContainText('Good work deserves a clear agreement.');
    await expect(page.locator('text=Sandbox prototype. No real money moves.').first()).toBeVisible();

    // 3. ProductPreview
    const preview = page.locator('[role="region"][aria-label="Milestone product preview demonstration"]');
    await expect(preview).toBeVisible();
    await expect(preview).toContainText(/Sample project/i);
    await expect(preview).toContainText(/Interactive prototype/i);
    await expect(preview).toContainText('$2,400.00');

    // 4. Section 2: TimelineSection
    const timelineHeading = page.locator('h2:has-text("One agreement, every milestone.")');
    await expect(timelineHeading).toBeVisible();
    await expect(page.locator('text=Total agreement budget')).toBeVisible();

    // 5. Section 3: Proof to payment
    const proofHeading = page.locator('h2:has-text("Proof to Payment"), h2:has-text("From agreed proof to instant payout.")');
    await expect(proofHeading.first()).toBeVisible();

    // 6. Section 4: Two Roles Section
    const rolesHeading = page.locator('h2:has-text("Two roles, one agreement.")');
    await expect(rolesHeading).toBeVisible();
    const roleToggle = page.locator('[role="tablist"][aria-label="Select role perspective to preview"]');
    await expect(roleToggle).toBeVisible();

    // Switch to freelancer perspective
    await page.locator('button[role="tab"]:has-text("I\'m delivering work")').click();
    await expect(page.locator('text=Locked for your work')).toBeVisible();

    // 7. Section 5: Proof before payment
    const reviewHeading = page.locator('h2:has-text("Proof before payment.")');
    await expect(reviewHeading).toBeVisible();
    await expect(page.locator('text=Prompt injection defense')).toBeVisible();
    await expect(page.locator('text=Instructions found inside a delivery were ignored.')).toBeVisible();

    // 8. Section 6: Built for trust & Sample ledger
    const trustHeading = page.locator('h2:has-text("Built for trust.")');
    await expect(trustHeading).toBeVisible();
    await expect(page.locator('text=Sample Project Ledger')).toBeVisible();
    await expect(page.locator('text=Sample ledger')).toBeVisible();

    // 9. Section 7: Final CTA & Footer
    const finalCta = page.locator('h2:has-text("Make every milestone count.")');
    await expect(finalCta).toBeVisible();
    await expect(page.locator('footer')).toContainText('Milestone');

    // Accessibility check: 0 critical or serious violations
    const a11y = await new AxeBuilder({ page }).analyze();
    const serious = a11y.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(serious).toEqual([]);
  });

  // =========================================================
  // 2. Multi-Resolution Screenshots for Landing Page (/)
  // =========================================================
  for (const bp of BREAKPOINTS) {
    test(`captures landing page screenshot at ${bp.name}px`, async ({ page }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto('/');
      await page.waitForTimeout(600);
      await page.screenshot({
        path: `docs/screens/p2/landing-${bp.name}.png`,
        fullPage: true,
      });
    });
  }

  // =========================================================
  // 3. Role Selection (/get-started) Tests & Screenshots
  // =========================================================
  test('Role selection page (/get-started) renders two distinct cards and passes axe', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/get-started');

    await expect(page.locator('h1')).toContainText('How will you use Milestone?');
    await expect(page.locator('h2:has-text("I\'m hiring")')).toBeVisible();
    await expect(page.locator('h2:has-text("I\'m delivering work")')).toBeVisible();
    await expect(page.locator('text=Create a client account')).toBeVisible();
    await expect(page.locator('text=Create a freelancer account')).toBeVisible();

    // Accessibility check
    const a11y = await new AxeBuilder({ page }).analyze();
    const serious = a11y.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(serious).toEqual([]);
  });

  for (const bp of BREAKPOINTS) {
    test(`captures /get-started screenshot at ${bp.name}px`, async ({ page }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto('/get-started');
      await page.waitForTimeout(400);
      await page.screenshot({
        path: `docs/screens/p2/get-started-${bp.name}.png`,
        fullPage: true,
      });
    });
  }

  // =========================================================
  // 4. Safety Page (/safety) Tests & Screenshots
  // =========================================================
  test('Safety page (/safety) renders all honest disclosures and passes axe', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/safety');

    await expect(page.locator('h1')).toContainText('Safety and prototype limits');
    await expect(page.locator('h2:has-text("1. How funds are held")')).toBeVisible();
    await expect(page.locator('h2:has-text("2. What the AI reviewer does")')).toBeVisible();
    await expect(page.locator('h2:has-text("3. Prompt injection and SSRF defenses")')).toBeVisible();
    await expect(page.locator('h2:has-text("4. Reviewer autonomy modes")')).toBeVisible();
    await expect(page.locator('h2:has-text("5. The audit trail")')).toBeVisible();
    await expect(page.locator('h2:has-text("6. Prototype limitations")')).toBeVisible();

    // Accessibility check
    const a11y = await new AxeBuilder({ page }).analyze();
    const serious = a11y.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(serious).toEqual([]);
  });

  for (const bp of BREAKPOINTS) {
    test(`captures /safety screenshot at ${bp.name}px`, async ({ page }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto('/safety');
      await page.waitForTimeout(400);
      await page.screenshot({
        path: `docs/screens/p2/safety-${bp.name}.png`,
        fullPage: true,
      });
    });
  }
});

