/**
 * ReviewerService — runs the LLM reviewer agent loop per ARCHITECTURE.md §7.2
 * and PROMPTS.md §3.
 *
 * Security rules:
 * - LLM produces a verdict; server recomputes and applies the stricter outcome.
 * - Deliverable payload is scanned for injection phrases before the LLM sees it.
 * - The LLM can never directly trigger a payout.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { eq, or, desc } from 'drizzle-orm';
import { getDb, type AppDatabase } from '../db/index.js';
import { milestones, deliverables, reviews, activity, projects } from '../db/schema.js';
import { sseHub } from './sse.js';
import { ReleaseService } from './release.js';
import {
  VerdictSchema,
  INJECTION_PHRASES,
  REVIEW_MIN_CONFIDENCE_DEFAULT,
  assertTransition,
  type Verdict,
  type LlmPort,
  type LlmMessage,
  type MilestoneStatus,
  type PayPalPort,
} from '@milestone/shared';
import {
  REVIEWER_TOOL_DEFINITIONS,
  getSubmissionText,
  fetchUrlText,
  githubRepoTree,
  githubReadFile,
  getSubmissionImage,
} from '../ai/reviewerTools.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROMPT_VERSION = 'reviewer.v1';
const MAX_TOOL_CALLS = 8;
const MAX_WALL_MS = 120_000;

function loadPrompt(promptFilename: string, fallback: string): string {
  const possiblePaths = [
    join(process.cwd(), 'apps', 'api', 'src', 'ai', 'prompts', promptFilename),
    join(__dirname, '..', 'ai', 'prompts', promptFilename),
    join(__dirname, 'prompts', promptFilename),
  ];
  for (const p of possiblePaths) {
    if (existsSync(p)) {
      return readFileSync(p, 'utf-8');
    }
  }
  return fallback;
}

/** Verdict strictness order: 0=release < 1=request_changes < 2=escalate_to_human */
const VERDICT_RANK: Record<string, number> = {
  release: 0,
  request_changes: 1,
  escalate_to_human: 2,
};

function stricterVerdict(a: string, b: string): string {
  return (VERDICT_RANK[a] ?? 0) >= (VERDICT_RANK[b] ?? 0) ? a : b;
}

/** Scan deliverable text payload for injection phrases (server-side, cheap). */
export function detectInjection(payload: unknown): { suspected: boolean; note?: string } {
  const text = typeof payload === 'string'
    ? payload
    : JSON.stringify(payload ?? '');
  const lower = text.toLowerCase();
  for (const phrase of INJECTION_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) {
      return { suspected: true, note: `Injection phrase detected: "${phrase}"` };
    }
  }
  return { suspected: false };
}

/** Server-side verdict recomputation per PROMPTS.md §3.5. */
export function recomputeVerdict(
  verdict: Verdict,
  criteriaCount: number,
  minConfidenceThreshold: number
): string {
  const { criteria, injectionSuspected } = verdict;

  if (injectionSuspected) return 'escalate_to_human';
  if (criteria.length !== criteriaCount) return 'escalate_to_human';

  // Check evidence is non-empty for every pass
  const passWithEmptyEvidence = criteria.some(
    (c) => c.result === 'pass' && (!c.evidence || c.evidence.trim() === '')
  );
  if (passWithEmptyEvidence) return 'escalate_to_human';

  if (criteria.some((c) => c.result === 'unclear')) return 'escalate_to_human';

  if (criteria.some((c) => c.result === 'fail')) return 'request_changes';

  const minConf = Math.min(...criteria.map((c) => c.confidence));
  if (minConf < minConfidenceThreshold) return 'escalate_to_human';

  return 'release';
}

export interface ReviewResult {
  reviewId: string;
  verdict: string;
  injectionSuspected: boolean;
  feedbackForFreelancer: string;
  criteriaResults: Verdict['criteria'];
  latencyMs: number;
}

export class ReviewerService {
  private db: AppDatabase;

  constructor(
    db?: AppDatabase,
    private paypal?: PayPalPort
  ) {
    this.db = db ?? getDb();
  }

  async review(
    milestoneId: string,
    deliverableId: string,
    llm: LlmPort,
    projectId: string
  ): Promise<ReviewResult> {
    const startMs = Date.now();

    // 1. Load milestone and deliverable
    const [milestone] = await this.db
      .select()
      .from(milestones)
      .where(or(eq(milestones.id, milestoneId), eq(milestones.taskId, milestoneId)))
      .limit(1);

    if (!milestone) throw new Error(`Milestone not found: ${milestoneId}`);

    const [deliverable] = await this.db
      .select()
      .from(deliverables)
      .where(eq(deliverables.id, deliverableId))
      .limit(1);

    if (!deliverable) throw new Error(`Deliverable not found: ${deliverableId}`);

    const criteria = (milestone.criteria as Array<{ id: string; description: string }>) ?? [];
    const minConfidence = parseFloat(process.env.REVIEW_MIN_CONFIDENCE ?? String(REVIEW_MIN_CONFIDENCE_DEFAULT));

    // 2. Server-side injection heuristic (before LLM)
    const injection = detectInjection(deliverable.payload);

    // 3. Load system prompt
    const systemPromptTemplate = loadPrompt(
      'reviewer.v1.md',
      'You are the Reviewer for Milestone. Decide, criterion by criterion, whether the deliverable satisfies the acceptance criteria.'
    );
    const systemPrompt = systemPromptTemplate.replace('{{min_confidence}}', String(minConfidence));

    // 4. Build user message
    const numberedCriteria = criteria
      .map((c, i) => `${i + 1}. ${c.description}`)
      .join('\n');
    const payloadStr = typeof deliverable.payload === 'string'
      ? deliverable.payload
      : JSON.stringify(deliverable.payload, null, 2);

    const userMessage = [
      `Milestone: ${milestone.name} (deliverable type: ${milestone.deliverableType})`,
      `Project: ${(milestone as unknown as { projectTitle?: string }).projectTitle ?? 'Unknown Project'}`,
      `Reviewer hint: ${(milestone as unknown as { reviewHint?: string }).reviewHint ?? ''}`,
      '',
      'Acceptance criteria:',
      numberedCriteria,
      '',
      `<deliverable kind="${deliverable.kind}">`,
      payloadStr,
      '</deliverable>',
    ].join('\n');

    // 5. Build conversation and tool-loop state
    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const trace: unknown[] = [];
    let toolCallCount = 0;
    let finalVerdict: Verdict | null = null;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let repairAttempts = 0;

    // 6. Tool loop — cap 8 calls, 120 s wall clock
    while (toolCallCount < MAX_TOOL_CALLS && Date.now() - startMs < MAX_WALL_MS) {
      const response = await llm.complete({
        messages,
        temperature: 0.1,
        maxTokens: 2048,
        tools: REVIEWER_TOOL_DEFINITIONS,
        toolChoice: 'auto',
      });

      totalInputTokens += response.inputTokens ?? 0;
      totalOutputTokens += response.outputTokens ?? 0;

      if (!response.toolCalls || response.toolCalls.length === 0) {
        // Model stopped without submitting verdict — escalate
        break;
      }

      for (const toolCall of response.toolCalls) {
        const toolName = toolCall.name;
        toolCallCount++;

        // Parse args (best-effort)
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.arguments || '{}') as Record<string, unknown>;
        } catch {
          args = {};
        }

        // Emit SSE progress event
        const stepDescription = describeToolCall(toolName, args);
        sseHub.broadcast(projectId, 'review.progress', {
          step: toolCallCount,
          tool: toolName,
          description: stepDescription,
        });

        trace.push({ step: toolCallCount, tool: toolName, args });

        let toolResult: string;

        if (toolName === 'submit_verdict') {
          // Parse and validate the verdict
          const parsed = VerdictSchema.safeParse(args);
          if (!parsed.success) {
            if (repairAttempts < 2) {
              repairAttempts++;
              const errorList = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
              toolResult = `Validation failed: ${errorList}. Please fix the verdict and call submit_verdict again.`;
              messages.push({ role: 'assistant', content: response.content ?? '' });
              messages.push({ role: 'user', content: `<tool_result name="submit_verdict">${toolResult}</tool_result>` });
              continue;
            } else {
              // Max repairs exceeded — escalate
              finalVerdict = null;
              break;
            }
          }

          finalVerdict = parsed.data;

          // Apply server-side injection detection (server override)
          if (injection.suspected) {
            finalVerdict = { ...finalVerdict, injectionSuspected: true, injectionNote: injection.note };
          }

          // Server-side recomputation
          const computed = recomputeVerdict(finalVerdict, criteria.length, minConfidence);
          const finalVerdictValue = stricterVerdict(finalVerdict.verdict, computed);
          finalVerdict = { ...finalVerdict, verdict: finalVerdictValue as Verdict['verdict'] };

          break; // Done
        }

        // Execute the requested tool
        toolResult = await executeReviewerTool(toolName, args, deliverable.payload);
        messages.push({ role: 'assistant', content: response.content ?? '' });
        messages.push({
          role: 'user',
          content: `<tool_result name="${toolName}">${toolResult}</tool_result>`,
        });
      }

      if (finalVerdict) break;
    }

    const latencyMs = Date.now() - startMs;

    // 7. Fallback if no verdict
    if (!finalVerdict) {
      finalVerdict = {
        criteria: criteria.map((_, i) => ({
          index: i,
          result: 'unclear' as const,
          evidence: 'Review timed out or failed to produce a verdict.',
          confidence: 0,
        })),
        verdict: 'escalate_to_human',
        injectionSuspected: injection.suspected,
        injectionNote: injection.note,
        feedbackForFreelancer: 'The automated review could not complete. A human reviewer will assess the deliverable.',
      };
    }

    // 8. Apply milestone status transition per autonomyMode
    const [project] = await this.db
      .select()
      .from(projects)
      .where(eq(projects.id, milestone.projectId))
      .limit(1);

    const autonomyMode = project?.autonomyMode ?? 'assisted';
    const releaseWindowSeconds = project?.releaseWindowSeconds ?? 20;

    let targetStatus: MilestoneStatus;
    let releaseAt: Date | null = null;
    let approvedBy: 'ai' | 'client' | null = null;

    if (finalVerdict.verdict === 'release') {
      if (autonomyMode === 'manual') {
        targetStatus = 'awaiting_client';
      } else if (autonomyMode === 'assisted') {
        targetStatus = 'approved';
        approvedBy = 'ai';
        releaseAt = new Date(Date.now() + releaseWindowSeconds * 1000);
      } else if (autonomyMode === 'auto') {
        const minConf = Math.min(...finalVerdict.criteria.map((c) => c.confidence));
        if (minConf >= minConfidence && !finalVerdict.injectionSuspected) {
          targetStatus = 'approved';
          approvedBy = 'ai';
        } else {
          targetStatus = 'awaiting_client';
        }
      } else {
        targetStatus = 'awaiting_client';
      }
    } else if (finalVerdict.verdict === 'request_changes') {
      targetStatus = 'changes_requested';
    } else {
      targetStatus = 'awaiting_client';
    }

    try {
      assertTransition(milestone.status as MilestoneStatus, targetStatus);
      await this.db
        .update(milestones)
        .set({ status: targetStatus, releaseAt, approvedBy, updatedAt: new Date() })
        .where(eq(milestones.id, milestone.id));

      sseHub.broadcast(projectId, 'milestone.status', {
        milestoneId: milestone.id,
        status: targetStatus,
        releaseAt: releaseAt ? releaseAt.toISOString() : null,
      });

      // If auto mode and approved, execute payout release immediately
      if (autonomyMode === 'auto' && targetStatus === 'approved' && this.paypal) {
        const releaseService = new ReleaseService(this.db, this.paypal);
        await releaseService.releaseMilestone(milestone.id, this.paypal, 'ai');
      }
    } catch (e) {
      // Transition might be invalid if status changed concurrently — log and continue
      trace.push({ warning: `Status transition failed: ${String(e)}` });
    }

    // 9. Persist review row
    const reviewId = randomUUID();
    await this.db.insert(reviews).values({
      id: reviewId,
      milestoneId: milestone.id,
      deliverableId,
      kind: 'initial',
      model: llm.model ?? process.env.LLM_MODEL ?? 'mock-model',
      promptVersion: PROMPT_VERSION,
      trace,
      criteriaResults: finalVerdict.criteria,
      verdict: finalVerdict.verdict,
      minConfidence: Math.min(...(finalVerdict.criteria.map((c) => c.confidence).length > 0
        ? finalVerdict.criteria.map((c) => c.confidence)
        : [0])),
      injectionSuspected: finalVerdict.injectionSuspected,
      latencyMs,
      tokens: { input: totalInputTokens, output: totalOutputTokens },
    });

    // 10. Log activity
    await this.db.insert(activity).values({
      id: randomUUID(),
      projectId,
      actor: 'ai',
      kind: 'review_completed',
      text: `AI review completed: ${finalVerdict.verdict} for milestone "${milestone.name}"`,
      meta: { reviewId, verdict: finalVerdict.verdict, injectionSuspected: finalVerdict.injectionSuspected },
      ts: new Date(),
    });

    // 11. Emit review.completed SSE
    sseHub.broadcast(projectId, 'review.completed', {
      reviewId,
      milestoneId: milestone.id,
      verdict: finalVerdict.verdict,
      injectionSuspected: finalVerdict.injectionSuspected,
      feedbackForFreelancer: finalVerdict.feedbackForFreelancer,
    });

    return {
      reviewId,
      verdict: finalVerdict.verdict,
      injectionSuspected: finalVerdict.injectionSuspected,
      feedbackForFreelancer: finalVerdict.feedbackForFreelancer,
      criteriaResults: finalVerdict.criteria,
      latencyMs,
    };
  }

  /**
   * Conduct a second independent review of an appealed milestone per ARCHITECTURE.md §6 and PROMPTS.md §4.
   */
  async reviewAppeal(
    milestoneId: string,
    appealExplanation: string,
    llm: LlmPort,
    projectId: string
  ): Promise<ReviewResult> {
    const startMs = Date.now();

    // 1. Load milestone and deliverable
    const [milestone] = await this.db
      .select()
      .from(milestones)
      .where(or(eq(milestones.id, milestoneId), eq(milestones.taskId, milestoneId)))
      .limit(1);

    if (!milestone) throw new Error(`Milestone not found: ${milestoneId}`);

    const [deliverable] = await this.db
      .select()
      .from(deliverables)
      .where(eq(deliverables.milestoneId, milestone.id))
      .orderBy(desc(deliverables.submittedAt))
      .limit(1);

    if (!deliverable) throw new Error(`Deliverable not found for milestone: ${milestoneId}`);

    // Load initial review for context
    const [prevReview] = await this.db
      .select()
      .from(reviews)
      .where(eq(reviews.milestoneId, milestone.id))
      .orderBy(desc(reviews.createdAt))
      .limit(1);

    const criteria = (milestone.criteria as Array<{ id: string; description: string }>) ?? [];
    const minConfidence = parseFloat(process.env.REVIEW_MIN_CONFIDENCE ?? String(REVIEW_MIN_CONFIDENCE_DEFAULT));

    // 2. Pre-scan both deliverable and appeal explanation for injection
    const deliverableInjection = detectInjection(deliverable.payload);
    const appealInjection = detectInjection(appealExplanation);
    const injectionSuspected = deliverableInjection.suspected || appealInjection.suspected;
    const injectionNote = appealInjection.note || deliverableInjection.note;

    // 3. Load appeal system prompt
    const systemPromptTemplate = loadPrompt(
      'appeal.v1.md',
      'You are the Reviewer for Milestone, conducting a second, independent review of a deliverable that a previous review rejected.'
    );
    const systemPrompt = systemPromptTemplate.replace('{{min_confidence}}', String(minConfidence));

    // 4. Build user message with delimited untrusted sections
    const numberedCriteria = criteria.map((c, i) => `${i + 1}. ${c.description}`).join('\n');
    const payloadStr = typeof deliverable.payload === 'string'
      ? deliverable.payload
      : JSON.stringify(deliverable.payload, null, 2);

    const prevReviewSummary = prevReview
      ? `Previous verdict: ${prevReview.verdict}\nCriteria: ${JSON.stringify(prevReview.criteriaResults)}`
      : 'Initial review requested changes';

    const userMessage = [
      `Milestone: ${milestone.name} (deliverable type: ${milestone.deliverableType})`,
      `Project: ${(milestone as unknown as { projectTitle?: string }).projectTitle ?? 'Unknown Project'}`,
      '',
      'Acceptance criteria:',
      numberedCriteria,
      '',
      `<deliverable kind="${deliverable.kind}">`,
      payloadStr,
      '</deliverable>',
      '',
      '<previous_review>',
      prevReviewSummary,
      '</previous_review>',
      '',
      '<appeal>',
      appealExplanation,
      '</appeal>',
    ].join('\n');

    // 5. Tool loop
    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const trace: unknown[] = [];
    let toolCallCount = 0;
    let finalVerdict: Verdict | null = null;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let repairAttempts = 0;

    while (toolCallCount < MAX_TOOL_CALLS && Date.now() - startMs < MAX_WALL_MS) {
      const response = await llm.complete({
        messages,
        temperature: 0.1,
        maxTokens: 2048,
        tools: REVIEWER_TOOL_DEFINITIONS,
        toolChoice: 'auto',
      });

      totalInputTokens += response.inputTokens ?? 0;
      totalOutputTokens += response.outputTokens ?? 0;

      if (!response.toolCalls || response.toolCalls.length === 0) break;

      for (const toolCall of response.toolCalls) {
        const toolName = toolCall.name;
        toolCallCount++;

        let args: Record<string, unknown> = {};
        try { args = JSON.parse(toolCall.arguments || '{}') as Record<string, unknown>; } catch { args = {}; }

        const stepDescription = describeToolCall(toolName, args);
        sseHub.broadcast(projectId, 'review.progress', {
          step: toolCallCount,
          tool: toolName,
          description: `[Appeal] ${stepDescription}`,
        });

        trace.push({ step: toolCallCount, tool: toolName, args });

        if (toolName === 'submit_verdict') {
          const parsed = VerdictSchema.safeParse(args);
          if (!parsed.success) {
            if (repairAttempts < 2) {
              repairAttempts++;
              const errorList = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
              const toolResult = `Validation failed: ${errorList}. Please fix the verdict and call submit_verdict again.`;
              messages.push({ role: 'assistant', content: response.content ?? '' });
              messages.push({ role: 'user', content: `<tool_result name="submit_verdict">${toolResult}</tool_result>` });
              continue;
            } else {
              finalVerdict = null;
              break;
            }
          }

          finalVerdict = parsed.data;
          if (injectionSuspected) {
            finalVerdict = { ...finalVerdict, injectionSuspected: true, injectionNote };
          }

          const computed = recomputeVerdict(finalVerdict, criteria.length, minConfidence);
          const finalVerdictValue = stricterVerdict(finalVerdict.verdict, computed);
          finalVerdict = { ...finalVerdict, verdict: finalVerdictValue as Verdict['verdict'] };
          break;
        }

        const toolResult = await executeReviewerTool(toolName, args, deliverable.payload);
        messages.push({ role: 'assistant', content: response.content ?? '' });
        messages.push({ role: 'user', content: `<tool_result name="${toolName}">${toolResult}</tool_result>` });
      }

      if (finalVerdict) break;
    }

    const latencyMs = Date.now() - startMs;

    if (!finalVerdict) {
      finalVerdict = {
        criteria: criteria.map((_, i) => ({
          index: i,
          result: 'unclear' as const,
          evidence: 'Appeal review could not complete.',
          confidence: 0,
        })),
        verdict: 'escalate_to_human',
        injectionSuspected,
        injectionNote,
        feedbackForFreelancer: 'Appeal review could not reach a decision. Escalated to client for resolution.',
      };
    }

    // 6. Transition state machine per Section 6:
    // appealed --> approved: second review releases
    // appealed --> awaiting_client: second review disagrees
    const [project] = await this.db.select().from(projects).where(eq(projects.id, milestone.projectId)).limit(1);
    const autonomyMode = project?.autonomyMode ?? 'assisted';
    const releaseWindowSeconds = project?.releaseWindowSeconds ?? 20;

    let targetStatus: MilestoneStatus;
    let releaseAt: Date | null = null;
    let approvedBy: 'ai' | 'client' | null = null;

    if (finalVerdict.verdict === 'release') {
      targetStatus = 'approved';
      approvedBy = 'ai';
      if (autonomyMode === 'assisted') {
        releaseAt = new Date(Date.now() + releaseWindowSeconds * 1000);
      }
    } else {
      targetStatus = 'awaiting_client';
    }

    try {
      assertTransition(milestone.status as MilestoneStatus, targetStatus);
      await this.db
        .update(milestones)
        .set({ status: targetStatus, releaseAt, approvedBy, updatedAt: new Date() })
        .where(eq(milestones.id, milestone.id));

      sseHub.broadcast(projectId, 'milestone.status', {
        milestoneId: milestone.id,
        status: targetStatus,
        releaseAt: releaseAt ? releaseAt.toISOString() : null,
      });

      if (autonomyMode === 'auto' && targetStatus === 'approved' && this.paypal) {
        const releaseService = new ReleaseService(this.db, this.paypal);
        await releaseService.releaseMilestone(milestone.id, this.paypal, 'ai');
      }
    } catch (e) {
      trace.push({ warning: `Status transition failed: ${String(e)}` });
    }

    // 7. Persist review row with kind: 'appeal'
    const reviewId = randomUUID();
    await this.db.insert(reviews).values({
      id: reviewId,
      milestoneId: milestone.id,
      deliverableId: deliverable.id,
      kind: 'appeal',
      model: llm.model,
      promptVersion: 'appeal.v1',
      trace,
      criteriaResults: finalVerdict.criteria,
      verdict: finalVerdict.verdict,
      minConfidence: Math.min(...(finalVerdict.criteria.map((c) => c.confidence).length > 0
        ? finalVerdict.criteria.map((c) => c.confidence)
        : [0])),
      injectionSuspected: finalVerdict.injectionSuspected,
      latencyMs,
      tokens: { input: totalInputTokens, output: totalOutputTokens },
    });

    // 8. Log activity
    await this.db.insert(activity).values({
      id: randomUUID(),
      projectId,
      actor: 'ai',
      kind: 'appeal_reviewed',
      text: `Appeal review completed: ${finalVerdict.verdict} for milestone "${milestone.name}"`,
      meta: { reviewId, verdict: finalVerdict.verdict, targetStatus },
      ts: new Date(),
    });

    // 9. Emit review.completed SSE
    sseHub.broadcast(projectId, 'review.completed', {
      reviewId,
      milestoneId: milestone.id,
      verdict: finalVerdict.verdict,
      injectionSuspected: finalVerdict.injectionSuspected,
      feedbackForFreelancer: finalVerdict.feedbackForFreelancer,
      kind: 'appeal',
    });

    return {
      reviewId,
      verdict: finalVerdict.verdict,
      injectionSuspected: finalVerdict.injectionSuspected,
      feedbackForFreelancer: finalVerdict.feedbackForFreelancer,
      criteriaResults: finalVerdict.criteria,
      latencyMs,
    };
  }
}

/** Human-readable description of a tool call for SSE progress events. */
function describeToolCall(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case 'get_submission_text':
      return 'Reading submitted deliverable text…';
    case 'fetch_url_text':
      return `Fetching URL: ${args.url ?? ''}…`;
    case 'github_repo_tree':
      return `Listing GitHub repo: ${args.owner}/${args.repo}…`;
    case 'github_read_file':
      return `Reading file from GitHub: ${args.path ?? ''}…`;
    case 'get_submission_image':
      return 'Loading submitted image…';
    case 'submit_verdict':
      return 'Submitting review verdict…';
    default:
      return `Calling tool: ${toolName}…`;
  }
}

/** Dispatch a tool call to the appropriate server-side implementation. */
async function executeReviewerTool(
  toolName: string,
  args: Record<string, unknown>,
  payload: unknown
): Promise<string> {
  switch (toolName) {
    case 'get_submission_text':
      return getSubmissionText(payload);

    case 'fetch_url_text': {
      const url = String(args.url ?? '');
      if (!url) return '[fetch_url_text: url is required]';
      return fetchUrlText(url);
    }

    case 'github_repo_tree': {
      const owner = String(args.owner ?? '');
      const repo = String(args.repo ?? '');
      const ref = args.ref ? String(args.ref) : 'HEAD';
      if (!owner || !repo) return '[github_repo_tree: owner and repo are required]';
      return githubRepoTree(owner, repo, ref);
    }

    case 'github_read_file': {
      const owner = String(args.owner ?? '');
      const repo = String(args.repo ?? '');
      const path = String(args.path ?? '');
      const ref = args.ref ? String(args.ref) : 'HEAD';
      if (!owner || !repo || !path) return '[github_read_file: owner, repo, and path are required]';
      return githubReadFile(owner, repo, path, ref);
    }

    case 'get_submission_image':
      return getSubmissionImage(payload);

    default:
      return `[unknown tool: ${toolName}]`;
  }
}
