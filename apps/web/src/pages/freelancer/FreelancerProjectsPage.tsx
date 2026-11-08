import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, Search } from 'lucide-react';
import { Button } from '../../components/ui/Button.js';
import { ProjectRow } from '../../components/ui/ProjectRow.js';
import { EmptyState } from '../../components/ui/EmptyState.js';

interface ProjectSummary {
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

interface ProjectLedgerSummary {
  heldCents: number;
  paidCents: number;
  fundedCents: number;
}

export const FreelancerProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const [projectsList, setProjectsList] = useState<ProjectSummary[]>([]);
  const [ledgerMap, setLedgerMap] = useState<Record<string, ProjectLedgerSummary>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [inviteCodeInput, setInviteCodeInput] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function fetchFreelancerProjects() {
      try {
        setIsLoading(true);

        const res = await fetch('/api/projects', {
          headers: {
            'X-Persona': 'freelancer',
          },
        });

        if (!res.ok) {
          throw new Error('Failed to load freelancer projects');
        }

        const data = await res.json();
        if (isMounted && data.projects) {
          setProjectsList(data.projects);

          const ledgers: Record<string, ProjectLedgerSummary> = {};
          await Promise.all(
            data.projects.map(async (p: ProjectSummary) => {
              try {
                const ledgerRes = await fetch(`/api/projects/${p.id}/ledger`);
                if (ledgerRes.ok) {
                  const ledgerData = await ledgerRes.json();
                  ledgers[p.id] = {
                    heldCents: ledgerData.balances?.heldCents ?? 0,
                    paidCents: ledgerData.balances?.paidCents ?? 0,
                    fundedCents: ledgerData.balances?.fundedCents ?? 0,
                  };
                }
              } catch {
                // Ignore per-project ledger error
              }
            })
          );

          if (isMounted) {
            setLedgerMap(ledgers);
          }
        }
      } catch {
        if (isMounted) {
          setProjectsList([]);
          setLedgerMap({});
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchFreelancerProjects();
    return () => {
      isMounted = false;
    };
  }, []);

  function getStateSentence(project: ProjectSummary): string {
    if (project.status === 'draft' || project.status === 'planned') {
      return 'Waiting for client to fund holding balance in PayPal Sandbox.';
    }
    if (project.status === 'funded' || project.status === 'active') {
      return 'Funded and locked in PayPal sandbox. You can start working.';
    }
    if (project.status === 'closed') {
      return 'Project completed. All milestone payouts released.';
    }
    return 'Active milestone agreement';
  }

  function getNextAction(project: ProjectSummary): { label: string; action: () => void } {
    if (project.status === 'funded' || project.status === 'active') {
      return {
        label: 'Deliverables',
        action: () => navigate(`/freelancer/projects/${project.id}/deliverables`),
      };
    }
    return {
      label: 'Open project',
      action: () => navigate(`/freelancer/projects/${project.id}`),
    };
  }

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCodeInput.trim()) return;
    let clean = inviteCodeInput.trim();
    if (clean.includes('/join/')) {
      clean = clean.split('/join/').pop()?.trim() || clean;
    }
    navigate(`/join/${encodeURIComponent(clean)}`);
  };

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
      {/* Header */}
      <div>
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
          Freelancer Projects
        </h1>
        <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--ink-2)' }}>
          Work agreements with verified milestone holding balances and automated AI delivery evaluations.
        </p>
      </div>

      {/* Entry point: Quick Join Input per §7.1 */}
      <div
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-card)',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--ink)' }}>
            Have an invitation code?
          </h3>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8125rem', color: 'var(--ink-2)' }}>
            Join a new project agreement shared by your client.
          </p>
        </div>

        <form onSubmit={handleJoinSubmit} style={{ display: 'flex', gap: '0.5rem', flex: '1', maxWidth: '360px' }}>
          <input
            type="text"
            value={inviteCodeInput}
            onChange={(e) => setInviteCodeInput(e.target.value)}
            placeholder="e.g. MILE-XXXXXXXXXX"
            style={{
              flex: 1,
              padding: '0.5rem 0.75rem',
              fontSize: '0.875rem',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-btn)',
              fontFamily: 'monospace',
            }}
          />
          <Button
            type="submit"
            variant="primary"
            disabled={!inviteCodeInput.trim()}
            leftIcon={<Search size={14} />}
          >
            Join
          </Button>
        </form>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[1, 2].map((n) => (
            <div
              key={n}
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-card)',
                height: '88px',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      )}

      {/* Projects List */}
      {!isLoading && projectsList.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {projectsList.map((project) => {
            const nextAction = getNextAction(project);
            const ledger = ledgerMap[project.id] || { heldCents: 0, paidCents: 0, fundedCents: 0 };

            return (
              <ProjectRow
                key={project.id}
                id={project.id}
                title={project.title}
                stateSentence={getStateSentence(project)}
                heldCents={ledger.heldCents}
                paidCents={ledger.paidCents}
                totalCents={project.totalCents}
                nextActionLabel={nextAction.label}
                onNextAction={nextAction.action}
                onClick={() => navigate(`/freelancer/projects/${project.id}`)}
                isDemo={project.isDemo}
              />
            );
          })}
        </div>
      )}

      {/* Empty State per §7.1 */}
      {!isLoading && projectsList.length === 0 && (
        <EmptyState
          icon={<FolderKanban size={40} style={{ color: 'var(--forest)' }} />}
          title="No projects yet. Join one with an invite."
          description="When a client invites you with an agreement code, enter it above to review milestones and begin work."
          actionLabel="Enter code at /join"
          onAction={() => navigate('/join')}
        />
      )}
    </div>
  );
};
