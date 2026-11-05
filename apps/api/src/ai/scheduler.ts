import type {
  PlanTask,
  PlanMilestone,
  ScheduledTask,
  ScheduledMilestone,
} from '@milestone/shared';
import { distributePercentages } from '@milestone/shared';

/**
 * Check if a given Date is a weekend (Saturday or Sunday).
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}

/**
 * Get the next business day (skipping Saturday and Sunday) if currently on a weekend.
 */
export function ensureWorkingDay(date: Date): Date {
  const result = new Date(date);
  while (isWeekend(result)) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}

/**
 * Format a Date to YYYY-MM-DD.
 */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Add working days (in 0.5 day increments) to a start date.
 */
export function addWorkingDays(startDate: Date, durationDays: number): Date {
  let current = new Date(startDate);
  current = ensureWorkingDay(current);

  // Each full day advances to the next business day
  const fullDays = Math.floor(durationDays);
  const halfDay = durationDays % 1 !== 0;

  let added = 0;
  while (added < fullDays) {
    current.setDate(current.getDate() + 1);
    current = ensureWorkingDay(current);
    added++;
  }

  // If half a day remains, keep the same day or advance if duration is purely 0.5
  if (halfDay && fullDays === 0) {
    // 0.5 days finishes on the same working day
    return current;
  }

  return current;
}

export interface ValidationIssue {
  field: string;
  message: string;
}

export const VAGUE_WORDS = [
  'good',
  'nice',
  'clean',
  'professional',
  'modern',
  'user-friendly',
  'high quality',
  'high-quality',
  'best practice',
  'best-practice',
  'scalable',
  'robust',
];

/**
 * Validate a plan against server-side business and topological rules.
 */
export function validatePlanGraph(
  tasks: PlanTask[],
  milestones: PlanMilestone[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // 1. Task ID uniqueness
  const taskIds = new Set<string>();
  for (const t of tasks) {
    if (taskIds.has(t.id)) {
      issues.push({ field: `tasks.${t.id}`, message: `Duplicate task ID: ${t.id}` });
    }
    taskIds.add(t.id);
  }

  // 2. All task dependencies exist
  for (const t of tasks) {
    for (const depId of t.dependsOn) {
      if (!taskIds.has(depId)) {
        issues.push({
          field: `tasks.${t.id}.dependsOn`,
          message: `Task ${t.id} depends on nonexistent task: ${depId}`,
        });
      }
      if (depId === t.id) {
        issues.push({
          field: `tasks.${t.id}.dependsOn`,
          message: `Task ${t.id} cannot depend on itself`,
        });
      }
    }
  }

  // 3. No dependency cycles (Topological sort using Kahn's algorithm)
  const inDegree: Record<string, number> = {};
  const adj: Record<string, string[]> = {};
  for (const id of taskIds) {
    inDegree[id] = 0;
    adj[id] = [];
  }

  for (const t of tasks) {
    for (const depId of t.dependsOn) {
      if (taskIds.has(depId)) {
        adj[depId].push(t.id);
        inDegree[t.id] = (inDegree[t.id] || 0) + 1;
      }
    }
  }

  const queue: string[] = [];
  for (const id of taskIds) {
    if (inDegree[id] === 0) {
      queue.push(id);
    }
  }

  let visitedCount = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    visitedCount++;
    for (const neighbor of adj[current]) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (visitedCount < taskIds.size) {
    issues.push({
      field: 'tasks.dependencies',
      message: 'Dependency cycle detected among tasks. Tasks must form a directed acyclic graph (DAG).',
    });
  }

  // 4. Milestone task references exist
  for (const m of milestones) {
    for (const taskId of m.afterTaskIds) {
      if (!taskIds.has(taskId)) {
        issues.push({
          field: `milestones.${m.id}.afterTaskIds`,
          message: `Milestone ${m.id} references nonexistent task: ${taskId}`,
        });
      }
    }
  }

  // 5. Payment percentages sum to exactly 100
  const totalPercent = milestones.reduce((sum, m) => sum + m.paymentPercent, 0);
  if (totalPercent !== 100) {
    issues.push({
      field: 'milestones.paymentPercent',
      message: `Milestone payment percentages sum to ${totalPercent}%, but must sum to exactly 100%`,
    });
  }

  // 6. Percentage constraints (first >= 10, last >= 15, no milestone > 40)
  if (milestones.length > 0) {
    if (milestones[0].paymentPercent < 10) {
      issues.push({
        field: `milestones.${milestones[0].id}.paymentPercent`,
        message: `The first milestone must be at least 10% (received ${milestones[0].paymentPercent}%)`,
      });
    }
    const last = milestones[milestones.length - 1];
    if (last.paymentPercent < 15) {
      issues.push({
        field: `milestones.${last.id}.paymentPercent`,
        message: `The last milestone must be at least 15% (received ${last.paymentPercent}%)`,
      });
    }
    for (const m of milestones) {
      if (m.paymentPercent > 40) {
        issues.push({
          field: `milestones.${m.id}.paymentPercent`,
          message: `Milestone ${m.id} exceeds maximum percentage of 40% (received ${m.paymentPercent}%)`,
        });
      }
    }
  }

  // 7. Check for vague words in acceptance criteria
  for (const m of milestones) {
    for (let i = 0; i < m.acceptanceCriteria.length; i++) {
      const criterion = m.acceptanceCriteria[i].toLowerCase();
      for (const vagueWord of VAGUE_WORDS) {
        // match word boundary
        const regex = new RegExp(`\\b${vagueWord}\\b`, 'i');
        if (regex.test(criterion)) {
          // If criterion contains vague words without quantifiable metrics
          issues.push({
            field: `milestones.${m.id}.acceptanceCriteria[${i}]`,
            message: `Criterion contains subjective word "${vagueWord}". Replace with an objective, observable verification check (e.g. exists, passes, returns HTTP 200).`,
          });
          break;
        }
      }
    }
  }

  return issues;
}

/**
 * Compute the timeline and financial allocations for a valid plan.
 */
export function computeSchedule(
  tasks: PlanTask[],
  milestones: PlanMilestone[],
  totalBudget: number,
  projectStartDate: Date = new Date()
): { scheduledTasks: ScheduledTask[]; scheduledMilestones: ScheduledMilestone[] } {
  const start = ensureWorkingDay(projectStartDate);

  // Map task to milestone if in afterTaskIds
  const taskToMilestoneMap = new Map<string, string>();
  for (const m of milestones) {
    for (const tid of m.afterTaskIds) {
      taskToMilestoneMap.set(tid, m.id);
    }
  }

  // Topological ordering for schedule calculation
  const taskMap = new Map<string, PlanTask>();
  const inDegree: Record<string, number> = {};
  const adj: Record<string, string[]> = {};
  for (const t of tasks) {
    taskMap.set(t.id, t);
    inDegree[t.id] = 0;
    adj[t.id] = [];
  }
  for (const t of tasks) {
    for (const dep of t.dependsOn) {
      adj[dep].push(t.id);
      inDegree[t.id] = (inDegree[t.id] || 0) + 1;
    }
  }

  const queue: string[] = [];
  for (const t of tasks) {
    if (inDegree[t.id] === 0) queue.push(t.id);
  }

  const taskDates = new Map<string, { start: Date; end: Date }>();

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const task = taskMap.get(currentId)!;

    let taskStart = new Date(start);
    // Task start is max of all dependency end dates
    for (const depId of task.dependsOn) {
      const depDates = taskDates.get(depId);
      if (depDates && depDates.end > taskStart) {
        taskStart = new Date(depDates.end);
      }
    }

    taskStart = ensureWorkingDay(taskStart);
    const taskEnd = addWorkingDays(taskStart, task.durationDays);
    taskDates.set(currentId, { start: taskStart, end: taskEnd });

    for (const neighbor of adj[currentId]) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) queue.push(neighbor);
    }
  }

  const scheduledTasks: ScheduledTask[] = tasks.map((t) => {
    const dates = taskDates.get(t.id) ?? { start, end: addWorkingDays(start, t.durationDays) };
    return {
      ...t,
      startDate: formatDate(dates.start),
      endDate: formatDate(dates.end),
      milestoneId: taskToMilestoneMap.get(t.id) ?? null,
    };
  });

  // Calculate milestone amounts via largest-remainder method
  const totalCents = Math.round(totalBudget * 100);
  const percentages = milestones.map((m) => m.paymentPercent);
  const amounts = distributePercentages(totalCents, percentages);

  const scheduledMilestones: ScheduledMilestone[] = milestones.map((m, idx) => {
    // Milestone date is max end date of its afterTaskIds
    let milestoneDate = new Date(start);
    for (const tid of m.afterTaskIds) {
      const dates = taskDates.get(tid);
      if (dates && dates.end > milestoneDate) {
        milestoneDate = new Date(dates.end);
      }
    }

    return {
      ...m,
      date: formatDate(milestoneDate),
      amountCents: amounts[idx],
    };
  });

  return { scheduledTasks, scheduledMilestones };
}

