import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc, and } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb, schema } from '../db/index.js';
import { requireRole } from '../auth/index.js';
import { createLlmPort } from '../ai/llmFactory.js';
import { PlannerService } from '../ai/planner.js';
import { validatePlanGraph, computeSchedule } from '../ai/scheduler.js';
import { sseHub } from '../services/sse.js';
import {
  createRateLimitHandler,
  validateBriefLength,
  validateDemoBudget,
  checkAndRecordLlmCall,
} from '../services/abuseGuards.js';
import type { ComputedPlan, LlmPort, AppConfig } from '@milestone/shared';

export async function registerProjectRoutes(server: FastifyInstance): Promise<void> {
  const { projects, milestones, ledgerEntries, tasks, dependencies, users, activity, deliverables, reviews } = schema;

  function formatMilestoneRecord(m: any) {
    const criteriaList: string[] = Array.isArray(m.criteria)
      ? m.criteria.map((c: any) => (typeof c === 'string' ? c : c?.description || c?.id || ''))
      : [];
    return {
      ...m,
      title: m.title || m.name,
      name: m.name || m.title,
      paymentStatus: m.paymentStatus || m.status,
      acceptanceCriteria: criteriaList,
    };
  }

  // List all projects accessible to current user
  server.get('/api/projects', async (request: FastifyRequest, reply: FastifyReply) => {
    const db = getDb();
    const allProjects = await db.select().from(projects).orderBy(desc(projects.createdAt));

    const isFreelancer =
      request.user?.role === 'freelancer' ||
      (request.headers['x-persona'] as string | undefined)?.toLowerCase() === 'freelancer';

    const scopedProjects = isFreelancer
      ? allProjects.map((p) => {
          const rest = { ...p };
          delete (rest as { autonomyMode?: string }).autonomyMode;
          delete (rest as { releaseWindowSeconds?: number }).releaseWindowSeconds;
          return rest;
        })
      : allProjects;

    return reply.send({ success: true, projects: scopedProjects });
  });

  // Get project by ID with milestones and ledger summary
  server.get<{ Params: { id: string } }>(
    '/api/projects/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const db = getDb();
      const { id } = request.params;

      const [proj] = await db.select().from(projects).where(eq(projects.id, id));
      if (!proj) {
        return reply.status(404).send({ error: 'NotFound', message: `Project "${id}" not found.` });
      }

      const projMilestones = await db
        .select()
        .from(milestones)
        .where(eq(milestones.projectId, id));

      const projLedger = await db
        .select()
        .from(ledgerEntries)
        .where(eq(ledgerEntries.projectId, id));

      // Calculate paid and held sums
      const paidCents = projLedger
        .filter((l) => l.type === 'released')
        .reduce((sum, l) => sum + l.amountCents, 0);

      const fundedCents = projLedger
        .filter((l) => l.type === 'funded')
        .reduce((sum, l) => sum + l.amountCents, 0);

      const [client] = await db.select().from(users).where(eq(users.id, proj.clientId));
      const [freelancer] = proj.freelancerId
        ? await db.select().from(users).where(eq(users.id, proj.freelancerId))
        : [null];

      // Role-scoped DTO: Freelancer endpoints never include autonomy settings, client notes, or invite data
      const isFreelancer =
        request.user?.role === 'freelancer' ||
        (request.headers['x-persona'] as string | undefined)?.toLowerCase() === 'freelancer';

      const projectDto = isFreelancer
        ? {
            ...proj,
            autonomyMode: undefined,
            releaseWindowSeconds: undefined,
          }
        : proj;

      return reply.send({
        success: true,
        project: projectDto,
        client,
        freelancer,
        milestones: projMilestones.map(formatMilestoneRecord),
        ledger: {
          entries: projLedger,
          totalCents: proj.totalCents,
          fundedCents,
          paidCents,
          heldCents: fundedCents - paidCents,
        },
      });
    }
  );

  // Create a new project draft (Role: client)
  server.post<{ Body: { title?: string; brief: string; totalBudget?: number } }>(
    '/api/projects',
    { preHandler: [requireRole(['client'])] },
    async (request, reply) => {
      const db = getDb();
      const { title, brief, totalBudget } = request.body || {};
      const briefValidation = validateBriefLength(brief || '');
      if (!briefValidation.valid) {
        return reply.status(400).send({ error: 'ValidationError', message: briefValidation.error });
      }

      const id = `proj_${randomUUID().substring(0, 8)}`;
      const numericBudget = Number(totalBudget);
      const safeBudget = Number.isFinite(numericBudget) && numericBudget > 0 ? numericBudget : 2000;
      const totalCents = Math.round(safeBudget * 100);

      const appConfig = (server as unknown as { appConfig?: AppConfig }).appConfig;
      const isDemo = Boolean(appConfig?.DEMO_MODE || process.env.DEMO_MODE === 'true');
      const budgetValidation = validateDemoBudget(totalCents, isDemo);
      if (!budgetValidation.valid) {
        return reply.status(400).send({ error: 'ValidationError', message: budgetValidation.error });
      }

      try {
        let clientId = request.user?.userId || 'user_client_01';
        const [existingClient] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, clientId))
          .limit(1);

        if (!existingClient) {
          clientId = 'user_client_01';
          await db
            .insert(users)
            .values({
              id: 'user_client_01',
              name: 'Sarah Lin (Acme Corp)',
              email: 'sarah@acme-corp.com',
              avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
            })
            .onConflictDoNothing();
        }

        const [newProject] = await db
          .insert(projects)
          .values({
            id,
            title: title?.trim() || 'New Milestone Project',
            brief,
            currency: 'USD',
            totalCents,
            status: 'draft',
            autonomyMode: 'assisted',
            releaseWindowSeconds: 20,
            clientId,
            freelancerId: null,
            isDemo: false,
          })
          .returning();

        return reply.status(201).send({ success: true, project: newProject });
      } catch (err) {
        server.log.error({ err }, 'Failed to create project draft');
        const msg = err instanceof Error ? err.message : 'Database insert error';
        return reply.status(500).send({
          error: 'ProjectCreationError',
          message: `Failed to create project draft: ${msg}`,
        });
      }
    }
  );

  // Update project settings (Role: client only)
  server.patch<{ Params: { id: string }; Body: { title?: string; autonomyMode?: string; releaseWindowSeconds?: number } }>(
    '/api/projects/:id',
    { preHandler: [requireRole(['client'])] },
    async (request, reply) => {
      const db = getDb();
      const { id } = request.params;
      const { title, autonomyMode, releaseWindowSeconds } = request.body;

      const updateData: Partial<typeof projects.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (title) updateData.title = title;
      if (autonomyMode) updateData.autonomyMode = autonomyMode;
      if (releaseWindowSeconds != null) updateData.releaseWindowSeconds = releaseWindowSeconds;

      const [updated] = await db
        .update(projects)
        .set(updateData)
        .where(eq(projects.id, id))
        .returning();

      if (!updated) {
        return reply.status(404).send({ error: 'NotFound', message: `Project "${id}" not found.` });
      }

      return reply.send({ success: true, project: updated });
    }
  );

  // List tasks for a project
  server.get<{ Params: { id: string } }>(
    '/api/projects/:id/tasks',
    async (request, reply) => {
      const db = getDb();
      const { id } = request.params;

      const taskRows = await db.select().from(tasks).where(eq(tasks.projectId, id));
      const depRows = await db.select().from(dependencies).where(eq(dependencies.projectId, id));
      const milestoneRows = await db.select().from(milestones).where(eq(milestones.projectId, id));

      return reply.send({
        success: true,
        tasks: taskRows,
        dependencies: depRows,
        milestones: milestoneRows.map(formatMilestoneRecord),
      });
    }
  );

  // List milestones for a project
  server.get<{ Params: { id: string } }>(
    '/api/projects/:id/milestones',
    async (request, reply) => {
      const db = getDb();
      const { id } = request.params;
      const projMilestones = await db
        .select()
        .from(milestones)
        .where(eq(milestones.projectId, id))
        .orderBy(milestones.createdAt);
      return reply.send(projMilestones.map(formatMilestoneRecord));
    }
  );

  // List deliverables and associated reviews/milestones for a project
  server.get<{ Params: { id: string } }>(
    '/api/projects/:id/deliverables',
    async (request, reply) => {
      const db = getDb();
      const { id } = request.params;

      const projMilestones = await db
        .select()
        .from(milestones)
        .where(eq(milestones.projectId, id))
        .orderBy(milestones.createdAt);

      const projDeliverables = await db
        .select({
          id: deliverables.id,
          milestoneId: deliverables.milestoneId,
          kind: deliverables.kind,
          payload: deliverables.payload,
          submittedBy: deliverables.submittedBy,
          submittedAt: deliverables.submittedAt,
        })
        .from(deliverables)
        .innerJoin(milestones, eq(deliverables.milestoneId, milestones.id))
        .where(eq(milestones.projectId, id))
        .orderBy(desc(deliverables.submittedAt));

      const projReviews = await db
        .select({
          id: reviews.id,
          milestoneId: reviews.milestoneId,
          deliverableId: reviews.deliverableId,
          kind: reviews.kind,
          model: reviews.model,
          promptVersion: reviews.promptVersion,
          trace: reviews.trace,
          criteriaResults: reviews.criteriaResults,
          verdict: reviews.verdict,
          minConfidence: reviews.minConfidence,
          injectionSuspected: reviews.injectionSuspected,
          latencyMs: reviews.latencyMs,
          tokens: reviews.tokens,
          createdAt: reviews.createdAt,
        })
        .from(reviews)
        .innerJoin(milestones, eq(reviews.milestoneId, milestones.id))
        .where(eq(milestones.projectId, id))
        .orderBy(desc(reviews.createdAt));

      return reply.send({
        success: true,
        deliverables: projDeliverables,
        milestones: projMilestones.map(formatMilestoneRecord),
        reviews: projReviews,
      });
    }
  );

  // List reviews for a project
  server.get<{ Params: { id: string } }>(
    '/api/projects/:id/reviews',
    async (request, reply) => {
      const db = getDb();
      const { id } = request.params;

      const projReviews = await db
        .select({
          id: reviews.id,
          milestoneId: reviews.milestoneId,
          deliverableId: reviews.deliverableId,
          kind: reviews.kind,
          model: reviews.model,
          promptVersion: reviews.promptVersion,
          trace: reviews.trace,
          criteriaResults: reviews.criteriaResults,
          verdict: reviews.verdict,
          minConfidence: reviews.minConfidence,
          injectionSuspected: reviews.injectionSuspected,
          latencyMs: reviews.latencyMs,
          tokens: reviews.tokens,
          createdAt: reviews.createdAt,
        })
        .from(reviews)
        .innerJoin(milestones, eq(reviews.milestoneId, milestones.id))
        .where(eq(milestones.projectId, id))
        .orderBy(desc(reviews.createdAt));

      return reply.send(projReviews);
    }
  );

  // List activity trail for a project
  server.get<{ Params: { id: string } }>(
    '/api/projects/:id/activity',
    async (request, reply) => {
      const db = getDb();
      const { id } = request.params;
      const activityRows = await db
        .select()
        .from(activity)
        .where(eq(activity.projectId, id))
        .orderBy(desc(activity.ts));
      return reply.send({ success: true, activity: activityRows });
    }
  );

  // Comprehensive audit export (JSON)
  server.get<{ Params: { id: string } }>(
    '/api/projects/:id/audit',
    async (request, reply) => {
      const db = getDb();
      const { id } = request.params;

      const [proj] = await db.select().from(projects).where(eq(projects.id, id));
      if (!proj) {
        return reply.status(404).send({ error: 'NotFound', message: `Project "${id}" not found.` });
      }

      const projMilestones = await db.select().from(milestones).where(eq(milestones.projectId, id));
      const projTasks = await db.select().from(tasks).where(eq(tasks.projectId, id));
      const projLedger = await db
        .select()
        .from(ledgerEntries)
        .where(eq(ledgerEntries.projectId, id))
        .orderBy(desc(ledgerEntries.createdAt));
      const projActivity = await db
        .select()
        .from(activity)
        .where(eq(activity.projectId, id))
        .orderBy(desc(activity.ts));
      const projDeliverables = await db
        .select()
        .from(deliverables)
        .innerJoin(milestones, eq(deliverables.milestoneId, milestones.id))
        .where(eq(milestones.projectId, id));
      const projReviews = await db
        .select()
        .from(reviews)
        .innerJoin(milestones, eq(reviews.milestoneId, milestones.id))
        .where(eq(milestones.projectId, id));

      return reply.send({
        exportTimestamp: new Date().toISOString(),
        project: proj,
        milestones: projMilestones,
        tasks: projTasks,
        ledger: projLedger,
        activity: projActivity,
        deliverables: projDeliverables.map((d) => d.deliverables),
        reviews: projReviews.map((r) => r.reviews),
      });
    }
  );

  // ==========================================
  // Planner Endpoints (M5)
  // ==========================================

  // Generate an AI project plan from brief (Role: client only)
  server.post<{
    Body: {
      brief: string;
      totalBudget?: number;
      durationHint?: string;
      currency?: 'USD';
    };
  }>(
    '/api/projects/plan',
    { preHandler: [requireRole(['client']), createRateLimitHandler('planner', 10, 60_000)] },
    async (request, reply) => {
      const { brief, totalBudget, durationHint, currency } = request.body || {};
      const briefValidation = validateBriefLength(brief || '');
      if (!briefValidation.valid) {
        return reply.status(400).send({
          error: 'ValidationError',
          message: briefValidation.error,
        });
      }

      const numericBudget = Number(totalBudget);
      const safeBudget = Number.isFinite(numericBudget) && numericBudget > 0 ? numericBudget : 2000;
      const totalCents = Math.round(safeBudget * 100);
      const appConfig = (request.server as unknown as { appConfig?: AppConfig }).appConfig;
      const isDemo = Boolean(appConfig?.DEMO_MODE || process.env.DEMO_MODE === 'true');
      const budgetValidation = validateDemoBudget(totalCents, isDemo);
      if (!budgetValidation.valid) {
        return reply.status(400).send({ error: 'ValidationError', message: budgetValidation.error });
      }

      const llmCheck = checkAndRecordLlmCall();
      if (!llmCheck.allowed) {
        return reply.status(429).send({
          error: 'DailyCapReached',
          message: llmCheck.message,
        });
      }

    try {
      const llm =
        (request.server as unknown as { llmAdapter?: LlmPort }).llmAdapter ||
        createLlmPort((request.server as unknown as { appConfig?: AppConfig }).appConfig || {});
      const planner = new PlannerService(llm);

      const result = await planner.generatePlan({
        brief,
        totalBudget: safeBudget,
        durationHint,
        currency: currency || 'USD',
      });

      if (!result.success) {
        return reply.status(422).send({
          success: false,
          error: result.error || 'Failed to generate a valid plan.',
          attempts: result.attempts,
          trace: result.trace,
          validationHistory: result.validationHistory,
        });
      }

      return reply.send({
        success: true,
        plan: result.plan,
        attempts: result.attempts,
        trace: result.trace,
        isFixture: result.plan?.isFixture ?? (result.trace?.provider === 'fixture'),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({
        error: 'PlannerExecutionError',
        message: `Plan generation failed: ${msg}`,
      });
    }
  });

  // Apply an approved plan to a project in the database
  server.post<{
    Params: { id: string };
    Body: { plan: ComputedPlan };
  }>(
    '/api/projects/:id/plan/apply',
    { preHandler: [requireRole(['client'])] },
    async (request, reply) => {
      const db = getDb();
      const { id } = request.params;
      const { plan } = request.body || {};

      if (!plan || !Array.isArray(plan.tasks) || !Array.isArray(plan.milestones)) {
        return reply.status(400).send({
          error: 'ValidationError',
          message: 'Invalid plan payload: tasks and milestones arrays are required.',
        });
      }

      // Check project exists
      const [proj] = await db.select().from(projects).where(eq(projects.id, id));
      if (!proj) {
        return reply.status(404).send({ error: 'NotFound', message: `Project "${id}" not found.` });
      }

      // Validate plan graph and percentages
      const issues = validatePlanGraph(plan.tasks, plan.milestones);
      if (issues.length > 0) {
        return reply.status(422).send({
          error: 'PlanValidationError',
          message: 'Plan failed server-side validation.',
          issues,
        });
      }

      // Recompute schedule to ensure exact date & money allocations
      const { scheduledTasks, scheduledMilestones } = computeSchedule(
        plan.tasks,
        plan.milestones,
        plan.totalBudget,
        new Date()
      );

      const toDbTaskId = (rawId: string) => (rawId.startsWith(`${id}__`) ? rawId : `${id}__${rawId}`);
      const toDbMilestoneId = (rawId: string) => (rawId.startsWith(`${id}__ms_`) ? rawId : `${id}__ms_${rawId}`);

      try {
        // Perform atomic database update
        await db.transaction(async (tx) => {
          // 1. Delete existing milestones, dependencies, tasks
          await tx.delete(milestones).where(eq(milestones.projectId, id));
          await tx.delete(dependencies).where(eq(dependencies.projectId, id));
          await tx.delete(tasks).where(eq(tasks.projectId, id));

          // 2. Insert standard delivery tasks
          for (let idx = 0; idx < scheduledTasks.length; idx++) {
            const t = scheduledTasks[idx];
            const dbTaskId = toDbTaskId(t.id);
            await tx.insert(tasks).values({
              id: dbTaskId,
              projectId: id,
              name: t.name,
              startDate: t.startDate,
              durationDays: t.durationDays,
              percentDone: 0,
              milestoneId: null,
              sortOrder: idx,
              bryntumExt: { milestone: false, linkedMilestoneId: t.milestoneId ? toDbMilestoneId(t.milestoneId) : null },
            });

            // Insert task-to-task dependencies
            for (const depId of t.dependsOn) {
              await tx.insert(dependencies).values({
                id: `dep_${id}_${t.id}_${depId}_${randomUUID().substring(0, 6)}`,
                projectId: id,
                fromTaskId: toDbTaskId(depId),
                toTaskId: dbTaskId,
                type: 2, // Finish-to-Start
                lag: 0,
              });
            }
          }

          // 3. Insert milestone tasks and milestone records
          for (let idx = 0; idx < scheduledMilestones.length; idx++) {
            const m = scheduledMilestones[idx];
            const milestoneTaskId = toDbTaskId(m.id);
            const dbMilestoneId = toDbMilestoneId(m.id);

            // Milestone task in Gantt
            await tx.insert(tasks).values({
              id: milestoneTaskId,
              projectId: id,
              name: m.name,
              startDate: m.date,
              durationDays: 0,
              percentDone: 0,
              milestoneId: dbMilestoneId,
              sortOrder: scheduledTasks.length + idx,
              bryntumExt: {
                milestone: true,
                paymentStatus: 'unfunded',
                amountCents: m.amountCents,
              },
            });

            // Milestone finish-to-start dependencies from afterTaskIds
            for (const prevTaskId of m.afterTaskIds) {
              await tx.insert(dependencies).values({
                id: `dep_${id}_${m.id}_${prevTaskId}_${randomUUID().substring(0, 6)}`,
                projectId: id,
                fromTaskId: toDbTaskId(prevTaskId),
                toTaskId: milestoneTaskId,
                type: 2,
                lag: 0,
              });
            }

            // Milestone record in milestones table
            const criteriaList = m.acceptanceCriteria.map((descText, cIdx) => ({
              id: `crit_${id}_${m.id}_${cIdx + 1}`,
              description: descText,
              passed: false,
            }));

            await tx.insert(milestones).values({
              id: dbMilestoneId,
              projectId: id,
              taskId: milestoneTaskId,
              name: m.name,
              amountCents: m.amountCents,
              percent: m.paymentPercent,
              criteria: criteriaList,
              deliverableType: m.deliverableType,
              status: 'unfunded',
            });
          }

          // 4. Update project record
          await tx
            .update(projects)
            .set({
              title: plan.projectTitle || proj.title,
              brief: plan.summary || proj.brief,
              totalCents: plan.totalCents,
              status: 'planned',
              planJson: {
                ...plan,
                tasks: scheduledTasks,
                milestones: scheduledMilestones,
              },
              planPromptVersion: plan.promptVersion || 'planner.v1',
              updatedAt: new Date(),
            })
            .where(eq(projects.id, id));

          // 5. Log activity
          await tx.insert(activity).values({
            id: `act_${randomUUID().substring(0, 8)}`,
            projectId: id,
            actor: 'client',
            kind: 'plan_approved',
            text: `Client approved delivery plan "${plan.projectTitle}" with ${scheduledMilestones.length} milestones.`,
            meta: {
              totalCents: plan.totalCents,
              tasksCount: scheduledTasks.length,
              milestonesCount: scheduledMilestones.length,
            },
          });
        });
      } catch (err) {
        server.log.error({ err, projectId: id }, 'Failed to apply approved plan');
        const msg = err instanceof Error ? err.message : 'Database transaction error';
        return reply.status(500).send({
          error: 'PlanApplyError',
          message: `Failed to apply approved plan: ${msg}`,
        });
      }

      // Broadcast update over SSE
      sseHub.broadcast(id, 'plan.applied', {
        projectId: id,
        projectTitle: plan.projectTitle,
        tasksCount: scheduledTasks.length,
        milestonesCount: scheduledMilestones.length,
      });

      const [updatedProj] = await db.select().from(projects).where(eq(projects.id, id));

      return reply.send({
        success: true,
        project: updatedProj,
        tasksCount: scheduledTasks.length,
        milestonesCount: scheduledMilestones.length,
      });
    }
  );

  // Edit milestone acceptance criteria before funding (Role: client only)
  server.patch<{
    Params: { id: string; milestoneId: string };
    Body: { criteria: Array<{ id: string; description: string; passed?: boolean }> };
  }>(
    '/api/projects/:id/milestones/:milestoneId/criteria',
    { preHandler: [requireRole(['client'])] },
    async (request, reply) => {
      const db = getDb();
      const { id, milestoneId } = request.params;
      const { criteria } = request.body || {};

      if (!Array.isArray(criteria) || criteria.length === 0) {
        return reply.status(400).send({
          error: 'ValidationError',
          message: 'Criteria must be a non-empty array.',
        });
      }

      const [proj] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
      if (!proj) {
        return reply.status(404).send({ error: 'NotFound', message: `Project "${id}" not found.` });
      }

      if (proj.status !== 'draft' && proj.status !== 'planned') {
        return reply.status(400).send({
          error: 'CriteriaLockedError',
          message: 'Acceptance criteria are locked after project funding.',
        });
      }

      const [updated] = await db
        .update(milestones)
        .set({ criteria, updatedAt: new Date() })
        .where(and(eq(milestones.id, milestoneId), eq(milestones.projectId, id)))
        .returning();

      if (!updated) {
        return reply.status(404).send({ error: 'NotFound', message: `Milestone "${milestoneId}" not found.` });
      }

      return reply.send({ success: true, milestone: updated });
    }
  );

  // Update task execution progress (Role: freelancer only)
  server.patch<{
    Params: { id: string; taskId: string };
    Body: { percentDone: number };
  }>(
    '/api/projects/:id/tasks/:taskId/progress',
    { preHandler: [requireRole(['freelancer'])] },
    async (request, reply) => {
      const db = getDb();
      const { id, taskId } = request.params;
      const { percentDone } = request.body || {};

      if (typeof percentDone !== 'number' || percentDone < 0 || percentDone > 100) {
        return reply.status(400).send({
          error: 'ValidationError',
          message: 'percentDone must be a number between 0 and 100.',
        });
      }

      const [updated] = await db
        .update(tasks)
        .set({ percentDone, updatedAt: new Date() })
        .where(and(eq(tasks.id, taskId), eq(tasks.projectId, id)))
        .returning();

      if (!updated) {
        return reply.status(404).send({ error: 'NotFound', message: `Task "${taskId}" not found.` });
      }

      return reply.send({ success: true, task: updated });
    }
  );
}
