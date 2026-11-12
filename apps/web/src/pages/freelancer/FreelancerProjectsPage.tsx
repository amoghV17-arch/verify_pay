import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, Search } from 'lucide-react';
import { Button } from '../../components/ui/Button.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { apiRawFetch } from '../../lib/api.js';
import {
  ProjectCategoryList,
  type ProjectListItem,
} from '../../components/ui/ProjectCategoryList.js';
import {
  extractLedgerBalances,
  isProjectCompletedStatus,
  type NormalizedBalances,
} from '../../lib/projectHelpers.js';

export const FreelancerProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const [projectsList, setProjectsList] = useState<ProjectListItem[]>([]);
  const [ledgerMap, setLedgerMap] = useState<Record<string, NormalizedBalances>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [inviteCodeInput, setInviteCodeInput] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function fetchFreelancerProjects() {
      try {
        setIsLoading(true);

        const res = await apiRawFetch('/api/projects');

        if (!res.ok) {
          throw new Error('Failed to load freelancer projects');
        }

        const data = await res.json();
        if (isMounted && Array.isArray(data.projects)) {
          const loadedProjects: ProjectListItem[] = (data.projects as ProjectListItem[]).filter(
            (p) => Boolean(p.freelancerId) && p.status !== 'draft'
          );
          setProjectsList(loadedProjects);

          const ledgers: Record<string, NormalizedBalances> = {};
          await Promise.all(
            loadedProjects.map(async (p) => {
              if (p.balances) {
                ledgers[p.id] = extractLedgerBalances(p.balances);
                return;
              }
              try {
                const ledgerRes = await apiRawFetch(`/api/projects/${p.id}/ledger`);
                if (ledgerRes.ok) {
                  const ledgerData = await ledgerRes.json();
                  ledgers[p.id] = extractLedgerBalances(ledgerData);
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

  function getNextAction(project: ProjectListItem): { label: string; action: () => void } {
    if (isProjectCompletedStatus(project)) {
      return {
        label: 'Receipts',
        action: () => navigate(`/freelancer/projects/${project.id}/payments`),
      };
    }
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
        <ProjectCategoryList
          projects={projectsList}
          ledgerMap={ledgerMap}
          role="freelancer"
          getNextAction={getNextAction}
          onProjectClick={(project) => navigate(`/freelancer/projects/${project.id}`)}
        />
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
