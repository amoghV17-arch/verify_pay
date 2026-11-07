import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, FolderKanban } from 'lucide-react';
import { Button } from '../../components/ui/Button.js';
import { ProjectRow } from '../../components/ui/ProjectRow.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { FALLBACK_PROJECT } from '../../data/fallbackData.js';

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

export const ClientProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const [projectsList, setProjectsList] = useState<ProjectSummary[]>([]);
  const [ledgerMap, setLedgerMap] = useState<Record<string, ProjectLedgerSummary>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchProjects() {
      try {
        setIsLoading(true);
        setError(null);

        const res = await fetch('/api/projects', {
          headers: {
            'X-Persona': 'client',
          },
        });

        if (!res.ok) {
          throw new Error(`Failed to load projects: ${res.statusText}`);
        }

        const data = await res.json();
        if (isMounted && data.projects) {
          setProjectsList(data.projects);

          // Fetch ledger balances for each project in parallel
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
                // Ignore per-project ledger fetch error
              }
            })
          );

          if (isMounted) {
            setLedgerMap(ledgers);
          }
        }
      } catch (err) {
        if (isMounted) {
          setProjectsList([FALLBACK_PROJECT]);
          setLedgerMap({
            [FALLBACK_PROJECT.id]: {
              heldCents: 680000,
              paidCents: 120000,
              fundedCents: 800000,
            },
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchProjects();
    return () => {
      isMounted = false;
    };
  }, []);

  function getStateSentence(project: ProjectSummary): string {
    if (!project.freelancerId) {
      return 'Waiting for the freelancer to accept invitation';
    }
    if (project.status === 'draft' || project.status === 'planned') {
      return 'Project agreement accepted. Fund holding balance to start.';
    }
    if (project.status === 'funded' || project.status === 'active') {
      return 'Milestone in progress. Work protected in PayPal sandbox.';
    }
    if (project.status === 'closed') {
      return 'All milestones completed and paid.';
    }
    return 'Active milestone agreement';
  }

  function getNextAction(project: ProjectSummary): { label: string; action: () => void } {
    if (!project.freelancerId) {
      return {
        label: 'View invite',
        action: () => navigate(`/client/projects/${project.id}`),
      };
    }
    if (project.status === 'draft' || project.status === 'planned') {
      return {
        label: 'Fund project',
        action: () => navigate(`/client/projects/${project.id}`),
      };
    }
    return {
      label: 'Open project',
      action: () => navigate(`/client/projects/${project.id}`),
    };
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
      {/* Header with Title and New Project CTA */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
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
            Client Projects
          </h1>
          <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--ink-2)' }}>
            Manage your AI-reviewed milestone agreements, funding holding, and payouts.
          </p>
        </div>

        <Link to="/client/new" style={{ textDecoration: 'none' }}>
          <Button variant="primary" leftIcon={<Plus size={16} />}>
            New project
          </Button>
        </Link>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[1, 2, 3].map((n) => (
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

      {/* Error state */}
      {!isLoading && error && (
        <div
          style={{
            backgroundColor: 'var(--amber-wash)',
            border: '1px solid var(--amber)',
            borderRadius: 'var(--radius-card)',
            padding: '1.25rem',
            color: 'var(--ink)',
            marginBottom: '1.5rem',
          }}
        >
          <p style={{ margin: 0, fontWeight: 500 }}>Unable to load projects</p>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: 'var(--ink-2)' }}>
            {error}
          </p>
        </div>
      )}

      {/* Projects List */}
      {!isLoading && !error && projectsList.length > 0 && (
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
                onClick={() => navigate(`/client/projects/${project.id}`)}
                isDemo={project.isDemo}
              />
            );
          })}
        </div>
      )}

      {/* Empty State per docs/UI_IMPLEMENTATION.md §6.1 */}
      {!isLoading && !error && projectsList.length === 0 && (
        <EmptyState
          icon={<FolderKanban size={40} style={{ color: 'var(--forest)' }} />}
          title="No projects yet. Start with a brief."
          description="Create a clear project agreement with milestone deliverables, verifiable acceptance criteria, and PayPal holding protection."
          actionLabel="Create project agreement"
          onAction={() => navigate('/client/new')}
        />
      )}
    </div>
  );
};

