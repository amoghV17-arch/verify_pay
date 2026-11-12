import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileText,
  Calendar,
  UserPlus,
  CreditCard,
  Check,
  Copy,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Clock,
  ShieldCheck,
  Trash2,
  Plus,
} from 'lucide-react';
import { formatCents, type ComputedPlan } from '@milestone/shared';
import { Button } from '../../components/ui/Button.js';
import { Field, Input, Textarea } from '../../components/ui/Field.js';
import { apiRawFetch } from '../../lib/api.js';

interface EditableMilestone {
  id: string;
  name: string;
  paymentPercent: number;
  amountCents: number;
  deliverableType: 'document' | 'url' | 'repo' | 'image' | 'text';
  acceptanceCriteria: string[];
}

const SAMPLE_BRIEFS = [
  {
    title: 'Brand Identity & Visual System',
    brief:
      'Design a comprehensive brand identity system including logo, color palette, typography guidelines, and digital asset templates for a modern fintech company. The project should deliver production-ready SVG assets, brand guidelines PDF, and a Figma component library.',
    budget: 450,
    duration: '4 weeks',
  },
  {
    title: 'Next.js Customer Dashboard',
    brief:
      'Build a modern responsive customer analytics dashboard in Next.js and Tailwind CSS with authentication, data charts, and real-time activity feeds. Needs comprehensive TypeScript strict typechecking, 90%+ test coverage, and deployment on Vercel.',
    budget: 350,
    duration: '3 weeks',
  },
];

export const NewProjectWizard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Wizard Step (1: Brief, 2: Plan, 3: Invite, 4: Fund)
  const initialStep = parseInt(searchParams.get('step') || '1', 10);
  const [currentStep, setCurrentStep] = useState<number>(initialStep >= 1 && initialStep <= 4 ? initialStep : 1);

  // Project state
  const [projectId, setProjectId] = useState<string>(searchParams.get('projectId') || '');
  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [totalBudget, setTotalBudget] = useState(450);
  const [durationHint, setDurationHint] = useState('4 weeks');
  const [demoCapUsd, setDemoCapUsd] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/system/mode')
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        if (m?.demoBudgetCapActive && typeof m?.maxDemoBudgetCents === 'number') {
          const capUsd = Math.floor(m.maxDemoBudgetCents / 100);
          setDemoCapUsd(capUsd);
          setTotalBudget((prev) => (prev > capUsd ? Math.min(450, capUsd) : prev));
        }
      })
      .catch(() => {});
  }, []);

  // Plan state
  const [computedPlan, setComputedPlan] = useState<ComputedPlan | null>(null);
  const [editableMilestones, setEditableMilestones] = useState<EditableMilestone[]>([]);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isApplyingPlan, setIsApplyingPlan] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  // Invite state
  const [inviteData, setInviteData] = useState<{
    id: string;
    token: string;
    code: string;
    inviteUrl: string;
    expiresAt: string;
  } | null>(null);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [invitedEmail, setInvitedEmail] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [acceptedFreelancer, setAcceptedFreelancer] = useState<{ name: string; email: string } | null>(null);
  const [copyCodeSuccess, setCopyCodeSuccess] = useState(false);
  const [copyLinkSuccess, setCopyLinkSuccess] = useState(false);

  // Funding state
  const [isFunding, setIsFunding] = useState(false);
  const [fundingError, setFundingError] = useState<string | null>(null);
  const [fundSuccess, setFundSuccess] = useState(false);
  const [pendingApprovalUrl, setPendingApprovalUrl] = useState<string | null>(null);
  const capturedTokenRef = useRef<string | null>(null);

  // Calculate total milestone percentage
  const totalPercentage = editableMilestones.reduce((sum, m) => sum + m.paymentPercent, 0);

  // Step 1: Use Sample Brief
  const handleUseSample = (idx: number) => {
    const s = SAMPLE_BRIEFS[idx];
    setTitle(s.title);
    setBrief(s.brief);
    setTotalBudget(demoCapUsd !== null && s.budget > demoCapUsd ? Math.min(450, demoCapUsd) : s.budget);
    setDurationHint(s.duration);
  };

  // Step 1: Generate AI Plan
  const handleGeneratePlan = async () => {
    if (!brief.trim()) {
      setPlanError('Please provide a project brief.');
      return;
    }
    setIsGeneratingPlan(true);
    setPlanError(null);

    try {
      // 1. Create or ensure project draft exists in DB
      let targetProjectId = projectId;
      if (!targetProjectId) {
        const createRes = await apiRawFetch('/api/projects', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: title || 'New Milestone Project',
            brief,
            totalBudget,
          }),
        });

        if (!createRes.ok) {
          const errBody = await createRes.json().catch(() => null);
          throw new Error(
            errBody?.message ||
              errBody?.error ||
              `Failed to create project draft (HTTP ${createRes.status})`
          );
        }
        const createData = await createRes.json();
        targetProjectId = createData.project.id;
        setProjectId(targetProjectId);
      }

      // 2. Call AI Planner endpoint
      const planRes = await apiRawFetch('/api/projects/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          brief,
          totalBudget,
          durationHint,
        }),
      });

      const planData = await planRes.json().catch(() => ({}));
      if (!planRes.ok || !planData.success) {
        throw new Error(planData.message || planData.error || `Failed to generate plan (HTTP ${planRes.status})`);
      }

      const plan = planData.plan as ComputedPlan;
      setComputedPlan(plan);

      // Convert milestones to editable format
      const editable = plan.milestones.map((m) => ({
        id: m.id,
        name: m.name,
        paymentPercent: m.paymentPercent,
        amountCents: m.amountCents,
        deliverableType: (m.deliverableType as EditableMilestone['deliverableType']) || 'document',
        acceptanceCriteria: [...m.acceptanceCriteria],
      }));
      setEditableMilestones(editable);

      setCurrentStep(2);
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Plan generation failed');
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  // Step 2: Approve and Apply Plan
  const handleApprovePlan = async () => {
    if (totalPercentage !== 100) {
      setPlanError('Total milestone percentages must sum exactly to 100%');
      return;
    }

    if (!computedPlan || !projectId) {
      setPlanError('No active plan or project found');
      return;
    }

    setIsApplyingPlan(true);
    setPlanError(null);

    try {
      // Recalculate amountCents for each milestone based on total budget and percentages
      const totalCents = Math.round(totalBudget * 100);
      const updatedMilestones = editableMilestones.map((m) => ({
        ...m,
        amountCents: Math.round((totalCents * m.paymentPercent) / 100),
      }));

      const plan = {
        ...computedPlan,
        totalBudget,
        totalCents,
        milestones: updatedMilestones.map((m) => {
          const original = computedPlan.milestones.find((orig) => orig.id === m.id);
          return {
            id: m.id,
            name: m.name,
            paymentPercent: m.paymentPercent,
            amountCents: m.amountCents,
            deliverableType: m.deliverableType,
            acceptanceCriteria: m.acceptanceCriteria,
            afterTaskIds: original?.afterTaskIds || [],
            date: original?.date || new Date().toISOString().split('T')[0],
            reviewHint: original?.reviewHint || 'Standard delivery verification',
          };
        }),
      };

      const res = await apiRawFetch(`/api/projects/${projectId}/plan/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Failed to apply plan');
      }

      setEditableMilestones(updatedMilestones);
      setCurrentStep(3);
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Failed to approve plan');
    } finally {
      setIsApplyingPlan(false);
    }
  };

  // Step 3: Create Invite
  const handleCreateInvite = async (targetEmail?: string) => {
    if (!projectId) return;
    setIsCreatingInvite(true);
    setInviteError(null);
    try {
      const res = await apiRawFetch(`/api/projects/${projectId}/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expiryDays: 7,
          maxUses: 1,
          ...(targetEmail?.trim() ? { invitedEmail: targetEmail.trim() } : {}),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setInviteData(data.invite);
      } else {
        const errData = await res.json().catch(() => ({}));
        setInviteError(errData.message || errData.error || 'Failed to create invite.');
      }
    } catch (err) {
      console.error('Invite creation failed:', err);
      setInviteError('Network error while creating invite.');
    } finally {
      setIsCreatingInvite(false);
    }
  };

  // Hydrate existing project details when entering via ?projectId=... (e.g. PayPal return or overview link)
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    const hydrateProject = async () => {
      try {
        const res = await apiRawFetch(`/api/projects/${projectId}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;

        if (data.project) {
          if (data.project.title) {
            setTitle((prev) => prev || data.project.title);
          }
          if (data.project.brief) {
            setBrief((prev) => prev || data.project.brief);
          }
          if (typeof data.project.totalCents === 'number' && data.project.totalCents > 0) {
            setTotalBudget(Math.round(data.project.totalCents / 100));
          }
          if (data.project.status === 'funded' || data.project.status === 'active') {
            setFundSuccess(true);
          }
        }

        if (data.freelancer) {
          setAcceptedFreelancer({
            name: data.freelancer.name,
            email: data.freelancer.email,
          });
        }

        if (Array.isArray(data.milestones) && data.milestones.length > 0) {
          interface ApiMilestoneItem {
            id: string;
            name?: string;
            title?: string;
            percent?: number;
            amountCents?: number;
            deliverableType?: EditableMilestone['deliverableType'];
            acceptanceCriteria?: string[];
          }
          setEditableMilestones((prev) =>
            prev.length > 0
              ? prev
              : (data.milestones as ApiMilestoneItem[]).map((m) => ({
                  id: m.id,
                  name: m.name || m.title || 'Milestone',
                  paymentPercent: typeof m.percent === 'number' ? m.percent : 0,
                  amountCents: typeof m.amountCents === 'number' ? m.amountCents : 0,
                  deliverableType: m.deliverableType || 'document',
                  acceptanceCriteria: Array.isArray(m.acceptanceCriteria) ? m.acceptanceCriteria : [],
                }))
          );
        }
      } catch {
        // Ignore hydration errors
      }
    };

    hydrateProject();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Poll project status in Step 3 for freelancer acceptance
  useEffect(() => {
    if (currentStep !== 3 || !projectId) return;

    // Automatically trigger invite creation if not yet generated
    if (!inviteData && !isCreatingInvite) {
      handleCreateInvite();
    }

    const interval = setInterval(async () => {
      try {
        const res = await apiRawFetch(`/api/projects/${projectId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.project?.freelancerId && data.freelancer) {
            setAcceptedFreelancer({
              name: data.freelancer.name,
              email: data.freelancer.email,
            });
          }
        }
      } catch {
        // Ignore polling errors
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [currentStep, projectId, inviteData]);

  // Shared capture helper used by both mock immediate capture and PayPal Sandbox redirect return
  const captureOrder = useCallback(
    async (targetProjectId: string, orderId: string) => {
      setIsFunding(true);
      setFundingError(null);
      setPendingApprovalUrl(null);

      try {
        const captureRes = await apiRawFetch(`/api/projects/${targetProjectId}/fund/capture`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ orderId }),
        });

        if (!captureRes.ok) {
          const errData = await captureRes.json().catch(() => ({}));
          throw new Error(errData.message || errData.error || 'Failed to capture funding order');
        }

        setFundSuccess(true);
        setTimeout(() => {
          navigate(`/client/projects/${targetProjectId}`);
        }, 1500);
      } catch (err) {
        setFundingError(err instanceof Error ? err.message : 'Funding failed');
      } finally {
        setIsFunding(false);
      }
    },
    [navigate]
  );

  // Handle return from PayPal Sandbox Checkout (?token=<orderId>&PayerID=... or ?paypalCancel=1)
  useEffect(() => {
    if (currentStep !== 4 || !projectId) return;

    const paypalToken = searchParams.get('token');
    const paypalCancel = searchParams.get('paypalCancel');

    if (paypalCancel === '1') {
      setFundingError('PayPal Sandbox approval was cancelled before payment completed. Click Authorize & Fund to try again.');
      const cleaned = new URLSearchParams(searchParams);
      cleaned.delete('paypalCancel');
      cleaned.delete('token');
      cleaned.delete('PayerID');
      setSearchParams(cleaned, { replace: true });
      return;
    }

    if (paypalToken && capturedTokenRef.current !== paypalToken) {
      capturedTokenRef.current = paypalToken;
      const cleaned = new URLSearchParams(searchParams);
      cleaned.delete('token');
      cleaned.delete('PayerID');
      setSearchParams(cleaned, { replace: true });
      void captureOrder(projectId, paypalToken);
    }
  }, [currentStep, projectId, searchParams, setSearchParams, captureOrder]);

  // Step 4: Fund Project via PayPal sandbox order -> approval redirect (when needed) -> capture
  const handleFundProject = async () => {
    if (!projectId) return;
    setIsFunding(true);
    setFundingError(null);
    setPendingApprovalUrl(null);

    try {
      const baseWizardUrl = `${window.location.origin}/client/new?step=4&projectId=${encodeURIComponent(projectId)}`;
      const returnUrl = baseWizardUrl;
      const cancelUrl = `${baseWizardUrl}&paypalCancel=1`;

      // 1. Create funding order
      const orderRes = await apiRawFetch(`/api/projects/${projectId}/fund/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ returnUrl, cancelUrl }),
      });

      if (!orderRes.ok) {
        const errData = await orderRes.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || 'Failed to create funding order');
      }

      const orderData = await orderRes.json();

      // Real PayPal Sandbox requires buyer approval on PayPal Checkout before capture
      if (
        orderData.approveUrl &&
        orderData.status !== 'APPROVED' &&
        orderData.status !== 'COMPLETED'
      ) {
        setPendingApprovalUrl(orderData.approveUrl);
        setIsFunding(false);
        window.location.assign(orderData.approveUrl);
        return;
      }

      // 2. Capture funding order directly (mock mode or already-approved order)
      await captureOrder(projectId, orderData.orderId);
    } catch (err) {
      setFundingError(err instanceof Error ? err.message : 'Funding failed');
      setIsFunding(false);
    }
  };

  const copyToClipboard = (text: string, type: 'code' | 'link') => {
    navigator.clipboard.writeText(text);
    if (type === 'code') {
      setCopyCodeSuccess(true);
      setTimeout(() => setCopyCodeSuccess(false), 2000);
    } else {
      setCopyLinkSuccess(true);
      setTimeout(() => setCopyLinkSuccess(false), 2000);
    }
  };

  return (
    <div
      style={{
        maxWidth: '960px',
        margin: '0 auto',
        padding: '2.5rem 1.5rem',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* 4-Step Thin Progress Indicator per §6.2 */}
      <div
        role="navigation"
        aria-label="Wizard progress"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '2.5rem',
          borderBottom: '1px solid var(--line)',
          paddingBottom: '1.25rem',
        }}
      >
        {[
          { step: 1, label: '1. Brief', icon: <FileText size={16} /> },
          { step: 2, label: '2. Plan', icon: <Calendar size={16} /> },
          { step: 3, label: '3. Invite', icon: <UserPlus size={16} /> },
          { step: 4, label: '4. Fund', icon: <CreditCard size={16} /> },
        ].map((item) => {
          const isDone = currentStep > item.step;
          const isActive = currentStep === item.step;
          return (
            <div
              key={item.step}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: isActive ? 'var(--forest)' : isDone ? 'var(--teal-ink)' : 'var(--ink-3)',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.875rem',
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDone ? 'var(--teal)' : isActive ? 'var(--forest)' : 'var(--line)',
                  color: isDone || isActive ? '#ffffff' : 'var(--ink-2)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                {isDone ? <Check size={14} /> : item.step}
              </div>
              <span>{item.label}</span>
            </div>
          );
        })}
      </div>

      {/* STEP 1: BRIEF */}
      {currentStep === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <h1
              className="font-display"
              style={{
                fontSize: '1.75rem',
                fontWeight: 600,
                color: 'var(--ink)',
                margin: '0 0 0.5rem 0',
              }}
            >
              Create a new project agreement
            </h1>
            <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: '0.9375rem' }}>
              Describe the project deliverables. Our AI Planner will generate verifiable milestones and fair payment splits.
            </p>
          </div>

          {/* Sample Brief Helpers */}
          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-card)',
              padding: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Sparkles size={16} style={{ color: 'var(--forest)' }} />
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink)' }}>
                Sample briefs for quick testing:
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {SAMPLE_BRIEFS.map((s, idx) => (
                <button
                  key={s.title}
                  type="button"
                  onClick={() => handleUseSample(idx)}
                  style={{
                    background: 'var(--paper)',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--radius-btn)',
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.8125rem',
                    color: 'var(--forest)',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Use sample: {s.title} (${s.budget})
                </button>
              ))}
            </div>
          </div>

          <Field label="Project title" required>
            {(props) => (
              <Input
                {...props}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Brand Identity & Visual System"
              />
            )}
          </Field>

          <Field label="Project brief & requirements" required hint="Be as descriptive as possible about deliverables.">
            {(props) => (
              <Textarea
                {...props}
                rows={5}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="Describe deliverables, scope, tech stack, and expected outputs..."
              />
            )}
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <Field label="Total project budget ($ USD)" required>
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min={100}
                  step={50}
                  value={totalBudget}
                  onChange={(e) => setTotalBudget(Number(e.target.value))}
                />
              )}
            </Field>

            <Field label="Estimated duration" hint="e.g. 4 weeks, 30 days">
              {(props) => (
                <Input
                  {...props}
                  value={durationHint}
                  onChange={(e) => setDurationHint(e.target.value)}
                  placeholder="4 weeks"
                />
              )}
            </Field>
          </div>

          {planError && (
            <div
              style={{
                backgroundColor: 'var(--amber-wash)',
                border: '1px solid var(--amber)',
                borderRadius: 'var(--radius-card)',
                padding: '0.875rem 1rem',
                color: 'var(--ink)',
                fontSize: '0.875rem',
              }}
            >
              {planError}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <Button
              variant="primary"
              size="lg"
              disabled={isGeneratingPlan || !brief.trim()}
              onClick={handleGeneratePlan}
              leftIcon={isGeneratingPlan ? undefined : <Sparkles size={18} />}
            >
              {isGeneratingPlan ? 'Generating AI Plan...' : 'Generate AI Plan'}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: PLAN */}
      {currentStep === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1
                className="font-display"
                style={{
                  fontSize: '1.75rem',
                  fontWeight: 600,
                  color: 'var(--ink)',
                  margin: '0 0 0.5rem 0',
                }}
              >
                Review & adjust milestone plan
              </h1>
              <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: '0.9375rem' }}>
                Verify the payment splits and observable acceptance criteria before inviting your freelancer.
              </p>
            </div>

            {/* Percentage check indicator */}
            <div
              style={{
                padding: '0.5rem 1rem',
                borderRadius: 'var(--radius-card)',
                backgroundColor: totalPercentage === 100 ? 'var(--teal-wash)' : 'var(--amber-wash)',
                border: `1px solid ${totalPercentage === 100 ? 'var(--teal)' : 'var(--amber)'}`,
                color: 'var(--ink)',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            >
              Total Split: {totalPercentage}% {totalPercentage === 100 ? '✓' : '(Must be 100%)'}
            </div>
          </div>

          {/* Editable Milestones List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {editableMilestones.map((m, mIdx) => (
              <div
                key={m.id}
                style={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-card)',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-2)', textTransform: 'uppercase' }}>
                      Milestone {mIdx + 1} Name
                    </label>
                    <input
                      type="text"
                      value={m.name}
                      onChange={(e) => {
                        const updated = [...editableMilestones];
                        updated[mIdx].name = e.target.value;
                        setEditableMilestones(updated);
                      }}
                      style={{
                        width: '100%',
                        fontSize: '1rem',
                        fontWeight: 600,
                        color: 'var(--ink)',
                        border: '1px solid var(--line)',
                        borderRadius: 'var(--radius-btn)',
                        padding: '0.5rem 0.75rem',
                        marginTop: '0.25rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div style={{ width: '130px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-2)', textTransform: 'uppercase' }}>
                      Split (%)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={m.paymentPercent}
                      onChange={(e) => {
                        const updated = [...editableMilestones];
                        updated[mIdx].paymentPercent = Number(e.target.value);
                        setEditableMilestones(updated);
                      }}
                      style={{
                        width: '100%',
                        fontSize: '1rem',
                        fontWeight: 600,
                        color: 'var(--ink)',
                        border: '1px solid var(--line)',
                        borderRadius: 'var(--radius-btn)',
                        padding: '0.5rem 0.75rem',
                        marginTop: '0.25rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div style={{ width: '150px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-2)', textTransform: 'uppercase' }}>
                      Payout Amount
                    </label>
                    <div
                      style={{
                        padding: '0.5rem 0.75rem',
                        marginTop: '0.25rem',
                        fontSize: '1rem',
                        fontWeight: 600,
                        color: 'var(--teal-ink)',
                      }}
                    >
                      {formatCents(Math.round((totalBudget * 100 * m.paymentPercent) / 100))}
                    </div>
                  </div>
                </div>

                {/* Acceptance Criteria */}
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-2)', textTransform: 'uppercase' }}>
                    Observable Acceptance Criteria (Checked by AI Reviewer)
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {m.acceptanceCriteria.map((c, cIdx) => (
                      <div key={cIdx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--ink-3)', width: '20px' }}>
                          {cIdx + 1}.
                        </span>
                        <input
                          type="text"
                          value={c}
                          onChange={(e) => {
                            const updated = [...editableMilestones];
                            updated[mIdx].acceptanceCriteria[cIdx] = e.target.value;
                            setEditableMilestones(updated);
                          }}
                          style={{
                            flex: 1,
                            fontSize: '0.875rem',
                            border: '1px solid var(--line)',
                            borderRadius: 'var(--radius-btn)',
                            padding: '0.4rem 0.6rem',
                          }}
                        />
                        {m.acceptanceCriteria.length > 2 && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...editableMilestones];
                              updated[mIdx].acceptanceCriteria.splice(cIdx, 1);
                              setEditableMilestones(updated);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--ink-3)',
                              cursor: 'pointer',
                              padding: '0.3rem',
                            }}
                            title="Remove criterion"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                    {m.acceptanceCriteria.length < 5 && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...editableMilestones];
                          updated[mIdx].acceptanceCriteria.push('Deliverable conforms to agreed specifications');
                          setEditableMilestones(updated);
                        }}
                        style={{
                          alignSelf: 'flex-start',
                          background: 'none',
                          border: 'none',
                          color: 'var(--forest)',
                          fontSize: '0.8125rem',
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          marginTop: '0.25rem',
                        }}
                      >
                        <Plus size={14} /> Add criterion
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {planError && (
            <div
              style={{
                backgroundColor: 'var(--amber-wash)',
                border: '1px solid var(--amber)',
                borderRadius: 'var(--radius-card)',
                padding: '0.875rem 1rem',
                color: 'var(--ink)',
                fontSize: '0.875rem',
              }}
            >
              {planError}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
            <Button variant="quiet" onClick={() => setCurrentStep(1)} leftIcon={<ArrowLeft size={16} />}>
              Back to brief
            </Button>
            <Button
              variant="primary"
              size="lg"
              disabled={isApplyingPlan || totalPercentage !== 100}
              onClick={handleApprovePlan}
              leftIcon={<ArrowRight size={16} />}
            >
              {isApplyingPlan ? 'Saving Plan...' : 'Approve Plan & Continue'}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: INVITE */}
      {currentStep === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <h1
              className="font-display"
              style={{
                fontSize: '1.75rem',
                fontWeight: 600,
                color: 'var(--ink)',
                margin: '0 0 0.5rem 0',
              }}
            >
              Your project agreement is ready
            </h1>
            <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: '0.9375rem' }}>
              Invite your freelancer to review the agreed milestones and criteria. Work and funding cannot start until they accept.
            </p>
          </div>

          {/* Project Summary Card */}
          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-card)',
              padding: '1.25rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1rem',
            }}
          >
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--ink-2)', textTransform: 'uppercase', fontWeight: 600 }}>
                Budget
              </span>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem', fontWeight: 600, color: 'var(--ink)' }}>
                ${totalBudget.toLocaleString()}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--ink-2)', textTransform: 'uppercase', fontWeight: 600 }}>
                Milestones
              </span>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem', fontWeight: 600, color: 'var(--ink)' }}>
                {editableMilestones.length} milestones
              </p>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--ink-2)', textTransform: 'uppercase', fontWeight: 600 }}>
                Duration
              </span>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem', fontWeight: 600, color: 'var(--ink)' }}>
                {durationHint}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--ink-2)', textTransform: 'uppercase', fontWeight: 600 }}>
                Freelancer Status
              </span>
              <p
                style={{
                  margin: '0.25rem 0 0 0',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  color: acceptedFreelancer ? 'var(--teal-ink)' : 'var(--amber)',
                }}
              >
                {acceptedFreelancer ? `Accepted: ${acceptedFreelancer.name}` : 'Waiting for acceptance'}
              </p>
            </div>
          </div>

          {/* Invitation Panel per §6.2 & §10.1 */}
          <div
            style={{
              backgroundColor: 'var(--paper)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-card)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--ink)' }}>
                Invitation Credentials
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--ink-2)' }}>
                Single-use • Expires in 7 days
              </span>
            </div>

            {inviteData && (
              <>
                {/* Short Code */}
                <div>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-2)' }}>
                    Short Invitation Code (Crockford Base32)
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <div
                      style={{
                        flex: 1,
                        padding: '0.75rem 1rem',
                        fontFamily: 'monospace',
                        fontSize: '1.25rem',
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        backgroundColor: 'var(--surface)',
                        border: '1px solid var(--line)',
                        borderRadius: 'var(--radius-btn)',
                        color: 'var(--forest)',
                      }}
                    >
                      {inviteData.code}
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => copyToClipboard(inviteData.code, 'code')}
                      leftIcon={copyCodeSuccess ? <Check size={16} /> : <Copy size={16} />}
                    >
                      {copyCodeSuccess ? 'Copied' : 'Copy code'}
                    </Button>
                  </div>
                </div>

                {/* Direct Link */}
                <div>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-2)' }}>
                    Direct Invitation URL
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <input
                      type="text"
                      readOnly
                      value={inviteData.inviteUrl}
                      style={{
                        flex: 1,
                        padding: '0.6rem 0.75rem',
                        fontSize: '0.875rem',
                        backgroundColor: 'var(--surface)',
                        border: '1px solid var(--line)',
                        borderRadius: 'var(--radius-btn)',
                        color: 'var(--ink-2)',
                      }}
                    />
                    <Button
                      variant="secondary"
                      onClick={() => copyToClipboard(inviteData.inviteUrl, 'link')}
                      leftIcon={copyLinkSuccess ? <Check size={16} /> : <Copy size={16} />}
                    >
                      {copyLinkSuccess ? 'Copied' : 'Copy link'}
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* Optional Freelancer Email Target */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label htmlFor="wizard-invite-email" style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-2)' }}>
                Send directly to freelancer email (optional)
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input
                  id="wizard-invite-email"
                  type="email"
                  className="ms-input"
                  style={{ flex: 1, minWidth: '220px' }}
                  placeholder="freelancer@example.com"
                  value={invitedEmail}
                  onChange={(e) => setInvitedEmail(e.target.value)}
                />
                <Button
                  variant="secondary"
                  isLoading={isCreatingInvite}
                  disabled={!invitedEmail.trim()}
                  onClick={() => void handleCreateInvite(invitedEmail)}
                >
                  Create &amp; send email invite
                </Button>
              </div>
              {inviteError && (
                <div style={{ fontSize: '0.82rem', color: 'var(--danger)' }} role="alert">
                  {inviteError}
                </div>
              )}
            </div>

            {/* Waiting State or Accepted Banner */}
            {!acceptedFreelancer ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'var(--surface)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-btn)',
                  border: '1px dashed var(--line)',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Clock size={18} className="animate-spin" style={{ color: 'var(--ink-3)' }} />
                  <span style={{ fontSize: '0.875rem', color: 'var(--ink-2)' }}>
                    Waiting for your freelancer to sign in and accept this invitation link…
                  </span>
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  backgroundColor: 'var(--teal-wash)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-btn)',
                  border: '1px solid var(--teal)',
                  color: 'var(--teal-ink)',
                }}
              >
                <CheckCircle2 size={20} />
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9375rem' }}>
                    {acceptedFreelancer.name} accepted the project agreement!
                  </p>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8125rem', opacity: 0.9 }}>
                    Funding gate unlocked. You can now fund the project via PayPal sandbox.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
            <Button variant="quiet" onClick={() => setCurrentStep(2)} leftIcon={<ArrowLeft size={16} />}>
              Back to plan
            </Button>
            <Button
              variant="primary"
              size="lg"
              disabled={!acceptedFreelancer}
              onClick={() => setCurrentStep(4)}
              leftIcon={<ArrowRight size={16} />}
            >
              Continue to Funding
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4: FUND */}
      {currentStep === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <h1
              className="font-display"
              style={{
                fontSize: '1.75rem',
                fontWeight: 600,
                color: 'var(--ink)',
                margin: '0 0 0.5rem 0',
              }}
            >
              Fund project holding balance
            </h1>
            <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: '0.9375rem' }}>
              Funds are held safely in your PayPal sandbox business account and released milestone-by-milestone upon verified delivery.
            </p>
          </div>

          {/* Sandbox Notice Banner per §6.2 */}
          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-card)',
              padding: '1rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <ShieldCheck size={20} style={{ color: 'var(--forest)' }} />
            <div style={{ fontSize: '0.875rem', color: 'var(--ink-2)' }}>
              <strong style={{ color: 'var(--ink)' }}>PayPal Sandbox Environment:</strong> No real money moves.
              You will approve the payment in PayPal Sandbox Checkout and return here to capture it into sandbox holding.
            </div>
          </div>

          {/* Funding Summary Card */}
          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-card)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9375rem', color: 'var(--ink-2)' }}>Total Project Budget</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--ink)' }}>
                ${totalBudget.toLocaleString()}.00 USD
              </span>
            </div>

            <div style={{ borderTop: '1px solid var(--line)', paddingTop: '0.75rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-2)', textTransform: 'uppercase' }}>
                Milestone Schedule
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                {editableMilestones.map((m, idx) => (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.875rem',
                    }}
                  >
                    <span style={{ color: 'var(--ink)' }}>
                      {idx + 1}. {m.name} ({m.paymentPercent}%)
                    </span>
                    <span style={{ fontWeight: 600, color: 'var(--teal-ink)' }}>
                      {formatCents(m.amountCents > 0 ? m.amountCents : Math.round((totalBudget * 100 * m.paymentPercent) / 100))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {pendingApprovalUrl && (
            <div
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--forest)',
                borderRadius: 'var(--radius-card)',
                padding: '0.875rem 1rem',
                color: 'var(--ink)',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                flexWrap: 'wrap',
              }}
            >
              <span>Redirecting to PayPal Sandbox Checkout for buyer approval...</span>
              <a
                href={pendingApprovalUrl}
                style={{
                  color: 'var(--forest)',
                  fontWeight: 600,
                  textDecoration: 'underline',
                }}
              >
                Open PayPal Sandbox Checkout
              </a>
            </div>
          )}

          {fundingError && (
            <div
              style={{
                backgroundColor: 'var(--amber-wash)',
                border: '1px solid var(--amber)',
                borderRadius: 'var(--radius-card)',
                padding: '0.875rem 1rem',
                color: 'var(--ink)',
                fontSize: '0.875rem',
              }}
            >
              {fundingError}
            </div>
          )}

          {fundSuccess && (
            <div
              style={{
                backgroundColor: 'var(--teal-wash)',
                border: '1px solid var(--teal)',
                borderRadius: 'var(--radius-card)',
                padding: '1rem',
                color: 'var(--teal-ink)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <CheckCircle2 size={24} />
              <div>
                <strong>Funding captured successfully!</strong>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.875rem' }}>
                  Redirecting to your project overview...
                </p>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
            <Button variant="quiet" onClick={() => setCurrentStep(3)} leftIcon={<ArrowLeft size={16} />}>
              Back to invite
            </Button>
            <Button
              variant="primary"
              size="lg"
              disabled={isFunding || fundSuccess}
              onClick={handleFundProject}
              leftIcon={<ShieldCheck size={18} />}
            >
              {isFunding ? 'Processing PayPal Sandbox...' : `Authorize & Fund $${totalBudget.toLocaleString()}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

