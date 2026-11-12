import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../server.js';
import { initDb, closeDb, getDb, schema, seedDatabase } from '../db/index.js';
import { loadConfig } from '@milestone/shared';
import { formatReviewRecord } from '../services/reviewFormatter.js';
import { createTestUserSession } from './helpers/authTestHelper.js';

describe('Review Formatting and Deliverables API DTO', () => {
  let server: Awaited<ReturnType<typeof buildServer>>;
  const testProjectId = 'proj_rev_fmt_test';
  const testMilestoneId = 'ms_rev_fmt_01';
  const testDeliverableId = 'deliv_rev_fmt_01';
  const testReviewId = 'rev_fmt_01';

  beforeAll(async () => {
    const db = await initDb({ useMemory: true });
    await seedDatabase(db);
    const config = loadConfig({
      NODE_ENV: 'test',
      PAYPAL_ENV: 'mock',
      PORT: '8080',
      LLM_PROVIDER: 'fixture',
    });
    server = buildServer(config);
    await server.ready();

    const now = new Date();
    await db.insert(schema.projects).values({
      id: testProjectId,
      title: 'Review DTO Test Project',
      brief: 'Verify review confidence, reasoning, and payout batch status DTOs.',
      currency: 'USD',
      totalCents: 9000,
      status: 'active',
      autonomyMode: 'assisted',
      releaseWindowSeconds: 20,
      clientId: 'user_client_01',
      freelancerId: 'user_freelancer_01',
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(schema.milestones).values({
      id: testMilestoneId,
      projectId: testProjectId,
      name: 'Database Schema & Seed Data',
      amountCents: 9000,
      percent: 100,
      status: 'releasing',
      criteria: [
        'PostgreSQL DDL script exists',
        'Seed INSERT statements included',
      ],
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(schema.deliverables).values({
      id: testDeliverableId,
      milestoneId: testMilestoneId,
      kind: 'text',
      payload: { text: 'CREATE TABLE users (id UUID PRIMARY KEY);' },
      submittedBy: 'user_freelancer_01',
      submittedAt: now,
    });

    await db.insert(schema.reviews).values({
      id: testReviewId,
      milestoneId: testMilestoneId,
      deliverableId: testDeliverableId,
      kind: 'initial',
      model: 'gemini-3.5-flash-lite',
      promptVersion: 'reviewer.v1',
      verdict: 'release',
      minConfidence: 0.94,
      criteriaResults: [
        {
          index: 0,
          result: 'pass',
          evidence: 'CREATE TABLE statements present with keys and indexes.',
          confidence: 0.96,
        },
        {
          index: 1,
          result: 'pass',
          evidence: 'Valid INSERT INTO seed statements verified.',
          confidence: 0.94,
        },
      ],
      trace: [{ step: 1, tool: 'submit_verdict', args: {} }],
      injectionSuspected: false,
      latencyMs: 650,
      tokens: { input: 320, output: 110 },
      createdAt: now,
    });

    await db.insert(schema.payoutBatches).values({
      id: 'pb_rev_fmt_01',
      milestoneId: testMilestoneId,
      senderBatchId: `ms_${testMilestoneId}`,
      paypalBatchId: 'BATCH_REV_FMT_01',
      status: 'UNCLAIMED',
      createdAt: now,
    });
  }, 60000);

  afterAll(async () => {
    const db = getDb();
    await db.delete(schema.projects).where(
      (await import('drizzle-orm')).eq(schema.projects.id, testProjectId)
    );
    await server.close();
    await closeDb();
  });

  it('formatReviewRecord produces finite confidence and synthesized reasoning without NaN', () => {
    const formatted = formatReviewRecord({
      id: testReviewId,
      milestoneId: testMilestoneId,
      deliverableId: testDeliverableId,
      kind: 'initial',
      model: 'gemini-3.5-flash-lite',
      promptVersion: 'reviewer.v1',
      verdict: 'release',
      minConfidence: 0.94,
      criteriaResults: [
        { index: 0, result: 'pass', evidence: 'DDL found', confidence: 0.96 },
      ],
      trace: [],
      injectionSuspected: false,
      latencyMs: 500,
      tokens: { input: 10, output: 10 },
      createdAt: new Date(),
    });

    expect(formatted.confidence).toBe(0.94);
    expect(Number.isFinite(formatted.confidence)).toBe(true);
    expect(formatted.reasoning).toContain('Criterion 1: DDL found');
    expect(formatted.evaluatedCriteria).toHaveLength(1);
    expect(formatted.evaluatedCriteria[0]?.satisfied).toBe(true);
    expect(formatted.promptInjectionSuspected).toBe(false);
  });

  it('GET /api/projects/:id/deliverables, /reviews, and /milestones/:id/reviews return formatted review fields and payoutStatus', async () => {
    const clientUser = await createTestUserSession({
      userId: 'user_client_01',
      role: 'client',
    });

    const delivRes = await server.inject({
      method: 'GET',
      url: `/api/projects/${testProjectId}/deliverables`,
      headers: { ...clientUser.headers },
    });
    expect(delivRes.statusCode).toBe(200);
    const delivBody = JSON.parse(delivRes.body);
    expect(delivBody.milestones[0].payoutStatus).toBe('UNCLAIMED');
    expect(delivBody.reviews[0].confidence).toBe(0.94);
    expect(delivBody.reviews[0].model).toBe('gemini-3.5-flash-lite');
    expect(delivBody.reviews[0].reasoning).toContain('Criterion 1:');
    expect(delivBody.reviews[0].evaluatedCriteria).toHaveLength(2);
    expect(delivBody.reviews[0].evaluatedCriteria[0].satisfied).toBe(true);

    const revRes = await server.inject({
      method: 'GET',
      url: `/api/projects/${testProjectId}/reviews`,
      headers: { ...clientUser.headers },
    });
    expect(revRes.statusCode).toBe(200);
    const revBody = JSON.parse(revRes.body);
    expect(revBody[0].confidence).toBe(0.94);
    expect(revBody[0].reasoning).toContain('Criterion 2:');

    const msRevRes = await server.inject({
      method: 'GET',
      url: `/api/milestones/${testMilestoneId}/reviews`,
      headers: { ...clientUser.headers },
    });
    expect(msRevRes.statusCode).toBe(200);
    const msRevBody = JSON.parse(msRevRes.body);
    expect(msRevBody.reviews[0].confidence).toBe(0.94);
    expect(msRevBody.reviews[0].evaluatedCriteria[1].satisfied).toBe(true);
  });
});
