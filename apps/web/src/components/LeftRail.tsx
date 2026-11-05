import React from 'react';
import { formatCents } from '@milestone/shared';

export interface ProjectListItem {
  id: string;
  title: string;
  status: string;
  totalCents: number;
}

interface LeftRailProps {
  currentProjectId: string;
  projects: ProjectListItem[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onSelectProject: (id: string) => void;
  onNewPlan: () => void;
  onOpenCloseout: () => void;
  onExportAudit: () => void;
}

export const LeftRail: React.FC<LeftRailProps> = ({
  currentProjectId,
  projects,
  isCollapsed,
  onToggleCollapse,
  onSelectProject,
  onNewPlan,
  onOpenCloseout,
  onExportAudit,
}) => {
  return (
    <nav
      id="left-rail"
      aria-label="Projects navigation"
      style={{
        width: isCollapsed ? '56px' : '240px',
        minWidth: isCollapsed ? '56px' : '240px',
        backgroundColor: 'var(--paper)',
        borderRight: '1px solid var(--line)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Top Header & Collapse Toggle */}
      <div
        style={{
          padding: '0.75rem 0.875rem',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
        }}
      >
        {!isCollapsed && (
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--slate)',
            }}
          >
            Projects
          </span>
        )}
        <button
          id="toggle-left-rail-btn"
          type="button"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? 'Expand projects rail' : 'Collapse projects rail'}
          title={isCollapsed ? 'Expand projects rail' : 'Collapse projects rail'}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--slate)',
            cursor: 'pointer',
            padding: '0.25rem 0.4rem',
            borderRadius: '4px',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isCollapsed ? '»' : '«'}
        </button>
      </div>

      {/* Projects List */}
      <div style={{ flex: 1, padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', overflowY: 'auto' }}>
        {projects.map((proj) => {
          const isSelected = proj.id === currentProjectId;
          return (
            <button
              key={proj.id}
              type="button"
              onClick={() => onSelectProject(proj.id)}
              aria-current={isSelected ? 'page' : undefined}
              title={isCollapsed ? proj.title : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                padding: isCollapsed ? '0.625rem' : '0.5rem 0.75rem',
                borderRadius: '6px',
                border: isSelected ? '1px solid var(--line)' : '1px solid transparent',
                backgroundColor: isSelected ? 'var(--chalk)' : 'transparent',
                color: isSelected ? 'var(--ink)' : 'var(--slate)',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                boxSizing: 'border-box',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor:
                    proj.status === 'active' || proj.status === 'funded'
                      ? 'var(--settled)'
                      : proj.status === 'planned'
                        ? 'var(--tide)'
                        : 'var(--slate)',
                  flexShrink: 0,
                }}
              />
              {!isCollapsed && (
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: isSelected ? 600 : 500,
                      color: isSelected ? 'var(--ink)' : 'var(--slate)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {proj.title}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--slate)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCents(proj.totalCents)} · {proj.status}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Actions */}
      <div
        style={{
          borderTop: '1px solid var(--line)',
          padding: '0.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
        }}
      >
        <button
          id="rail-new-plan-btn"
          type="button"
          onClick={onNewPlan}
          title="Create New AI Delivery Plan"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            gap: '0.5rem',
            padding: '0.5rem 0.65rem',
            borderRadius: '6px',
            border: '1px solid var(--line)',
            backgroundColor: 'var(--paper)',
            color: 'var(--tide)',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: 'pointer',
            width: '100%',
          }}
        >
          <span>✨</span>
          {!isCollapsed && <span>New Plan</span>}
        </button>

        <button
          id="rail-closeout-receipt-btn"
          type="button"
          onClick={onOpenCloseout}
          title="View Closeout Receipt"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            gap: '0.5rem',
            padding: '0.5rem 0.65rem',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: 'transparent',
            color: 'var(--slate)',
            fontSize: '0.8125rem',
            fontWeight: 500,
            cursor: 'pointer',
            width: '100%',
          }}
        >
          <span>🧾</span>
          {!isCollapsed && <span>Closeout Receipt</span>}
        </button>

        <button
          id="rail-audit-export-btn"
          type="button"
          onClick={onExportAudit}
          title="Download Audit Trail JSON"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            gap: '0.5rem',
            padding: '0.5rem 0.65rem',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: 'transparent',
            color: 'var(--slate)',
            fontSize: '0.8125rem',
            fontWeight: 500,
            cursor: 'pointer',
            width: '100%',
          }}
        >
          <span>📥</span>
          {!isCollapsed && <span>Audit JSON</span>}
        </button>
      </div>
    </nav>
  );
};

