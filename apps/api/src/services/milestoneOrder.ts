import { and, eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { AppDatabase } from '../db/index.js';
import { activity, dependencies, milestones, projects, tasks } from '../db/schema.js';

type DbLike = Pick<AppDatabase, 'select' | 'update' | 'insert'>;

export type MilestoneRow = typeof milestones.$inferSelect;
export type TaskRow = typeof tasks.$inferSelect;
export type DependencyRow = typeof dependencies.$inferSelect;

/**
 * Derive display completion percentage (0..100) from milestone payment/review status.
 */
export function deriveMilestonePercentDone(status?: string | null): number {
  switch (status) {
    case 'paid':
    case 'closed':
    case 'approved':
    case 'awaiting_client':
    case 'releasing':
      return 100;
    case 'in_review':
    case 'submitted':
    case 'appealed':
      return 75;
    case 'changes_requested':
      return 50;
    default:
      return 0;
  }
}

/**
 * Fetch milestones for a project sorted deterministically by linked task sortOrder,
 * then createdAt ascending, then natural id order (prevents PostgreSQL MVCC tuple
 * reordering from scrambling Milestone 1 / 2 / 3 numbers after status updates).
 */
export async function fetchOrderedMilestones(
  db: DbLike,
  projectId: string
): Promise<MilestoneRow[]> {
  const [milestoneRows, taskRows] = await Promise.all([
    db.select().from(milestones).where(eq(milestones.projectId, projectId)),
    db
      .select({
        id: tasks.id,
        milestoneId: tasks.milestoneId,
        sortOrder: tasks.sortOrder,
      })
      .from(tasks)
      .where(eq(tasks.projectId, projectId)),
  ]);

  const orderByMilestoneId = new Map<string, number>();
  const orderByTaskId = new Map<string, number>();

  for (const t of taskRows) {
    orderByTaskId.set(t.id, t.sortOrder);
    if (t.milestoneId) {
      const existing = orderByMilestoneId.get(t.milestoneId);
      if (existing === undefined || t.sortOrder < existing) {
        orderByMilestoneId.set(t.milestoneId, t.sortOrder);
      }
    }
  }

  const getOrder = (m: MilestoneRow): number => {
    const byMs = orderByMilestoneId.get(m.id);
    if (byMs !== undefined) return byMs;
    if (m.taskId) {
      const byTask = orderByTaskId.get(m.taskId);
      if (byTask !== undefined) return byTask;
    }
    return Number.MAX_SAFE_INTEGER;
  };

  return [...milestoneRows].sort((a, b) => {
    const orderDiff = getOrder(a) - getOrder(b);
    if (orderDiff !== 0) return orderDiff;

    const timeDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (timeDiff !== 0) return timeDiff;

    return a.id.localeCompare(b.id, undefined, { numeric: true });
  });
}

/**
 * Locate direct task IDs and upstream execution task IDs feeding a specific milestone,
 * stopping reverse traversal at any prior milestone node.
 */
export function findMilestoneLinkedTaskIds(
  taskRows: TaskRow[],
  depRows: DependencyRow[],
  milestoneRow: MilestoneRow
): { directTaskIds: Set<string>; upstreamTaskIds: Set<string> } {
  const taskById = new Map<string, TaskRow>();
  const reverseDeps = new Map<string, string[]>();

  for (const t of taskRows) {
    taskById.set(t.id, t);
  }
  for (const d of depRows) {
    const list = reverseDeps.get(d.toTaskId) ?? [];
    list.push(d.fromTaskId);
    reverseDeps.set(d.toTaskId, list);
  }

  const directTaskIds = new Set<string>();
  const upstreamTaskIds = new Set<string>();
  const queue: string[] = [];

  for (const t of taskRows) {
    if (t.milestoneId === milestoneRow.id || (milestoneRow.taskId && t.id === milestoneRow.taskId)) {
      directTaskIds.add(t.id);
      queue.push(t.id);
    } else {
      const ext = t.bryntumExt as { linkedMilestoneId?: string | null } | null;
      if (ext?.linkedMilestoneId === milestoneRow.id) {
        upstreamTaskIds.add(t.id);
        queue.push(t.id);
      }
    }
  }

  const visited = new Set<string>(queue);
  while (queue.length > 0) {
    const curr = queue.shift()!;
    const predecessors = reverseDeps.get(curr) ?? [];
    for (const prevId of predecessors) {
      if (visited.has(prevId)) continue;
      visited.add(prevId);
      const prevTask = taskById.get(prevId);
      if (!prevTask) continue;
      // Do not cross preceding milestone boundaries or tasks explicitly linked to a different milestone
      if (prevTask.milestoneId !== null || prevTask.durationDays === 0) continue;
      const prevExt = prevTask.bryntumExt as { linkedMilestoneId?: string | null } | null;
      if (prevExt?.linkedMilestoneId && prevExt.linkedMilestoneId !== milestoneRow.id) continue;
      upstreamTaskIds.add(prevId);
      queue.push(prevId);
    }
  }

  return { directTaskIds, upstreamTaskIds };
}

/**
 * Compute effective percentDone (0..100) for all tasks in a schedule by combining persisted
 * progress with milestone status inheritance for both milestone markers and upstream work tasks.
 */
export function computeDerivedTaskPercentMap(
  taskRows: TaskRow[],
  depRows: DependencyRow[],
  milestoneRows: MilestoneRow[]
): Map<string, number> {
  const derivedMap = new Map<string, number>();
  for (const t of taskRows) {
    derivedMap.set(t.id, t.percentDone ?? 0);
  }

  for (const m of milestoneRows) {
    const derivedPct = deriveMilestonePercentDone(m.status);
    if (derivedPct <= 0) continue;

    const { directTaskIds, upstreamTaskIds } = findMilestoneLinkedTaskIds(taskRows, depRows, m);
    for (const id of directTaskIds) {
      derivedMap.set(id, Math.max(derivedMap.get(id) ?? 0, derivedPct));
    }
    for (const id of upstreamTaskIds) {
      derivedMap.set(id, Math.max(derivedMap.get(id) ?? 0, derivedPct));
    }
  }

  return derivedMap;
}

/**
 * Persist updated percentDone on the milestone task and upstream execution tasks when
 * a milestone moves through submission, review, approval, or settlement.
 */
export async function syncMilestoneProgress(
  db: DbLike,
  projectId: string,
  milestoneId: string,
  targetStatus: string
): Promise<void> {
  const [milestoneRow] = await db
    .select()
    .from(milestones)
    .where(and(eq(milestones.id, milestoneId), eq(milestones.projectId, projectId)))
    .limit(1);

  if (!milestoneRow) return;

  const derivedPct = deriveMilestonePercentDone(targetStatus);
  const [taskRows, depRows] = await Promise.all([
    db.select().from(tasks).where(eq(tasks.projectId, projectId)),
    db.select().from(dependencies).where(eq(dependencies.projectId, projectId)),
  ]);

  const { directTaskIds, upstreamTaskIds } = findMilestoneLinkedTaskIds(
    taskRows,
    depRows,
    milestoneRow
  );

  const now = new Date();
  if (directTaskIds.size > 0) {
    await db
      .update(tasks)
      .set({ percentDone: derivedPct, updatedAt: now })
      .where(and(eq(tasks.projectId, projectId), inArray(tasks.id, Array.from(directTaskIds))));
  }

  if (derivedPct > 0 && upstreamTaskIds.size > 0) {
    const toRaise = taskRows
      .filter((t) => upstreamTaskIds.has(t.id) && (t.percentDone ?? 0) < derivedPct)
      .map((t) => t.id);

    if (toRaise.length > 0) {
      await db
        .update(tasks)
        .set({ percentDone: derivedPct, updatedAt: now })
        .where(and(eq(tasks.projectId, projectId), inArray(tasks.id, toRaise)));
    }
  }
}

/**
 * Marks project status as 'closed' when every milestone is paid, returning true if transitioned.
 * Safe to invoke lazily on reads too so pre-existing completed projects sync automatically.
 */
export async function syncProjectCompletionStatus(
  db: DbLike,
  projectId: string
): Promise<boolean> {
  const [projRows, milestoneRows] = await Promise.all([
    db.select().from(projects).where(eq(projects.id, projectId)).limit(1),
    db.select().from(milestones).where(eq(milestones.projectId, projectId)),
  ]);

  const proj = projRows[0];
  if (!proj || milestoneRows.length === 0) return false;

  const allPaid = milestoneRows.every((m) => m.status === 'paid' || m.status === 'closed');
  if (!allPaid || proj.status === 'closed' || proj.status === 'cancelled' || proj.status === 'failed') {
    return false;
  }

  const now = new Date();
  await db
    .update(projects)
    .set({ status: 'closed', updatedAt: now })
    .where(eq(projects.id, projectId));

  const existingCompletion = await db
    .select({ id: activity.id })
    .from(activity)
    .where(and(eq(activity.projectId, projectId), eq(activity.kind, 'project_completed')))
    .limit(1);

  if (existingCompletion.length === 0) {
    await db.insert(activity).values({
      id: `act_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      projectId,
      actor: 'system',
      kind: 'project_completed',
      text: `All ${milestoneRows.length} milestones paid via PayPal. Project marked completed.`,
      meta: { milestoneCount: milestoneRows.length },
      ts: now,
    });
  }

  return true;
}
