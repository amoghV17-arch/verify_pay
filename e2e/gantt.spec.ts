import { test, expect } from '@playwright/test';

test.describe('M1 Bryntum Gantt Spike Suite', () => {
  test('renders themed Gantt with 12 tasks, 4 milestones, custom columns, and money states', async ({ page }) => {
    // Set viewport to 1440x900 desktop
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    // 1. Verify Header & Application Shell
    await expect(page.locator('header')).toContainText('Milestone');
    await expect(page.locator('header')).toContainText('Brand-site Redesign & Launch');
    await expect(page.locator('header')).toContainText('PayPal Sandbox Active');
    await expect(page.locator('#balance-chip')).toContainText('$1,200.00');

    // 2. Verify Funds Meter
    const fundsMeter = page.locator('section[aria-label="Funds status meter"]');
    await expect(fundsMeter).toBeVisible();
    await expect(fundsMeter).toContainText('$8,000.00');
    await expect(fundsMeter).toContainText('Paid');
    await expect(fundsMeter).toContainText('$1,200.00');

    // 3. Verify Gantt component mounts
    const ganttContainer = page.locator('.b-gantt');
    await expect(ganttContainer).toBeVisible({ timeout: 15000 });

    // 4. Verify custom column headers exist
    await expect(page.locator('.b-grid-header:has-text("Task / Milestone")')).toBeVisible();
    await expect(page.locator('.b-grid-header:has-text("Payment Status")')).toBeVisible();
    await expect(page.locator('.b-grid-header:has-text("Amount")')).toBeVisible();

    // 5. Verify tasks and milestones rendered in grid
    await expect(page.locator('.b-grid-cell:has-text("Stakeholder & customer interviews")')).toBeVisible();
    await expect(page.locator('.b-grid-cell:has-text("Milestone 1: Brand Strategy Approved")')).toBeVisible();
    await expect(page.locator('.b-grid-cell:has-text("Milestone 2: Wireframes & Architecture Approved")')).toBeVisible();
    await expect(page.locator('.b-grid-cell:has-text("Milestone 3: Interactive Prototype Verified")')).toBeVisible();
    await expect(page.locator('.b-grid-cell:has-text("Milestone 4: Production Launch & Settle")')).toBeVisible();

    // 6. Verify money amounts in the Amount column
    await expect(page.locator('.b-grid-cell .money-cell:has-text("$1,200.00")')).toBeVisible();
    await expect(page.locator('.b-grid-cell .money-cell:has-text("$1,800.00")')).toBeVisible();
    await expect(page.locator('.b-grid-cell .money-cell:has-text("$2,400.00")')).toBeVisible();
    await expect(page.locator('.b-grid-cell .money-cell:has-text("$2,600.00")')).toBeVisible();

    // 7. Verify status pills in grid
    await expect(page.locator('.b-grid-cell .status-pill.paid:has-text("paid")')).toBeVisible();
    await expect(page.locator('.b-grid-cell .status-pill.approved:has-text("approved")')).toBeVisible();
    await expect(page.locator('.b-grid-cell .status-pill.in_review:has-text("in review")')).toBeVisible();
    await expect(page.locator('.b-grid-cell .status-pill.funded:has-text("funded")')).toBeVisible();

    // 8. Verify milestone timeline fill treatments and classes
    const paidMilestone = page.locator('.b-gantt-task.b-milestone.milestone-status-paid');
    await expect(paidMilestone).toHaveCount(1);

    const approvedMilestone = page.locator('.b-gantt-task.b-milestone.milestone-status-approved');
    await expect(approvedMilestone).toHaveCount(1);

    const inReviewMilestone = page.locator('.b-gantt-task.b-milestone.milestone-status-in_review');
    await expect(inReviewMilestone).toHaveCount(1);

    const fundedMilestone = page.locator('.b-gantt-task.b-milestone.milestone-status-funded');
    await expect(fundedMilestone).toHaveCount(1);

    // 9. Verify dependency lines rendered
    const dependencies = page.locator('.b-sch-dependency');
    await expect(dependencies.first()).toBeVisible({ timeout: 10000 });
    const depCount = await dependencies.count();
    expect(depCount).toBeGreaterThan(5);

    // 10. Verify interaction: Click a task to update Trust Panel
    await page.locator('.b-grid-cell:has-text("Milestone 2: Wireframes & Architecture Approved")').click();
    const trustPanel = page.locator('aside[aria-label="Milestone Trust Panel"]');
    await expect(trustPanel).toContainText('Milestone 2: Wireframes & Architecture Approved');
    await expect(trustPanel).toContainText('$1,800.00');
    await expect(trustPanel).toContainText('figma');

    // 11. Test task drag interaction (drag task t1 to reschedule)
    const taskBar = page.locator('.b-gantt-task:not(.b-milestone)').first();
    await expect(taskBar).toBeVisible();
    const initialBox = await taskBar.boundingBox();
    expect(initialBox).not.toBeNull();

    if (initialBox) {
      await page.mouse.move(initialBox.x + initialBox.width / 2, initialBox.y + initialBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(initialBox.x + initialBox.width / 2 + 50, initialBox.y + initialBox.height / 2, { steps: 5 });
      await page.mouse.up();
    }

    // 12. Save official milestone screenshot at 1440px desktop
    await page.screenshot({ path: 'docs/screens/m1-gantt.png', fullPage: true });

    // 13. Capture responsive viewport screenshots (1024px tablet, 390px mobile)
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'docs/screens/m1-gantt-1024.png', fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'docs/screens/m1-gantt-390.png', fullPage: true });
  });
});
