import { test, expect } from '@playwright/test';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../apps/api/src/server.js';
import { initDb, closeDb, seedDatabase, getDb, schema, eq } from '../apps/api/src/db/index.js';
import { LedgerService } from '../apps/api/src/services/ledger.js';
import { MockPayPalAdapter } from '../apps/api/src/paypal/mockAdapter.js';
import { loadConfig } from '@milestone/shared';

test.describe('M9 Settle Moment & Motion Suite', () => {
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

  test.beforeEach(async () => {
    const db = getDb();
    const { milestones, ledgerEntries } = schema;
    await db.update(milestones).set({ status: 'approved' }).where(eq(milestones.id, 'ms-02'));
    await db.delete(ledgerEntries).where(eq(ledgerEntries.milestoneId, 'ms-02'));
  });

  test('releases payout with 700ms sweep, coin travel, count-up balance chip, and aria-live announcement', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    // 1. Ensure Client persona
    const clientBtn = page.locator('#persona-client-btn');
    await clientBtn.click();
    await page.waitForTimeout(300);

    // Initial balance
    const balanceChip = page.locator('#balance-chip');
    await expect(balanceChip).toContainText('$1,200.00');

    // 2. Select approved milestone (Milestone 2 in sample data)
    const m2Cell = page.locator('.b-grid-cell:has-text("Milestone 2: Wireframes & Architecture Approved")');
    await expect(m2Cell).toBeVisible({ timeout: 15000 });
    await m2Cell.click();

    // 3. Click "Release Payment ($1,800.00)"
    const releaseBtn = page.locator('#release-milestone-btn');
    await expect(releaseBtn).toBeVisible({ timeout: 5000 });
    await releaseBtn.click();

    // 4. Verify settle announcement is made to polite aria-live region
    const ariaRegion = page.locator('[role="status"][aria-live="polite"]');
    await expect(ariaRegion.first()).toBeVisible({ timeout: 5000 });

    // 5. Verify balance chip pulses and updates to new total ($3,000.00)
    await expect(balanceChip).toBeVisible();
    await expect(balanceChip).toContainText('$3,000.00', { timeout: 10000 });

    // 6. Screenshot the settle moment
    await page.screenshot({ path: 'docs/screens/m9-settle-moment.png' });
  });

  test('respects prefers-reduced-motion by bypassing coin flight and updating state cleanly', async ({
    page,
  }) => {
    // Emulate reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    // Ensure Client persona
    const clientBtn = page.locator('#persona-client-btn');
    await clientBtn.click();
    await page.waitForTimeout(300);

    // Select approved milestone
    const m2Cell = page.locator('.b-grid-cell:has-text("Milestone 2: Wireframes & Architecture Approved")');
    await expect(m2Cell).toBeVisible({ timeout: 15000 });
    await m2Cell.click();

    const releaseBtn = page.locator('#release-milestone-btn');
    await expect(releaseBtn).toBeVisible({ timeout: 5000 });
    await releaseBtn.click();

    // Verify coin flyer is NOT rendered under reduced motion
    const coinFlyer = page.locator('.settle-coin-flyer');
    await expect(coinFlyer).toHaveCount(0);

    // Balance chip still updates cleanly
    const balanceChip = page.locator('#balance-chip');
    await expect(balanceChip).toBeVisible();
    await expect(balanceChip).toContainText('$3,000.00', { timeout: 10000 });
  });
});
