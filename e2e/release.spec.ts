import { test, expect } from '@playwright/test';
import { loadConfig } from '@milestone/shared';
import { buildServer } from '../apps/api/src/server.js';
import { initDb, closeDb, seedDatabase } from '../apps/api/src/db/index.js';
import { MockPayPalAdapter } from '../apps/api/src/paypal/mockAdapter.js';
import { LedgerService } from '../apps/api/src/services/ledger.js';
import type { FastifyInstance } from 'fastify';

test.describe('M4 E2E Payout Release Suite', () => {
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

    // Ensure project has funds in ledger for release
    const ledger = new LedgerService(db);
    await ledger.recordProjectFunding({
      projectId: 'proj_brand_launch',
      captureId: `cap_e2e_${Date.now()}`,
      orderId: `ord_e2e_${Date.now()}`,
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

  test('client can select an approved milestone and release payment', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    // 1. Verify page and Gantt loaded
    const ganttContainer = page.locator('.b-gantt');
    await expect(ganttContainer).toBeVisible({ timeout: 15000 });

    // 2. Select Client Persona
    const clientBtn = page.locator('button:has-text("Client (Acme Corp)")');
    await clientBtn.click();
    await page.waitForTimeout(400);

    // 3. Click Milestone 2 row (approved in seed data) to activate in Trust Panel
    const m2Cell = page.locator('.b-grid-cell:has-text("Milestone 2: Wireframes & Architecture Approved")');
    await expect(m2Cell).toBeVisible();
    await m2Cell.click();

    // 4. Verify Trust Panel shows Milestone 2 details
    const trustPanel = page.locator('aside[aria-label="Milestone Trust Panel"]');
    await expect(trustPanel).toContainText('Milestone 2: Wireframes & Architecture Approved');
    await expect(trustPanel).toContainText('$1,800.00');

    // 5. Verify "Release Payment" button is visible
    const releaseBtn = page.locator('#release-milestone-btn');
    await expect(releaseBtn).toBeVisible({ timeout: 5000 });
    await expect(releaseBtn).toContainText('Release Payment ($1,800.00)');

    // 6. Click "Release Payment"
    await releaseBtn.click();

    // 7. Verify accessible notification appears confirming payout
    const notification = page.locator('[role="status"]');
    await expect(notification).toBeVisible({ timeout: 10000 });
    await expect(notification).toContainText('Payout released');

    // 8. Verify Trust Panel status updates
    await expect(trustPanel).toContainText('paid');

    // 9. Verify funds meter reflects paid funds
    const fundsMeter = page.locator('section[aria-label="Funds status meter"]');
    await expect(fundsMeter).toBeVisible();
  });
});

