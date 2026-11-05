import React, { useState, useEffect, useCallback } from 'react';
import type { ComputedPlan } from '@milestone/shared';
import { formatCents } from '@milestone/shared';
import { MilestoneGantt } from './components/Gantt.js';
import { MilestoneTaskModel } from './models/MilestoneTaskModel.js';
import { sampleTasks } from './data/sampleProject.js';
import { StartScreen } from './components/StartScreen.js';
import { PlanReviewScreen } from './components/PlanReviewScreen.js';
import { SubmitDeliverableModal, type DeliverableKind } from './components/SubmitDeliverableModal.js';

interface LedgerSummary {
  fundedCents: number;
  releasedCents: number;
  refundedCents: number;
  holdingBalanceCents: number;
}

export function App(): React.ReactElement {
  const projectId = 'proj_brand_launch';
  const [viewMode, setViewMode] = useState<'workspace' | 'start' | 'review_plan'>('workspace');
  const [currentPlan, setCurrentPlan] = useState<ComputedPlan | null>(null);
  const [selectedTask, setSelectedTask] = useState<MilestoneTaskModel | null>(null);
  const [persona, setPersona] = useState<'client' | 'freelancer'>('client');
  const [ledgerSummary, setLedgerSummary] = useState<LedgerSummary | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isFunding, setIsFunding] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const fetchLedger = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/ledger`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setLedgerSummary(data.summary);
      }
    } catch {
      // offline dev fallback
    }
  }, [projectId]);

  useEffect(() => {
    // Initialize default client persona cookie
    handlePersonaChange('client');
    fetchLedger();

    // Setup Server-Sent Events (SSE) listener
    let es: EventSource | null = null;
    try {
      es = new EventSource(`/api/projects/${projectId}/events`);

      es.addEventListener('project.funded', (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data);
          setNotification(`PayPal Funding Received: ${formatCents(payload.amountCents ?? 0)} holding balance.`);
          fetchLedger();
          setRefreshKey((k) => k + 1);
        } catch {
          // ignore parsing error
        }
      });

      es.addEventListener('milestone.paid', (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data);
          setNotification(`Milestone payout completed: ${formatCents(payload.amountCents ?? 0)} released to freelancer.`);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setSelectedTask((prev) => (prev ? ({ ...prev, paymentStatus: 'paid' } as any) : prev));
          fetchLedger();
          setRefreshKey((k) => k + 1);
        } catch {
          // ignore parsing error
        }
      });

      es.addEventListener('milestone.status', (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data);
          setNotification(`Milestone status updated: ${payload.status}`);
          fetchLedger();
          setRefreshKey((k) => k + 1);
        } catch {
          // ignore parsing error
        }
      });

      es.addEventListener('ledger.entry', () => {
        fetchLedger();
        setRefreshKey((k) => k + 1);
      });
    } catch {
      // offline fallback
    }

    return () => {
      es?.close();
    };
  }, [projectId, fetchLedger]);

  const handlePersonaChange = async (targetPersona: 'client' | 'freelancer') => {
    setPersona(targetPersona);
    try {
      await fetch('/api/auth/persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ persona: targetPersona }),
      });
    } catch {
      // offline dev fallback
    }
  };

  const handleFundProject = async () => {
    setIsFunding(true);
    setNotification(null);
    try {
      // 1. Create order
      const orderRes = await fetch(`/api/projects/${projectId}/fund/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'PayPal-Request-Id': `fund:${projectId}:${Date.now()}`,
        },
        body: JSON.stringify({}),
        credentials: 'include',
      });

      if (!orderRes.ok) {
        const errJson = (await orderRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(errJson.error || 'Failed to create funding order');
      }

      const orderData = await orderRes.json();

      // 2. Capture order
      const capRes = await fetch(`/api/projects/${projectId}/fund/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderId: orderData.orderId }),
      });

      if (!capRes.ok) {
        throw new Error('Failed to capture funding order');
      }

      const capData = await capRes.json();
      setNotification(`Project funded! Captured ${capData.captureId}. Holding balance: ${formatCents(capData.holdingBalanceCents)}`);
      await fetchLedger();
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Funding failed';
      setNotification(`Error: ${msg}`);
    } finally {
      setIsFunding(false);
    }
  };

  const handleReleasePayment = async (targetMilestoneId: string) => {
    setIsReleasing(true);
    setNotification(null);
    try {
      const res = await fetch(`/api/milestones/${targetMilestoneId}/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to release milestone payout');
      }

      setNotification(`Payout released! Status: ${data.status}. Holding balance: ${formatCents(data.holdingBalanceCents ?? 0)}`);
      if (data.status === 'paid') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setSelectedTask((prev) => (prev ? ({ ...prev, paymentStatus: 'paid' } as any) : prev));
      }
      await fetchLedger();
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Release failed';
      setNotification(`Error: ${msg}`);
    } finally {
      setIsReleasing(false);
    }
  };

  // Compute summary metrics from sample tasks or live ledger
  const milestones = sampleTasks.filter((t) => t.milestone);
  const sampleBudget = milestones.reduce((sum, m) => sum + (m.amountCents ?? 0), 0);
  const samplePaid = milestones
    .filter((m) => m.paymentStatus === 'paid')
    .reduce((sum, m) => sum + (m.amountCents ?? 0), 0);
  const sampleHeld = milestones
    .filter((m) => m.paymentStatus === 'funded' || m.paymentStatus === 'in_review' || m.paymentStatus === 'approved')
    .reduce((sum, m) => sum + (m.amountCents ?? 0), 0);

  const totalBudget = sampleBudget;
  const paidTotal = ledgerSummary ? ledgerSummary.releasedCents : samplePaid;
  const heldTotal = ledgerSummary ? ledgerSummary.holdingBalanceCents : sampleHeld;

  const activeMilestone =
    selectedTask?.isMilestone
      ? selectedTask
      : (milestones[0] as unknown as MilestoneTaskModel);

  if (viewMode === 'start') {
    return (
      <StartScreen
        onPlanGenerated={(plan) => {
          setCurrentPlan(plan);
          setViewMode('review_plan');
        }}
        onCancel={() => setViewMode('workspace')}
      />
    );
  }

  if (viewMode === 'review_plan' && currentPlan) {
    return (
      <PlanReviewScreen
        initialPlan={currentPlan}
        projectId={projectId}
        onPlanApproved={(_applied) => {
          setNotification('Plan approved! Milestones and tasks saved to project.');
          setViewMode('workspace');
          setRefreshKey((k) => k + 1);
          fetchLedger();
        }}
        onBack={() => setViewMode('start')}
      />
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--chalk)', display: 'flex', flexDirection: 'column' }}>
      {/* Top Application Bar */}
      <header
        style={{
          backgroundColor: 'var(--paper)',
          borderBottom: '1px solid var(--line)',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                fontFamily: 'Bricolage Grotesque, sans-serif',
                fontWeight: 700,
                fontSize: '1.25rem',
                color: 'var(--ink)',
                letterSpacing: '-0.02em',
              }}
            >
              Milestone
            </span>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                backgroundColor: 'rgba(31, 122, 140, 0.1)',
                color: 'var(--tide)',
                padding: '0.2rem 0.45rem',
                borderRadius: '4px',
              }}
            >
              PayPal Sandbox Active
            </span>
          </div>
          <span style={{ color: 'var(--slate)', fontSize: '0.875rem' }}>/</span>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink)' }}>
            Brand-site Redesign & Launch
          </span>
        </div>

        {/* Persona Switcher & Balance Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {persona === 'client' && (
            <button
              id="new-plan-btn"
              type="button"
              onClick={() => setViewMode('start')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.75rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                backgroundColor: 'var(--tide)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              <span>✨</span>
              <span>New Plan</span>
            </button>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--chalk)',
              padding: '0.25rem',
              borderRadius: '6px',
              border: '1px solid var(--line)',
              gap: '0.25rem',
            }}
          >
            <button
              id="persona-client-btn"
              onClick={() => handlePersonaChange('client')}
              style={{
                background: persona === 'client' ? 'var(--paper)' : 'transparent',
                border: persona === 'client' ? '1px solid var(--line)' : 'none',
                boxShadow: persona === 'client' ? '0 1px 2px rgba(22, 32, 43, 0.05)' : 'none',
                color: persona === 'client' ? 'var(--ink)' : 'var(--slate)',
                fontWeight: persona === 'client' ? 600 : 500,
                padding: '0.35rem 0.65rem',
                borderRadius: '4px',
                fontSize: '0.8125rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <span>🏛️</span>
              <span>Client (Acme Corp)</span>
            </button>
            <button
              id="persona-freelancer-btn"
              onClick={() => handlePersonaChange('freelancer')}
              style={{
                background: persona === 'freelancer' ? 'var(--paper)' : 'transparent',
                border: persona === 'freelancer' ? '1px solid var(--line)' : 'none',
                boxShadow: persona === 'freelancer' ? '0 1px 2px rgba(22, 32, 43, 0.05)' : 'none',
                color: persona === 'freelancer' ? 'var(--ink)' : 'var(--slate)',
                fontWeight: persona === 'freelancer' ? 600 : 500,
                padding: '0.35rem 0.65rem',
                borderRadius: '4px',
                fontSize: '0.8125rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <span>⚡</span>
              <span>Freelancer (Arjun)</span>
            </button>
          </div>

          {/* Real-time PayPal Balance Chip */}
          <div
            id="balance-chip"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'rgba(38, 107, 74, 0.08)',
              border: '1px solid rgba(38, 107, 74, 0.25)',
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--settled)' }} />
            <span style={{ fontSize: '0.8125rem', color: 'var(--slate)', fontWeight: 500 }}>
              Paid to date:
            </span>
            <strong style={{ fontSize: '0.875rem', color: 'var(--settled)', fontVariantNumeric: 'tabular-nums' }}>
              {formatCents(paidTotal)}
            </strong>
          </div>

          {/* Fund Project Button for Client */}
          {persona === 'client' && (
            <button
              id="fund-project-btn"
              onClick={handleFundProject}
              disabled={isFunding}
              style={{
                backgroundColor: 'var(--tide)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '0.45rem 0.85rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: isFunding ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                opacity: isFunding ? 0.7 : 1,
              }}
            >
              <span>💳</span>
              <span>{isFunding ? 'Funding...' : 'Fund with PayPal'}</span>
            </button>
          )}
        </div>
      </header>

      {/* Funds Status Meter (Financial Summary Bar) */}
      <section
        aria-label="Funds status meter"
        style={{
          backgroundColor: 'var(--paper)',
          borderBottom: '1px solid var(--line)',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '2.5rem',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--slate)' }}>
            Total Budget
          </span>
          <span style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
            {formatCents(totalBudget)}
          </span>
        </div>

        <div style={{ height: '28px', width: '1px', backgroundColor: 'var(--line)' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--settled)' }}>
            Paid (Settled)
          </span>
          <span style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--settled)', fontVariantNumeric: 'tabular-nums' }}>
            {formatCents(paidTotal)}
          </span>
        </div>

        <div style={{ height: '28px', width: '1px', backgroundColor: 'var(--line)' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--brass)' }}>
            Holding Balance (Escrow)
          </span>
          <span style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
            {formatCents(heldTotal)}
          </span>
        </div>

        {/* Progress Fill Meter */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem', marginLeft: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--slate)' }}>
            <span>Project Settlement Progress</span>
            <span>{totalBudget > 0 ? Math.round((paidTotal / totalBudget) * 100) : 0}%</span>
          </div>
          <div
            style={{
              height: '8px',
              backgroundColor: 'var(--chalk)',
              borderRadius: '4px',
              overflow: 'hidden',
              display: 'flex',
            }}
          >
            <div
              style={{
                width: `${totalBudget > 0 ? (paidTotal / totalBudget) * 100 : 0}%`,
                backgroundColor: 'var(--settled)',
                transition: 'width 0.4s ease',
              }}
            />
            <div
              style={{
                width: `${totalBudget > 0 ? (heldTotal / totalBudget) * 100 : 0}%`,
                backgroundColor: 'var(--brass)',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>
      </section>

      {/* Notification Banner */}
      {notification && (
        <div
          role="status"
          aria-live="polite"
          style={{
            backgroundColor: notification.startsWith('Error') ? 'rgba(200, 64, 47, 0.1)' : 'rgba(31, 122, 140, 0.1)',
            borderBottom: '1px solid var(--line)',
            padding: '0.625rem 1.5rem',
            fontSize: '0.875rem',
            color: notification.startsWith('Error') ? 'var(--flag)' : 'var(--tide)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{notification}</span>
          <button
            onClick={() => setNotification(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--tide)',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Main Workspace: Central Gantt + Side Trust Panel Preview */}
      <main
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 340px',
          gap: '1rem',
          padding: '1rem 1.5rem',
          boxSizing: 'border-box',
        }}
      >
        {/* Gantt Container */}
        <div style={{ minWidth: 0, height: '100%' }}>
          <MilestoneGantt projectId={projectId} refreshKey={refreshKey} onTaskSelect={setSelectedTask} />
        </div>

        {/* Side Trust Panel Drawer Preview */}
        <aside
          aria-label="Milestone Trust Panel"
          style={{
            backgroundColor: 'var(--paper)',
            border: '1px solid var(--line)',
            borderRadius: '8px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            height: 'fit-content',
            boxShadow: '0 1px 3px rgba(22, 32, 43, 0.05)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--slate)', fontWeight: 600 }}>
                Trust Panel
              </span>
              <span
                className={`status-pill ${activeMilestone?.paymentStatus ?? 'paid'}`}
                style={{ fontSize: '0.75rem' }}
              >
                {activeMilestone?.paymentStatus?.replace(/_/g, ' ') ?? 'Paid'}
              </span>
            </div>
            <h3
              style={{
                fontFamily: 'Bricolage Grotesque, sans-serif',
                margin: '0.5rem 0 0 0',
                fontSize: '1.05rem',
                color: 'var(--ink)',
              }}
            >
              {activeMilestone?.name ?? 'Milestone 1: Brand Strategy'}
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: 'var(--slate)' }}>
              Amount attached:{' '}
              <strong style={{ color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                {formatCents(activeMilestone?.amountCents ?? 120000)}
              </strong>
            </p>
          </div>

          <div style={{ borderTop: '1px solid var(--line)', paddingTop: '0.75rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink)' }}>
              Acceptance Criteria
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {(activeMilestone?.acceptanceCriteria ?? [
                { id: '1', description: 'At least 5 customer interview summaries documented', passed: true },
                { id: '2', description: 'Positioning matrix compares 4 primary competitors', passed: true },
              ]).map((c) => (
                <li
                  key={c.id}
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--ink)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                  }}
                >
                  <span
                    style={{
                      color: c.passed ? 'var(--settled)' : 'var(--slate)',
                      fontWeight: 700,
                    }}
                  >
                    {c.passed ? '✓' : '○'}
                  </span>
                  <span>{c.description}</span>
                </li>
              ))}
            </ul>
          </div>

          <div style={{ borderTop: '1px solid var(--line)', paddingTop: '0.75rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink)' }}>
              Money & Sandbox Settlement
            </h4>
            <div
              style={{
                fontSize: '0.8125rem',
                backgroundColor: 'var(--chalk)',
                padding: '0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--line)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
              }}
            >
              <div>
                <span style={{ color: 'var(--slate)' }}>Deliverable Type: </span>
                <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                  {activeMilestone?.deliverableType ?? 'document'}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--slate)' }}>Ledger Invariant: </span>
                <span style={{ fontWeight: 600, color: 'var(--settled)' }}>Funded before start</span>
              </div>
              <div>
                <span style={{ color: 'var(--slate)' }}>PayPal Mode: </span>
                <span style={{ fontWeight: 600 }}>Sandbox / Mock Safe</span>
              </div>
            </div>

            {/* Manual Release Payment Button for Client Persona when Milestone is Approved */}
            {activeMilestone?.paymentStatus === 'approved' && persona === 'client' && (
              <button
                id="release-milestone-btn"
                onClick={() =>
                  handleReleasePayment(
                    String(
                      activeMilestone.id ||
                        (activeMilestone as unknown as { milestoneId?: string }).milestoneId ||
                        'ms-02'
                    )
                  )
                }
                disabled={isReleasing}
                style={{
                  marginTop: '0.75rem',
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
                  boxShadow: '0 1px 2px rgba(22, 32, 43, 0.1)',
                }}
              >
                <span>🚀</span>
                <span>
                  {isReleasing
                    ? 'Releasing Payout...'
                    : `Release Payment (${formatCents(activeMilestone.amountCents ?? 0)})`}
                </span>
              </button>
            )}

            {/* Submit Deliverable Button for Freelancer Persona */}
            {(activeMilestone?.paymentStatus === 'funded' || activeMilestone?.paymentStatus === 'changes_requested') && persona === 'freelancer' && (
              <button
                id="submit-deliverable-btn"
                onClick={() => setShowSubmitModal(true)}
                style={{
                  marginTop: '0.75rem',
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
                  boxShadow: '0 1px 2px rgba(22, 32, 43, 0.1)',
                }}
              >
                <span>📤</span>
                <span>Submit Deliverable</span>
              </button>
            )}
          </div>
        </aside>
      </main>

      {/* Submit Deliverable Modal */}
      {showSubmitModal && activeMilestone && (
        <SubmitDeliverableModal
          milestoneId={String(activeMilestone.id || (activeMilestone as unknown as { milestoneId?: string })?.milestoneId || 'm1')}
          milestoneName={activeMilestone.name ?? 'Milestone'}
          projectId={projectId}
          deliverableType={activeMilestone.deliverableType as DeliverableKind}
          onClose={() => setShowSubmitModal(false)}
          onSubmitted={() => {
            fetchLedger();
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
