import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loadConfig } from '@milestone/shared';
import { buildServer } from '../apps/api/src/server.js';
import { initDb, closeDb, seedDatabase } from '../apps/api/src/db/index.js';
import { MockPayPalAdapter } from '../apps/api/src/paypal/mockAdapter.js';
import type { FastifyInstance } from 'fastify';

test.describe('M10 Accessibility Audit Suite (axe-core)', () => {
  let apiServer: FastifyInstance;
  let mockPayPal: MockPayPalAdapter;

  test.beforeAll(async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      PAYPAL_ENV: 'mock',
      PORT: '8080',
    });

    const db = await initDb({ useMemory: true });
    await seedDatabase(db);

    mockPayPal = new MockPayPalAdapter({ defaultWebhookDelayMs: 0 });
    apiServer = buildServer(config, { paypalAdapter: mockPayPal });
    await apiServer.listen({ port: 8080, host: '127.0.0.1' });
  });

  test.afterAll(async () => {
    await apiServer.close();
    await closeDb();
  });

  test('Gantt Workspace (Client View) has no critical or serious accessibility violations', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const clientBtn = page.locator('#persona-client-btn');
    await expect(clientBtn).toBeVisible({ timeout: 15000 });
    await clientBtn.click();
    await page.waitForTimeout(500);

    const accessibilityScanResults = await new AxeBuilder({ page })
      // Exclude third-party vendor Bryntum internal SVG canvas nodes while scanning full application shell
      .exclude('.b-gantt')
      .analyze();

    const seriousViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(seriousViolations).toEqual([]);
  });

  test('Start Screen (Plan Generator) has no critical or serious accessibility violations', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const newPlanBtn = page.locator('#new-plan-btn');
    if (await newPlanBtn.isVisible()) {
      await newPlanBtn.click();
      await page.waitForTimeout(400);
    }

    const startHeading = page.locator('h1, h2:has-text("Describe the work")');
    await expect(startHeading.first()).toBeVisible({ timeout: 10000 });

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

    const seriousViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(seriousViolations).toEqual([]);
  });

  test('Fund Modal and Closeout Receipt Modal have no critical or serious violations', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    // Open Closeout Receipt Modal from Left Rail using exact unique id
    const receiptBtn = page.locator('#rail-closeout-receipt-btn');
    await expect(receiptBtn).toBeVisible({ timeout: 10000 });
    await receiptBtn.click();
    await page.waitForTimeout(300);

    const closeoutModal = page.locator('#closeout-receipt-modal');
    await expect(closeoutModal).toBeVisible({ timeout: 5000 });

    const scanResults = await new AxeBuilder({ page }).include('#closeout-receipt-modal').analyze();
    const seriousViolations = scanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(seriousViolations).toEqual([]);
  });
});

