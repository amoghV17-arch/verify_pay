export interface RawReviewCriterion {
  index?: number;
  criterionId?: string;
  id?: string;
  result?: string;
  passed?: boolean;
  satisfied?: boolean;
  evidence?: string;
  reasoning?: string;
  confidence?: number;
}

export interface FormattedCriterionEvaluation {
  id: string;
  index: number;
  satisfied: boolean;
  result: string;
  reasoning: string;
  evidence: string;
  confidence: number;
}

export interface RawReviewRow {
  id: string;
  milestoneId: string;
  deliverableId: string;
  kind: string;
  model: string;
  promptVersion: string;
  trace: unknown;
  criteriaResults: unknown;
  verdict: string;
  minConfidence: number;
  injectionSuspected: boolean;
  latencyMs: number | null;
  tokens: unknown;
  createdAt: Date | string;
}

export interface FormattedReviewRecord extends RawReviewRow {
  confidence: number;
  reasoning: string;
  evaluatedCriteria: FormattedCriterionEvaluation[];
  promptInjectionSuspected: boolean;
}

/**
 * Normalizes a persisted review database row into the API contract expected by UI consumers
 * while preserving all underlying columns for backwards compatibility.
 */
export function formatReviewRecord(r: RawReviewRow): FormattedReviewRecord {
  const minConf =
    typeof r.minConfidence === 'number' && Number.isFinite(r.minConfidence) ? r.minConfidence : 0;

  const rawList: RawReviewCriterion[] = Array.isArray(r.criteriaResults)
    ? (r.criteriaResults as RawReviewCriterion[])
    : [];

  const evaluatedCriteria: FormattedCriterionEvaluation[] = rawList.map((c, idx) => {
    const index = typeof c?.index === 'number' && Number.isFinite(c.index) ? c.index : idx;
    const satisfied =
      typeof c?.passed === 'boolean'
        ? c.passed
        : typeof c?.satisfied === 'boolean'
        ? c.satisfied
        : c?.result === 'pass';
    const result =
      typeof c?.result === 'string' && c.result.length > 0
        ? c.result
        : satisfied
        ? 'pass'
        : 'fail';
    const evidence =
      (typeof c?.evidence === 'string' && c.evidence.trim()) ||
      (typeof c?.reasoning === 'string' && c.reasoning.trim()) ||
      '';
    const confidence =
      typeof c?.confidence === 'number' && Number.isFinite(c.confidence) ? c.confidence : minConf;

    return {
      id: String(c?.criterionId || c?.id || index),
      index,
      satisfied,
      result,
      reasoning: evidence,
      evidence,
      confidence,
    };
  });

  const evidenceSummary = evaluatedCriteria
    .filter((c) => c.evidence.length > 0)
    .map((c) => `Criterion ${c.index + 1}: ${c.evidence}`)
    .join(' · ');

  const reasoning =
    evidenceSummary.length > 0
      ? evidenceSummary
      : `AI verdict: ${String(r.verdict || '').replace(/_/g, ' ')}`;

  return {
    ...r,
    minConfidence: minConf,
    confidence: minConf,
    reasoning,
    evaluatedCriteria,
    promptInjectionSuspected: Boolean(r.injectionSuspected),
  };
}

