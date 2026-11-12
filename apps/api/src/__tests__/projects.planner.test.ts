import { describe, it, expect, beforeAll } from 'vitest';
import { buildServer } from '../server.js';
import { initDb, getDb, schema, seedDatabase } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { createTestUserSession } from './helpers/authTestHelper.js';
import { loadConfig, type ComputedPlan } from '@milestone/shared';

describe('Project Planner API Endpoints', () => {
  let server: Awaited<ReturnType<typeof buildServer>>;
  const projectId = 'proj_brand_launch';

  beforeAll(async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      PAYPAL_ENV: 'mock',
      PORT: '8080',
      LLM_PROVIDER: 'fixture',
    });
    const db = await initDb({ useMemory: true });
    await seedDatabase(db);
    server = buildServer(config);
  }, 60000);

  it('POST /api/projects/plan returns 400 when brief is missing', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/projects/plan',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('ValidationError');
  });

  it('POST /api/projects/plan returns valid plan for a client brief', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/projects/plan',
      payload: {
        brief: 'Build a customer retention data analytics pipeline and cohort dashboard',
        totalBudget: 3000,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.plan).toBeDefined();
    expect(body.plan.projectTitle).toBe('Customer Retention & Churn Analytics');
    expect(body.plan.totalCents).toBe(300000);
    expect(body.plan.tasks.length).toBeGreaterThanOrEqual(6);
    expect(body.plan.milestones.length).toBe(3);
  });

  it('POST /api/projects/plan returns 422 error on unsafe brief', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/projects/plan',
      payload: {
        brief: 'Crack password hashes from unauthorized server',
      },
    });

    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error).toContain('Refused');
  });

  it('POST /api/projects/:id/plan/apply updates project and persists tasks/milestones in DB', async () => {
    // First generate a plan
    const planRes = await server.inject({
      method: 'POST',
      url: '/api/projects/plan',
      payload: {
        brief: 'Mobile biometric auth and offline sync',
        totalBudget: 2800,
      },
    });
    expect(planRes.statusCode).toBe(200);
    const generatedPlan: ComputedPlan = JSON.parse(planRes.body).plan;

    // Reset project to draft status for initial planning
    const db = getDb();
    await db.update(schema.projects).set({ status: 'draft' }).where(eq(schema.projects.id, projectId));

    // Apply the plan as client
    const clientUser = await createTestUserSession({
      userId: 'user_client_01',
      role: 'client',
    });

    const applyRes = await server.inject({
      method: 'POST',
      url: `/api/projects/${projectId}/plan/apply`,
      headers: { ...clientUser.headers },
      payload: { plan: generatedPlan },
    });

    expect(applyRes.statusCode).toBe(200);
    const applyBody = JSON.parse(applyRes.body);
    expect(applyBody.success).toBe(true);
    expect(applyBody.project.status).toBe('planned');
    expect(applyBody.project.totalCents).toBe(280000);

    // Verify DB state
    const [dbProj] = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId));
    expect(dbProj.title).toBe(generatedPlan.projectTitle);
    expect(dbProj.status).toBe('planned');

    const dbMilestones = await db.select().from(schema.milestones).where(eq(schema.milestones.projectId, projectId));
    expect(dbMilestones.length).toBe(generatedPlan.milestones.length);

    const dbTasks = await db.select().from(schema.tasks).where(eq(schema.tasks.projectId, projectId));
    expect(dbTasks.length).toBeGreaterThanOrEqual(generatedPlan.tasks.length);
  });

  it('POST /api/projects/:id/plan/apply scopes task & milestone IDs for newly created projects', async () => {
    const clientUser = await createTestUserSession({ userId: 'user_client_01', role: 'client' });

    const createRes = await server.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { ...clientUser.headers },
      payload: {
        title: 'Second Project Alongside Seed',
        brief: 'Build a customer retention data analytics pipeline and cohort dashboard',
        totalBudget: 400,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const createdProjectId: string = JSON.parse(createRes.body).project.id;

    const planRes = await server.inject({
      method: 'POST',
      url: '/api/projects/plan',
      headers: { ...clientUser.headers },
      payload: {
        brief: 'Build a customer retention data analytics pipeline and cohort dashboard',
        totalBudget: 400,
      },
    });
    expect(planRes.statusCode).toBe(200);
    const generatedPlan: ComputedPlan = JSON.parse(planRes.body).plan;

    const applyRes = await server.inject({
      method: 'POST',
      url: `/api/projects/${createdProjectId}/plan/apply`,
      headers: { ...clientUser.headers },
      payload: { plan: generatedPlan },
    });
    expect(applyRes.statusCode).toBe(200);
    const applyBody = JSON.parse(applyRes.body);
    expect(applyBody.success).toBe(true);

    // Ensure Gantt load works on the newly planned project
    const ganttRes = await server.inject({
      method: 'GET',
      url: `/api/gantt/${createdProjectId}/load`,
      headers: { ...clientUser.headers },
    });
    expect(ganttRes.statusCode).toBe(200);
    const ganttBody = JSON.parse(ganttRes.body);
    expect(ganttBody.tasks.rows.some((r: { milestone: boolean }) => r.milestone)).toBe(true);
    expect(ganttBody.tasks.rows.some((r: { milestone: boolean }) => !r.milestone)).toBe(true);
  });
});
