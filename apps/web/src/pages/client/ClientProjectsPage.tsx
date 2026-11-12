import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, FolderKanban } from 'lucide-react';
import { formatCents } from '@milestone/shared';
import { Button } from '../../components/ui/Button.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { Dialog } from '../../components/ui/Dialog.js';
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

export const ClientProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const [projectsList, setProjectsList] = useState<ProjectListItem[]>([]);
  const [ledgerMap, setLedgerMap] = useState<Record<string, NormalizedBalances>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [projectToDelete, setProjectToDelete] = useState<ProjectListItem | null>(null);
  const [projectToManage, setProjectToManage] = useState<ProjectListItem | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await apiRawFetch('/api/projects');

      if (!res.ok) {
        throw new Error(`Failed to load projects: ${res.statusText}`);
      }

      const data = await res.json();
      const loadedProjects: ProjectListItem[] = Array.isArray(data.projects) ? data.projects : [];
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
            // Ignore per-project ledger fetch error
          }
        })
      );

      setLedgerMap(ledgers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load projects');
      setProjectsList([]);
      setLedgerMap({});
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    setIsMutating(true);
    setMutationError(null);
    try {
      const res = await apiRawFetch(`/api/projects/${projectToDelete.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || 'Failed to delete project');
      }
      setProjectToDelete(null);
      await fetchProjects();
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to delete project');
    } finally {
      setIsMutating(false);
    }
  };

  const handleUpdateProjectStatus = async (status: 'cancelled' | 'failed') => {
    if (!projectToManage) return;
    setIsMutating(true);
    setMutationError(null);
    try {
      const res = await apiRawFetch(`/api/projects/${projectToManage.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || 'Failed to update project status');
      }
      setProjectToManage(null);
      await fetchProjects();
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to update project status');
    } finally {
      setIsMutating(false);
    }
  };

  function getNextAction(project: ProjectListItem): { label: string; action: () => void } {
    if (
      isProjectCompletedStatus(project) ||
      project.status === 'cancelled' ||
      project.status === 'failed'
    ) {
      return {
        label: 'Open project',
        action: () => navigate(`/client/projects/${project.id}`),
      };
    }
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
        <ProjectCategoryList
          projects={projectsList}
          ledgerMap={ledgerMap}
          role="client"
          getNextAction={getNextAction}
          onProjectClick={(project) => navigate(`/client/projects/${project.id}`)}
          onManageStatus={(project) => {
            setMutationError(null);
            setProjectToManage(project);
          }}
          onDeleteProject={(project) => {
            setMutationError(null);
            setProjectToDelete(project);
          }}
        />
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

      {/* Delete Project Confirmation Dialog */}
      <Dialog
        isOpen={Boolean(projectToDelete)}
        onClose={() => {
          if (!isMutating) {
            setProjectToDelete(null);
            setMutationError(null);
          }
        }}
        title="Delete project permanently?"
        description={
          projectToDelete
            ? `This will remove "${projectToDelete.title}" along with its milestones, tasks, deliverables, reviews, and audit records.`
            : undefined
        }
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button
              variant="secondary"
              disabled={isMutating}
              onClick={() => {
                setProjectToDelete(null);
                setMutationError(null);
              }}
            >
              Keep project
            </Button>
            <Button
              variant="destructive"
              isLoading={isMutating}
              onClick={handleConfirmDelete}
              data-testid="confirm-delete-project-btn"
            >
              Delete project
            </Button>
          </div>
        }
      >
        {projectToDelete && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--ink-2)' }}>
            {(ledgerMap[projectToDelete.id]?.heldCents ?? extractLedgerBalances(projectToDelete).heldCents) > 0 && (
              <div
                style={{
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-input)',
                  backgroundColor: 'rgba(200, 64, 47, 0.08)',
                  border: '1px solid rgba(200, 64, 47, 0.25)',
                  color: '#C8402F',
                }}
              >
                Note: {formatCents(ledgerMap[projectToDelete.id]?.heldCents ?? extractLedgerBalances(projectToDelete).heldCents)} is currently recorded in sandbox holding. Deleting removes local project records only.
              </div>
            )}
            {mutationError && (
              <div role="alert" style={{ color: '#C8402F', fontWeight: 500 }}>
                {mutationError}
              </div>
            )}
          </div>
        )}
      </Dialog>

      {/* Cancel / Mark Failed Dialog */}
      <Dialog
        isOpen={Boolean(projectToManage)}
        onClose={() => {
          if (!isMutating) {
            setProjectToManage(null);
            setMutationError(null);
          }
        }}
        title="Update project status"
        description={
          projectToManage
            ? `Choose how to categorize "${projectToManage.title}".`
            : undefined
        }
      >
        {projectToManage && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>
              Cancelled or failed projects are moved out of Ongoing and synced across both Client and Freelancer workspaces.
            </p>
            {mutationError && (
              <div role="alert" style={{ color: '#C8402F', fontSize: '0.875rem', fontWeight: 500 }}>
                {mutationError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Button
                variant="secondary"
                disabled={isMutating}
                onClick={() => setProjectToManage(null)}
              >
                Back
              </Button>
              <Button
                variant="secondary"
                disabled={isMutating}
                onClick={() => handleUpdateProjectStatus('cancelled')}
                data-testid="mark-project-cancelled-btn"
              >
                Cancel project
              </Button>
              <Button
                variant="destructive"
                disabled={isMutating}
                onClick={() => handleUpdateProjectStatus('failed')}
                data-testid="mark-project-failed-btn"
              >
                Mark as failed
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

