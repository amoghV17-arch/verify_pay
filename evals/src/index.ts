import { runPlannerEval } from './plannerEval.js';

async function main() {
  const summary = await runPlannerEval();

  console.log(`\nPlanner Evaluation Summary:`);
  console.log(`-----------------------------------------------`);
  console.log(`Pass Rate:                  ${summary.passRate}% (${summary.passedBriefs}/${summary.totalBriefs})`);
  console.log(`First-Attempt Valid Rate:   ${summary.firstAttemptValidRate}%`);
  console.log(`Valid After Repair Rate:    ${summary.validAfterRepairRate}%`);
  console.log(`Unsafe Brief Refused:       ${summary.unsafeBriefRefused ? 'YES' : 'NO'}`);
  console.log(`Average Latency:            ${summary.averageLatencyMs}ms`);
  console.log(`-----------------------------------------------\n`);

  if (summary.passRate < 100) {
    console.error(`[EVAL] Planner eval failed to meet 100% target.`);
    process.exit(1);
  } else {
    console.log(`[EVAL] All benchmark briefs met targets successfully.`);
  }
}

main().catch((err) => {
  console.error('[EVAL] Fatal error running evals:', err);
  process.exit(1);
});
