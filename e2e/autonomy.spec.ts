import { test, expect } from '@playwright/test';
import { loadConfig } from '@milestone/shared';
import { buildServer } from '../apps/api/src/server.js';
import { initDb, closeDb, seedDatabase, getDb, schema, eq } from '../apps/api/src/db/index.js';
import { MockPayPalAdapter } from '../apps/api/src/paypal/mockAdapter.js';
import { LedgerService } from '../apps/api/src/services/ledger.js';
import type { FastifyInstance } from 'fastify';

test.describe('M7 E2E Autonomy Modes, Scheduler & Appeal Suite', () => {
  let apiServer: FastifyInstance;
  let mockPayPal: MockPayPalAdapter;

  test.beforeAll(async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      PAYPAL_ENV: 'mock',
      LLM_PROVIDER: 'fixture',
      PORT: '8080',
    });

    const db = await initDb({ useMemory: true });
    await seedDatabase(db);

    const ledger = new LedgerService(db);
    await ledger.recordProjectFunding({
      projectId: 'proj_brand_launch',
      captureId: `cap_e2e_auto_${Date.now()}`,
      orderId: `ord_e2e_auto_${Date.now()}`,
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

  test('client can view and change autonomy mode in the header', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const select = page.locator('#autonomy-mode-select');
    await expect(select).toBeVisible({ timeout: 15000 });

    // Switch to manual mode
    await select.selectOption('manual');
    await expect(select).toHaveValue('manual');

    // Switch back to assisted mode
    await select.selectOption('assisted');
    await expect(select).toHaveValue('assisted');
  });

  test('client objection on approved milestone stops release and sets changes_requested', async ({ request }) => {
    const db = getDb();
    // Set ms-02 to approved with a future release_at
    await db
      .update(schema.milestones)
      .set({
        status: 'approved',
        approvedBy: 'ai',
        releaseAt: new Date(Date.now() + 30000),
        updatedAt: new Date(),
      })
      .where(eq(schema.milestones.id, 'ms-02'));

    // Authenticate as client
    const authRes = await request.post('/api/auth/persona', {
      data: { persona: 'client' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(authRes.status()).toBe(200);

    // Client objects
    const objRes = await request.post('/api/milestones/ms-02/object', {
      data: { reason: 'Visual assets do not match the brand guidelines.' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(objRes.status()).toBe(200);
    const objData = await objRes.json();
    expect(objData.status).toBe('changes_requested');

    // Verify in db
    const [ms] = await db.select().from(schema.milestones).where(eq(schema.milestones.id, 'ms-02'));
    expect(ms.status).toBe('changes_requested');
    expect(ms.releaseAt).toBeNull();
  });

  test('freelancer can appeal a changes_requested decision', async ({ request }) => {
    const db = getDb();
    // Ensure ms-02 is in changes_requested
    await db
      .update(schema.milestones)
      .set({
        status: 'changes_requested',
        releaseAt: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.milestones.id, 'ms-02'));

    // Freelancer API appeal test
    const authRes = await request.post('/api/auth/persona', {
      data: { persona: 'freelancer' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(authRes.status()).toBe(200);

    const appealRes = await request.post('/api/milestones/ms-02/appeal', {
      data: { explanation: 'The assets follow the style guide attached in section 3.' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(appealRes.status()).toBe(202);
    const appealData = await appealRes.json();
    expect(appealData.status).toBe('appealed');

    // Second appeal should be rejected (max 1 appeal)
    const secondAppealRes = await request.post('/api/milestones/ms-02/appeal', {
      data: { explanation: 'Another appeal attempt should fail.' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(secondAppealRes.status()).toBe(409);
  });

  test('assisted release window auto-releases payout after expiration via scheduler tick', async ({ request }) => {
    const db = getDb();
    const testMilestoneId = `ms_auto_${Date.now()}`;
    await db.insert(schema.milestones).values({
      id: testMilestoneId,
      projectId: 'proj_brand_launch',
      name: 'Assisted Auto Release Milestone',
      amountCents: 50000,
      percent: 5,
      deliverableType: 'text',
      criteria: [{ id: 'c-auto-1', description: 'Assisted auto criteria' }],
      status: 'approved',
      approvedBy: 'ai',
      releaseAt: new Date(Date.now() - 5000), // 5 seconds ago
    });

    // Trigger scheduler tick
    const tickRes = await request.post('/api/projects/proj_brand_launch/scheduler/tick');
    expect(tickRes.status()).toBe(200);
    const tickData = await tickRes.json();
    expect(tickData.success).toBe(true);
    expect(tickData.released).toBeGreaterThanOrEqual(1);

    // Verify milestone is now paid
    const [ms] = await db.select().from(schema.milestones).where(eq(schema.milestones.id, testMilestoneId));
    expect(ms.status).toBe('paid');
    expect(ms.releaseAt).toBeNull();
  });
});
