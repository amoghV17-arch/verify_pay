import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  ShieldCheck,
  Send,
} from 'lucide-react';
import { formatCents } from '@milestone/shared';
import { Button } from '../../components/ui/Button.js';
import { LifecycleProgress } from '../../components/ui/LifecycleProgress.js';
import { StatusBadge, type MoneyState } from '../../components/ui/StatusBadge.js';

interface MilestoneData {
  id: string;
  name: string;
  amountCents: number;
  status: string;
  dueDate?: string;
  acceptanceCriteria: string[];
  deliverableType?: string;
}

interface ProjectData {
  id: string;
  title: string;
  brief: string;
  totalCents: number;
  status: string;
  clientId: string;
  freelancerId: string | null;
  isDemo: boolean;
  createdAt: string;
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

export const FreelancerOverviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<ProjectData | null>(null);
  const [milestones, setMilestones] = useState<MilestoneData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ledger, setLedger] = useState({
    totalCents: 0,
    fundedCents: 0,
    paidCents: 0,
    heldCents: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;

    async function fetchProject() {
      try {
        setIsLoading(true);

        const res = await fetch(`/api/projects/${id}`, {
          headers: { 'X-Persona': 'freelancer' },
        });

        if (!res.ok) {
          throw new Error('Failed to load project');
        }

        const data = await res.json();
        if (isMounted && data.success) {
          setProject(data.project);
          const normalized = (data.milestones || []).map(
            (m: MilestoneData & { criteria?: Array<{ id?: string; description?: string } | string> }) => ({
              ...m,
              acceptanceCriteria: Array.isArray(m.acceptanceCriteria)
                ? m.acceptanceCriteria
                : Array.isArray(m.criteria)
                  ? m.criteria.map((c) => (typeof c === 'string' ? c : c.description || ''))
                  : [],
            })
          );
          setMilestones(normalized);
          if (data.ledger) {
            setLedger({
              totalCents: data.ledger.totalCents || data.project.totalCents,
              fundedCents: data.ledger.fundedCents || 0,
              paidCents: data.ledger.paidCents || 0,
              heldCents: data.ledger.heldCents || 0,
            });
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load project');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchProject();
    return () => {
      isMounted = false;
    };
  }, [id]);

  // Determine active milestone for the freelancer
  const nextUpMilestone =
    milestones.find(
      (m) =>
        m.status === 'funded' ||
        m.status === 'in_review' ||
        m.status === 'submitted' ||
        m.status === 'changes_requested' ||
        m.status === 'awaiting_client' ||
        m.status === 'approved'
    ) || milestones[0];

  const isProjectFunded = project?.status === 'funded' || project?.status === 'active';
  const isMilestoneFunded = nextUpMilestone && (nextUpMilestone.status === 'funded' || nextUpMilestone.status === 'changes_requested');

  if (isLoading) {
    return (
      <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '2.5rem 1.5rem', width: '100%' }}>
        <div style={{ height: '240px', backgroundColor: 'var(--surface)', borderRadius: 'var(--radius-card)', animation: 'pulse 1.5s infinite' }} />
      </div>
    );
  }

  if (error && !project) {
    return (
      <div style={{ maxWidth: '1080px', margin: '3rem auto', padding: '0 1.5rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--ink-2)', marginBottom: '1rem' }}>{error}</p>
        <button
          type="button"
          onClick={() => navigate('/freelancer')}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'var(--forest)',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Back to Projects
        </button>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div
      style={{
        maxWidth: '1080px',
        margin: '0 auto',
        padding: '2.5rem 1.5rem',
        width: '100%',
        boxSizing: 'border-box',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
      }}
    >
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.35rem' }}>
          <h1
            className="font-display"
            style={{
              fontSize: '2rem',
              fontWeight: 600,
              color: 'var(--ink)',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            {project.title}
          </h1>
          <StatusBadge state={mapStatusToMoneyState(project.status)} />
          {project.isDemo && (
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: 'var(--ink-2)',
                backgroundColor: 'var(--paper-warm)',
                padding: '0.15rem 0.5rem',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--line)',
              }}
            >
              Demo project
            </span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--ink-2)', lineHeight: 1.5, maxWidth: '680px' }}>
          {project.brief}
        </p>
      </div>

      {/* NEXT UP CARD (Always first per §7.2) */}
      {nextUpMilestone && (
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '2px solid var(--forest)',
            borderRadius: 'var(--radius-card)',
            padding: '1.75rem',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--forest)',
                }}
              >
                Next Up for Delivery
              </span>
              <h2
                style={{
                  fontSize: '1.35rem',
                  fontWeight: 600,
                  color: 'var(--ink)',
                  margin: '0.25rem 0 0.2rem 0',
                }}
              >
                {nextUpMilestone.name}
              </h2>
              <span style={{ fontSize: '0.875rem', color: 'var(--ink-2)' }}>
                Payment attached:{' '}
                <strong style={{ color: 'var(--teal-ink)' }}>{formatCents(nextUpMilestone.amountCents)}</strong>
              </span>
            </div>

            {/* Primary Action Button per §7.2 */}
            <div>
              {isMilestoneFunded ? (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate(`/freelancer/projects/${project.id}/deliverables?submit=${nextUpMilestone.id}`)}
                  leftIcon={<Send size={16} />}
                >
                  Submit deliverable
                </Button>
              ) : nextUpMilestone.status === 'in_review' || nextUpMilestone.status === 'submitted' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--forest)', fontSize: '0.875rem', fontWeight: 600 }}>
                  <Clock size={16} className="animate-spin" />
                  <span>AI Review in progress...</span>
                </div>
              ) : nextUpMilestone.status === 'approved' || nextUpMilestone.status === 'awaiting_client' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--teal-ink)', fontSize: '0.875rem', fontWeight: 600 }}>
                  <CheckCircle2 size={16} />
                  <span>Verified! Awaiting client release</span>
                </div>
              ) : (
                <div
                  style={{
                    backgroundColor: 'var(--paper)',
                    padding: '0.6rem 1rem',
                    borderRadius: 'var(--radius-btn)',
                    border: '1px solid var(--line)',
                    color: 'var(--ink-2)',
                    fontSize: '0.8125rem',
                  }}
                >
                  Not funded yet. Wait for client before you start.
                </div>
              )}
            </div>
          </div>

          {/* Funding Status Confirmation Banner per §7.2 */}
          {isProjectFunded && (
            <div
              style={{
                backgroundColor: 'var(--teal-wash)',
                borderRadius: 'var(--radius-btn)',
                padding: '0.6rem 1rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: 'var(--teal-ink)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                alignSelf: 'flex-start',
              }}
            >
              <ShieldCheck size={16} />
              <span>Funded and locked. You can start.</span>
            </div>
          )}

          {/* LifecycleProgress per §7.2 */}
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: '1.25rem' }}>
            <LifecycleProgress backendStatus={nextUpMilestone.status} />
          </div>

          {/* Acceptance Criteria */}
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: '1rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-2)', textTransform: 'uppercase' }}>
              Acceptance Criteria to Pass Review:
            </span>
            <ul style={{ margin: '0.4rem 0 0 0', paddingLeft: '1.25rem', fontSize: '0.875rem', color: 'var(--ink)', lineHeight: 1.5 }}>
              {(nextUpMilestone.acceptanceCriteria || []).map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* FINANCIAL HIERARCHY per §7.2: Large "Locked for you" + "Earned" */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
          gap: '1.25rem',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-card)',
            padding: '1.5rem',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--ink-2)', textTransform: 'uppercase', fontWeight: 600 }}>
            Locked for you (Holding Balance)
          </span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '2rem', fontWeight: 700, color: 'var(--forest)' }}>
            {formatCents(ledger.heldCents)}
          </p>
          <span style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>
            Funds committed in PayPal Sandbox
          </span>
        </div>

        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-card)',
            padding: '1.5rem',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--ink-2)', textTransform: 'uppercase', fontWeight: 600 }}>
            Earned to Date (Settled)
          </span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '2rem', fontWeight: 700, color: 'var(--teal-ink)' }}>
            {formatCents(ledger.paidCents)}
          </p>
          <span style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>
            Released to your sandbox account
          </span>
        </div>

        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-card)',
            padding: '1.5rem',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--ink-2)', textTransform: 'uppercase', fontWeight: 600 }}>
            Total Agreement Value
          </span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '2rem', fontWeight: 700, color: 'var(--ink)' }}>
            {formatCents(ledger.totalCents)}
          </p>
          <span style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>
            Total agreement split across {milestones.length} milestones
          </span>
        </div>
      </div>

      {/* UPCOMING MILESTONES per §7.2 */}
      <div
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-card)',
          padding: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--ink)' }}>
            All Milestones
          </h3>
          <Link
            to={`/freelancer/projects/${project.id}/schedule`}
            style={{ fontSize: '0.8125rem', color: 'var(--forest)', fontWeight: 600, textDecoration: 'none' }}
          >
            View schedule →
          </Link>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {milestones.map((m, idx) => (
            <div
              key={m.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                padding: '0.875rem 1rem',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-btn)',
                backgroundColor: 'var(--paper)',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-3)', width: '24px' }}>
                  #{idx + 1}
                </span>
                <div>
                  <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--ink)' }}>
                    {m.name}
                  </span>
                  <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.75rem', color: 'var(--ink-2)' }}>
                    Criteria: {(m.acceptanceCriteria || []).length} checks
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <StatusBadge state={mapStatusToMoneyState(m.status)} />
                <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--ink)' }}>
                  {formatCents(m.amountCents)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
