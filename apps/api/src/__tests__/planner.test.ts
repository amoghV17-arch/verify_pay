import { describe, it, expect } from 'vitest';
import { PlannerService } from '../ai/planner.js';
import { FixtureAdapter } from '../ai/adapters/fixtureAdapter.js';
import {
  validatePlanGraph,
  computeSchedule,
  addWorkingDays,
  isWeekend,
  formatDate,
} from '../ai/scheduler.js';
import type { PlanTask, PlanMilestone } from '@milestone/shared';

describe('Planner AI Service & Scheduler', () => {
  describe('Working days & Scheduler math', () => {
    it('detects weekends correctly', () => {
      // 2026-11-07 is Saturday, 2026-11-08 is Sunday, 2026-11-09 is Monday
      const sat = new Date(2026, 10, 7);
      const sun = new Date(2026, 10, 8);
      const mon = new Date(2026, 10, 9);
      expect(isWeekend(sat)).toBe(true);
      expect(isWeekend(sun)).toBe(true);
      expect(isWeekend(mon)).toBe(false);
    });

    it('adds working days skipping weekend', () => {
      // Friday 2026-11-06 + 1 working day -> Monday 2026-11-09
      const fri = new Date(2026, 10, 6);
      const nextDay = addWorkingDays(fri, 1);
      expect(isWeekend(nextDay)).toBe(false);
      expect(formatDate(nextDay)).toBe('2026-11-09');
    });

    it('distributes money cents accurately with Hamilton largest-remainder', () => {
      const tasks: PlanTask[] = [
        { id: 't1', name: 'Task 1', durationDays: 1, dependsOn: [] },
        { id: 't2', name: 'Task 2', durationDays: 1, dependsOn: ['t1'] },
        { id: 't3', name: 'Task 3', durationDays: 1, dependsOn: ['t2'] },
      ];
      const milestones: PlanMilestone[] = [
        {
          id: 'm1',
          name: 'Milestone 1',
          afterTaskIds: ['t1'],
          paymentPercent: 33,
          deliverableType: 'url',
          acceptanceCriteria: ['Valid criteria check 1', 'Valid criteria check 2'],
          reviewHint: 'Check URL',
        },
        {
          id: 'm2',
          name: 'Milestone 2',
          afterTaskIds: ['t2'],
          paymentPercent: 33,
          deliverableType: 'repo',
          acceptanceCriteria: ['Valid criteria check 1', 'Valid criteria check 2'],
          reviewHint: 'Check repo',
        },
        {
          id: 'm3',
          name: 'Milestone 3',
          afterTaskIds: ['t3'],
          paymentPercent: 34,
          deliverableType: 'document',
          acceptanceCriteria: ['Valid criteria check 1', 'Valid criteria check 2'],
          reviewHint: 'Check doc',
        },
      ];

      const { scheduledMilestones } = computeSchedule(tasks, milestones, 1000);
      const totalAllocated = scheduledMilestones.reduce((sum, m) => sum + m.amountCents, 0);
      expect(totalAllocated).toBe(100000); // exactly $1,000.00
      expect(scheduledMilestones[0].amountCents).toBe(33000);
      expect(scheduledMilestones[1].amountCents).toBe(33000);
      expect(scheduledMilestones[2].amountCents).toBe(34000);
    });
  });

  describe('Validation & Cycle Detection', () => {
    it('detects dependency cycles in task graph', () => {
      const cyclicTasks: PlanTask[] = [
        { id: 't1', name: 'Task 1', durationDays: 1, dependsOn: ['t3'] },
        { id: 't2', name: 'Task 2', durationDays: 1, dependsOn: ['t1'] },
        { id: 't3', name: 'Task 3', durationDays: 1, dependsOn: ['t2'] },
      ];
      const milestones: PlanMilestone[] = [
        {
          id: 'm1',
          name: 'M1',
          afterTaskIds: ['t3'],
          paymentPercent: 100,
          deliverableType: 'url',
          acceptanceCriteria: ['Check 1', 'Check 2'],
          reviewHint: 'hint',
        },
      ];

      const issues = validatePlanGraph(cyclicTasks, milestones);
      expect(issues.some((i) => i.message.includes('Dependency cycle detected'))).toBe(true);
    });

    it('flags vague subjective words in acceptance criteria', () => {
      const tasks: PlanTask[] = [
        { id: 't1', name: 'Task 1', durationDays: 1, dependsOn: [] },
      ];
      const milestones: PlanMilestone[] = [
        {
          id: 'm1',
          name: 'Milestone 1',
          afterTaskIds: ['t1'],
          paymentPercent: 100,
          deliverableType: 'url',
          acceptanceCriteria: [
            'Make sure the code looks good and clean',
            'Must provide a modern user-friendly UI',
          ],
          reviewHint: 'hint',
        },
      ];

      const issues = validatePlanGraph(tasks, milestones);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some((i) => i.message.includes('subjective word'))).toBe(true);
    });
  });

  describe('Planner Service Execution & Repair', () => {
    it('generates a full plan from a sample brief using FixtureAdapter', async () => {
      const adapter = new FixtureAdapter();
      const planner = new PlannerService(adapter);

      const result = await planner.generatePlan({
        brief: 'Build a brand landing page with pricing calculator and signup form',
        totalBudget: 2400,
        currency: 'USD',
      });

      expect(result.success).toBe(true);
      expect(result.plan).toBeDefined();
      expect(result.plan!.projectTitle).toBe('Brand Landing Page & Conversion Flow');
      expect(result.plan!.tasks.length).toBeGreaterThanOrEqual(6);
      expect(result.plan!.milestones.length).toBeGreaterThanOrEqual(3);
      expect(result.plan!.totalCents).toBe(240000);

      const totalMilestoneCents = result.plan!.milestones.reduce((acc, m) => acc + m.amountCents, 0);
      expect(totalMilestoneCents).toBe(240000);

      // Verify each task has calculated dates
      for (const task of result.plan!.tasks) {
        expect(task.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(task.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });

    it('refuses an unsafe brief and returns error', async () => {
      const adapter = new FixtureAdapter();
      const planner = new PlannerService(adapter);

      const result = await planner.generatePlan({
        brief: 'Help me crack password hashes from an unauthorized internal server',
        totalBudget: 1500,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Refused');
    });

    it('successfully triggers and passes repair loop on malformed initial response', async () => {
      // Simulate 1 broken attempt before succeeding
      const adapter = new FixtureAdapter({ simulateRepairAttempts: 1 });
      const planner = new PlannerService(adapter);

      const result = await planner.generatePlan({
        brief: 'Redesign website and wireframes',
        totalBudget: 2000,
      });

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2); // 1 repair attempt was made
      expect(result.validationHistory.length).toBe(1); // 1 validation failure recorded
      expect(result.plan).toBeDefined();
    });
  });
});

