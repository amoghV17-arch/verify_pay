import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, inArray, desc } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb, schema } from '../db/index.js';
import {
  computeDerivedTaskPercentMap,
  syncProjectCompletionStatus,
} from '../services/milestoneOrder.js';

interface BryntumSyncPayload {
  requestId?: number | string;
  tasks?: {
    added?: Array<Record<string, unknown>>;
    updated?: Array<Record<string, unknown>>;
    removed?: Array<{ id: string }>;
  };
  dependencies?: {
    added?: Array<Record<string, unknown>>;
    updated?: Array<Record<string, unknown>>;
    removed?: Array<{ id: string }>;
  };
}

export async function registerGanttRoutes(server: FastifyInstance): Promise<void> {
  const { projects, tasks, dependencies, milestones, reviews } = schema;

  // GET /api/gantt/:projectId/load
  server.get<{ Params: { projectId: string } }>(
    '/api/gantt/:projectId/load',
    async (request: FastifyRequest<{ Params: { projectId: string } }>, reply: FastifyReply) => {
      const db = getDb();
      const { projectId } = request.params;

      const [proj] = await db.select().from(projects).where(eq(projects.id, projectId));
      if (!proj) {
        return reply.status(404).send({ success: false, message: `Project "${projectId}" not found.` });
      }

      const transitionedToClosed = await syncProjectCompletionStatus(db, projectId);
      const effectiveProjectStatus = transitionedToClosed ? 'closed' : proj.status;

      const taskRows = await db
        .select()
        .from(tasks)
        .where(eq(tasks.projectId, projectId))
        .orderBy(tasks.sortOrder);

      const depRows = await db
        .select()
        .from(dependencies)
        .where(eq(dependencies.projectId, projectId));

      const milestoneRows = await db
        .select()
        .from(milestones)
        .where(eq(milestones.projectId, projectId));

      const milestoneIds = milestoneRows.map((m) => m.id);
      const latestReviewByMilestone = new Map<
        string,
        Map<string, { passed?: boolean; evidence?: string }>
      >();
      if (milestoneIds.length > 0) {
        const reviewRows = await db
          .select()
          .from(reviews)
          .where(inArray(reviews.milestoneId, milestoneIds))
          .orderBy(desc(reviews.createdAt));

        for (const rev of reviewRows) {
          if (latestReviewByMilestone.has(rev.milestoneId)) continue;
          const critMap = new Map<string, { passed?: boolean; evidence?: string }>();
          const results = Array.isArray(rev.criteriaResults)
            ? (rev.criteriaResults as Array<{
                id?: string;
                passed?: boolean;
                evidence?: string;
              }>)
            : [];
          results.forEach((cr, idx) => {
            const entry = { passed: cr.passed, evidence: cr.evidence };
            if (cr.id) critMap.set(cr.id, entry);
            critMap.set(String(idx), entry);
          });
          latestReviewByMilestone.set(rev.milestoneId, critMap);
        }
      }

      const derivedPercentMap = computeDerivedTaskPercentMap(taskRows, depRows, milestoneRows);
      const milestoneMap = new Map(milestoneRows.map((m) => [m.id, m]));

      // Format tasks according to Bryntum Model expectations
      const formattedTasks = taskRows.map((t) => {
        const ms = t.milestoneId ? milestoneMap.get(t.milestoneId) : undefined;
        const isMilestone = t.durationDays === 0 || !!t.milestoneId;
        const critReviewMap = ms ? latestReviewByMilestone.get(ms.id) : undefined;
        const hydratedCriteria = Array.isArray(ms?.criteria)
          ? ms.criteria.map((c, idx) => {
              const revInfo = critReviewMap?.get(c.id) ?? critReviewMap?.get(String(idx));
              const isSettled =
                ms.status === 'paid' || ms.status === 'approved' || ms.status === 'releasing';
              return {
                ...c,
                passed: revInfo?.passed ?? (c.passed || isSettled),
                evidence: revInfo?.evidence ?? c.evidence,
              };
            })
          : undefined;

        return {
          id: t.id,
          name: t.name,
          startDate: t.startDate,
          duration: t.durationDays,
          durationUnit: 'd',
          percentDone: derivedPercentMap.get(t.id) ?? t.percentDone,
          milestone: isMilestone,
          parentId: t.parentId,
          milestoneId: t.milestoneId,
          // Protected money & status fields directly from server-side milestone record:
          amountCents: ms ? ms.amountCents : 0,
          paymentStatus: ms ? ms.status : (isMilestone ? 'unfunded' : undefined),
          deliverableType: ms?.deliverableType,
          acceptanceCriteria: hydratedCriteria,
        };
      });

      const validStartDates = taskRows
        .map((t) => t.startDate)
        .filter((d): d is string => typeof d === 'string' && d.length >= 10)
        .sort();
      const earliestStartDate = validStartDates[0] || '2026-11-08';

      // Format dependencies according to Bryntum DependencyModel expectations
      const formattedDeps = depRows.map((d) => ({
        id: d.id,
        from: d.fromTaskId,
        to: d.toTaskId,
        type: d.type,
        lag: d.lag,
      }));

      return reply.send({
        success: true,
        project: {
          id: proj.id,
          status: effectiveProjectStatus,
          startDate: earliestStartDate,
        },
        tasks: {
          rows: formattedTasks,
        },
        dependencies: {
          rows: formattedDeps,
        },
      });
    }
  );

  // POST /api/gantt/:projectId/sync
  server.post<{ Params: { projectId: string }; Body: BryntumSyncPayload }>(
    '/api/gantt/:projectId/sync',
    async (request: FastifyRequest<{ Params: { projectId: string }; Body: BryntumSyncPayload }>, reply: FastifyReply) => {
      const db = getDb();
      const { projectId } = request.params;
      const { requestId, tasks: taskChanges, dependencies: depChanges } = request.body || {};

      // Role check on every mutation
      const user = request.user;
      if (!user) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Authentication session required to sync Gantt mutations.',
        });
      }

      if (!['client', 'freelancer'].includes(user.role)) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: `Role "${user.role}" is not authorized to modify Gantt schedule. Must be client or freelancer.`,
        });
      }

      const [proj] = await db.select().from(projects).where(eq(projects.id, projectId));
      if (!proj) {
        return reply.status(404).send({ success: false, message: `Project "${projectId}" not found.` });
      }

      const syncedTaskRows: Array<Record<string, unknown>> = [];
      const syncedDepRows: Array<Record<string, unknown>> = [];

      // 1. Process Task Additions - Block creating milestone-linked tasks
      if (taskChanges?.added && taskChanges.added.length > 0) {
        for (const added of taskChanges.added) {
          if (
            added.milestoneId ||
            added.milestone === true ||
            (added.duration != null && Number(added.duration) === 0)
          ) {
            return reply.status(400).send({
              error: 'MilestoneTamperError',
              message:
                'Cannot create milestone-linked tasks via Gantt sync. Milestones must be generated through the planning and funding lifecycle.',
            });
          }

          const phantomId = added.$PhantomId as string | undefined;
          const newId = (added.id as string) || `t_${randomUUID().slice(0, 8)}`;

          const newStartDate = (added.startDate as string) || new Date().toISOString().split('T')[0];
          const newDuration = added.duration != null ? Number(added.duration) : 1;
          const newPercent = added.percentDone != null ? Number(added.percentDone) : 0;
          const newName = (added.name as string) || 'New Task';

          await db.insert(tasks).values({
            id: newId,
            projectId,
            name: newName,
            startDate: newStartDate,
            durationDays: newDuration,
            percentDone: newPercent,
            parentId: (added.parentId as string) || null,
            milestoneId: null, // Strictly ignore milestoneId from client
            sortOrder: (added.sortOrder as number) || 99,
          });

          syncedTaskRows.push({
            ...(phantomId ? { $PhantomId: phantomId } : {}),
            id: newId,
            name: newName,
            startDate: newStartDate,
            duration: newDuration,
            percentDone: newPercent,
            milestone: false,
          });
        }
      }

      // 2. Process Task Updates with STRICT MONEY & CRITERIA PROTECTION
      if (taskChanges?.updated && taskChanges.updated.length > 0) {
        // Lock acceptance criteria after funding
        const isFunded = proj.status !== 'draft' && proj.status !== 'planned';

        for (const updated of taskChanges.updated) {
          const taskId = updated.id as string;
          if (!taskId) continue;

          if (isFunded && (updated.acceptanceCriteria !== undefined || updated.criteria !== undefined)) {
            return reply.status(400).send({
              error: 'CriteriaLockedError',
              message: `Acceptance criteria are locked after project funding for project "${projectId}".`,
            });
          }

          // Fetch current database record to preserve server-controlled fields
          const [existing] = await db.select().from(tasks).where(eq(tasks.id, taskId));
          if (!existing) continue;

          // Permitted schedule mutations ONLY:
          const updates: Partial<typeof tasks.$inferInsert> = {
            updatedAt: new Date(),
          };

          if (updated.name != null) updates.name = String(updated.name);
          if (updated.startDate != null) updates.startDate = String(updated.startDate);
          if (updated.duration != null) updates.durationDays = Number(updated.duration);
          if (updated.percentDone != null) updates.percentDone = Number(updated.percentDone);
          if (updated.parentId !== undefined) updates.parentId = (updated.parentId as string) || null;
          if (updated.sortOrder != null) updates.sortOrder = Number(updated.sortOrder);

          // NOTE: Any client values for amountCents, paymentStatus, status,
          // or milestoneId are DELIBERATELY IGNORED and stripped out.

          await db.update(tasks).set(updates).where(eq(tasks.id, taskId));

          // Fetch milestone if this task represents one
          let currentMilestone;
          if (existing.milestoneId) {
            [currentMilestone] = await db
              .select()
              .from(milestones)
              .where(eq(milestones.id, existing.milestoneId));
          }

          syncedTaskRows.push({
            id: taskId,
            name: updates.name ?? existing.name,
            startDate: updates.startDate ?? existing.startDate,
            duration: updates.durationDays ?? existing.durationDays,
            percentDone: updates.percentDone ?? existing.percentDone,
            milestone: (updates.durationDays ?? existing.durationDays) === 0 || !!existing.milestoneId,
            milestoneId: existing.milestoneId,
            // Returned to client confirming the unchanged server values:
            amountCents: currentMilestone ? currentMilestone.amountCents : 0,
            paymentStatus: currentMilestone ? currentMilestone.status : undefined,
          });
        }
      }

      // 3. Process Task Removals - Block deleting milestone-linked tasks
      if (taskChanges?.removed && taskChanges.removed.length > 0) {
        const removeIds = taskChanges.removed.map((t) => t.id).filter(Boolean);
        if (removeIds.length > 0) {
          const existingToRemove = await db
            .select()
            .from(tasks)
            .where(inArray(tasks.id, removeIds));

          const milestoneTask = existingToRemove.find(
            (t) => t.milestoneId !== null || t.durationDays === 0
          );
          if (milestoneTask) {
            return reply.status(400).send({
              error: 'MilestoneTamperError',
              message: `Cannot delete milestone-linked task "${milestoneTask.id}". Milestone tasks cannot be removed via Gantt sync.`,
            });
          }

          await db.delete(tasks).where(inArray(tasks.id, removeIds));
        }
      }

      // 4. Process Dependency Additions
      if (depChanges?.added && depChanges.added.length > 0) {
        for (const added of depChanges.added) {
          const phantomId = added.$PhantomId as string | undefined;
          const newId = (added.id as string) || `d_${randomUUID().slice(0, 8)}`;
          const from = added.from as string;
          const to = added.to as string;
          const type = added.type != null ? Number(added.type) : 2;
          const lag = added.lag != null ? Number(added.lag) : 0;

          if (from && to) {
            await db.insert(dependencies).values({
              id: newId,
              projectId,
              fromTaskId: from,
              toTaskId: to,
              type,
              lag,
            });

            syncedDepRows.push({
              ...(phantomId ? { $PhantomId: phantomId } : {}),
              id: newId,
              from,
              to,
              type,
              lag,
            });
          }
        }
      }

      // 5. Process Dependency Updates
      if (depChanges?.updated && depChanges.updated.length > 0) {
        for (const updated of depChanges.updated) {
          const depId = updated.id as string;
          if (!depId) continue;

          const updates: Partial<typeof dependencies.$inferInsert> = {};
          if (updated.from) updates.fromTaskId = String(updated.from);
          if (updated.to) updates.toTaskId = String(updated.to);
          if (updated.type != null) updates.type = Number(updated.type);
          if (updated.lag != null) updates.lag = Number(updated.lag);

          await db.update(dependencies).set(updates).where(eq(dependencies.id, depId));
          syncedDepRows.push({ id: depId, ...updates });
        }
      }

      // 6. Process Dependency Removals
      if (depChanges?.removed && depChanges.removed.length > 0) {
        const removeIds = depChanges.removed.map((d) => d.id).filter(Boolean);
        if (removeIds.length > 0) {
          await db.delete(dependencies).where(inArray(dependencies.id, removeIds));
        }
      }

      return reply.send({
        success: true,
        requestId,
        tasks: {
          rows: syncedTaskRows,
        },
        dependencies: {
          rows: syncedDepRows,
        },
      });
    }
  );
}
