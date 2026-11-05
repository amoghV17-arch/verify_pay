/**
 * M7 Autonomy modes, assisted release window scheduler, objection, and appeal tests.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { initDb, closeDb, getDb } from '../db/index.js';
import { schema } from '../db/index.js';
import { AutonomySchedulerService } from '../services/autonomyScheduler.js';
import { ReviewerService } from '../services/reviewer.js';
import { MockPayPalAdapter } from '../paypal/mockAdapter.js';
import { LedgerService } from '../services/ledger.js';
import { buildServer } from '../server.js';
import { loadConfig, assertTransition, canTransition, type LlmPort, type LlmCompletionRequest, type LlmCompletionResponse } from '@milestone/shared';
import type { FastifyInstance } from 'fastify';

describe('M7 Autonomy Modes and Scheduler Suite', () => {
  let db: ReturnType<typeof getDb>;
  let mockPayPal: MockPayPalAdapter;
  let ledger: LedgerService;
  let server: FastifyInstance;

  const projectId = 'proj_m7_test';
  const clientId = 'user_client_01';
  const freelancerId = 'user_freelancer_01';

  beforeAll(async () => {
    db = await initDb({ useMemory: true });
    mockPayPal = new MockPayPalAdapter({ defaultWebhookDelayMs: 0 });
    ledger = new LedgerService(db);

    // Seed users and project
    await db.insert(schema.users).values([
      { id: clientId, name: 'Client Test', email: 'client@test.local' },
      { id: freelancerId, name: 'Freelancer Test', email: 'freelancer@test.local' },
    ]);

    await db.insert(schema.projects).values({
      id: projectId,
      title: 'M7 Autonomy Project',
      brief: 'Test project for autonomy and appeal',
      currency: 'USD',
      totalCents: 500000,
      status: 'funded',
      autonomyMode: 'assisted',
      releaseWindowSeconds: 20,
      clientId,
      freelancerId,
      freelancerPaypalEmail: 'freelancer@test.local',
    });

    // Fund project
    await ledger.recordProjectFunding({
      projectId,
      captureId: `cap_${Date.now()}`,
      orderId: `ord_${Date.now()}`,
      amountCents: 500000,
    });

    const config = loadConfig({
      NODE_ENV: 'test',
      PAYPAL_ENV: 'mock',
      PORT: '8080',
      LLM_PROVIDER: 'fixture',
    });
    server = buildServer(config, { paypalAdapter: mockPayPal });
    await server.ready();
  }, 35000);

  afterAll(async () => {
    await server?.close();
    await closeDb();
  });

  // -------------------------------------------------------------------------
  // 1. State machine transitions for M7
  // -------------------------------------------------------------------------
  describe('State machine M7 transitions', () => {
    it('allows approved -> changes_requested (client objection during window)', () => {
      expect(canTransition('approved', 'changes_requested')).toBe(true);
      expect(() => assertTransition('approved', 'changes_requested')).not.toThrow();
    });

    it('allows changes_requested -> appealed (freelancer appeals)', () => {
      expect(canTransition('changes_requested', 'appealed')).toBe(true);
      expect(() => assertTransition('changes_requested', 'appealed')).not.toThrow();
    });

    it('allows appealed -> approved (second review passes)', () => {
      expect(canTransition('appealed', 'approved')).toBe(true);
      expect(() => assertTransition('appealed', 'approved')).not.toThrow();
    });

    it('allows appealed -> awaiting_client (second review disagrees)', () => {
      expect(canTransition('appealed', 'awaiting_client')).toBe(true);
      expect(() => assertTransition('appealed', 'awaiting_client')).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // 2. Autonomy modes on review verdict: manual, assisted, auto
  // -------------------------------------------------------------------------
  describe('Reviewer behavior per project autonomyMode', () => {
    function createPassingLlm(): LlmPort {
      return {
        provider: 'mock',
        model: 'mock-llm',
        async complete(_req: LlmCompletionRequest): Promise<LlmCompletionResponse> {
          return {
            content: null,
            toolCalls: [
              {
                id: 'call_verdict',
                name: 'submit_verdict',
                arguments: JSON.stringify({
                  criteria: [
                    { index: 0, result: 'pass', evidence: 'Code compiles', confidence: 0.95 },
                    { index: 1, result: 'pass', evidence: 'Tests pass', confidence: 0.9 },
                  ],
                  verdict: 'release',
                  injectionSuspected: false,
                  feedbackForFreelancer: 'Great job!',
                }),
              },
            ],
            provider: 'mock',
            model: 'mock-llm',
            latencyMs: 10,
          };
        },
      };
    }

    async function setupMilestoneAndDeliverable(status = 'in_review'): Promise<{ milestoneId: string; deliverableId: string }> {
      const milestoneId = `ms_${randomUUID().slice(0, 8)}`;
      const deliverableId = `del_${randomUUID().slice(0, 8)}`;

      await db.insert(schema.milestones).values({
        id: milestoneId,
        projectId,
        name: 'Autonomy Test Milestone',
        amountCents: 100000,
        percent: 20,
        criteria: [
          { id: 'c1', description: 'Code compiles' },
          { id: 'c2', description: 'Tests pass' },
        ],
        deliverableType: 'text',
        status,
      });

      await db.insert(schema.deliverables).values({
        id: deliverableId,
        milestoneId,
        kind: 'text',
        payload: { text: 'Everything is done and clean.' },
        submittedBy: freelancerId,
      });

      return { milestoneId, deliverableId };
    }

    it('manual mode: release verdict transitions to awaiting_client', async () => {
      await db.update(schema.projects).set({ autonomyMode: 'manual' }).where(eq(schema.projects.id, projectId));
      const { milestoneId, deliverableId } = await setupMilestoneAndDeliverable('in_review');

      const reviewer = new ReviewerService(db, mockPayPal);
      const result = await reviewer.review(milestoneId, deliverableId, createPassingLlm(), projectId);

      expect(result.verdict).toBe('release');

      const [updated] = await db.select().from(schema.milestones).where(eq(schema.milestones.id, milestoneId));
      expect(updated.status).toBe('awaiting_client');
      expect(updated.releaseAt).toBeNull();
    });

    it('assisted mode: release verdict transitions to approved with release_at in the future', async () => {
      await db.update(schema.projects).set({ autonomyMode: 'assisted', releaseWindowSeconds: 30 }).where(eq(schema.projects.id, projectId));
      const { milestoneId, deliverableId } = await setupMilestoneAndDeliverable('in_review');

      const reviewer = new ReviewerService(db, mockPayPal);
      const result = await reviewer.review(milestoneId, deliverableId, createPassingLlm(), projectId);

      expect(result.verdict).toBe('release');

      const [updated] = await db.select().from(schema.milestones).where(eq(schema.milestones.id, milestoneId));
      expect(updated.status).toBe('approved');
      expect(updated.approvedBy).toBe('ai');
      expect(updated.releaseAt).not.toBeNull();
      // releaseAt should be ~30s in the future
      const diffMs = updated.releaseAt!.getTime() - Date.now();
      expect(diffMs).toBeGreaterThan(25000);
      expect(diffMs).toBeLessThanOrEqual(31000);
    });

    it('auto mode: release verdict with passing policy releases immediately', async () => {
      await db.update(schema.projects).set({ autonomyMode: 'auto' }).where(eq(schema.projects.id, projectId));
      const { milestoneId, deliverableId } = await setupMilestoneAndDeliverable('in_review');

      const reviewer = new ReviewerService(db, mockPayPal);
      const result = await reviewer.review(milestoneId, deliverableId, createPassingLlm(), projectId);

      expect(result.verdict).toBe('release');

      const [updated] = await db.select().from(schema.milestones).where(eq(schema.milestones.id, milestoneId));
      // In auto mode, immediate payout moves to 'paid' (mock delay 0)
      expect(updated.status).toBe('paid');
    });

    it('auto mode: release verdict with low confidence falls back to awaiting_client', async () => {
      await db.update(schema.projects).set({ autonomyMode: 'auto' }).where(eq(schema.projects.id, projectId));
      const { milestoneId, deliverableId } = await setupMilestoneAndDeliverable('in_review');

      const lowConfLlm: LlmPort = {
        provider: 'mock',
        model: 'mock-llm',
        async complete(): Promise<LlmCompletionResponse> {
          return {
            content: null,
            toolCalls: [
              {
                id: 'call_verdict',
                name: 'submit_verdict',
                arguments: JSON.stringify({
                  criteria: [
                    { index: 0, result: 'pass', evidence: 'Maybe passes', confidence: 0.5 }, // low conf
                    { index: 1, result: 'pass', evidence: 'Tests pass', confidence: 0.9 },
                  ],
                  verdict: 'release',
                  injectionSuspected: false,
                  feedbackForFreelancer: 'Ok',
                }),
              },
            ],
            provider: 'mock',
            model: 'mock-llm',
            latencyMs: 10,
          };
        },
      };

      const reviewer = new ReviewerService(db, mockPayPal);
      const result = await reviewer.review(milestoneId, deliverableId, lowConfLlm, projectId);

      // Server recomputes to escalate_to_human due to low confidence
      expect(result.verdict).toBe('escalate_to_human');

      const [updated] = await db.select().from(schema.milestones).where(eq(schema.milestones.id, milestoneId));
      expect(updated.status).toBe('awaiting_client');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Assisted release scheduler & client objection
  // -------------------------------------------------------------------------
  describe('Assisted release scheduler and client objection', () => {
    async function createAssistedMilestone(releaseInSeconds: number): Promise<string> {
      const milestoneId = `ms_${randomUUID().slice(0, 8)}`;
      const releaseAt = new Date(Date.now() + releaseInSeconds * 1000);

      await db.insert(schema.milestones).values({
        id: milestoneId,
        projectId,
        name: 'Assisted Window Milestone',
        amountCents: 100000,
        percent: 20,
        criteria: [{ id: 'c1', description: 'Done' }],
        deliverableType: 'text',
        status: 'approved',
        approvedBy: 'ai',
        releaseAt,
      });

      return milestoneId;
    }

    it('does NOT release milestone before window expires', async () => {
      // releaseAt is 30 seconds in the future
      const milestoneId = await createAssistedMilestone(30);

      const scheduler = new AutonomySchedulerService(db, mockPayPal);
      const tick = await scheduler.processDueAssistedReleases(mockPayPal);

      expect(tick.checked).toBe(0);
      expect(tick.released).toBe(0);

      const [m] = await db.select().from(schema.milestones).where(eq(schema.milestones.id, milestoneId));
      expect(m.status).toBe('approved');
      expect(m.releaseAt).not.toBeNull();
    });

    it('releases milestone automatically after window expires', async () => {
      // releaseAt is 1 second in the past
      const milestoneId = await createAssistedMilestone(-1);

      const scheduler = new AutonomySchedulerService(db, mockPayPal);
      const tick = await scheduler.processDueAssistedReleases(mockPayPal);

      expect(tick.checked).toBe(1);
      expect(tick.released).toBe(1);

      const [m] = await db.select().from(schema.milestones).where(eq(schema.milestones.id, milestoneId));
      expect(m.status).toBe('paid');
      expect(m.releaseAt).toBeNull();
    });

    it('client objection during window stops auto-release and moves to changes_requested', async () => {
      const milestoneId = await createAssistedMilestone(20);

      // Client objects (transition approved -> changes_requested)
      assertTransition('approved', 'changes_requested');
      await db
        .update(schema.milestones)
        .set({ status: 'changes_requested', releaseAt: null, updatedAt: new Date() })
        .where(eq(schema.milestones.id, milestoneId));

      // Time advances: window would have expired
      // Even if scheduler runs now, milestone is in changes_requested and releaseAt is null
      const scheduler = new AutonomySchedulerService(db, mockPayPal);
      const tick = await scheduler.processDueAssistedReleases(mockPayPal);

      expect(tick.checked).toBe(0);
      expect(tick.released).toBe(0);

      const [m] = await db.select().from(schema.milestones).where(eq(schema.milestones.id, milestoneId));
      expect(m.status).toBe('changes_requested');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Appeal flow: second independent review
  // -------------------------------------------------------------------------
  describe('Appeal flow (second independent review)', () => {
    async function setupAppealedMilestone(): Promise<{ milestoneId: string; deliverableId: string }> {
      const milestoneId = `ms_app_${randomUUID().slice(0, 8)}`;
      const deliverableId = `del_app_${randomUUID().slice(0, 8)}`;

      await db.insert(schema.milestones).values({
        id: milestoneId,
        projectId,
        name: 'Appeal Test Milestone',
        amountCents: 100000,
        percent: 20,
        criteria: [{ id: 'c1', description: 'Functional CLI tool exists' }],
        deliverableType: 'text',
        status: 'appealed',
      });

      await db.insert(schema.deliverables).values({
        id: deliverableId,
        milestoneId,
        kind: 'text',
        payload: { text: 'CLI is implemented in bin/cli.js with full help flags.' },
        submittedBy: freelancerId,
      });

      // Insert initial review that requested changes
      await db.insert(schema.reviews).values({
        id: randomUUID(),
        milestoneId,
        deliverableId,
        kind: 'initial',
        model: 'mock-llm',
        promptVersion: 'reviewer.v1',
        verdict: 'request_changes',
        minConfidence: 0.9,
        criteriaResults: [{ index: 0, result: 'fail', evidence: 'Could not find CLI', confidence: 0.9 }],
      });

      return { milestoneId, deliverableId };
    }

    it('second review passes → milestone transitions to approved (assisted window)', async () => {
      await db.update(schema.projects).set({ autonomyMode: 'assisted' }).where(eq(schema.projects.id, projectId));
      const { milestoneId } = await setupAppealedMilestone();

      const passAppealLlm: LlmPort = {
        provider: 'mock',
        model: 'mock-llm',
        async complete(): Promise<LlmCompletionResponse> {
          return {
            content: null,
            toolCalls: [
              {
                id: 'call_appeal_verdict',
                name: 'submit_verdict',
                arguments: JSON.stringify({
                  criteria: [
                    { index: 0, result: 'pass', evidence: 'bin/cli.js verified and functional', confidence: 0.92 },
                  ],
                  verdict: 'release',
                  injectionSuspected: false,
                  feedbackForFreelancer: 'Appeal approved. Deliverable meets all criteria.',
                }),
              },
            ],
            provider: 'mock',
            model: 'mock-llm',
            latencyMs: 15,
          };
        },
      };

      const reviewer = new ReviewerService(db, mockPayPal);
      const result = await reviewer.reviewAppeal(
        milestoneId,
        'The CLI tool is in bin/cli.js as stated in package.json bin field.',
        passAppealLlm,
        projectId
      );

      expect(result.verdict).toBe('release');

      const [m] = await db.select().from(schema.milestones).where(eq(schema.milestones.id, milestoneId));
      expect(m.status).toBe('approved');
      expect(m.releaseAt).not.toBeNull(); // assisted window set
    });

    it('second review disagrees → milestone transitions to awaiting_client', async () => {
      const { milestoneId } = await setupAppealedMilestone();

      const failAppealLlm: LlmPort = {
        provider: 'mock',
        model: 'mock-llm',
        async complete(): Promise<LlmCompletionResponse> {
          return {
            content: null,
            toolCalls: [
              {
                id: 'call_appeal_verdict',
                name: 'submit_verdict',
                arguments: JSON.stringify({
                  criteria: [
                    { index: 0, result: 'fail', evidence: 'CLI exits with syntax error', confidence: 0.95 },
                  ],
                  verdict: 'request_changes',
                  injectionSuspected: false,
                  feedbackForFreelancer: 'Appeal rejected: syntax error in CLI entrypoint.',
                }),
              },
            ],
            provider: 'mock',
            model: 'mock-llm',
            latencyMs: 15,
          };
        },
      };

      const reviewer = new ReviewerService(db, mockPayPal);
      const result = await reviewer.reviewAppeal(
        milestoneId,
        'Please reconsider, it worked on my machine.',
        failAppealLlm,
        projectId
      );

      expect(result.verdict).toBe('request_changes');

      // Per ARCHITECTURE.md §6: appealed --> awaiting_client (second review disagrees, so human client decides)
      const [m] = await db.select().from(schema.milestones).where(eq(schema.milestones.id, milestoneId));
      expect(m.status).toBe('awaiting_client');
    });
  });
});
