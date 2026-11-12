import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { ComputedPlan } from '@milestone/shared';
import { formatCents } from '@milestone/shared';
import { MilestoneGantt } from './components/Gantt.js';
import { MilestoneTaskModel } from './models/MilestoneTaskModel.js';
import { StartScreen } from './components/StartScreen.js';
import { PlanReviewScreen } from './components/PlanReviewScreen.js';
import { SubmitDeliverableModal, type DeliverableKind } from './components/SubmitDeliverableModal.js';
import { AppealModal } from './components/AppealModal.js';
import { LeftRail, type ProjectListItem } from './components/LeftRail.js';
import { FundsMeter } from './components/FundsMeter.js';
import { TrustPanel, type LedgerEntryItem } from './components/TrustPanel.js';
import { FundModal } from './components/FundModal.js';
import { CloseoutReceiptModal } from './components/CloseoutReceiptModal.js';
import { SettleCoinFlyer, useCountUp, type SettleEventData } from './components/SettleMoment.js';

interface LedgerSummary {
  fundedCents: number;
  releasedCents: number;
  refundedCents: number;
  holdingBalanceCents: number;
}

const DEMO_PROJECTS: ProjectListItem[] = [
  {
    id: 'proj_brand_launch',
    title: 'Brand-site Redesign & Launch',
    status: 'active',
    totalCents: 600000,
  },
  {
    id: 'proj_analytics',
    title: 'Customer Retention Analytics',
    status: 'planned',
    totalCents: 300000,
  },
  {
    id: 'proj_docs',
    title: 'API Integration Docs',
    status: 'draft',
    totalCents: 150000,
  },
];

export function App(): React.ReactElement {
  const [projectId, setProjectId] = useState(
    () => new URLSearchParams(window.location.search).get('projectId') || 'proj_brand_launch'
  );
  const capturedPayPalTokenRef = useRef<string | null>(null);
  const [viewMode, setViewMode] = useState<'workspace' | 'start' | 'review_plan'>('workspace');
  const [currentPlan, setCurrentPlan] = useState<ComputedPlan | null>(null);
  const [selectedTask, setSelectedTask] = useState<MilestoneTaskModel | null>(null);
  const [persona, setPersona] = useState<'client' | 'freelancer'>('client');
  const [ledgerSummary, setLedgerSummary] = useState<LedgerSummary | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntryItem[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isFunding, setIsFunding] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [isObjecting, setIsObjecting] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showAppealModal, setShowAppealModal] = useState(false);
  const [showFundModal, setShowFundModal] = useState(false);
  const [showCloseoutModal, setShowCloseoutModal] = useState(false);
  const [isRailCollapsed, setIsRailCollapsed] = useState(false);
  const [autonomyMode, setAutonomyMode] = useState<'manual' | 'assisted' | 'auto'>('assisted');
  const [notification, setNotification] = useState<string | null>(null);
  const [milestones, setMilestones] = useState<Array<{
    id: string;
    name: string;
    amountCents: number;
    paymentStatus?: string;
    deliverableType?: string;
  }>>([]);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/milestones`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          setMilestones(data);
        }
      })
      .catch(() => {});
  }, [projectId, refreshKey]);

  // Settle moment state per DESIGN.md §2
  const [settleData, setSettleData] = useState<SettleEventData | null>(null);
  const [isChipPulsing, setIsChipPulsing] = useState(false);

  const triggerSettleMoment = useCallback(
    (data: { milestoneId: string; milestoneName: string; amountCents: number }) => {
      setSettleData({
        milestoneId: data.milestoneId,
        milestoneName: data.milestoneName,
        amountCents: data.amountCents,
        recipientName: 'Freelancer',
      });

      // Sweep animation on Gantt milestone diamond/row
      const milestoneDiamond = document.querySelector(`.b-gantt-task.b-milestone`);
      milestoneDiamond?.classList.add('milestone-settling');

      // Single aria-live announcement per DESIGN.md §2: surfaces in visible status notification
      const formattedAmount = formatCents(data.amountCents);
      setNotification(`Payout released! ${data.milestoneName} paid, ${formattedAmount} to Freelancer.`);
    },
    []
  );

  const handleSettleComplete = useCallback(() => {
    setSettleData(null);
    setIsChipPulsing(true);
    setTimeout(() => {
      setIsChipPulsing(false);
    }, 700);
  }, []);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.project?.autonomyMode) {
          setAutonomyMode(data.project.autonomyMode);
        }
      }
    } catch {
      // offline dev fallback
    }
  }, [projectId]);

  const fetchLedger = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/ledger`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setLedgerSummary(data.summary);
        setLedgerEntries(data.entries || []);
      }
    } catch {
      // offline dev fallback
    }
  }, [projectId]);

  useEffect(() => {
    // Initialize default client persona cookie
    handlePersonaChange('client');
    fetchLedger();
    fetchProject();

    // Setup Server-Sent Events (SSE) listener
    let es: EventSource | null = null;
    try {
      es = new EventSource(`/api/projects/${projectId}/events`);

      es.addEventListener('project.funded', (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data);
          setNotification(`Project funded. ${formatCents(payload.amountCents ?? 0)} is held for this project.`);
          fetchLedger();
          setRefreshKey((k) => k + 1);
        } catch {
          // ignore parsing error
        }
      });

      es.addEventListener('milestone.paid', (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data);
          // Trigger the full settle moment
          triggerSettleMoment({
            milestoneId: payload.milestoneId || 'ms-02',
            milestoneName: payload.milestoneName || 'Milestone',
            amountCents: payload.amountCents ?? 180000,
          });
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
          if (payload.status !== 'paid') {
            setNotification(`Milestone status updated: ${payload.status}`);
          }
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
  }, [projectId, fetchLedger, triggerSettleMoment]);

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

  const captureFundingOrder = useCallback(
    async (targetProjectId: string, orderId: string) => {
      setIsFunding(true);
      try {
        const postCapture = () =>
          fetch(`/api/projects/${targetProjectId}/fund/capture`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ orderId }),
          });

        let capRes = await postCapture();
        if (capRes.status === 403) {
          await fetch('/api/auth/persona', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ persona: 'client' }),
          });
          capRes = await postCapture();
        }

        if (!capRes.ok) {
          const errJson = (await capRes.json().catch(() => ({}))) as {
            message?: string;
            error?: string;
          };
          throw new Error(errJson.message || errJson.error || 'Failed to capture funding order');
        }

        const capData = await capRes.json();
        setNotification(
          `Project funded! Captured ${capData.captureId}. Holding balance: ${formatCents(capData.holdingBalanceCents)}`
        );
        setShowFundModal(false);
        await fetchLedger();
        setRefreshKey((k) => k + 1);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Funding failed';
        setNotification(`Error: ${msg}`);
      } finally {
        setIsFunding(false);
      }
    },
    [fetchLedger]
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paypalCancel = params.get('paypalCancel');
    const token = params.get('token');
    const urlProjectId = params.get('projectId') || projectId;

    if (paypalCancel === '1') {
      setNotification('PayPal Sandbox approval was cancelled before payment completed.');
      params.delete('paypalCancel');
      params.delete('token');
      params.delete('PayerID');
      const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
      window.history.replaceState({}, '', nextUrl);
      return;
    }

    if (token && capturedPayPalTokenRef.current !== token) {
      capturedPayPalTokenRef.current = token;
      params.delete('token');
      params.delete('PayerID');
      const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
      window.history.replaceState({}, '', nextUrl);
      void captureFundingOrder(urlProjectId, token);
    }
  }, [projectId, captureFundingOrder]);

  const handleFundProject = async () => {
    setIsFunding(true);
    setNotification(null);
    try {
      const returnUrl = `${window.location.origin}/?workspace=true&projectId=${encodeURIComponent(projectId)}`;
      const cancelUrl = `${returnUrl}&paypalCancel=1`;

      // 1. Create order
      const postOrder = () =>
        fetch(`/api/projects/${projectId}/fund/order`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'PayPal-Request-Id': `fund:${projectId}:${Date.now()}`,
          },
          body: JSON.stringify({ returnUrl, cancelUrl }),
          credentials: 'include',
        });

      let orderRes = await postOrder();
      if (orderRes.status === 403) {
        await fetch('/api/auth/persona', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ persona: 'client' }),
        });
        orderRes = await postOrder();
      }

      if (!orderRes.ok) {
        const errJson = (await orderRes.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        throw new Error(errJson.message || errJson.error || 'Failed to create funding order');
      }

      const orderData = await orderRes.json();

      if (
        orderData.approveUrl &&
        orderData.status !== 'APPROVED' &&
        orderData.status !== 'COMPLETED'
      ) {
        window.location.assign(orderData.approveUrl);
        return;
      }

      // 2. Capture order directly (mock mode or already-approved order)
      await captureFundingOrder(projectId, orderData.orderId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Funding failed';
      setNotification(`Error: ${msg}`);
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

      // Trigger the memorable settle moment
      const releasedAmount = data.amountCents || activeMilestone?.amountCents || 180000;
      triggerSettleMoment({
        milestoneId: targetMilestoneId,
        milestoneName: activeMilestone?.name || 'Milestone',
        amountCents: releasedAmount,
      });

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

  const handleAutonomyModeChange = async (newMode: 'manual' | 'assisted' | 'auto') => {
    setAutonomyMode(newMode);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ autonomyMode: newMode }),
      });
      if (res.ok) {
        setNotification(`Autonomy mode changed to ${newMode.toUpperCase()}`);
      }
    } catch {
      // offline dev fallback
    }
  };

  const handleObjectToRelease = async (targetMilestoneId: string) => {
    setIsObjecting(true);
    setNotification(null);
    try {
      const res = await fetch(`/api/milestones/${targetMilestoneId}/object`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: 'Client requested revisions before payout release.' }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to object to release');
      }

      setNotification('Auto-release stopped. Changes requested from freelancer.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setSelectedTask((prev) => (prev ? ({ ...prev, paymentStatus: 'changes_requested' } as any) : prev));
      await fetchLedger();
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Objection failed';
      setNotification(`Error: ${msg}`);
    } finally {
      setIsObjecting(false);
    }
  };

  const handleExportAuditJson = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/audit`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch audit trail');
      const data = await res.json();

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `milestone-audit-${projectId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setNotification('Audit trail JSON downloaded successfully.');
    } catch {
      setNotification('Error downloading audit export');
    }
  };

  const currentProject = DEMO_PROJECTS.find((p) => p.id === projectId) || DEMO_PROJECTS[0];
  const totalBudget = ledgerSummary
    ? (ledgerSummary.holdingBalanceCents + ledgerSummary.releasedCents)
    : milestones.reduce((sum: number, m: { amountCents?: number }) => sum + (m.amountCents ?? 0), 0);
  const paidTotal = ledgerSummary ? ledgerSummary.releasedCents : 0;
  const heldTotal = ledgerSummary ? ledgerSummary.holdingBalanceCents : 0;

  // Numerical eased counter for balance chip
  const countedPaidTotal = useCountUp(paidTotal, 700);

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
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--chalk)',
        display: 'flex',
        flexDirection: 'row',
        fontFamily: 'Instrument Sans, sans-serif',
      }}
    >
      {/* Settle coin flyer along an arc per DESIGN.md §2 */}
      {settleData && <SettleCoinFlyer settleData={settleData} onComplete={handleSettleComplete} />}

      {/* 1. Left Rail (Collapsible Projects Navigation) */}
      <LeftRail
        currentProjectId={projectId}
        projects={DEMO_PROJECTS}
        isCollapsed={isRailCollapsed}
        onToggleCollapse={() => setIsRailCollapsed(!isRailCollapsed)}
        onSelectProject={(id) => {
          setProjectId(id);
          setNotification(`Switched to project ${id}`);
        }}
        onNewPlan={() => setViewMode('start')}
        onOpenCloseout={() => setShowCloseoutModal(true)}
        onExportAudit={handleExportAuditJson}
      />

      {/* Main App Container */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* 2. Top Application Bar per DESIGN.md */}
        <header
          style={{
            backgroundColor: 'var(--paper)',
            borderBottom: '1px solid var(--line)',
            padding: '0.75rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          {/* Project Title and Sandbox Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
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
                  color: '#125461',
                  padding: '0.2rem 0.45rem',
                  borderRadius: '4px',
                }}
              >
                PayPal Sandbox Active
              </span>
            </div>
            <span style={{ color: 'var(--slate)', fontSize: '0.875rem' }}>/</span>
            <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--ink)' }}>
              {currentProject?.title || 'Milestone Project'}
            </span>
          </div>

          {/* Controls: Autonomy Mode, Persona Switch ("Viewing as"), Freelancer Balance Chip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap' }}>
            {/* Autonomy Mode Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem' }}>
              <label htmlFor="autonomy-mode-select" style={{ color: 'var(--slate)', fontWeight: 500 }}>Mode:</label>
              <select
                id="autonomy-mode-select"
                aria-label="Autonomy Mode"
                value={autonomyMode}
                disabled={persona !== 'client'}
                onChange={(e) => handleAutonomyModeChange(e.target.value as 'manual' | 'assisted' | 'auto')}
                style={{
                  padding: '0.3rem 0.5rem',
                  borderRadius: '4px',
                  border: '1px solid var(--line)',
                  backgroundColor: 'var(--paper)',
                  color: 'var(--ink)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: persona === 'client' ? 'pointer' : 'default',
                }}
              >
                <option value="manual">Manual (Client releases)</option>
                <option value="assisted">Assisted (20s Window)</option>
                <option value="auto">Auto (Immediate)</option>
              </select>
            </div>

            {/* New Plan Button for Client Persona */}
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
                  backgroundColor: 'var(--paper)',
                  color: 'var(--tide)',
                  border: '1px solid var(--line)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                <span>✨</span>
                <span>New Plan</span>
              </button>
            )}

            {/* Persona Switcher per DESIGN.md: Labeled "Viewing as" */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--chalk)',
                padding: '0.2rem',
                borderRadius: '6px',
                border: '1px solid var(--line)',
                gap: '0.25rem',
              }}
            >
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--slate)',
                  fontWeight: 500,
                  padding: '0 0.4rem',
                }}
              >
                Viewing as:
              </span>
              <button
                id="persona-client-btn"
                type="button"
                onClick={() => handlePersonaChange('client')}
                style={{
                  background: persona === 'client' ? 'var(--paper)' : 'transparent',
                  border: persona === 'client' ? '1px solid var(--line)' : 'none',
                  boxShadow: persona === 'client' ? '0 1px 2px rgba(22, 32, 43, 0.05)' : 'none',
                  color: persona === 'client' ? 'var(--ink)' : 'var(--slate)',
                  fontWeight: persona === 'client' ? 600 : 500,
                  padding: '0.3rem 0.6rem',
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
                type="button"
                onClick={() => handlePersonaChange('freelancer')}
                style={{
                  background: persona === 'freelancer' ? 'var(--paper)' : 'transparent',
                  border: persona === 'freelancer' ? '1px solid var(--line)' : 'none',
                  boxShadow: persona === 'freelancer' ? '0 1px 2px rgba(22, 32, 43, 0.05)' : 'none',
                  color: persona === 'freelancer' ? 'var(--ink)' : 'var(--slate)',
                  fontWeight: persona === 'freelancer' ? 600 : 500,
                  padding: '0.3rem 0.6rem',
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

            {/* Freelancer Balance Chip (Target of settle moment per DESIGN.md §2) */}
            <div
              id="balance-chip"
              className={isChipPulsing ? 'chip-pulsing' : ''}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                backgroundColor: 'rgba(29, 143, 90, 0.08)',
                border: '1px solid rgba(29, 143, 90, 0.25)',
                padding: '0.3rem 0.65rem',
                borderRadius: '6px',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--settled)' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--slate)', fontWeight: 500 }}>
                Arjun:
              </span>
              <strong style={{ fontSize: '0.875rem', color: '#137042', fontVariantNumeric: 'tabular-nums' }}>
                {formatCents(countedPaidTotal)}
              </strong>
            </div>

            {/* Fund Project CTA for Client Persona */}
            {persona === 'client' && (
              <button
                id="fund-project-btn"
                type="button"
                onClick={handleFundProject}
                disabled={isFunding}
                style={{
                  backgroundColor: 'var(--tide)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: isFunding ? 'not-allowed' : 'pointer',
                  opacity: isFunding ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span>💳</span>
                <span>{isFunding ? 'Funding...' : 'Fund with PayPal'}</span>
              </button>
            )}
          </div>
        </header>

        {/* 3. Horizontal Funds Status Meter per DESIGN.md */}
        <FundsMeter
          totalBudget={totalBudget}
          paidTotal={paidTotal}
          heldTotal={heldTotal}
          showFundAction={persona === 'client'}
          onFundClick={() => setShowFundModal(true)}
        />

        {/* Notification Banner / aria-live polite */}
        {notification && (
          <div
            role="status"
            aria-live="polite"
            style={{
              backgroundColor: notification.startsWith('Error')
                ? 'rgba(200, 64, 47, 0.1)'
                : 'rgba(31, 122, 140, 0.1)',
              borderBottom: '1px solid var(--line)',
              padding: '0.5rem 1.5rem',
              fontSize: '0.8125rem',
              color: notification.startsWith('Error') ? 'var(--flag)' : 'var(--tide)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{notification}</span>
            <button
              type="button"
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

        {/* 4. Central Workspace: Bryntum Gantt + Trust Panel Drawer */}
        <main
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 360px',
            gap: '1rem',
            padding: '1rem 1.5rem',
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}
        >
          {/* Bryntum Gantt View */}
          <div style={{ minWidth: 0, height: '100%', overflow: 'hidden' }}>
            <MilestoneGantt projectId={projectId} refreshKey={refreshKey} onTaskSelect={setSelectedTask} />
          </div>

          {/* Trust Panel Drawer */}
          <TrustPanel
            milestone={
              activeMilestone
                ? {
                    id: String(activeMilestone.id || (activeMilestone as unknown as { milestoneId?: string })?.milestoneId || 'ms-01'),
                    name: activeMilestone.name ?? 'Milestone',
                    amountCents: activeMilestone.amountCents ?? 0,
                    paymentStatus: (activeMilestone as any).paymentStatus || (activeMilestone as any).status || 'funded',
                    acceptanceCriteria: activeMilestone.acceptanceCriteria,
                    deliverableType: activeMilestone.deliverableType,
                  }
                : null
            }
            projectId={projectId}
            persona={persona}
            ledgerEntries={ledgerEntries}
            refreshKey={refreshKey}
            isReleasing={isReleasing}
            isObjecting={isObjecting}
            onReleasePayment={handleReleasePayment}
            onObjectToRelease={handleObjectToRelease}
            onSubmitDeliverableClick={() => setShowSubmitModal(true)}
            onAppealClick={() => setShowAppealModal(true)}
            onOpenCloseout={() => setShowCloseoutModal(true)}
          />
        </main>
      </div>

      {/* 5. Modals & Dialogs */}
      {showFundModal && (
        <FundModal
          projectId={projectId}
          projectTitle={currentProject?.title || 'Milestone Project'}
          milestones={milestones.map((m) => ({
            id: String(m.id || m.name),
            name: m.name ?? 'Milestone',
            amountCents: m.amountCents ?? 0,
          }))}
          totalBudget={totalBudget}
          isFunding={isFunding}
          onConfirmFund={handleFundProject}
          onClose={() => setShowFundModal(false)}
        />
      )}

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

      {showAppealModal && activeMilestone && (
        <AppealModal
          milestoneId={String(activeMilestone.id || (activeMilestone as unknown as { milestoneId?: string })?.milestoneId || 'm1')}
          milestoneName={activeMilestone.name ?? 'Milestone'}
          projectId={projectId}
          onClose={() => setShowAppealModal(false)}
          onSubmitted={() => {
            fetchLedger();
            setRefreshKey((k) => k + 1);
          }}
        />
      )}

      {showCloseoutModal && (
        <CloseoutReceiptModal
          projectId={projectId}
          projectTitle={currentProject?.title || 'Milestone Project'}
          clientName="Client"
          freelancerName="Freelancer"
          totalBudget={totalBudget}
          paidTotal={paidTotal}
          heldTotal={heldTotal}
          milestones={milestones.map((m) => ({
            id: String(m.id || m.name),
            name: m.name ?? 'Milestone',
            amountCents: m.amountCents ?? 0,
            paymentStatus: m.paymentStatus ?? 'funded',
          }))}
          onClose={() => setShowCloseoutModal(false)}
        />
      )}
    </div>
  );
}
