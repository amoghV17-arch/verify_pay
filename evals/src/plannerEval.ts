import { PlannerService, createLlmPort, VAGUE_WORDS } from '@milestone/api/ai';
import { PLANNER_BENCHMARK_BRIEFS } from './fixtures/plannerBriefs.js';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface EvalBriefResult {
  id: string;
  category: string;
  expectedOutcome: 'valid_plan' | 'refusal';
  actualOutcome: 'valid_plan' | 'refusal' | 'error';
  passed: boolean;
  attempts: number;
  firstAttemptValid: boolean;
  validAfterRepair: boolean;
  percentagesValid: boolean;
  criteriaQualityPassed: boolean;
  vagueWordCount: number;
  latencyMs: number;
  tasksCount?: number;
  milestonesCount?: number;
  error?: string;
}

export interface PlannerEvalSummary {
  timestamp: string;
  provider: string;
  model: string;
  promptVersion: string;
  totalBriefs: number;
  passedBriefs: number;
  passRate: number;
  firstAttemptValidRate: number;
  validAfterRepairRate: number;
  unsafeBriefRefused: boolean;
  averageLatencyMs: number;
  results: EvalBriefResult[];
}

export async function runPlannerEval(): Promise<PlannerEvalSummary> {
  const llm = createLlmPort();
  const planner = new PlannerService(llm);

  console.log(`\n======================================================`);
  console.log(`[EVAL] Running Planner Benchmark (${PLANNER_BENCHMARK_BRIEFS.length} briefs)`);
  console.log(`[EVAL] Provider: ${llm.provider} | Model: ${llm.model}`);
  console.log(`======================================================\n`);

  const results: EvalBriefResult[] = [];
  let totalLatency = 0;

  for (const b of PLANNER_BENCHMARK_BRIEFS) {
    const startTime = Date.now();
    const res = await planner.generatePlan({
      brief: b.brief,
      totalBudget: b.totalBudget,
      currency: 'USD',
    });
    const elapsed = Date.now() - startTime;
    totalLatency += elapsed;

    let actualOutcome: 'valid_plan' | 'refusal' | 'error' = 'error';
    let percentagesValid = false;
    let criteriaQualityPassed = true;
    let vagueWordCount = 0;
    let tasksCount = 0;
    let milestonesCount = 0;

    if (res.success && res.plan) {
      actualOutcome = 'valid_plan';
      tasksCount = res.plan.tasks.length;
      milestonesCount = res.plan.milestones.length;

      const sumPercent = res.plan.milestones.reduce((acc, m) => acc + m.paymentPercent, 0);
      percentagesValid =
        sumPercent === 100 &&
        res.plan.milestones[0].paymentPercent >= 10 &&
        res.plan.milestones[res.plan.milestones.length - 1].paymentPercent >= 15 &&
        res.plan.milestones.every((m) => m.paymentPercent <= 40);

      // Check vague words in criteria
      for (const m of res.plan.milestones) {
        for (const crit of m.acceptanceCriteria) {
          for (const vw of VAGUE_WORDS) {
            if (new RegExp(`\\b${vw}\\b`, 'i').test(crit)) {
              vagueWordCount++;
              criteriaQualityPassed = false;
            }
          }
        }
      }
    } else if (!res.success && res.error?.toLowerCase().includes('refused')) {
      actualOutcome = 'refusal';
      percentagesValid = true;
    }

    const passed =
      b.expectedOutcome === actualOutcome &&
      (b.expectedOutcome === 'refusal' || (percentagesValid && criteriaQualityPassed));

    const briefResult: EvalBriefResult = {
      id: b.id,
      category: b.category,
      expectedOutcome: b.expectedOutcome,
      actualOutcome,
      passed,
      attempts: res.attempts,
      firstAttemptValid: res.attempts === 1 && passed,
      validAfterRepair: passed,
      percentagesValid,
      criteriaQualityPassed,
      vagueWordCount,
      latencyMs: elapsed,
      tasksCount: tasksCount || undefined,
      milestonesCount: milestonesCount || undefined,
      error: res.error,
    };

    results.push(briefResult);

    const mark = passed ? '✓ PASS' : '✗ FAIL';
    console.log(
      ` ${mark.padEnd(8)} [${b.id}] ${b.category.padEnd(28)} | Attempt: ${res.attempts} | Latency: ${elapsed}ms`
    );
  }

  const passedCount = results.filter((r) => r.passed).length;
  const firstAttemptValidCount = results.filter((r) => r.firstAttemptValid).length;
  const validAfterRepairCount = results.filter((r) => r.validAfterRepair).length;
  const unsafeRefused = results.find((r) => r.id === 'b6_unsafe_refusal')?.actualOutcome === 'refusal';

  const summary: PlannerEvalSummary = {
    timestamp: new Date().toISOString(),
    provider: llm.provider,
    model: llm.model,
    promptVersion: 'planner.v1',
    totalBriefs: results.length,
    passedBriefs: passedCount,
    passRate: Math.round((passedCount / results.length) * 100),
    firstAttemptValidRate: Math.round((firstAttemptValidCount / results.length) * 100),
    validAfterRepairRate: Math.round((validAfterRepairCount / results.length) * 100),
    unsafeBriefRefused: !!unsafeRefused,
    averageLatencyMs: Math.round(totalLatency / results.length),
    results,
  };

  const baseDir = process.cwd().endsWith('evals') ? process.cwd() : join(process.cwd(), 'evals');
  const resultsDir = join(baseDir, 'results');
  if (!existsSync(resultsDir)) {
    mkdirSync(resultsDir, { recursive: true });
  }

  // Evals must never publish fixture results as model results
  if (llm.provider === 'fixture') {
    const fixtureFilePath = join(resultsDir, 'latest-fixture.json');
    writeFileSync(fixtureFilePath, JSON.stringify(summary, null, 2), 'utf8');
    console.log(`\n[EVAL] Running with replay fixtures. Results saved to: ${fixtureFilePath}`);
    console.log(`[EVAL] Note: Per project policy, fixture runs are NEVER published to latest.json as model results.`);
  } else {
    const liveFilePath = join(resultsDir, 'latest.json');
    writeFileSync(liveFilePath, JSON.stringify(summary, null, 2), 'utf8');
    console.log(`\n[EVAL] Live model benchmark results written to: ${liveFilePath}`);
  }

  return summary;
}
