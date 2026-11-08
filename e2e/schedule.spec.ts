import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { startTestServer, type TestServerContext } from './testServer.js';

test.describe('Phase P7: Schedule (Bryntum Gantt) Suite', () => {
  let testEnv: TestServerContext;

  test.beforeAll(async () => {
    testEnv = await startTestServer();
    const screensDir = path.resolve(process.cwd(), 'docs/screens/p7');
    if (!fs.existsSync(screensDir)) {
      fs.mkdirSync(screensDir, { recursive: true });
    }
  });

  test.afterAll(async () => {
    await testEnv.stop();
  });

  // =========================================================
  // 1. Client Schedule Page & Slim Context Bar (Desktop 1440px)
  // =========================================================
  test('Client schedule page renders Bryntum Gantt, slim context bar, and one-line key', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/client/projects/proj_brand_launch/schedule');

    // Context Bar elements
    const contextBar = page.getByTestId('schedule-context-bar');
    await expect(contextBar).toBeVisible({ timeout: 15000 });
    await expect(contextBar.getByText('Brand-site Redesign & Launch')).toBeVisible();
    await expect(contextBar.getByText('Client Schedule')).toBeVisible();

    // View toggles and controls
    await expect(page.getByTestId('view-toggle-gantt')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('view-toggle-list')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('zoom-out-btn')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('zoom-in-btn')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('fit-timeline-btn')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('toggle-details-btn')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('toggle-inspector-btn')).toBeVisible({ timeout: 15000 });

    // Bryntum Gantt container
    await expect(page.getByTestId('bryntum-gantt-wrapper')).toBeVisible({ timeout: 15000 });

    // One-line legend key
    const legendKey = page.getByTestId('schedule-legend-key');
    await expect(legendKey).toBeVisible();
    await expect(legendKey.getByText('Milestone States:')).toBeVisible();
    await expect(legendKey.getByText('Unfunded', { exact: true })).toBeVisible();
    await expect(legendKey.getByText('Funded', { exact: true })).toBeVisible();
    await expect(legendKey.getByText('In review', { exact: true })).toBeVisible();
    await expect(legendKey.getByText('Paid', { exact: true })).toBeVisible();

    // Capture desktop Gantt screenshot
    await page.screenshot({
      path: path.resolve(process.cwd(), 'docs/screens/p7/p7-client-gantt-1440.png'),
      fullPage: true,
    });
  });

  // =========================================================
  // 2. Context Bar: Details Toggle (Start Date & Duration Columns)
  // =========================================================
  test('Toggling Details button reveals additional schedule columns', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/client/projects/proj_brand_launch/schedule');

    const detailsBtn = page.getByTestId('toggle-details-btn');
    await expect(detailsBtn).toBeVisible();

    // Click details toggle
    await detailsBtn.click();

    // Wait for column update
    await page.waitForTimeout(300);

    await page.screenshot({
      path: path.resolve(process.cwd(), 'docs/screens/p7/p7-client-details-1440.png'),
      fullPage: true,
    });
  });

  // =========================================================
  // 3. Task Inspector Slide-Over Panel
  // =========================================================
  test('Inspector panel opens, shows milestone criteria, amount, and close button', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/client/projects/proj_brand_launch/schedule');

    // Click inspector toggle button
    const inspectorBtn = page.getByTestId('toggle-inspector-btn');
    await inspectorBtn.click();

    const inspectorPanel = page.getByTestId('task-inspector-panel');
    await expect(inspectorPanel).toBeVisible();

    // Milestone Details checks
    await expect(inspectorPanel.getByText(/Inspector/i)).toBeVisible();
    await expect(inspectorPanel.getByText('Schedule Details')).toBeVisible();

    // Capture inspector open screenshot
    await page.screenshot({
      path: path.resolve(process.cwd(), 'docs/screens/p7/p7-client-inspector-1440.png'),
      fullPage: true,
    });

    // Close button works
    const closeBtn = page.getByTestId('inspector-close-btn');
    await closeBtn.click();
    await expect(inspectorPanel).not.toBeVisible();
  });

  // =========================================================
  // 4. View Mode Switch: Gantt to List View
  // =========================================================
  test('Switching between Gantt and List view shows sequential table with inspect triggers', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/client/projects/proj_brand_launch/schedule');

    // Switch to List view
    const listToggleBtn = page.getByTestId('view-toggle-list');
    await listToggleBtn.click();

    const listView = page.getByTestId('schedule-list-view');
    await expect(listView).toBeVisible();
    await expect(listView.getByText('Project Schedule & Deliverable Sequence')).toBeVisible();

    // Check list item inspection
    const firstInspectBtn = page.getByTestId(/inspect-btn-/).first();
    await expect(firstInspectBtn).toBeVisible();
    await firstInspectBtn.click();

    const inspectorPanel = page.getByTestId('task-inspector-panel');
    await expect(inspectorPanel).toBeVisible();

    await page.screenshot({
      path: path.resolve(process.cwd(), 'docs/screens/p7/p7-client-list-1440.png'),
      fullPage: true,
    });

    // Switch back to Gantt
    const ganttToggleBtn = page.getByTestId('view-toggle-gantt');
    await ganttToggleBtn.click();
    await expect(page.getByTestId('bryntum-gantt-wrapper')).toBeVisible();
  });

  // =========================================================
  // 5. Responsive Breakpoints (1024px & 768px)
  // =========================================================
  test('Responsive display on tablet viewports (1024px and 768px)', async ({ page }) => {
    // 1024px (Tablet Landscape)
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/client/projects/proj_brand_launch/schedule');
    await expect(page.getByTestId('schedule-context-bar')).toBeVisible({ timeout: 15000 });
    await page.screenshot({
      path: path.resolve(process.cwd(), 'docs/screens/p7/p7-client-gantt-1024.png'),
      fullPage: true,
    });

    // 768px (Tablet Portrait)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/client/projects/proj_brand_launch/schedule');
    await expect(page.getByTestId('schedule-context-bar')).toBeVisible({ timeout: 15000 });
    await page.screenshot({
      path: path.resolve(process.cwd(), 'docs/screens/p7/p7-client-list-768.png'),
      fullPage: true,
    });
  });

  // =========================================================
  // 6. Mobile Fallback (< 768px -> 390px Mobile Viewport)
  // =========================================================
  test('Mobile viewport (390px) defaults to List view with advisory notice and switch-to-Gantt button', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/client/projects/proj_brand_launch/schedule');

    // Automatically in List view
    const listView = page.getByTestId('schedule-list-view');
    await expect(listView).toBeVisible({ timeout: 15000 });

    // Advisory notice visible
    const advisory = page.getByTestId('mobile-gantt-advisory');
    await expect(advisory).toBeVisible({ timeout: 15000 });
    await expect(advisory.getByText('Mobile Schedule View')).toBeVisible();
    await expect(advisory.getByText(/optimized for larger displays/i)).toBeVisible();

    // Switch to Gantt button works
    const switchToGanttBtn = page.getByTestId('switch-to-gantt-btn');
    await expect(switchToGanttBtn).toBeVisible({ timeout: 15000 });

    await page.screenshot({
      path: path.resolve(process.cwd(), 'docs/screens/p7/p7-mobile-fallback-390.png'),
      fullPage: true,
    });

    // Clicking switch-to-Gantt on mobile loads Gantt
    await switchToGanttBtn.click();
    await expect(page.getByTestId('bryntum-gantt-wrapper')).toBeVisible({ timeout: 15000 });
  });

  // =========================================================
  // 7. Freelancer Schedule Route (/freelancer/projects/:id/schedule)
  // =========================================================
  test('Freelancer schedule route renders with role scoping', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/freelancer/projects/proj_brand_launch/schedule');

    const contextBar = page.getByTestId('schedule-context-bar');
    await expect(contextBar).toBeVisible({ timeout: 15000 });
    await expect(contextBar.getByText('Freelancer Schedule')).toBeVisible();

    // Gantt is present
    await expect(page.getByTestId('bryntum-gantt-wrapper')).toBeVisible({ timeout: 15000 });

    await page.screenshot({
      path: path.resolve(process.cwd(), 'docs/screens/p7/p7-freelancer-schedule-1440.png'),
      fullPage: true,
    });
  });
});
