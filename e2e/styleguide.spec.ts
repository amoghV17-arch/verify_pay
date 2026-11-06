import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';

const breakpoints = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'tablet-portrait', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];

test.describe('P1 Styleguide & Design System Suite', () => {
  const outDir = path.resolve(process.cwd(), 'docs/screens/p1');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  test('styleguide renders design tokens, fonts, and component library', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/styleguide');

    // 1. Verify Header & Typography
    const heading = page.locator('h1');
    await expect(heading).toContainText('Editorial Fintech & Precision SaaS');

    // Verify self-hosted font family computed styles
    const computedHeadingFont = await heading.evaluate((el) => window.getComputedStyle(el).fontFamily);
    expect(computedHeadingFont.toLowerCase()).toContain('dm serif display');

    // 2. Verify Tab Switching
    const tokensTab = page.locator('button[role="tab"]:has-text("Color & Typography Tokens")');
    await expect(tokensTab).toBeVisible();
    await tokensTab.click();
    await expect(page.locator('h2:has-text("Color Token Palette")')).toBeVisible();

    const lifecycleTab = page.locator('button[role="tab"]:has-text("Lifecycle & Money States")');
    await expect(lifecycleTab).toBeVisible();
    await lifecycleTab.click();
    await expect(page.locator('h2:has-text("Money States")')).toBeVisible();

    // Switch back to Components
    const componentsTab = page.locator('button[role="tab"]:has-text("Components & Primitives")');
    await componentsTab.click();
    await expect(page.locator('h2:has-text("Buttons & Triggers")')).toBeVisible();
  });

  test('styleguide has zero critical or serious axe accessibility violations', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/styleguide');
    await page.waitForTimeout(500);

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    const seriousViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(seriousViolations).toEqual([]);
  });

  for (const bp of breakpoints) {
    test(`captures styleguide screenshot at ${bp.width}px (${bp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto('/styleguide');
      await page.waitForTimeout(500);

      await page.screenshot({
        path: path.join(outDir, `styleguide-${bp.width}.png`),
        fullPage: true,
      });
    });
  }
});

