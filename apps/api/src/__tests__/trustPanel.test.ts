import { describe, it, expect, beforeAll } from 'vitest';
import { buildServer } from '../server.js';
import { initDb, seedDatabase } from '../db/index.js';
import { loadConfig } from '@milestone/shared';

describe('Trust Panel & Audit API Endpoints', () => {
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

  it('GET /api/projects/:id/activity returns activity trail', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/projects/${projectId}/activity`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.activity)).toBe(true);
  });

  it('GET /api/milestones/:id/reviews returns reviews and deliverables for milestone', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/milestones/ms-01/reviews`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.milestoneId).toBe('ms-01');
    expect(Array.isArray(body.reviews)).toBe(true);
    expect(Array.isArray(body.deliverables)).toBe(true);
  });

  it('GET /api/projects/:id/audit returns complete JSON audit trail', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/projects/${projectId}/audit`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.exportTimestamp).toBeDefined();
    expect(body.project).toBeDefined();
    expect(body.project.id).toBe(projectId);
    expect(Array.isArray(body.milestones)).toBe(true);
    expect(Array.isArray(body.tasks)).toBe(true);
    expect(Array.isArray(body.ledger)).toBe(true);
    expect(Array.isArray(body.activity)).toBe(true);
    expect(Array.isArray(body.deliverables)).toBe(true);
    expect(Array.isArray(body.reviews)).toBe(true);
  });
});

