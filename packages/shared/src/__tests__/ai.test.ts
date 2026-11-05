import { describe, it, expect } from 'vitest';
import {
  PlanSchema,
  PlanTaskSchema,
  PlanMilestoneSchema,
} from '../ai.js';

describe('AI Planner Schemas', () => {
  it('validates a valid task schema', () => {
    const validTask = {
      id: 't1',
      name: 'Design high-fidelity wireframes',
      durationDays: 2.5,
      dependsOn: [],
    };
    expect(PlanTaskSchema.safeParse(validTask).success).toBe(true);
  });

  it('rejects tasks with invalid duration step (not multiple of 0.5)', () => {
    const invalidTask = {
      id: 't1',
      name: 'Write docs',
      durationDays: 1.3,
      dependsOn: [],
    };
    const res = PlanTaskSchema.safeParse(invalidTask);
    expect(res.success).toBe(false);
  });

  it('rejects tasks with malformed ids', () => {
    const invalidTask = {
      id: 'task-1',
      name: 'Write docs',
      durationDays: 1.0,
      dependsOn: [],
    };
    const res = PlanTaskSchema.safeParse(invalidTask);
    expect(res.success).toBe(false);
  });

  it('validates a valid milestone schema', () => {
    const validMilestone = {
      id: 'm1',
      name: 'Architecture & Wireframes',
      afterTaskIds: ['t1', 't2'],
      paymentPercent: 25,
      deliverableType: 'repo',
      acceptanceCriteria: [
        'GitHub repository initialized with README and MIT license',
        'Figma wireframe link accessible with view permissions',
      ],
      reviewHint: 'Check the repository root and verify Figma URL loads',
    };
    expect(PlanMilestoneSchema.safeParse(validMilestone).success).toBe(true);
  });

  it('rejects milestone with percentage exceeding 40%', () => {
    const invalidMilestone = {
      id: 'm1',
      name: 'Big Milestone',
      afterTaskIds: ['t1'],
      paymentPercent: 45,
      deliverableType: 'repo',
      acceptanceCriteria: ['Passes tests and compiles cleanly', 'README exists'],
      reviewHint: 'Check tests',
    };
    const res = PlanMilestoneSchema.safeParse(invalidMilestone);
    expect(res.success).toBe(false);
  });

  it('validates a complete successful plan', () => {
    const fullPlan = {
      projectTitle: 'SaaS Dashboard Redesign',
      summary: 'Complete redesign of analytics dashboard and user settings',
      assumptions: ['Client provides brand assets', 'Figma mockups approved upfront'],
      currency: 'USD',
      totalBudget: 3000,
      tasks: [
        { id: 't1', name: 'Information architecture', durationDays: 2, dependsOn: [] },
        { id: 't2', name: 'UI Component library', durationDays: 3, dependsOn: ['t1'] },
        { id: 't3', name: 'Dashboard layout', durationDays: 2.5, dependsOn: ['t2'] },
        { id: 't4', name: 'Analytics charts', durationDays: 3, dependsOn: ['t3'] },
        { id: 't5', name: 'Responsive testing', durationDays: 1.5, dependsOn: ['t4'] },
        { id: 't6', name: 'Production deployment', durationDays: 1, dependsOn: ['t5'] },
      ],
      milestones: [
        {
          id: 'm1',
          name: 'Design System & Architecture',
          afterTaskIds: ['t1', 't2'],
          paymentPercent: 30,
          deliverableType: 'url',
          acceptanceCriteria: [
            'Storybook preview URL live with at least 8 component variants',
            'Architecture document approved in markdown format',
          ],
          reviewHint: 'Open storybook link and review components',
        },
        {
          id: 'm2',
          name: 'Dashboard UI & Charts',
          afterTaskIds: ['t3', 't4'],
          paymentPercent: 40,
          deliverableType: 'repo',
          acceptanceCriteria: [
            'Interactive charts render mock time-series data without errors',
            'Zero console warnings on initial dashboard mount',
          ],
          reviewHint: 'Clone repo and run pnpm test',
        },
        {
          id: 'm3',
          name: 'Deployment & Acceptance',
          afterTaskIds: ['t5', 't6'],
          paymentPercent: 30,
          deliverableType: 'url',
          acceptanceCriteria: [
            'Production URL loads with HTTPS and valid SSL certificate',
            'Lighthouse performance score is at least 90 on desktop',
          ],
          reviewHint: 'Test production URL in browser',
        },
      ],
    };

    const parsed = PlanSchema.safeParse(fullPlan);
    expect(parsed.success).toBe(true);
    if (parsed.success && !('error' in parsed.data)) {
      expect(parsed.data.projectTitle).toBe('SaaS Dashboard Redesign');
      expect(parsed.data.milestones).toHaveLength(3);
    }
  });

  it('validates an error plan output for unsafe briefs', () => {
    const errorPlan = {
      error: 'The requested brief asks for unauthorized vulnerability exploitation, which is not permitted.',
    };
    const parsed = PlanSchema.safeParse(errorPlan);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect('error' in parsed.data).toBe(true);
    }
  });
});
