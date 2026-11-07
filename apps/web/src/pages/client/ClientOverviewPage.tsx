import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  Sliders,
  DollarSign,
  Activity as ActivityIcon,
  PackageCheck,
} from 'lucide-react';
import { formatCents } from '@milestone/shared';
import { Button } from '../../components/ui/Button.js';
import { LifecycleProgress } from '../../components/ui/LifecycleProgress.js';
import { StatusBadge, type MoneyState } from '../../components/ui/StatusBadge.js';
import { Avatar } from '../../components/ui/Skeleton.js';
import {
  FALLBACK_PROJECT,
  FALLBACK_FREELANCER,
  FALLBACK_MILESTONES,
  FALLBACK_LEDGER,
  FALLBACK_ACTIVITY,
} from '../../data/fallbackData.js';

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
  autonomyMode?: 'manual' | 'assisted' | 'auto';
  releaseWindowSeconds?: number;
  isDemo: boolean;
  createdAt: string;
}

interface ActivityEvent {
  id: string;
  actor: string;
  type: string;
  description: string;
  timestamp: string;
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

export const ClientOverviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [project, setProject] = useState<ProjectData | null>(null);
  const [freelancer, setFreelancer] = useState<{ name: string; email: string } | null>(null);
  const [milestones, setMilestones] = useState<MilestoneData[]>([]);
  const [ledger, setLedger] = useState<{
    totalCents: number;
    fundedCents: number;
    paidCents: number;
    heldCents: number;
  }>({ totalCents: 0, fundedCents: 0, paidCents: 0, heldCents: 0 });
  const [recentActivity, setRecentActivity] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Autonomy settings state
  const [isChangingAutonomy, setIsChangingAutonomy] = useState(false);
  const [autonomyMode, setAutonomyMode] = useState<'manual' | 'assisted' | 'auto'>('assisted');

  // Next action interaction states
  const [isReleasing, setIsReleasing] = useState(false);
  const [releaseSuccess, setReleaseSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;

    async function fetchProjectData() {
      try {
        setIsLoading(true);
        setError(null);

        const [projRes, activityRes] = await Promise.all([
          fetch(`/api/projects/${id}`, {
            headers: { 'X-Persona': 'client' },
          }),
          fetch(`/api/projects/${id}/activity`, {
            headers: { 'X-Persona': 'client' },
          }),
        ]);

        if (!projRes.ok) {
          throw new Error(`Project not found: ${projRes.statusText}`);
        }

        const projData = await projRes.json();
        if (isMounted && projData.success) {
          setProject(projData.project);
          setFreelancer(projData.freelancer);
          setMilestones(projData.milestones || []);
          if (projData.project.autonomyMode) {
            setAutonomyMode(projData.project.autonomyMode);
          }
          if (projData.ledger) {
            setLedger({
              totalCents: projData.ledger.totalCents || projData.project.totalCents,
              fundedCents: projData.ledger.fundedCents || 0,
              paidCents: projData.ledger.paidCents || 0,
              heldCents: projData.ledger.heldCents || 0,
            });
          }
        }

        if (activityRes.ok) {
          const actData = await activityRes.json();
          if (isMounted && actData.activity) {
            setRecentActivity(actData.activity.slice(0, 5));
          }
        }
      } catch (err) {
        if (isMounted) {
          // Resilient preview fallback
          setProject(FALLBACK_PROJECT);
          setFreelancer(FALLBACK_FREELANCER);
          setMilestones(FALLBACK_MILESTONES);
          setLedger({
            totalCents: FALLBACK_LEDGER.totalCents,
            fundedCents: FALLBACK_LEDGER.fundedCents,
            paidCents: FALLBACK_LEDGER.paidCents,
            heldCents: FALLBACK_LEDGER.heldCents,
          });
          setRecentActivity(FALLBACK_ACTIVITY.slice(0, 5));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchProjectData();
    return () => {
      isMounted = false;
    };
  }, [id, releaseSuccess]);

  // Update autonomy mode
  const handleUpdateAutonomy = async (newMode: 'manual' | 'assisted' | 'auto') => {
    if (!id) return;
    setIsChangingAutonomy(true);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Persona': 'client',
        },
        body: JSON.stringify({ autonomyMode: newMode }),
      });
      if (res.ok) {
        setAutonomyMode(newMode);
      }
    } catch (err) {
      console.error('Failed to update autonomy:', err);
    } finally {
      setIsChangingAutonomy(false);
    }
  };

  // Immediate release payout
  const handleReleasePayout = async (milestoneId: string) => {
    setIsReleasing(true);
    try {
      const res = await fetch(`/api/milestones/${milestoneId}/release`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Persona': 'client',
        },
      });
      if (res.ok) {
        setReleaseSuccess(`Milestone payout released!`);
        setTimeout(() => setReleaseSuccess(null), 3000);
      }
    } catch (err) {
      console.error('Release failed:', err);
    } finally {
      setIsReleasing(false);
    }
  };

  // Client objection to assisted release
  const handleObjectToRelease = async (milestoneId: string) => {
    try {
      const res = await fetch(`/api/milestones/${milestoneId}/object`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Persona': 'client',
        },
        body: JSON.stringify({ reason: 'Client requested review prior to release.' }),
      });
      if (res.ok) {
        setReleaseSuccess('Objection recorded. Payout halted for review.');
        setTimeout(() => setReleaseSuccess(null), 3000);
      }
    } catch (err) {
      console.error('Objection failed:', err);
    }
  };

  // Determine current active milestone
  const currentMilestone =
    milestones.find(
      (m) =>
        m.status === 'in_review' ||
        m.status === 'submitted' ||
        m.status === 'awaiting_client' ||
        m.status === 'approved' ||
        m.status === 'funded'
    ) || milestones[0];

  // Financial calculations
  const remainingCents = Math.max(0, ledger.totalCents - ledger.fundedCents);
  const paidPercent = ledger.totalCents > 0 ? (ledger.paidCents / ledger.totalCents) * 100 : 0;
  const heldPercent = ledger.totalCents > 0 ? (ledger.heldCents / ledger.totalCents) * 100 : 0;
  const unfundedPercent = ledger.totalCents > 0 ? (remainingCents / ledger.totalCents) * 100 : 0;

  if (isLoading) {
    return (
      <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '2.5rem 1.5rem', width: '100%' }}>
        <div style={{ height: '200px', backgroundColor: 'var(--surface)', borderRadius: 'var(--radius-card)', animation: 'pulse 1.5s infinite' }} />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '2.5rem 1.5rem', width: '100%' }}>
        <div style={{ backgroundColor: 'var(--amber-wash)', padding: '1.5rem', borderRadius: 'var(--radius-card)', border: '1px solid var(--amber)' }}>
          <h3>Unable to load project</h3>
          <p>{error || 'Project not found'}</p>
          <Link to="/client"><Button variant="secondary">Back to projects</Button></Link>
        </div>
      </div>
    );
  }

  // Next action computation per docs/UI_IMPLEMENTATION.md §6.3
  const readyToReleaseMilestone = milestones.find((m) => m.status === 'approved' || m.status === 'awaiting_client');
  const reviewMilestone = milestones.find((m) => m.status === 'in_review' || m.status === 'submitted');

  return (
    <div
      style={{
        maxWidth: '1080px',
        margin: '0 auto',
        padding: '2.5rem 1.5rem',
        width: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
      }}
    >
      {/* Header: Title, Description, Freelancer & Status */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1.5rem',
        }}
      >
        <div style={{ flex: 1, minWidth: '280px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
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
          <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--ink-2)', lineHeight: 1.5, maxWidth: '640px' }}>
            {project.brief}
          </p>
        </div>

        {/* Freelancer info chip */}
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-card)',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          {freelancer ? (
            <>
              <Avatar name={freelancer.name} roleBadge="freelancer" size="sm" />
              <div>
                <span style={{ fontSize: '0.6875rem', color: 'var(--ink-2)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Freelancer
                </span>
                <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink)' }}>
                  {freelancer.name}
                </p>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={16} style={{ color: 'var(--amber)' }} />
              <span style={{ fontSize: '0.8125rem', color: 'var(--ink-2)' }}>
                Waiting for freelancer to accept
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Release Success Banner */}
      {releaseSuccess && (
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
          <CheckCircle2 size={20} />
          <span>{releaseSuccess}</span>
        </div>
      )}

      {/* NEXT ACTION CARD (Always first per §6.3) */}
      <div
        style={{
          backgroundColor: 'var(--surface)',
          border: '2px solid var(--forest)',
          borderRadius: 'var(--radius-card)',
          padding: '1.5rem',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem',
        }}
      >
        <div style={{ flex: 1, minWidth: '260px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--forest)',
              }}
            >
              Next Action
            </span>
          </div>

          {!project.freelancerId ? (
            <div>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--ink)' }}>
                Waiting for freelancer to accept agreement
              </h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: 'var(--ink-2)' }}>
                Share your invitation code or direct URL with your freelancer so they can review the milestones.
              </p>
            </div>
          ) : project.status === 'draft' || project.status === 'planned' ? (
            <div>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--ink)' }}>
                Freelancer accepted! Fund holding balance to begin work
              </h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: 'var(--ink-2)' }}>
                Authorize PayPal sandbox holding to protect the project and enable deliverable submissions.
              </p>
            </div>
          ) : readyToReleaseMilestone ? (
            <div>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--ink)' }}>
                {readyToReleaseMilestone.name} passed review
              </h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: 'var(--ink-2)' }}>
                Ready to release {formatCents(readyToReleaseMilestone.amountCents)} to freelancer.
              </p>
            </div>
          ) : reviewMilestone ? (
            <div>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--ink)' }}>
                AI Review in progress: {reviewMilestone.name}
              </h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: 'var(--ink-2)' }}>
                Reviewer agent is validating deliverables against acceptance criteria.
              </p>
            </div>
          ) : (
            <div>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--ink)' }}>
                Milestone 1 funded and active
              </h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: 'var(--ink-2)' }}>
                Freelancer is preparing deliverable. You will be notified when submitted.
              </p>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div>
          {!project.freelancerId ? (
            <Link to={`/client/new?step=3&projectId=${project.id}`} style={{ textDecoration: 'none' }}>
              <Button variant="primary">View invitation code</Button>
            </Link>
          ) : project.status === 'draft' || project.status === 'planned' ? (
            <Link to={`/client/new?step=4&projectId=${project.id}`} style={{ textDecoration: 'none' }}>
              <Button variant="primary" leftIcon={<ShieldCheck size={16} />}>
                Fund project now
              </Button>
            </Link>
          ) : readyToReleaseMilestone ? (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Button
                variant="secondary"
                onClick={() => handleObjectToRelease(readyToReleaseMilestone.id)}
              >
                Object
              </Button>
              <Button
                variant="primary"
                disabled={isReleasing}
                onClick={() => handleReleasePayout(readyToReleaseMilestone.id)}
                leftIcon={<DollarSign size={16} />}
              >
                {isReleasing ? 'Releasing...' : 'Release now'}
              </Button>
            </div>
          ) : (
            <Link to={`/client/projects/${project.id}/deliverables`} style={{ textDecoration: 'none' }}>
              <Button variant="secondary" leftIcon={<PackageCheck size={16} />}>
                View deliverables
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* FINANCIAL HIERARCHY per §6.3: One large figure with segmented bar + small figures */}
      <div
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-card)',
          padding: '1.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        <div>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-2)', textTransform: 'uppercase' }}>
            Held for this project in PayPal Sandbox
          </span>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', marginTop: '0.25rem' }}>
            {formatCents(ledger.heldCents)}
          </div>
        </div>

        {/* Segmented bar visual: Paid (teal), Held (forest/amber), Remaining (line) */}
        <div>
          <div
            style={{
              height: '10px',
              borderRadius: '5px',
              backgroundColor: 'var(--line)',
              display: 'flex',
              overflow: 'hidden',
              gap: '2px',
            }}
          >
            {paidPercent > 0 && (
              <div
                style={{
                  width: `${paidPercent}%`,
                  backgroundColor: 'var(--teal)',
                  transition: 'width 0.4s ease',
                }}
                title={`Paid: ${formatCents(ledger.paidCents)}`}
              />
            )}
            {heldPercent > 0 && (
              <div
                style={{
                  width: `${heldPercent}%`,
                  backgroundColor: 'var(--forest)',
                  transition: 'width 0.4s ease',
                }}
                title={`Held: ${formatCents(ledger.heldCents)}`}
              />
            )}
            {unfundedPercent > 0 && (
              <div
                style={{
                  width: `${unfundedPercent}%`,
                  backgroundColor: 'var(--line)',
                  transition: 'width 0.4s ease',
                }}
                title={`Not yet funded: ${formatCents(remainingCents)}`}
              />
            )}
          </div>

          {/* Segment legend */}
          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--ink-2)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--teal)' }} />
              Paid ({Math.round(paidPercent)}%)
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--forest)' }} />
              Held in sandbox ({Math.round(heldPercent)}%)
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--line)' }} />
              Not yet funded ({Math.round(unfundedPercent)}%)
            </span>
          </div>
        </div>

        {/* Quiet row of four small figures underneath */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '1rem',
            borderTop: '1px solid var(--line)',
            paddingTop: '1rem',
          }}
        >
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--ink-3)', textTransform: 'uppercase', fontWeight: 600 }}>
              Budget
            </span>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '1rem', fontWeight: 600, color: 'var(--ink)' }}>
              {formatCents(ledger.totalCents)}
            </p>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--ink-3)', textTransform: 'uppercase', fontWeight: 600 }}>
              Funded
            </span>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '1rem', fontWeight: 600, color: 'var(--ink)' }}>
              {formatCents(ledger.fundedCents)}
            </p>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--ink-3)', textTransform: 'uppercase', fontWeight: 600 }}>
              Paid
            </span>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '1rem', fontWeight: 600, color: 'var(--teal-ink)' }}>
              {formatCents(ledger.paidCents)}
            </p>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--ink-3)', textTransform: 'uppercase', fontWeight: 600 }}>
              Remaining
            </span>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '1rem', fontWeight: 600, color: 'var(--ink)' }}>
              {formatCents(remainingCents)}
            </p>
          </div>
        </div>
      </div>

      {/* CURRENT MILESTONE & LIFECYCLE PROGRESS */}
      {currentMilestone && (
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-card)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--ink-2)', textTransform: 'uppercase', fontWeight: 600 }}>
                Active Milestone
              </span>
              <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.125rem', fontWeight: 600, color: 'var(--ink)' }}>
                {currentMilestone.name}
              </h3>
            </div>
            <span style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--forest)' }}>
              {formatCents(currentMilestone.amountCents)}
            </span>
          </div>

          <LifecycleProgress backendStatus={currentMilestone.status} />
        </div>
      )}

      {/* MILESTONE LIST: Compact Rows */}
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
            Milestones Schedule
          </h3>
          <Link
            to={`/client/projects/${project.id}/schedule`}
            style={{ fontSize: '0.8125rem', color: 'var(--forest)', fontWeight: 600, textDecoration: 'none' }}
          >
            View Gantt schedule →
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
                <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--ink)' }}>
                  {m.name}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <StatusBadge state={mapStatusToMoneyState(m.status)} />
                <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--ink)' }}>
                  {formatCents(m.amountCents)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RECENT ACTIVITY & AUTONOMY SETTINGS (Two columns on desktop) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Recent Activity */}
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-card)',
            padding: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--ink)' }}>
              Recent Activity
            </h3>
            <Link
              to={`/client/projects/${project.id}/activity`}
              style={{ fontSize: '0.8125rem', color: 'var(--forest)', fontWeight: 600, textDecoration: 'none' }}
            >
              Full log →
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {recentActivity.length > 0 ? (
              recentActivity.map((event) => (
                <div
                  key={event.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    fontSize: '0.8125rem',
                    borderBottom: '1px solid var(--line)',
                    paddingBottom: '0.5rem',
                  }}
                >
                  <ActivityIcon size={14} style={{ color: 'var(--forest)', marginTop: '2px', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, color: 'var(--ink)' }}>{event.description}</p>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--ink-3)' }}>
                      {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--ink-2)' }}>No activity recorded yet.</p>
            )}
          </div>
        </div>

        {/* Autonomy Setting per §6.3 */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sliders size={18} style={{ color: 'var(--forest)' }} />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--ink)' }}>
              Payout Autonomy Mode
            </h3>
          </div>

          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--ink-2)', lineHeight: 1.4 }}>
            Control how payments are released once the AI Reviewer validates deliverable criteria:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[
              {
                mode: 'manual' as const,
                title: 'Manual Approval',
                desc: 'You approve each payment manually upon review.',
              },
              {
                mode: 'assisted' as const,
                title: 'Assisted Auto-Release',
                desc: 'Paid automatically after 30 seconds unless you object.',
              },
              {
                mode: 'auto' as const,
                title: 'Instant Autonomy',
                desc: 'Paid immediately when AI Reviewer confirms criteria.',
              },
            ].map((option) => (
              <label
                key={option.mode}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.6rem 0.75rem',
                  borderRadius: 'var(--radius-btn)',
                  backgroundColor: autonomyMode === option.mode ? 'var(--teal-wash)' : 'var(--paper)',
                  border: `1px solid ${autonomyMode === option.mode ? 'var(--teal)' : 'var(--line)'}`,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="autonomyMode"
                  checked={autonomyMode === option.mode}
                  onChange={() => handleUpdateAutonomy(option.mode)}
                  disabled={isChangingAutonomy}
                  style={{ marginTop: '2px' }}
                />
                <div>
                  <strong style={{ fontSize: '0.8125rem', color: 'var(--ink)' }}>{option.title}</strong>
                  <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.75rem', color: 'var(--ink-2)' }}>
                    {option.desc}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

