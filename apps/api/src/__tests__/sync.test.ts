import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { loadConfig } from '@milestone/shared';
import { buildServer } from '../server.js';
import { initDb, closeDb, getDb, schema } from '../db/index.js';
import { seedDatabase } from '../db/seed.js';
import { eq } from 'drizzle-orm';
import { createTestUserSession } from './helpers/authTestHelper.js';

describe('M2 Data Layer & Gantt Sync Integration Suite', () => {
  let server: FastifyInstance;
  let db: ReturnType<typeof getDb>;
  let clientHeaders: Record<string, string>;
  let freelancerHeaders: Record<string, string>;

  beforeAll(async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      PAYPAL_ENV: 'mock',
      PORT: '8090',
      LLM_PROVIDER: 'fixture',
    });

    db = await initDb({ useMemory: true });
    await seedDatabase(db);

    server = buildServer(config);
    await server.ready();

    const clientUser = await createTestUserSession({ userId: 'user_client_01', role: 'client' });
    const freelancerUser = await createTestUserSession({ userId: 'user_freelancer_01', role: 'freelancer' });
    clientHeaders = clientUser.headers;
    freelancerHeaders = freelancerUser.headers;
  }, 60000);

  afterAll(async () => {
    await server.close();
    await closeDb();
  });

  it('loads seeded Gantt project with tasks and dependencies', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/gantt/proj_brand_launch/load',
      headers: { ...clientHeaders },
    });

    expect(response.statusCode).toBe(200);
    const data = response.json();
    expect(data.success).toBe(true);
    expect(data.project.id).toBe('proj_brand_launch');

    // 12 execution tasks + 4 milestone marker tasks = 16 tasks
    expect(data.tasks.rows.length).toBe(16);
    expect(data.dependencies.rows.length).toBe(15);

    // Verify Milestone 1 protected fields
    const m1 = data.tasks.rows.find((t: { id: string }) => t.id === 'm1');
    expect(m1).toBeDefined();
    expect(m1.amountCents).toBe(120000);
    expect(m1.paymentStatus).toBe('paid');
  });

  it('persists schedule edits via sync endpoint', async () => {
    const syncPayload = {
      requestId: 101,
      tasks: {
        updated: [
          {
            id: 't1',
            name: 'Updated Stakeholder Interviews',
            startDate: '2026-11-10',
            duration: 5,
            percentDone: 75,
          },
        ],
      },
    };

    const response = await server.inject({
      method: 'POST',
      url: '/api/gantt/proj_brand_launch/sync',
      headers: { ...clientHeaders },
      payload: syncPayload,
    });

    expect(response.statusCode).toBe(200);
    const result = response.json();
    expect(result.success).toBe(true);
    expect(result.tasks.rows[0].name).toBe('Updated Stakeholder Interviews');
    expect(result.tasks.rows[0].duration).toBe(5);

    // Verify persistence directly from DB
    const [persisted] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, 't1'));
    expect(persisted.name).toBe('Updated Stakeholder Interviews');
    expect(persisted.startDate).toBe('2026-11-10');
    expect(persisted.durationDays).toBe(5);
    expect(persisted.percentDone).toBe(75);
  });

  it('CRITICAL ACCEPTANCE: server ignores client changes to money and status fields', async () => {
    // Malicious or accidental client payload trying to set $99,999.99 and 'paid' status on milestone 4
    const maliciousPayload = {
      requestId: 999,
      tasks: {
        updated: [
          {
            id: 'm4',
            name: 'Tampered Milestone 4',
            startDate: '2026-12-20',
            duration: 0,
            amountCents: 9999999, // $99,999.99 forged value
            paymentStatus: 'paid', // forged status
            status: 'paid',
          },
        ],
      },
    };

    const response = await server.inject({
      method: 'POST',
      url: '/api/gantt/proj_brand_launch/sync',
      headers: { ...clientHeaders },
      payload: maliciousPayload,
    });

    expect(response.statusCode).toBe(200);
    const result = response.json();
    expect(result.success).toBe(true);

    // The response returns the server's genuine unchanged values
    const returnedRow = result.tasks.rows[0];
    expect(returnedRow.amountCents).toBe(260000); // exactly $2,600.00, NOT $99,999.99
    expect(returnedRow.paymentStatus).toBe('funded'); // NOT 'paid'

    // Verify milestone record in database is completely untouched
    const [milestoneInDb] = await db.select().from(schema.milestones).where(eq(schema.milestones.id, 'ms-04'));
    expect(milestoneInDb.amountCents).toBe(260000);
    expect(milestoneInDb.status).toBe('funded');
  });

  it('rejects unauthenticated caller attempting Gantt sync mutation with HTTP 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/gantt/proj_brand_launch/sync',
      payload: {
        tasks: {
          added: [{ name: 'Unauthenticated Task', startDate: '2026-11-15', duration: 2 }],
        },
      },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('Unauthorized');
  });

  it('rejects caller with unauthorized role attempting Gantt sync mutation with HTTP 403', async () => {
    const guestUser = await createTestUserSession({ userId: 'user_unauthorized_guest' });
    const res = await server.inject({
      method: 'POST',
      url: '/api/gantt/proj_brand_launch/sync',
      headers: { ...guestUser.headers },
      payload: {
        tasks: {
          added: [{ name: 'Guest Task', startDate: '2026-11-15', duration: 2 }],
        },
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('Forbidden');
  });

  it('blocks creating milestone-linked tasks or milestone markers via Gantt sync', async () => {
    // Attempt 1: task with milestoneId
    const res1 = await server.inject({
      method: 'POST',
      url: '/api/gantt/proj_brand_launch/sync',
      headers: { ...clientHeaders },
      payload: {
        tasks: {
          added: [{ name: 'Forged Milestone Task', milestoneId: 'ms_forged', duration: 1 }],
        },
      },
    });
    expect(res1.statusCode).toBe(400);
    expect(res1.json().error).toBe('MilestoneTamperError');

    // Attempt 2: task with milestone: true or duration: 0
    const res2 = await server.inject({
      method: 'POST',
      url: '/api/gantt/proj_brand_launch/sync',
      headers: { ...clientHeaders },
      payload: {
        tasks: {
          added: [{ name: 'Zero Duration Marker', milestone: true, duration: 0 }],
        },
      },
    });
    expect(res2.statusCode).toBe(400);
    expect(res2.json().error).toBe('MilestoneTamperError');
  });

  it('blocks deleting milestone-linked tasks via Gantt sync', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/gantt/proj_brand_launch/sync',
      headers: { ...clientHeaders },
      payload: {
        tasks: {
          removed: [{ id: 'm4' }], // m4 is linked to milestone ms-04
        },
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('MilestoneTamperError');
    expect(res.json().message).toContain('Milestone tasks cannot be removed via Gantt sync');

    // Verify task is still in DB
    const [taskInDb] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, 'm4'));
    expect(taskInDb).toBeDefined();
  });

  it('locks acceptance criteria modifications after project is funded', async () => {
    // proj_brand_launch is already funded in seed
    const res = await server.inject({
      method: 'POST',
      url: '/api/gantt/proj_brand_launch/sync',
      headers: { ...clientHeaders },
      payload: {
        tasks: {
          updated: [
            {
              id: 'm4',
              acceptanceCriteria: ['Tampered criterion 1', 'Tampered criterion 2'],
            },
          ],
        },
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('CriteriaLockedError');
  });

  it('strictly ignores milestoneId sent in task updates', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/gantt/proj_brand_launch/sync',
      headers: { ...clientHeaders },
      payload: {
        tasks: {
          updated: [
            {
              id: 't2',
              milestoneId: 'forged_milestone_id_999',
              name: 'Updated Task 2 Name',
            },
          ],
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const row = res.json().tasks.rows[0];
    expect(row.name).toBe('Updated Task 2 Name');
    expect(row.milestoneId).toBeNull();

    // Verify database record
    const [taskInDb] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, 't2'));
    expect(taskInDb.milestoneId).toBeNull();
  });

  it('allows freelancer to update standard task progress via Gantt sync', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/gantt/proj_brand_launch/sync',
      headers: { ...freelancerHeaders },
      payload: {
        tasks: {
          updated: [
            {
              id: 't3',
              percentDone: 90,
            },
          ],
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const row = res.json().tasks.rows[0];
    expect(row.percentDone).toBe(90);
  });

  it('enforces role checks on protected project modifications', async () => {
    // 1. Freelancer attempts to update project settings (restricted to client)
    const patchResponse = await server.inject({
      method: 'PATCH',
      url: '/api/projects/proj_brand_launch',
      headers: { ...freelancerHeaders },
      payload: { title: 'Unauthorized Project Title' },
    });

    expect(patchResponse.statusCode).toBe(403);
    const errorBody = patchResponse.json();
    expect(errorBody.error).toBe('Forbidden');

    // 2. Client updates project settings and succeeds
    const allowedPatch = await server.inject({
      method: 'PATCH',
      url: '/api/projects/proj_brand_launch',
      headers: { ...clientHeaders },
      payload: { title: 'Brand-site Redesign (Client Updated)' },
    });

    expect(allowedPatch.statusCode).toBe(200);
    expect(allowedPatch.json().project.title).toBe('Brand-site Redesign (Client Updated)');
  });

  it('enforces database constraints: idempotency key and single released per milestone', async () => {
    const { ledgerEntries } = schema;

    // Invariant 1: Idempotency key must be unique
    await expect(
      db.insert(ledgerEntries).values({
        id: 'duplicate_test_1',
        projectId: 'proj_brand_launch',
        type: 'funded',
        amountCents: 1000,
        idempotencyKey: 'idemp_fund_proj_brand_launch', // duplicate of seeded key
      })
    ).rejects.toThrow();

    // Invariant 2: At most one 'released' entry per milestone (partial unique index)
    // ms-01 already has one 'released' entry in seed. Inserting a second must fail:
    await expect(
      db.insert(ledgerEntries).values({
        id: 'duplicate_release_test',
        projectId: 'proj_brand_launch',
        milestoneId: 'ms-01',
        type: 'released',
        amountCents: 5000,
        idempotencyKey: 'different_idempotency_key_123',
      })
    ).rejects.toThrow();
  });
});

