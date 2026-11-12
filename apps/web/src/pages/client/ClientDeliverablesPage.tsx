import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  PackageCheck,
  CheckCircle2,
  Eye,
  DollarSign,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';
import { formatCents } from '@milestone/shared';
import { Button } from '../../components/ui/Button.js';
import { StatusBadge, type MoneyState } from '../../components/ui/StatusBadge.js';
import { EvidenceChip, type DeliverableType } from '../../components/ui/EvidenceChip.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import {
  useSystemLlmLabel,
  formatModelLabel,
  getReviewConfidencePct,
  isApprovalVerdict,
} from '../../lib/aiMeta.js';

interface DeliverableItem {
  id: string;
  milestoneId: string;
  kind: string;
  payload: Record<string, unknown>;
  submittedAt: string;
}

interface ReviewItem {
  id: string;
  milestoneId: string;
  model?: string;
  verdict: 'pass' | 'release' | 'request_changes' | 'escalate_to_human';
  confidence?: number;
  minConfidence?: number;
  reasoning?: string;
  evaluatedCriteria?: Array<{ id: string; index?: number; satisfied: boolean; reasoning: string }>;
  promptInjectionSuspected?: boolean;
}

interface MilestoneDetails {
  id: string;
  name: string;
  amountCents: number;
  status: string;
  payoutStatus?: string | null;
  deliverableType?: string;
  acceptanceCriteria: string[];
}

function mapStatusToMoneyState(status: string): MoneyState {
  switch (status) {
    case 'paid':
    case 'closed':
      return 'paid';
    case 'releasing':
      return 'releasing';
    case 'approved':
    case 'awaiting_client':
      return 'needs_decision';
    case 'changes_requested':
      return 'changes_requested';
    case 'submitted':
    case 'in_review':
    case 'appealed':
      return 'in_review';
    case 'funded':
    case 'active':
      return 'funded';
    default:
      return 'agreed';
  }
}

export const ClientDeliverablesPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [milestones, setMilestones] = useState<MilestoneDetails[]>([]);
  const [deliverables, setDeliverables] = useState<DeliverableItem[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quick release and reconcile actions
  const [releasingMilestoneId, setReleasingMilestoneId] = useState<string | null>(null);
  const [isSyncingPayout, setIsSyncingPayout] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const llmLabel = useSystemLlmLabel();

  // Selected deliverable for modal/drawer preview
  const [selectedMilestone, setSelectedMilestone] = useState<MilestoneDetails | null>(null);

  const fetchData = useCallback(
    async (showSpinner = true) => {
      if (!id) return;
      try {
        if (showSpinner) {
          setIsLoading(true);
        }
        setError(null);

        const res = await fetch(`/api/projects/${id}/deliverables`, {
          credentials: 'include',
          headers: { 'X-Persona': 'client' },
        });

        if (!res.ok) {
          throw new Error(`Failed to load deliverables: ${res.statusText}`);
        }

        const data = await res.json();
        setMilestones(data.milestones || []);
        setDeliverables(data.deliverables || []);
        setReviews(data.reviews || []);
      } catch (err) {
        if (showSpinner) {
          setError(err instanceof Error ? err.message : 'Failed to load deliverables');
          setMilestones([]);
          setDeliverables([]);
          setReviews([]);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    void fetchData(true);
  }, [fetchData, actionSuccess]);

  const hasActiveAsyncState = milestones.some((m) =>
    ['submitted', 'in_review', 'approved', 'appealed', 'releasing'].includes(m.status)
  );
  const hasReleasingState = milestones.some((m) => m.status === 'releasing');

  useEffect(() => {
    if (!id || !hasActiveAsyncState) return;
    const pollInterval = setInterval(() => {
      void fetchData(false);
    }, 4000);
    return () => clearInterval(pollInterval);
  }, [id, hasActiveAsyncState, fetchData]);

  useEffect(() => {
    if (!id || !hasReleasingState) return;
    const reconcileInterval = setInterval(() => {
      void fetch(`/api/projects/${id}/reconcile`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Persona': 'client' },
      }).then(() => fetchData(false)).catch(() => undefined);
    }, 10000);
    return () => clearInterval(reconcileInterval);
  }, [id, hasReleasingState, fetchData]);

  const handleSyncPayout = async () => {
    if (!id) return;
    setIsSyncingPayout(true);
    try {
      await fetch(`/api/projects/${id}/reconcile`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Persona': 'client' },
      });
      await fetchData(false);
    } catch {
      // ignore transient errors
    } finally {
      setIsSyncingPayout(false);
    }
  };

  const handleRelease = async (milestoneId: string) => {
    setReleasingMilestoneId(milestoneId);
    setError(null);
    try {
      const res = await fetch(`/api/milestones/${milestoneId}/release`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Persona': 'client',
        },
      });
      if (res.ok) {
        setActionSuccess('Milestone payout released successfully!');
        setTimeout(() => setActionSuccess(null), 3000);
      } else {
        const errData = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        setError(errData.message || errData.error || 'Failed to initiate payout release');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Release request failed');
    } finally {
      setReleasingMilestoneId(null);
    }
  };

  if (isLoading) {
    return (
      <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '2.5rem 1.5rem', width: '100%' }}>
        <div style={{ height: '240px', backgroundColor: 'var(--surface)', borderRadius: 'var(--radius-card)', animation: 'pulse 1.5s infinite' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '2.5rem 1.5rem', width: '100%' }}>
        <div style={{ backgroundColor: 'var(--amber-wash)', padding: '1.5rem', borderRadius: 'var(--radius-card)', border: '1px solid var(--amber)' }}>
          <h3>Unable to load deliverables</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: '1080px',
        margin: '0 auto',
        padding: '2.5rem 1.5rem',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1
          className="font-display"
          style={{
            fontSize: '2rem',
            fontWeight: 600,
            color: 'var(--ink)',
            margin: '0 0 0.25rem 0',
            letterSpacing: '-0.02em',
          }}
        >
          Deliverables & Reviews
        </h1>
        <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--ink-2)' }}>
          Review submitted deliverables, inspect AI verification evidence, and authorize payout releases.
        </p>
      </div>

      {actionSuccess && (
        <div
          style={{
            backgroundColor: 'var(--teal-wash)',
            border: '1px solid var(--teal)',
            borderRadius: 'var(--radius-card)',
            padding: '1rem',
            color: 'var(--teal-ink)',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <CheckCircle2 size={20} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Deliverables List Table per §6.5 */}
      {milestones.length > 0 ? (
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-card)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1.2fr 1.2fr 1.5fr 1.5fr',
              padding: '0.75rem 1.25rem',
              backgroundColor: 'var(--paper)',
              borderBottom: '1px solid var(--line)',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--ink-2)',
              textTransform: 'uppercase',
            }}
          >
            <span>Milestone</span>
            <span>Submitted</span>
            <span>Review Status</span>
            <span>Evidence / AI Verdict</span>
            <span>Action</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {milestones.map((m) => {
              const deliverable = deliverables.find((d) => d.milestoneId === m.id);
              const review = reviews.find((r) => r.milestoneId === m.id);

              return (
                <div
                  key={m.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1.2fr 1.2fr 1.5fr 1.5fr',
                    padding: '1.25rem',
                    borderBottom: '1px solid var(--line)',
                    alignItems: 'center',
                    gap: '0.75rem',
                  }}
                >
                  {/* Milestone Name & Amount */}
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--ink)' }}>
                      {m.name}
                    </h4>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--teal-ink)', fontWeight: 600 }}>
                      {formatCents(m.amountCents)}
                    </span>
                  </div>

                  {/* Submission date */}
                  <div style={{ fontSize: '0.8125rem', color: 'var(--ink-2)' }}>
                    {deliverable ? (
                      new Date(deliverable.submittedAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    ) : (
                      <span style={{ color: 'var(--ink-3)', fontStyle: 'italic' }}>Pending submission</span>
                    )}
                  </div>

                  {/* Review Status Badge */}
                  <div>
                    <StatusBadge state={mapStatusToMoneyState(m.status)} />
                  </div>

                  {/* Evidence / AI Verdict */}
                  <div>
                    {review ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              color: isApprovalVerdict(review.verdict)
                                ? 'var(--teal-ink)'
                                : review.verdict === 'request_changes'
                                ? 'var(--amber)'
                                : 'var(--ink)',
                            }}
                          >
                            AI: {review.verdict.replace(/_/g, ' ')}
                          </span>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--ink-3)' }}>
                            ({getReviewConfidencePct(review)}%)
                          </span>
                        </div>

                        {review.promptInjectionSuspected && (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              fontSize: '0.6875rem',
                              color: 'var(--amber)',
                              fontWeight: 600,
                            }}
                          >
                            <ShieldAlert size={12} />
                            <span>Injection Shield Active</span>
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                          {deliverable?.kind && (
                            <EvidenceChip
                              type={(deliverable.kind as DeliverableType) || 'document'}
                              label={deliverable.kind}
                            />
                          )}
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>No review yet</span>
                    )}
                  </div>

                  {/* Client Action */}
                  <div>
                    {m.status === 'approved' || m.status === 'awaiting_client' ? (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={releasingMilestoneId === m.id}
                        onClick={() => handleRelease(m.id)}
                        leftIcon={<DollarSign size={14} />}
                      >
                        {releasingMilestoneId === m.id ? 'Releasing...' : 'Release payout'}
                      </Button>
                    ) : m.status === 'paid' ? (
                      <span style={{ fontSize: '0.8125rem', color: 'var(--teal-ink)', fontWeight: 600 }}>
                        ✓ Paid & Settled
                      </span>
                    ) : m.status === 'releasing' ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={isSyncingPayout}
                          onClick={handleSyncPayout}
                          leftIcon={<RefreshCw size={14} />}
                        >
                          {isSyncingPayout ? 'Checking...' : 'Sync payout'}
                        </Button>
                        {deliverable && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setSelectedMilestone(m)}
                            leftIcon={<Eye size={14} />}
                          >
                            Inspect
                          </Button>
                        )}
                      </div>
                    ) : deliverable ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedMilestone(m)}
                        leftIcon={<Eye size={14} />}
                      >
                        Inspect
                      </Button>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>
                        Waiting for freelancer
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<PackageCheck size={40} style={{ color: 'var(--forest)' }} />}
          title="No deliverables yet"
          description="Deliverables submitted by your freelancer will appear here with automated criteria verification."
        />
      )}

      {/* Inspect Deliverable Modal */}
      {selectedMilestone && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
          onClick={() => setSelectedMilestone(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--surface)',
              borderRadius: 'var(--radius-card)',
              maxWidth: '600px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--line)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 600, color: 'var(--ink)' }}>
              {selectedMilestone.name} Deliverable
            </h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.875rem', color: 'var(--ink-2)' }}>
              Payout Amount: <strong>{formatCents(selectedMilestone.amountCents)}</strong>
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-2)', textTransform: 'uppercase' }}>
                Agreed Acceptance Criteria
              </span>
              <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.25rem', fontSize: '0.875rem', color: 'var(--ink)' }}>
                {(((selectedMilestone.acceptanceCriteria || (selectedMilestone as any).criteria) || []) as any[]).map((rawC: any, i: number) => {
                  const c = typeof rawC === 'string' ? rawC : rawC?.description || rawC?.id || '';
                  return <li key={i} style={{ marginBottom: '0.35rem' }}>{c}</li>;
                })}
              </ul>
            </div>

            {(() => {
              const modalDeliverable = deliverables.find((d) => d.milestoneId === selectedMilestone.id);
              const modalReview = reviews.find((r) => r.milestoneId === selectedMilestone.id);
              const modalPayloadText =
                typeof modalDeliverable?.payload?.text === 'string'
                  ? modalDeliverable.payload.text
                  : '';
              return (
                <>
                  {modalPayloadText && (
                    <div style={{ marginBottom: '1.25rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-2)', textTransform: 'uppercase' }}>
                        Submitted Text
                      </span>
                      <pre
                        style={{
                          margin: '0.5rem 0 0',
                          padding: '0.75rem',
                          borderRadius: 'var(--radius-input)',
                          border: '1px solid var(--line)',
                          backgroundColor: 'var(--paper)',
                          fontSize: '0.75rem',
                          maxHeight: '160px',
                          overflowY: 'auto',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {modalPayloadText}
                      </pre>
                    </div>
                  )}

                  {modalReview && (
                    <div
                      style={{
                        marginBottom: '1.25rem',
                        padding: '0.85rem',
                        borderRadius: 'var(--radius-input)',
                        backgroundColor: isApprovalVerdict(modalReview.verdict)
                          ? 'var(--teal-wash)'
                          : 'var(--amber-wash)',
                        fontSize: '0.8125rem',
                        color: 'var(--ink)',
                        lineHeight: 1.45,
                      }}
                    >
                      <strong style={{ display: 'block', marginBottom: '0.25rem' }}>
                        AI Verdict: {modalReview.verdict.replace(/_/g, ' ').toUpperCase()} (
                        {getReviewConfidencePct(modalReview)}% confidence ·{' '}
                        {modalReview.model ? formatModelLabel(modalReview.model) : llmLabel})
                      </strong>
                      <span>
                        {modalReview.reasoning || `AI verdict: ${modalReview.verdict.replace(/_/g, ' ')}`}
                      </span>
                    </div>
                  )}
                </>
              );
            })()}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <Button variant="secondary" onClick={() => setSelectedMilestone(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

