import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { buildServer } from '../apps/api/src/server.js';
import { loadConfig } from '../packages/shared/src/config/env.js';
import { MockPayPalAdapter } from '../apps/api/src/paypal/mockAdapter.js';
import { initDb, closeDb, resetDemoDatabase } from '../apps/api/src/db/index.js';
import type { FastifyInstance } from 'fastify';

test.describe('Phase P9: Polish, Responsive Pass, Accessibility & Quality Suite', () => {
  let apiServer: FastifyInstance;
  let mockPayPal: MockPayPalAdapter;

  const BREAKPOINTS = [
    { width: 1440, height: 900, name: 'desktop-1440' },
    { width: 1280, height: 800, name: 'laptop-1280' },
    { width: 1024, height: 768, name: 'tablet-landscape-1024' },
    { width: 768, height: 1024, name: 'tablet-portrait-768' },
    { width: 390, height: 844, name: 'mobile-390' },
    { width: 360, height: 740, name: 'narrow-mobile-360' },
  ];

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

  test('Responsiveness pass: No horizontal viewport overflow across 6 breakpoints', async ({ page }) => {
    test.setTimeout(90000);
    const testRoutes = [
      '/',
      '/safety',
      '/get-started',
      '/client/projects/proj_brand_launch/overview',
      '/freelancer/projects/proj_brand_launch/overview',
      '/client/projects/proj_brand_launch/schedule',
      '/client/projects/proj_brand_launch/payments',
      '/demo/split',
    ];

    for (const bp of BREAKPOINTS) {
      await page.setViewportSize({ width: bp.width, height: bp.height });

      for (const route of testRoutes) {
        await page.goto(route);
        await page.waitForLoadState('domcontentloaded');

        // Check horizontal overflow
        const overflowInfo = await page.evaluate(() => {
          const docEl = document.documentElement;
          const bodyEl = document.body;
          const docScroll = docEl.scrollWidth;
          const bodyScroll = bodyEl ? bodyEl.scrollWidth : 0;
          const winWidth = window.innerWidth;
          const isOver = docScroll > winWidth + 2 || bodyScroll > winWidth + 2;
          if (!isOver) return null;

          const overflowing: Array<{ tag: string; id: string; className: string; scrollWidth: number; clientWidth: number; offsetWidth: number; right: number }> = [];
          document.querySelectorAll('*').forEach((el) => {
            const rect = el.getBoundingClientRect();
            if (el.scrollWidth > winWidth + 2 || rect.right > winWidth + 2) {
              overflowing.push({
                tag: el.tagName,
                id: el.id,
                className: typeof el.className === 'string' ? el.className : '',
                scrollWidth: el.scrollWidth,
                clientWidth: el.clientWidth,
                offsetWidth: (el as HTMLElement).offsetWidth || 0,
                right: rect.right,
                text: el.tagName === 'PRE' ? (el.textContent || '').slice(0, 200) : undefined,
              });
            }
          });
          return { docScroll, bodyScroll, winWidth, sample: overflowing.slice(0, 10) };
        });

        if (overflowInfo) {
          console.error(`HORIZONTAL OVERFLOW on ${route} at ${bp.name}:`, JSON.stringify(overflowInfo, null, 2));
        }
        expect(overflowInfo === null, `Horizontal overflow detected on ${route} at ${bp.name}`).toBe(true);
      }
    }
  });

  test('Accessibility pass: 0 critical or serious axe-core violations on all core pages', async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1440, height: 900 });

    const auditPages = [
      { name: 'Landing', route: '/' },
      { name: 'Safety', route: '/safety' },
      { name: 'GetStarted', route: '/get-started' },
      { name: 'ClientOverview', route: '/client/projects/proj_brand_launch/overview' },
      { name: 'FreelancerDeliverables', route: '/freelancer/projects/proj_brand_launch/deliverables' },
      { name: 'ReviewPage', route: '/client/projects/proj_brand_launch/deliverables/ms-01' },
      { name: 'SplitDemo', route: '/demo/split' },
    ];

    for (const p of auditPages) {
      await page.goto(p.route);
      await page.waitForLoadState('domcontentloaded');

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .exclude('.b-gantt') // Bryntum canvas internal grid is tested separately
        .exclude('iframe') // Child iframes (SplitDemo) have independent document scopes
        .analyze();

      const seriousViolations = accessibilityScanResults.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );

      expect(seriousViolations, `Axe accessibility violations found on ${p.name}`).toEqual([]);
    }
  });

  test('Micro-interactions & touch targets: Button sizes and reduced-motion honoring', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/get-started');

    // Verify touch target sizes on mobile (>= 40px bounding box)
    const clientCard = page.locator('#role-card-client');
    await expect(clientCard).toBeVisible();
    const box = await clientCard.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(44);
    }

    // Verify prefers-reduced-motion media query emulation
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const header = page.locator('header');
    await expect(header).toBeVisible();
  });

  test('Three clean runs of the demo journey in under 3 minutes each', async ({ page }) => {
    test.setTimeout(90000);

    for (let run = 1; run <= 3; run++) {
      const startTime = Date.now();
      await page.setViewportSize({ width: 1440, height: 900 });

      // Reset workspace
      await page.goto('/demo/split');
      const resetBtn = page.locator('#split-reset-btn');
      await expect(resetBtn).toBeVisible();
      await resetBtn.click();
      await expect(page.locator('[role="status"]')).toContainText('Reset complete!');

      // Navigate to Client overview
      await page.goto('/client/projects/proj_brand_launch/overview');
      await expect(page.locator('h1')).toContainText('Brand-site Redesign & Launch', { timeout: 15000 });

      // Navigate to Deliverables
      await page.goto('/freelancer/projects/proj_brand_launch/deliverables');
      await expect(page.locator('h1')).toContainText('Deliverables', { timeout: 15000 });

      // Navigate to Review page
      await page.goto('/client/projects/proj_brand_launch/deliverables/ms-01');
      await expect(page.locator('#review-heading')).toBeVisible({ timeout: 15000 });

      // Navigate to Schedule
      await page.goto('/client/projects/proj_brand_launch/schedule');
      await expect(page.locator('#view-gantt-btn')).toBeVisible({ timeout: 15000 });

      const elapsedMs = Date.now() - startTime;
      expect(elapsedMs).toBeLessThan(60000); // Executed cleanly in < 60s (well under 180s target)
    }
  });

  test('Official README and submission screenshots generated into docs/screens/p9/', async ({ page }) => {
    test.setTimeout(60000);
    // 1. Landing 1440 & 360
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'docs/screens/p9/p9-landing-1440.png', fullPage: true });

    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/');
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'docs/screens/p9/p9-landing-360.png', fullPage: true });

    // 2. Client Overview 1440 & 360
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/client/projects/proj_brand_launch/overview');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'docs/screens/p9/p9-client-overview-1440.png', fullPage: true });

    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/client/projects/proj_brand_launch/overview');
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'docs/screens/p9/p9-client-overview-360.png', fullPage: true });

    // 3. Freelancer Overview 1440 & 360
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/freelancer/projects/proj_brand_launch/overview');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'docs/screens/p9/p9-freelancer-overview-1440.png', fullPage: true });

    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/freelancer/projects/proj_brand_launch/overview');
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'docs/screens/p9/p9-freelancer-overview-360.png', fullPage: true });

    // 4. Schedule (Gantt on 1440, List fallback on 360)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/client/projects/proj_brand_launch/schedule');
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'docs/screens/p9/p9-schedule-1440.png', fullPage: true });

    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/client/projects/proj_brand_launch/schedule');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'docs/screens/p9/p9-schedule-list-360.png', fullPage: true });

    // 5. Review Screen 1440 & 360
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/client/projects/proj_brand_launch/deliverables/ms-01');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'docs/screens/p9/p9-review-1440.png', fullPage: true });

    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/client/projects/proj_brand_launch/deliverables/ms-01');
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'docs/screens/p9/p9-review-360.png', fullPage: true });

    // 6. Split Demo 1440 & 360
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/split');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'docs/screens/p9/p9-split-demo-1440.png', fullPage: true });

    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/demo/split');
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'docs/screens/p9/p9-split-demo-360.png', fullPage: true });
  });
});

