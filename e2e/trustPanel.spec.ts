import { test, expect } from '@playwright/test';

test.describe('M8 Trust Panel and Product UI Suite', () => {
  test('renders complete layout per DESIGN.md: left rail, funds meter, Gantt, and Trust Panel', async ({ page }) => {
    // 1440px Desktop Viewport
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?workspace=true');

    // 1. Verify Top App Header & Persona Switcher ("Viewing as")
    await expect(page.locator('header')).toContainText('Milestone');
    await expect(page.locator('header')).toContainText('PayPal Sandbox Active');
    await expect(page.locator('header')).toContainText('Viewing as:');
    await expect(page.locator('#persona-client-btn')).toBeVisible();
    await expect(page.locator('#persona-freelancer-btn')).toBeVisible();
    await expect(page.locator('#balance-chip')).toContainText('Arjun:');
    await expect(page.locator('#autonomy-mode-select')).toBeVisible();

    // 2. Verify Collapsible Left Rail & Projects Navigation
    const leftRail = page.locator('#left-rail');
    await expect(leftRail).toBeVisible();
    await expect(leftRail).toContainText('Projects');
    await expect(leftRail).toContainText('Brand-site Redesign & Launch');
    await expect(leftRail).toContainText('Customer Retention Analytics');
    await expect(leftRail).toContainText('API Integration Docs');

    // Test collapse / expand toggle
    const toggleBtn = page.locator('#toggle-left-rail-btn');
    await toggleBtn.click();
    await page.waitForTimeout(200);
    // Rail width is now collapsed
    const collapsedBox = await leftRail.boundingBox();
    expect(collapsedBox?.width).toBeLessThanOrEqual(60);

    // Expand back
    await toggleBtn.click();
    await page.waitForTimeout(200);
    const expandedBox = await leftRail.boundingBox();
    expect(expandedBox?.width).toBeGreaterThanOrEqual(200);

    // 3. Verify Funds Meter (3-segment financial status bar)
    const fundsMeter = page.locator('#funds-meter');
    await expect(fundsMeter).toBeVisible();
    await expect(fundsMeter).toContainText('Total Budget');
    await expect(fundsMeter).toContainText('Paid (Settled)');
    await expect(fundsMeter).toContainText(/held for this project/i);
    await expect(fundsMeter).toContainText('$8,000.00');

    // 4. Verify Center Bryntum Gantt
    const gantt = page.locator('.b-gantt');
    await expect(gantt).toBeVisible({ timeout: 15000 });

    // 5. Verify Right Trust Panel Drawer and its 5 Sections
    const trustPanel = page.locator('#trust-panel');
    await expect(trustPanel).toBeVisible();
    await expect(trustPanel).toContainText('Trust Panel');

    // Section 1: Status & Next Step
    await expect(trustPanel.locator('section[aria-labelledby="section-status-heading"]')).toBeVisible();
    await expect(trustPanel).toContainText('Status & Next Step');

    // Section 2: Acceptance Criteria
    await expect(trustPanel.locator('section[aria-labelledby="section-criteria-heading"]')).toBeVisible();
    await expect(trustPanel).toContainText('Acceptance Criteria');

    // Section 3: AI Review Trace
    await expect(trustPanel.locator('section[aria-labelledby="section-review-heading"]')).toBeVisible();
    await expect(trustPanel).toContainText('AI Review & Reasoning Trace');

    // Section 4: Money & Sandbox Settlement
    await expect(trustPanel.locator('section[aria-labelledby="section-money-heading"]')).toBeVisible();
    await expect(trustPanel).toContainText('Money & Sandbox Settlement');

    // Section 5: Activity Trail
    await expect(trustPanel.locator('section[aria-labelledby="section-activity-heading"]')).toBeVisible();
    await expect(trustPanel).toContainText('Activity Trail');

    // 6. Test Milestone Selection updates Trust Panel
    await page.locator('.b-grid-cell:has-text("Milestone 2: Wireframes & Architecture Approved")').click();
    await expect(trustPanel).toContainText('Milestone 2: Wireframes & Architecture Approved');
    await expect(trustPanel).toContainText('$1,800.00');

    // 7. Test Fund Project Breakdown & Protection Guarantee Modal
    const fundModalBtn = page.locator('#open-fund-modal-btn');
    await expect(fundModalBtn).toBeVisible();
    await fundModalBtn.click();

    const fundModal = page.locator('div[role="dialog"][aria-labelledby="fund-modal-title"]');
    await expect(fundModal).toBeVisible();
    await expect(fundModal).toContainText('Fund Project');
    await expect(fundModal).toContainText('Milestone Allocation Breakdown');
    await expect(fundModal).toContainText('How funds are held');
    await expect(page.locator('#confirm-fund-btn')).toBeVisible();

    // Close fund modal
    await page.locator('button[aria-label="Close funding modal"]').click();
    await expect(fundModal).not.toBeVisible();

    // 8. Test Closeout Receipt Modal & Audit Export
    const closeoutBtn = page.locator('#trust-panel-receipt-btn');
    await closeoutBtn.click();

    const receiptModal = page.locator('div[role="dialog"][aria-labelledby="closeout-receipt-title"]');
    await expect(receiptModal).toBeVisible();
    await expect(receiptModal).toContainText('Closeout Receipt');
    await expect(receiptModal).toContainText('Project Settlement Record');
    await expect(receiptModal).toContainText('Milestones & Payments Breakdown');
    await expect(page.locator('#download-audit-btn')).toBeVisible();

    // Close receipt modal
    await page.locator('button[aria-label="Close receipt"]').click();
    await expect(receiptModal).not.toBeVisible();

    // 9. Save Desktop 1440px screenshot
    await page.screenshot({ path: 'docs/screens/m8-workspace-1440.png', fullPage: true });

    // 10. Tablet 1024px Viewport
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(300);
    await expect(page.locator('#left-rail')).toBeVisible();
    await expect(page.locator('#trust-panel')).toBeVisible();
    await page.screenshot({ path: 'docs/screens/m8-workspace-1024.png', fullPage: true });

    // 11. Mobile 390px Viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await expect(page.locator('header')).toBeVisible();
    await page.screenshot({ path: 'docs/screens/m8-workspace-390.png', fullPage: true });
  });

  test('persona switcher toggles between client and freelancer controls', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?workspace=true');

    // Start as Client
    await page.locator('#persona-client-btn').click();
    await expect(page.locator('#fund-project-btn')).toBeVisible();

    // Switch to Freelancer
    await page.locator('#persona-freelancer-btn').click();
    await expect(page.locator('#fund-project-btn')).not.toBeVisible();

    // Select milestone in funded status (Milestone 4)
    await page.locator('.b-grid-cell:has-text("Milestone 4: Production Launch & Settle")').click();
    await expect(page.locator('#submit-deliverable-btn')).toBeVisible();
  });
});

