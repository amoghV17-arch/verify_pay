import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  PackageCheck,
  CheckCircle2,
  Upload,
  AlertCircle,
  Sparkles,
  RotateCcw,
  RefreshCw,
  Scale,
  Check,
} from 'lucide-react';
import { formatCents } from '@milestone/shared';
import { Button } from '../../components/ui/Button.js';
import { StatusBadge } from '../../components/ui/StatusBadge.js';
import { mapStatusToMoneyState } from '../../lib/projectHelpers.js';
import { EvidenceChip, type DeliverableType } from '../../components/ui/EvidenceChip.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { SubmitSlideOver, type DeliverableKind } from '../../components/freelancer/SubmitSlideOver.js';
import { AppealModal } from '../../components/AppealModal.js';
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
  notes?: string;
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

export const FreelancerDeliverablesPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const projectId = id || '';

  const [milestones, setMilestones] = useState<MilestoneDetails[]>([]);
  const [deliverables, setDeliverables] = useState<DeliverableItem[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncingPayout, setIsSyncingPayout] = useState(false);
  const llmLabel = useSystemLlmLabel();

  // Slide-over and Appeal state
  const [activeSlideOverMilestone, setActiveSlideOverMilestone] = useState<MilestoneDetails | null>(null);
  const [appealMilestone, setAppealMilestone] = useState<MilestoneDetails | null>(null);

  const loadData = useCallback(
    async (showLoadingSpinner = true) => {
      if (!projectId) {
        setMilestones([]);
        setDeliverables([]);
        setReviews([]);
        setIsLoading(false);
        return;
      }
      if (showLoadingSpinner) {
        setIsLoading(true);
      }
      try {
        const [delivRes, msRes, revRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/deliverables`, {
            credentials: 'include',
            headers: { 'X-Persona': 'freelancer' },
          }).catch(() => null),
          fetch(`/api/projects/${projectId}/milestones`, {
            credentials: 'include',
            headers: { 'X-Persona': 'freelancer' },
          }),
          fetch(`/api/projects/${projectId}/reviews`, {
            credentials: 'include',
            headers: { 'X-Persona': 'freelancer' },
          }).catch(() => null),
        ]);

        if (delivRes && delivRes.ok) {
          const delivData = (await delivRes.json()) as {
            milestones?: MilestoneDetails[];
            deliverables?: DeliverableItem[];
            reviews?: ReviewItem[];
          };
          if (Array.isArray(delivData.milestones) && delivData.milestones.length > 0) {
            setMilestones(delivData.milestones);
          } else if (msRes.ok) {
            const msData = (await msRes.json()) as MilestoneDetails[] | { milestones?: MilestoneDetails[] };
            setMilestones(Array.isArray(msData) ? msData : msData.milestones || []);
          }
          setDeliverables(Array.isArray(delivData) ? (delivData as DeliverableItem[]) : delivData.deliverables || []);
          if (Array.isArray(delivData.reviews)) {
            setReviews(delivData.reviews);
          }
        } else {
          if (msRes.ok) {
            const msData = (await msRes.json()) as MilestoneDetails[] | { milestones?: MilestoneDetails[] };
            setMilestones(Array.isArray(msData) ? msData : msData.milestones || []);
          } else if (showLoadingSpinner) {
            setMilestones([]);
          }
          if (showLoadingSpinner) {
            setDeliverables([]);
          }
        }

        if (revRes && revRes.ok) {
          const revData = (await revRes.json()) as ReviewItem[] | { reviews?: ReviewItem[] };
          setReviews(Array.isArray(revData) ? revData : revData.reviews || []);
        }
      } catch {
        if (showLoadingSpinner) {
          setMilestones([]);
          setDeliverables([]);
          setReviews([]);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    void loadData(true);
  }, [loadData]);

  const handleSyncPayout = useCallback(async () => {
    if (!projectId) return;
    setIsSyncingPayout(true);
    try {
      await fetch(`/api/projects/${projectId}/reconcile`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Persona': 'freelancer' },
      });
      await loadData(false);
    } catch {
      // ignore transient network errors
    } finally {
      setIsSyncingPayout(false);
    }
  }, [projectId, loadData]);

  const hasActiveAsyncState = milestones.some((m) =>
    ['submitted', 'in_review', 'approved', 'appealed', 'releasing'].includes(m.status)
  );
  const hasReleasingState = milestones.some((m) => m.status === 'releasing');

  useEffect(() => {
    if (!projectId || !hasActiveAsyncState) return;
    const pollInterval = setInterval(() => {
      void loadData(false);
    }, 4000);
    return () => clearInterval(pollInterval);
  }, [projectId, hasActiveAsyncState, loadData]);

  useEffect(() => {
    if (!projectId || !hasReleasingState) return;
    const reconcileInterval = setInterval(() => {
      void fetch(`/api/projects/${projectId}/reconcile`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Persona': 'freelancer' },
      }).then(() => loadData(false)).catch(() => undefined);
    }, 10000);
    return () => clearInterval(reconcileInterval);
  }, [projectId, hasReleasingState, loadData]);

  function handleDeliverableSubmitted(newDeliverableId: string) {
    if (!activeSlideOverMilestone) return;

    // Update milestone state in-memory
    setMilestones((prev) =>
      prev.map((m) =>
        m.id === activeSlideOverMilestone.id ? { ...m, status: 'in_review' } : m
      )
    );

    // Add or replace deliverable
    setDeliverables((prev) => [
      ...prev.filter((d) => d.milestoneId !== activeSlideOverMilestone.id),
      {
        id: newDeliverableId,
        milestoneId: activeSlideOverMilestone.id,
        kind: activeSlideOverMilestone.deliverableType || 'url',
        payload: { url: 'https://example.com/deliverable' },
        submittedAt: new Date().toISOString(),
      },
    ]);
  }

  function handleAppealSubmitted() {
    if (!appealMilestone) return;
    setMilestones((prev) =>
      prev.map((m) =>
        m.id === appealMilestone.id ? { ...m, status: 'appealed' } : m
      )
    );
    setAppealMilestone(null);
  }

  return (
    <div
      style={{
        maxWidth: '1080px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
        paddingBottom: '3rem',
      }}
    >
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <PackageCheck size={24} color="var(--forest)" />
          <h1
            style={{
              fontSize: '1.625rem',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--ink)',
              margin: 0,
            }}
          >
            My Deliverables & AI Reviews
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--ink-2)' }}>
          Submit your work for automated AI verification against agreed acceptance criteria. Approved deliverables unlock direct PayPal payouts.
        </p>
      </div>

      {/* Deliverable Milestones List */}
      {milestones.length === 0 && !isLoading ? (
        <EmptyState
          title="No milestones found"
          description="This project does not have any milestones configured yet."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {milestones.map((milestone, idx) => {
            const deliverable = deliverables.find((d) => d.milestoneId === milestone.id);
            const review = reviews.find((r) => r.milestoneId === milestone.id);
            const isFunded = milestone.status === 'funded' || milestone.status === 'active';
            const isPaid = milestone.status === 'paid' || milestone.status === 'closed';
            const isReleasing = milestone.status === 'releasing';
            const isApproved = milestone.status === 'approved' || milestone.status === 'awaiting_client';
            const isInReview = milestone.status === 'in_review' || milestone.status === 'submitted';
            const isChangesRequested = milestone.status === 'changes_requested';
            const isAppealed = milestone.status === 'appealed';
            const hasHeldFunds =
              isFunded || isInReview || isApproved || isChangesRequested || isAppealed;

            const amountSubLabel = isPaid
              ? 'Deposited to PayPal'
              : isReleasing
              ? milestone.payoutStatus === 'UNCLAIMED'
                ? 'Sent — accept payment in PayPal'
                : 'PayPal payout processing'
              : hasHeldFunds
              ? 'Locked in sandbox'
              : 'Awaiting client funding';

            return (
              <div
                key={milestone.id}
                style={{
                  backgroundColor: 'var(--surface)',
                  border: isFunded ? '2px solid var(--forest)' : '1px solid var(--line)',
                  borderRadius: 'var(--radius-card)',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  boxShadow: isFunded ? '0 4px 16px rgba(0, 56, 42, 0.06)' : 'none',
                }}
              >
                {/* Milestone Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: 'var(--forest)',
                          backgroundColor: 'var(--teal-wash)',
                          padding: '0.15rem 0.5rem',
                          borderRadius: 'var(--radius-chip)',
                        }}
                      >
                        Milestone {idx + 1}
                      </span>
                      <StatusBadge state={mapStatusToMoneyState(milestone.status)} />
                    </div>

                    <h2
                      style={{
                        fontSize: '1.25rem',
                        fontWeight: 700,
                        color: 'var(--ink)',
                        margin: 0,
                        marginTop: '0.25rem',
                      }}
                    >
                      {milestone.name}
                    </h2>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          display: 'block',
                          fontSize: '1.25rem',
                          fontWeight: 700,
                          color: isPaid ? 'var(--forest)' : 'var(--ink)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {formatCents(milestone.amountCents)}
                      </span>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--ink-2)' }}>
                        {amountSubLabel}
                      </span>
                    </div>

                    {isReleasing && (
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<RefreshCw size={14} />}
                        disabled={isSyncingPayout}
                        onClick={handleSyncPayout}
                      >
                        {isSyncingPayout ? 'Checking PayPal...' : 'Refresh payout status'}
                      </Button>
                    )}

                    {/* Action button */}
                    {isFunded && (
                      <Button
                        id={`submit-milestone-${milestone.id}-btn`}
                        variant="primary"
                        size="sm"
                        leftIcon={<Upload size={16} />}
                        onClick={() => setActiveSlideOverMilestone(milestone)}
                      >
                        Submit deliverable
                      </Button>
                    )}

                    {isChangesRequested && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          leftIcon={<Scale size={16} />}
                          onClick={() => setAppealMilestone(milestone)}
                        >
                          Appeal
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          leftIcon={<RotateCcw size={16} />}
                          onClick={() => setActiveSlideOverMilestone(milestone)}
                        >
                          Submit revision
                        </Button>
                      </div>
                    )}

                    {isInReview && (
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<Sparkles size={16} />}
                        onClick={() => setActiveSlideOverMilestone(milestone)}
                      >
                        Review status
                      </Button>
                    )}
                  </div>
                </div>

                {/* Acceptance Criteria */}
                <div
                  style={{
                    backgroundColor: 'var(--paper)',
                    padding: '1rem',
                    borderRadius: 'var(--radius-input)',
                    border: '1px solid var(--line)',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      color: 'var(--ink)',
                      marginBottom: '0.6rem',
                    }}
                  >
                    Agreed Acceptance Criteria
                  </span>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                      fontSize: '0.8125rem',
                      color: 'var(--ink)',
                      lineHeight: 1.45,
                    }}
                  >
                    {((milestone.acceptanceCriteria || (milestone as any).criteria || []) as any[]).map((rawC: any, i: number) => {
                      const c = typeof rawC === 'string' ? rawC : rawC?.description || rawC?.id || '';
                      const criterionEval =
                        review?.evaluatedCriteria?.find((ec) => ec.index === i) ||
                        review?.evaluatedCriteria?.[i] ||
                        review?.evaluatedCriteria?.find((ec) => ec.id.includes(String(i + 1)) || ec.reasoning?.includes(c));
                      return (
                        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                          <span style={{ color: criterionEval?.satisfied ? 'var(--forest)' : 'var(--ink-2)', flexShrink: 0, marginTop: '2px' }}>
                            {criterionEval?.satisfied ? <Check size={14} /> : '•'}
                          </span>
                          <span>{c}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Deliverable Submitted Section */}
                {deliverable ? (
                  <div
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-input)',
                      border: '1px solid var(--line)',
                      backgroundColor: 'var(--surface)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <EvidenceChip
                          type={(deliverable.kind as DeliverableType) || 'url'}
                          label={
                            (deliverable.payload?.documentUrl as string) ||
                            (deliverable.payload?.url as string) ||
                            (deliverable.payload?.repoUrl as string) ||
                            (deliverable.payload?.text as string) ||
                            'Submitted deliverable'
                          }
                          url={
                            (deliverable.payload?.documentUrl as string) ||
                            (deliverable.payload?.url as string) ||
                            (deliverable.payload?.repoUrl as string)
                          }
                        />
                        <span style={{ fontSize: '0.75rem', color: 'var(--ink-2)' }}>
                          Submitted on {new Date(deliverable.submittedAt).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Review status badge */}
                      {isPaid && (
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: 'var(--forest)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            backgroundColor: 'var(--teal-wash)',
                            padding: '0.2rem 0.55rem',
                            borderRadius: 'var(--radius-chip)',
                          }}
                        >
                          <CheckCircle2 size={14} />
                          Paid via PayPal (Sandbox)
                        </span>
                      )}

                      {isInReview && (
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: 'var(--teal-ink)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            backgroundColor: 'var(--teal-wash)',
                            padding: '0.2rem 0.55rem',
                            borderRadius: 'var(--radius-chip)',
                          }}
                        >
                          <Sparkles size={14} />
                          {llmLabel} evaluating criteria
                        </span>
                      )}

                      {isChangesRequested && (
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: 'var(--amber-ink)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            backgroundColor: 'var(--amber-wash)',
                            padding: '0.2rem 0.55rem',
                            borderRadius: 'var(--radius-chip)',
                          }}
                        >
                          <AlertCircle size={14} />
                          Changes requested
                        </span>
                      )}

                      {isAppealed && (
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: 'var(--forest)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            backgroundColor: 'var(--teal-wash)',
                            padding: '0.2rem 0.55rem',
                            borderRadius: 'var(--radius-chip)',
                          }}
                        >
                          <Scale size={14} />
                          Independent appeal review active
                        </span>
                      )}
                    </div>

                    {/* Review reasoning box if available */}
                    {review && (
                      <div
                        style={{
                          marginTop: '0.5rem',
                          padding: '0.75rem',
                          borderRadius: 'var(--radius-input)',
                          backgroundColor: isApprovalVerdict(review.verdict)
                            ? 'var(--teal-wash)'
                            : 'var(--amber-wash)',
                          fontSize: '0.8125rem',
                          color: 'var(--ink)',
                          lineHeight: 1.4,
                        }}
                      >
                        <strong style={{ display: 'block', marginBottom: '0.2rem' }}>
                          AI Review Evaluation ({getReviewConfidencePct(review)}% confidence ·{' '}
                          {review.model ? formatModelLabel(review.model) : llmLabel}):
                        </strong>
                        <span>
                          {review.reasoning || `AI verdict: ${review.verdict.replace(/_/g, ' ')}`}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Deliverable not yet submitted */
                  <div
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: 'var(--radius-input)',
                      border: '1px dashed var(--line)',
                      backgroundColor: 'var(--paper)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.8125rem',
                      color: 'var(--ink-2)',
                    }}
                  >
                    <span>
                      {isFunded
                        ? 'Ready to work: Deliverable can be submitted when finished.'
                        : isInReview
                        ? 'Deliverable is currently under AI evaluation.'
                        : isApproved
                        ? 'Deliverable approved; preparing PayPal payout release.'
                        : isReleasing
                        ? 'PayPal sandbox payout is releasing.'
                        : isPaid
                        ? 'Milestone paid and settled via PayPal.'
                        : isChangesRequested
                        ? 'Changes requested; submit a revision or appeal.'
                        : isAppealed
                        ? 'Independent appeal review in progress.'
                        : 'Awaiting client funding before submission unlocks.'}
                    </span>
                    <span style={{ fontStyle: 'italic', fontSize: '0.75rem' }}>
                      Accepted formats: URL, GitHub Repo, Figma/Document, Text
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Slide-over Submission Drawer */}
      {activeSlideOverMilestone && (
        <SubmitSlideOver
          isOpen={!!activeSlideOverMilestone}
          onClose={() => {
            setActiveSlideOverMilestone(null);
            void loadData(false);
          }}
          milestoneId={activeSlideOverMilestone.id}
          milestoneTitle={activeSlideOverMilestone.name}
          amountCents={activeSlideOverMilestone.amountCents}
          projectId={projectId}
          initialKind={(activeSlideOverMilestone.deliverableType as DeliverableKind) || 'url'}
          onSubmitted={handleDeliverableSubmitted}
        />
      )}

      {/* Appeal Modal */}
      {appealMilestone && (
        <AppealModal
          milestoneId={appealMilestone.id}
          milestoneName={appealMilestone.name}
          projectId={projectId}
          onClose={() => setAppealMilestone(null)}
          onSubmitted={handleAppealSubmitted}
        />
      )}
    </div>
  );
};
