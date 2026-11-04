import { test, expect } from '@playwright/test';
import { loadConfig } from '@milestone/shared';
import { buildServer } from '../apps/api/src/server.js';
import { initDb, closeDb, seedDatabase } from '../apps/api/src/db/index.js';
import type { FastifyInstance } from 'fastify';

test.describe('M2 E2E Data Layer & Gantt Sync Suite', () => {
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

  test('Gantt loads real data from API, syncs edits, and persists on page reload', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    // 1. Verify that the Gantt container renders
    const ganttContainer = page.locator('.b-gantt');
    await expect(ganttContainer).toBeVisible({ timeout: 15000 });

    // 2. Verify tasks loaded from backend
    await expect(page.locator('.b-grid-cell:has-text("Stakeholder & customer interviews")')).toBeVisible();
    await expect(page.locator('.b-grid-cell:has-text("Milestone 1: Brand Strategy Approved")')).toBeVisible();

    // 3. Test persona switching updates cookie and UI
    const freelancerBtn = page.locator('button:has-text("Freelancer (Arjun)")');
    await freelancerBtn.click();
    await expect(freelancerBtn).toHaveCSS('font-weight', '600');

    // 4. Trigger a task update via direct API sync to simulate client edit
    const updateRes = await page.request.post('http://localhost:8080/api/gantt/proj_brand_launch/sync', {
      data: {
        requestId: 555,
        tasks: {
          updated: [
            {
              id: 't2',
              name: 'Competitive Audit (Persisted on Reload)',
              duration: 6,
              percentDone: 85,
            },
          ],
        },
      },
    });
    expect(updateRes.ok()).toBeTruthy();

    // 5. Reload the page and verify that the persisted edit is returned from the database
    await page.reload();
    await expect(page.locator('.b-gantt')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.b-grid-cell:has-text("Competitive Audit (Persisted on Reload)")')).toBeVisible({ timeout: 10000 });

    // 6. Verify that Milestone money amounts remain protected after reload
    await expect(page.locator('.b-grid-cell .money-cell:has-text("$1,200.00")')).toBeVisible();
    await expect(page.locator('.b-grid-cell .money-cell:has-text("$2,600.00")')).toBeVisible();
  });
});

