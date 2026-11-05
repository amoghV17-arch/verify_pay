import { test, expect } from '@playwright/test';
import { loadConfig } from '@milestone/shared';
import { buildServer } from '../apps/api/src/server.js';
import { initDb, closeDb, seedDatabase } from '../apps/api/src/db/index.js';
import type { FastifyInstance } from 'fastify';

test.describe('M5 E2E AI Layer and Planner Workflow', () => {
  let apiServer: FastifyInstance;

  test.beforeAll(async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      PAYPAL_ENV: 'mock',
      LLM_PROVIDER: 'fixture',
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

  test('client can create a verified plan from brief, review it, and apply to Gantt in under 20s', async ({ page }) => {
    const startTime = Date.now();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    // 1. Initial workspace load
    const ganttContainer = page.locator('.b-gantt');
    await expect(ganttContainer).toBeVisible({ timeout: 15000 });

    // 2. Select Client persona
    const clientBtn = page.locator('button:has-text("Client (Acme Corp)")');
    await clientBtn.click();
    await page.waitForTimeout(300);

    // 3. Click "New Plan" button to open Start Screen
    const newPlanBtn = page.locator('#new-plan-btn');
    await expect(newPlanBtn).toBeVisible();
    await newPlanBtn.click();

    // 4. Verify Start Screen empty state and description
    await expect(
      page.locator('text=Describe the work in your own words. The plan comes back with milestones you can edit.')
    ).toBeVisible();

    // 5. Fill with sample brief
    const sampleBtn = page.locator('#sample-brief-btn');
    await expect(sampleBtn).toBeVisible();
    await sampleBtn.click();

    const briefInput = page.locator('#brief-input');
    await expect(briefInput).not.toHaveValue('');

    // 6. Click "Create plan"
    const createBtn = page.locator('#create-plan-btn');
    await expect(createBtn).toBeEnabled();
    await createBtn.click();

    // 7. Verify transition to Plan Review screen
    const approveBtn = page.locator('#approve-plan-btn');
    await expect(approveBtn).toBeVisible({ timeout: 15000 });

    const meterBadge = page.locator('#percentage-meter-badge');
    await expect(meterBadge).toBeVisible();
    await expect(meterBadge).toContainText('100% Total');

    // 8. Verify Gantt preview inside Plan Review screen
    await expect(page.locator('.b-gantt')).toBeVisible();

    // 9. Click "Approve plan"
    await approveBtn.click();

    // 10. Verify workspace returns with confirmation toast
    const notification = page.locator('[role="status"]');
    await expect(notification).toBeVisible({ timeout: 10000 });
    await expect(notification).toContainText('Plan approved');

    // Verify entire flow completed well under 20 seconds
    const totalElapsedSec = (Date.now() - startTime) / 1000;
    expect(totalElapsedSec).toBeLessThan(20);
  });
});
