import { test, expect } from '@playwright/test';
import { buildServer } from '../apps/api/src/server.js';
import { loadConfig } from '../packages/shared/src/config/env.js';
import { MockPayPalAdapter } from '../apps/api/src/paypal/mockAdapter.js';
import { initDb, closeDb, getDb, resetDemoDatabase, schema, eq } from '../apps/api/src/db/index.js';
import type { FastifyInstance } from 'fastify';

test.describe('Live Demo Sessions & Multi-Judge Isolation (docs/LIVE_PROOF.md §2)', () => {
  let apiServer: FastifyInstance;
  let mockPayPal: MockPayPalAdapter;

  test.beforeAll(async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      PORT: '8080',
      APP_BASE_URL: 'http://localhost:5173',
      PAYPAL_ENV: 'mock',
      LLM_PROVIDER: 'fixture',
      DEMO_MODE: 'true',
    });

    const db = await initDb();
    await resetDemoDatabase(db);

    mockPayPal = new MockPayPalAdapter({ defaultWebhookDelayMs: 0 });
    apiServer = buildServer(config, { paypalAdapter: mockPayPal });
    await apiServer.listen({ port: 8080, host: '127.0.0.1' });
  });

  test.afterAll(async () => {
    await apiServer.close();
    await closeDb();
  });

  test('1. Landing page /demo displays sandbox buyer card, prepared deliverables, and abuse safeguards', async ({
    page,
  }) => {
    await page.goto('/demo');

    // 1. Verify Page Title and Header
    await expect(page.locator('h1')).toContainText('Interactive Prototype & Live Proof');

    // 2. Verify Sandbox Buyer Credentials Card per LIVE_PROOF.md §2
    const buyerCard = page.locator('#sandbox-buyer-card');
    await expect(buyerCard).toBeVisible();
    await expect(buyerCard).toContainText('Sandbox Test Credentials');
    await expect(buyerCard).toContainText('Sandbox Buyer Email');
    await expect(buyerCard).toContainText('Sandbox Buyer Password');
    await expect(buyerCard).toContainText('Freelancer Payout Destination');
    await expect(buyerCard).toContainText('No Real Money Moves');

    // 3. Verify Prepared Deliverables Presets (good, weak, injection) per §2
    const deliverablesSection = page.locator('#prepared-deliverables-section');
    await expect(deliverablesSection).toBeVisible();
    await expect(deliverablesSection).toContainText('Prepared Deliverable Presets');
    await expect(deliverablesSection).toContainText('Good Delivery');
    await expect(deliverablesSection).toContainText('Weak Delivery');
    await expect(deliverablesSection).toContainText('Prompt Injection');

    // 4. Verify Abuse Safeguards Disclosure Bar per §2
    const safeguardsSection = page.locator('#safeguards-section');
    await expect(safeguardsSection).toBeVisible();
    await expect(safeguardsSection).toContainText('Public Demo Safeguards Active');
    await expect(safeguardsSection).toContainText('Per-IP rate limits');
    await expect(safeguardsSection).toContainText('demo budget cap');
    await expect(safeguardsSection).toContainText('24h automatic session cleanup');
  });

  test('2. Two independent browser contexts run two independent demo projects simultaneously without interference', async ({
    browser,
  }) => {
    // Context A: Judge A
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    // Context B: Judge B
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    try {
      // 1. Judge A launches an isolated demo session
      await pageA.goto('/demo');
      const launchBtnA = pageA.locator('#launch-isolated-demo-btn');
      await expect(launchBtnA).toBeVisible();
      await launchBtnA.click();

      // Wait for navigation to split demo with project ID
      await pageA.waitForURL(/\/demo\/split\?projectId=proj_demo_/);
      const urlA = new URL(pageA.url());
      const projectIdA = urlA.searchParams.get('projectId');
      expect(projectIdA).toBeTruthy();
      expect(projectIdA).toMatch(/^proj_demo_/);

      // 2. Judge B simultaneously launches an isolated demo session
      await pageB.goto('/demo');
      const launchBtnB = pageB.locator('#launch-isolated-demo-btn');
      await expect(launchBtnB).toBeVisible();
      await launchBtnB.click();

      // Wait for navigation to split demo with project ID
      await pageB.waitForURL(/\/demo\/split\?projectId=proj_demo_/);
      const urlB = new URL(pageB.url());
      const projectIdB = urlB.searchParams.get('projectId');
      expect(projectIdB).toBeTruthy();
      expect(projectIdB).toMatch(/^proj_demo_/);

      // 3. Acceptance Verification: projects must be strictly isolated
      expect(projectIdA).not.toBe(projectIdB);

      // 4. Verify Judge A workspace points exclusively to projectIdA
      const clientIframeA = pageA.locator('#client-iframe');
      const freelancerIframeA = pageA.locator('#freelancer-iframe');
      await expect(clientIframeA).toHaveAttribute('src', `/client/projects/${projectIdA}/overview`);
      await expect(freelancerIframeA).toHaveAttribute(
        'src',
        `/freelancer/projects/${projectIdA}/overview`
      );
      await expect(pageA.locator('.split-pane-client')).toContainText('Judge Client');

      // 5. Verify Judge B workspace points exclusively to projectIdB
      const clientIframeB = pageB.locator('#client-iframe');
      const freelancerIframeB = pageB.locator('#freelancer-iframe');
      await expect(clientIframeB).toHaveAttribute('src', `/client/projects/${projectIdB}/overview`);
      await expect(freelancerIframeB).toHaveAttribute(
        'src',
        `/freelancer/projects/${projectIdB}/overview`
      );
      await expect(pageB.locator('.split-pane-client')).toContainText('Judge Client');

      // 6. Verify Database Isolation
      const db = getDb();
      const [dbProjA] = await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, projectIdA!));
      const [dbProjB] = await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, projectIdB!));

      expect(dbProjA).toBeDefined();
      expect(dbProjB).toBeDefined();
      expect(dbProjA.clientId).not.toBe(dbProjB.clientId);
      expect(dbProjA.freelancerId).not.toBe(dbProjB.freelancerId);
      expect(dbProjA.isDemo).toBe(true);
      expect(dbProjB.isDemo).toBe(true);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
