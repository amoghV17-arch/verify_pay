import React, { useState, useEffect } from 'react';
import { formatCents } from '@milestone/shared';

export interface AcceptanceCriterionItem {
  id: string;
  description: string;
  passed?: boolean;
  evidence?: string;
  confidence?: number;
}

export interface ReviewRecord {
  id: string;
  kind: string;
  model: string;
  promptVersion: string;
  verdict: 'release' | 'request_changes' | 'escalate_to_human';
  minConfidence: number;
  injectionSuspected: boolean;
  latencyMs?: number;
  trace?: {
    toolCalls?: Array<{ tool: string; input?: unknown; outputSummary?: string; durationMs?: number }>;
    reasoningSteps?: Array<{ step: string; durationMs?: number; detail?: string }>;
  };
  criteriaResults?: Array<{
    id: string;
    passed: boolean;
    evidence: string;
    confidence: number;
    explanation?: string;
  }>;
  createdAt: string;
}

export interface ActivityRecord {
  id: string;
  actor: 'client' | 'freelancer' | 'ai' | 'system';
  kind: string;
  text: string;
  meta?: Record<string, unknown>;
  ts: string;
}

export interface LedgerEntryItem {
  id: string;
  projectId?: string;
  milestoneId?: string | null;
  type: string;
  amountCents: number;
  paypalRef?: string | null;
  meta?: Record<string, unknown> | null;
  createdAt: string;
}

interface TrustPanelProps {
  milestone: {
    id: string;
    name: string;
    amountCents: number;
    paymentStatus: string;
    acceptanceCriteria?: AcceptanceCriterionItem[];
    deliverableType?: string;
    releaseAt?: string | null;
  } | null;
  projectId: string;
  persona: 'client' | 'freelancer';
  ledgerEntries: LedgerEntryItem[];
  refreshKey: number;
  isReleasing: boolean;
  isObjecting: boolean;
  onReleasePayment: (milestoneId: string) => void;
  onObjectToRelease: (milestoneId: string) => void;
  onSubmitDeliverableClick: () => void;
  onAppealClick: () => void;
  onOpenCloseout: () => void;
}

export const TrustPanel: React.FC<TrustPanelProps> = ({
  milestone,
  projectId,
  persona,
  ledgerEntries,
  refreshKey,
  isReleasing,
  isObjecting,
  onReleasePayment,
  onObjectToRelease,
  onSubmitDeliverableClick,
  onAppealClick,
  onOpenCloseout,
}) => {
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [expandedCriteria, setExpandedCriteria] = useState<Record<string, boolean>>({});
  const [showFullTrace, setShowFullTrace] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const milestoneId = milestone?.id;

  // Fetch reviews and activity trail
  useEffect(() => {
    if (!milestoneId) {
      setReviews([]);
      return;
    }
    let isMounted = true;
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [revRes, actRes] = await Promise.all([
          fetch(`/api/milestones/${milestoneId}/reviews`, { credentials: 'include' }),
          fetch(`/api/projects/${projectId}/activity`, { credentials: 'include' }),
        ]);

        if (isMounted && revRes.ok) {
          const revData = await revRes.json();
          setReviews(revData.reviews || []);
        }
        if (isMounted && actRes.ok) {
          const actData = await actRes.json();
          setActivities(actData.activity || []);
        }
      } catch {
        // network failure
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();
    return () => {
      isMounted = false;
    };
  }, [milestoneId, projectId, refreshKey]);

  if (!milestone) {
    return (
      <aside
        id="trust-panel"
        aria-label="Trust Panel"
        style={{
          backgroundColor: 'var(--paper)',
          border: '1px solid var(--line)',
          borderRadius: '8px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          color: 'var(--slate)',
          textAlign: 'center',
        }}
      >
        <span style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>🎯</span>
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--ink)', margin: '0 0 0.25rem 0' }}>
          No Milestone Selected
        </h3>
        <p style={{ fontSize: '0.8125rem', margin: 0 }}>
          Click on any milestone diamond or task in the timeline to inspect criteria, review traces, and payment status.
        </p>
      </aside>
    );
  }

  const latestReview = reviews[0];
  const relevantLedger = ledgerEntries.filter(
    (l) => l.milestoneId === milestone.id || (l.meta as Record<string, unknown>)?.milestoneId === milestone.id
  );

  // Status and Next Step Summary Sentence per DESIGN.md
  let statusSummary = 'Waiting for freelancer to submit deliverable.';
  let nextStep = 'Freelancer needs to submit work matching the agreed criteria.';

  if (milestone.paymentStatus === 'unfunded') {
    statusSummary = 'Milestone is planned but not yet funded.';
    nextStep = 'Client must fund the project to begin work.';
  } else if (milestone.paymentStatus === 'in_review') {
    statusSummary = 'AI review in progress.';
    nextStep = 'AI reviewer is inspecting deliverables against acceptance criteria.';
  } else if (milestone.paymentStatus === 'changes_requested') {
    statusSummary = 'Changes requested on deliverable.';
    nextStep = 'Freelancer must submit revisions or request a second independent review.';
  } else if (milestone.paymentStatus === 'approved') {
    statusSummary = milestone.releaseAt
      ? 'Approved. Scheduled for auto-release unless client objects.'
      : 'Approved by AI reviewer. Ready for client payment release.';
    nextStep = 'Client can release payment immediately or allow auto-release window to complete.';
  } else if (milestone.paymentStatus === 'releasing') {
    statusSummary = 'Payout in flight via PayPal Sandbox.';
    nextStep = 'Processing settlement to freelancer account.';
  } else if (milestone.paymentStatus === 'paid') {
    statusSummary = `Paid. ${formatCents(milestone.amountCents)} released to freelancer.`;
    nextStep = 'Work verified and payment settled.';
  } else if (milestone.paymentStatus === 'appealed') {
    statusSummary = 'Freelancer submitted an appeal for second independent review.';
    nextStep = 'Impartial review model is re-evaluating deliverable and feedback.';
  }

  const toggleCriterionEvidence = (id: string) => {
    setExpandedCriteria((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <aside
      id="trust-panel"
      aria-label="Milestone Trust Panel"
      style={{
        backgroundColor: 'var(--paper)',
        border: '1px solid var(--line)',
        borderRadius: '8px',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        boxShadow: '0 1px 3px rgba(22, 32, 43, 0.05)',
        overflowY: 'auto',
        maxHeight: 'calc(100vh - 180px)',
      }}
    >
      {/* Drawer Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                fontSize: '0.6875rem',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--slate)',
                fontWeight: 700,
              }}
            >
              Trust Panel
            </span>
            {isLoading && (
              <span style={{ fontSize: '0.6875rem', color: 'var(--slate)', fontStyle: 'italic' }}>
                Updating…
              </span>
            )}
          </div>
          <span className={`status-pill ${milestone.paymentStatus}`} style={{ fontSize: '0.75rem' }}>
            {milestone.paymentStatus.replace(/_/g, ' ')}
          </span>
        </div>

        <h3
          style={{
            fontFamily: 'Bricolage Grotesque, sans-serif',
            margin: '0.5rem 0 0.25rem 0',
            fontSize: '1.125rem',
            color: 'var(--ink)',
            fontWeight: 700,
            lineHeight: 1.3,
          }}
        >
          {milestone.name}
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}>
          <span style={{ color: 'var(--slate)' }}>Amount attached:</span>
          <strong style={{ color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
            {formatCents(milestone.amountCents)}
          </strong>
        </div>
      </div>

      {/* SECTION 1: Status & Next Step */}
      <section
        aria-labelledby="section-status-heading"
        style={{
          backgroundColor: 'var(--chalk)',
          padding: '0.75rem 0.875rem',
          borderRadius: '6px',
          border: '1px solid var(--line)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
        }}
      >
        <span
          id="section-status-heading"
          style={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--slate)',
          }}
        >
          Status & Next Step
        </span>
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink)' }}>{statusSummary}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--slate)' }}>{nextStep}</div>

        {milestone.paymentStatus === 'approved' && milestone.releaseAt && (
          <div
            style={{
              marginTop: '0.35rem',
              padding: '0.35rem 0.5rem',
              borderRadius: '4px',
              backgroundColor: 'rgba(176, 122, 18, 0.12)',
              color: 'var(--brass)',
              fontSize: '0.75rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <span>⏳</span>
            <span>Releases in 20 seconds unless client objects</span>
          </div>
        )}
      </section>

      {/* SECTION 2: Acceptance Criteria with Status Mark & Evidence */}
      <section aria-labelledby="section-criteria-heading">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <h4
            id="section-criteria-heading"
            style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, color: 'var(--ink)' }}
          >
            Acceptance Criteria
          </h4>
          <span style={{ fontSize: '0.6875rem', color: 'var(--slate)' }}>
            {(milestone.acceptanceCriteria || []).length} criteria
          </span>
        </div>

        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          {(milestone.acceptanceCriteria || [
            { id: '1', description: 'At least 5 customer interview summaries documented', passed: true },
            { id: '2', description: 'Positioning matrix compares 4 primary competitors', passed: true },
          ]).map((crit, idx) => {
            const result = latestReview?.criteriaResults?.find((r) => r.id === crit.id);
            const isPassed = result ? result.passed : crit.passed;
            const evidence = result?.evidence || crit.evidence;
            const isExpanded = !!expandedCriteria[crit.id];

            return (
              <li
                key={crit.id || idx}
                style={{
                  fontSize: '0.8125rem',
                  border: '1px solid var(--line)',
                  borderRadius: '6px',
                  padding: '0.5rem 0.65rem',
                  backgroundColor: 'var(--paper)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <span
                    style={{
                      color: isPassed ? 'var(--settled)' : isPassed === false ? 'var(--flag)' : 'var(--slate)',
                      fontWeight: 700,
                      lineHeight: 1.2,
                      fontSize: '0.9375rem',
                    }}
                  >
                    {isPassed ? '✓' : isPassed === false ? '✗' : '○'}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'var(--ink)', lineHeight: 1.35 }}>{crit.description}</div>

                    {/* Evidence Toggle */}
                    {evidence && (
                      <button
                        type="button"
                        onClick={() => toggleCriterionEvidence(crit.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--forest)',
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: '0.2rem 0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          marginTop: '0.25rem',
                        }}
                      >
                        <span>{isExpanded ? 'Hide evidence ▲' : 'Show evidence ▼'}</span>
                      </button>
                    )}

                    {isExpanded && evidence && (
                      <div
                        style={{
                          marginTop: '0.25rem',
                          padding: '0.4rem 0.5rem',
                          borderRadius: '4px',
                          backgroundColor: 'var(--chalk)',
                          border: '1px solid var(--line)',
                          fontSize: '0.75rem',
                          color: 'var(--slate)',
                          lineHeight: 1.35,
                        }}
                      >
                        <strong>Evidence: </strong>
                        {evidence}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* SECTION 3: AI Review Trace & Confidence */}
      <section aria-labelledby="section-review-heading">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <h4
            id="section-review-heading"
            style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, color: 'var(--ink)' }}
          >
            AI Review & Reasoning Trace
          </h4>
          {latestReview && (
            <span
              style={{
                fontSize: '0.6875rem',
                backgroundColor: 'rgba(31, 122, 140, 0.1)',
                color: 'var(--forest)',
                padding: '0.15rem 0.4rem',
                borderRadius: '4px',
                fontWeight: 600,
              }}
            >
              {latestReview.model || 'Reviewer'}
            </span>
          )}
        </div>

        {latestReview ? (
          <div
            style={{
              backgroundColor: 'var(--chalk)',
              border: '1px solid var(--line)',
              borderRadius: '6px',
              padding: '0.65rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--slate)' }}>Verdict:</span>
              <strong
                style={{
                  color:
                    latestReview.verdict === 'release'
                      ? 'var(--settled)'
                      : latestReview.verdict === 'request_changes'
                        ? 'var(--flag)'
                        : 'var(--brass)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {latestReview.verdict.replace(/_/g, ' ')}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--slate)' }}>Confidence:</span>
              <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
                {Math.round(latestReview.minConfidence * 100)}% ({latestReview.minConfidence >= 0.8 ? 'High' : 'Moderate'})
              </span>
            </div>

            {/* Prompt Injection Heuristic Warning if flagged */}
            {latestReview.injectionSuspected && (
              <div
                style={{
                  backgroundColor: 'rgba(200, 64, 47, 0.1)',
                  border: '1px solid var(--flag)',
                  color: 'var(--flag)',
                  padding: '0.4rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.6875rem',
                  lineHeight: 1.3,
                }}
              >
                ⚠️ <strong>Prompt injection detected:</strong> Deliverable contained instructions targeting reviewer prompt. Safely neutralized; human escalation enforced.
              </div>
            )}

            {/* Reasoning Tool Steps */}
            {latestReview.trace?.reasoningSteps && latestReview.trace.reasoningSteps.length > 0 && (
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: '0.4rem' }}>
                <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--slate)' }}>
                  Tool & Reasoning Steps:
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }}>
                  {latestReview.trace.reasoningSteps.slice(0, showFullTrace ? 10 : 3).map((st, sIdx) => (
                    <div
                      key={sIdx}
                      style={{
                        fontSize: '0.6875rem',
                        color: 'var(--ink)',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>• {st.step}</span>
                      {st.durationMs != null && (
                        <span style={{ color: 'var(--slate)', fontVariantNumeric: 'tabular-nums' }}>
                          {st.durationMs}ms
                        </span>
                      )}
                    </div>
                  ))}
                  {latestReview.trace.reasoningSteps.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setShowFullTrace(!showFullTrace)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--forest)',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                        textAlign: 'left',
                        marginTop: '0.2rem',
                      }}
                    >
                      {showFullTrace ? 'Show fewer steps' : `+${latestReview.trace.reasoningSteps.length - 3} more steps`}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              padding: '0.75rem',
              border: '1px dashed var(--line)',
              borderRadius: '6px',
              fontSize: '0.75rem',
              color: 'var(--slate)',
              textAlign: 'center',
            }}
          >
            No AI reviews conducted yet for this milestone.
          </div>
        )}
      </section>

      {/* SECTION 4: Money & Ledger History */}
      <section aria-labelledby="section-money-heading">
        <h4
          id="section-money-heading"
          style={{ margin: '0 0 0.5rem 0', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--ink)' }}
        >
          Money & Sandbox Settlement
        </h4>
        <div
          style={{
            backgroundColor: 'var(--chalk)',
            padding: '0.65rem',
            borderRadius: '6px',
            border: '1px solid var(--line)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
            fontSize: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--slate)' }}>Deliverable Type:</span>
            <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
              {milestone.deliverableType || 'document'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--slate)' }}>Holding Invariant:</span>
            <span style={{ color: '#137042', fontWeight: 600 }}>Funded before start</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--slate)' }}>PayPal Mode:</span>
            <span style={{ fontWeight: 600 }}>Sandbox Safe</span>
          </div>

          {/* Ledger records attached to this milestone */}
          {relevantLedger.length > 0 && (
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: '0.35rem', marginTop: '0.25rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--slate)' }}>Ledger Transactions:</span>
              {relevantLedger.map((tx) => (
                <div
                  key={tx.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '0.2rem',
                    fontSize: '0.6875rem',
                  }}
                >
                  <span style={{ textTransform: 'capitalize', color: 'var(--ink)' }}>{tx.type}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                    {formatCents(tx.amountCents)}{tx.paypalRef ? ` (${tx.paypalRef})` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* SECTION 5: Activity Trail with Actor Glyphs */}
      <section aria-labelledby="section-activity-heading">
        <h4
          id="section-activity-heading"
          style={{ margin: '0 0 0.5rem 0', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--ink)' }}
        >
          Activity Trail
        </h4>
        <div
          tabIndex={0}
          role="region"
          aria-label="Activity history list"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            maxHeight: '160px',
            overflowY: 'auto',
          }}
        >
          {activities.length > 0 ? (
            activities.slice(0, 6).map((act) => {
              const actorGlyph =
                act.actor === 'client'
                  ? '🏛️'
                  : act.actor === 'freelancer'
                    ? '⚡'
                    : act.actor === 'ai'
                      ? '🤖'
                      : '⚙️';
              return (
                <div
                  key={act.id}
                  style={{
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.35rem',
                    padding: '0.3rem 0',
                    borderBottom: '1px solid var(--chalk)',
                  }}
                >
                  <span>{actorGlyph}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'var(--ink)', lineHeight: 1.3 }}>{act.text}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--slate)' }}>
                      {new Date(act.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ fontSize: '0.75rem', color: 'var(--slate)' }}>No recent activity.</div>
          )}
        </div>
      </section>

      {/* ACTION BUTTONS & CONTROLS */}
      <div
        style={{
          borderTop: '1px solid var(--line)',
          paddingTop: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        {/* Client Actions */}
        {persona === 'client' && milestone.paymentStatus === 'approved' && (
          <>
            <button
              id="release-milestone-btn"
              type="button"
              onClick={() => onReleasePayment(milestone.id)}
              disabled={isReleasing}
              style={{
                width: '100%',
                padding: '0.625rem 1rem',
                backgroundColor: 'var(--settled)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: isReleasing ? 'not-allowed' : 'pointer',
                opacity: isReleasing ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
            >
              <span>🚀</span>
              <span>{isReleasing ? 'Releasing Payout...' : `Release Payment (${formatCents(milestone.amountCents)})`}</span>
            </button>

            <button
              id="object-milestone-btn"
              type="button"
              onClick={() => onObjectToRelease(milestone.id)}
              disabled={isObjecting}
              style={{
                width: '100%',
                padding: '0.5rem 1rem',
                backgroundColor: '#ffffff',
                color: '#dc2626',
                border: '1px solid #dc2626',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.8125rem',
                cursor: isObjecting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
              }}
            >
              <span>🛑</span>
              <span>{isObjecting ? 'Objecting…' : 'Object to Release (Request Changes)'}</span>
            </button>
          </>
        )}

        {/* Freelancer Actions */}
        {persona === 'freelancer' &&
          (milestone.paymentStatus === 'funded' || milestone.paymentStatus === 'changes_requested') && (
            <>
              <button
                id="submit-deliverable-btn"
                type="button"
                onClick={onSubmitDeliverableClick}
                style={{
                  width: '100%',
                  padding: '0.625rem 1rem',
                  backgroundColor: 'var(--tide)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                <span>📤</span>
                <span>
                  {milestone.paymentStatus === 'changes_requested' ? 'Submit Revision' : 'Submit Deliverable'}
                </span>
              </button>

              {milestone.paymentStatus === 'changes_requested' && (
                <button
                  id="appeal-decision-btn"
                  type="button"
                  onClick={onAppealClick}
                  style={{
                    width: '100%',
                    padding: '0.5rem 1rem',
                    backgroundColor: '#d97706',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <span>⚖️</span>
                  <span>Appeal Decision (Second Review)</span>
                </button>
              )}
            </>
          )}

        {/* Global Action: Open Closeout Receipt */}
        <button
          id="trust-panel-receipt-btn"
          type="button"
          onClick={onOpenCloseout}
          style={{
            width: '100%',
            padding: '0.45rem 0.75rem',
            backgroundColor: 'transparent',
            color: 'var(--slate)',
            border: '1px solid var(--line)',
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem',
          }}
        >
          <span>🧾</span>
          <span>View Project Closeout Receipt</span>
        </button>
      </div>
    </aside>
  );
};

