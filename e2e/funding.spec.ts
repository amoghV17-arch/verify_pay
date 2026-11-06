import { test, expect } from '@playwright/test';
import { loadConfig } from '@milestone/shared';
import { buildServer } from '../apps/api/src/server.js';
import { initDb, closeDb, seedDatabase } from '../apps/api/src/db/index.js';
import type { FastifyInstance } from 'fastify';

test.describe('M3 E2E PayPal Funding and Real-time Updates', () => {
  let apiServer: FastifyInstance;

  test.beforeAll(async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      PAYPAL_ENV: 'mock',
      PORT: '8080',
    });

    const db = await initDb({ useMemory: true });
    await seedDatabase(db);

    apiServer = buildServer(config);
    await apiServer.listen({ port: 8080, host: '127.0.0.1' });
  });

  test.afterAll(async () => {
    await apiServer.close();
    await closeDb();
  });

  test('client can initiate and capture funding with holding balance update', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?workspace=true');

    // 1. Verify page and Gantt loaded
    const ganttContainer = page.locator('.b-gantt');
    await expect(ganttContainer).toBeVisible({ timeout: 15000 });

    // 2. Ensure viewing as Client and cookie is settled
    const clientBtn = page.locator('button:has-text("Client (Acme Corp)")');
    await clientBtn.click();
    await page.waitForTimeout(500);

    // 3. Verify "Fund with PayPal" button is visible
    const fundBtn = page.locator('#fund-project-btn');
    await expect(fundBtn).toBeVisible();

    // 4. Click "Fund with PayPal"
    await fundBtn.click();

    // 5. Verify accessible status notification appears
    const notification = page.locator('[role="status"]');
    await expect(notification).toBeVisible({ timeout: 10000 });
    await expect(notification).toContainText(/fund/i);

    // 6. Verify funds meter shows holding balance
    const meterSection = page.locator('section[aria-label="Funds status meter"]');
    await expect(meterSection).toBeVisible();
    await expect(meterSection).toContainText('Holding Balance');
  });
});
