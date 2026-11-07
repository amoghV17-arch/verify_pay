import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { X, CheckCircle2, Clock, ExternalLink, Calendar, ShieldCheck } from 'lucide-react';
import { formatCents } from '@milestone/shared';
import { getStatusGlyph, formatStatusLabel } from '../Gantt.js';

export interface TaskInspectorData {
  id: string;
  name: string;
  startDate?: string;
  duration?: number;
  percentDone?: number;
  milestone?: boolean;
  isMilestone?: boolean;
  milestoneId?: string;
  amountCents?: number;
  paymentStatus?: string;
  deliverableType?: string;
  acceptanceCriteria?: Array<{
    id: string;
    description: string;
    passed?: boolean;
    evidence?: string;
  }>;
}

interface TaskInspectorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskInspectorData | null;
  projectId: string;
  role?: 'client' | 'freelancer';
}

export const TaskInspectorPanel: React.FC<TaskInspectorPanelProps> = ({
  isOpen,
  onClose,
  task,
  projectId,
  role = 'client',
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !task) {
    return null;
  }

  const isMilestone = Boolean(task.isMilestone || task.milestone || task.milestoneId || (task.amountCents && task.amountCents > 0));
  const milestoneId = task.milestoneId || (isMilestone ? task.id : undefined);
  const status = task.paymentStatus ?? (isMilestone ? 'unfunded' : '');
  const glyph = getStatusGlyph(status);
  const statusLabel = formatStatusLabel(status);
  const percent = task.percentDone ?? 0;
  const criteria = task.acceptanceCriteria || [];

  return (
    <aside
      ref={panelRef}
      aria-label="Task and milestone inspector"
      data-testid="task-inspector-panel"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: '380px',
        maxWidth: '100vw',
        backgroundColor: 'var(--paper)',
        borderLeft: '1px solid var(--line)',
        boxShadow: '-4px 0 20px rgba(22, 32, 43, 0.08)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        animation: 'slideInRight 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--line)',
          backgroundColor: 'var(--chalk)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '24px',
              borderRadius: isMilestone ? '4px' : '6px',
              transform: isMilestone ? 'rotate(45deg)' : 'none',
              backgroundColor: isMilestone ? 'var(--tide)' : 'var(--slate)',
              color: '#FFFFFF',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
          >
            <span style={{ transform: isMilestone ? 'rotate(-45deg)' : 'none' }}>
              {isMilestone ? '◆' : '■'}
            </span>
          </span>
          <div>
            <span
              style={{
                fontFamily: 'Bricolage Grotesque, sans-serif',
                fontSize: '0.9375rem',
                fontWeight: 600,
                color: 'var(--ink)',
              }}
            >
              {isMilestone ? 'Milestone Inspector' : 'Task Inspector'}
            </span>
            <span
              className="mono"
              style={{
                display: 'block',
                fontSize: '0.6875rem',
                color: 'var(--slate)',
              }}
            >
              ID: {task.id}
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          aria-label="Close inspector"
          data-testid="inspector-close-btn"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--slate)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Title & Badge */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span
              style={{
                fontSize: '0.6875rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: isMilestone ? 'rgba(31, 122, 140, 0.1)' : 'var(--chalk)',
                color: isMilestone ? 'var(--tide)' : 'var(--slate)',
              }}
            >
              {isMilestone ? 'Milestone with Funds' : 'Standard Work Task'}
            </span>
            {task.deliverableType && (
              <span
                style={{
                  fontSize: '0.6875rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--chalk)',
                  color: 'var(--slate)',
                }}
              >
                {task.deliverableType}
              </span>
            )}
          </div>
          <h3
            style={{
              fontFamily: 'Bricolage Grotesque, sans-serif',
              fontSize: '1.25rem',
              fontWeight: 600,
              color: 'var(--ink)',
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            {task.name}
          </h3>
        </div>

        {/* Milestone Financial & Payment State Card */}
        {isMilestone && (
          <div
            style={{
              backgroundColor: 'var(--chalk)',
              border: '1px solid var(--line)',
              borderRadius: '8px',
              padding: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Milestone Amount
                </span>
                <div
                  className="mono"
                  style={{
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    color: 'var(--ink)',
                    marginTop: '2px',
                  }}
                >
                  {task.amountCents ? formatCents(task.amountCents) : '$0.00'}
                </div>
              </div>
              <div
                className={`status-pill ${status}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                }}
              >
                <span>{glyph}</span>
                <span>{statusLabel}</span>
              </div>
            </div>

            {/* Direct Review Link */}
            {milestoneId && (
              <Link
                to={
                  role === 'client'
                    ? `/client/projects/${projectId}/deliverables/${milestoneId}`
                    : `/freelancer/projects/${projectId}/deliverables/${milestoneId}`
                }
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  width: '100%',
                  padding: '0.625rem 1rem',
                  borderRadius: '6px',
                  backgroundColor: 'var(--paper)',
                  border: '1px solid var(--line)',
                  color: 'var(--tide)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  textAlign: 'center',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <span>Review deliverable & criteria</span>
                <ExternalLink size={14} />
              </Link>
            )}
          </div>
        )}

        {/* Schedule & Progress Metrics */}
        <div>
          <h4
            style={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--slate)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Calendar size={14} />
            <span>Schedule Details</span>
          </h4>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.75rem',
              marginBottom: '1rem',
            }}
          >
            <div
              style={{
                padding: '0.75rem',
                backgroundColor: 'var(--surface, #FAFCFD)',
                border: '1px solid var(--line)',
                borderRadius: '6px',
              }}
            >
              <div style={{ fontSize: '0.6875rem', color: 'var(--slate)' }}>Start Date</div>
              <div className="mono" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink)', marginTop: '2px' }}>
                {task.startDate || 'Not scheduled'}
              </div>
            </div>
            <div
              style={{
                padding: '0.75rem',
                backgroundColor: 'var(--surface, #FAFCFD)',
                border: '1px solid var(--line)',
                borderRadius: '6px',
              }}
            >
              <div style={{ fontSize: '0.6875rem', color: 'var(--slate)' }}>Duration</div>
              <div className="mono" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink)', marginTop: '2px' }}>
                {isMilestone ? 'Milestone (0d)' : `${task.duration ?? 1} day${task.duration === 1 ? '' : 's'}`}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
              <span style={{ color: 'var(--slate)' }}>Completion Progress</span>
              <span className="mono" style={{ fontWeight: 600, color: 'var(--ink)' }}>{percent}%</span>
            </div>
            <div
              style={{
                height: '8px',
                width: '100%',
                backgroundColor: 'var(--line)',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${percent}%`,
                  backgroundColor: percent === 100 ? 'var(--settled)' : 'var(--tide)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        </div>

        {/* Acceptance Criteria (for milestones) */}
        {isMilestone && (
          <div>
            <h4
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--slate)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <ShieldCheck size={14} />
              <span>Agreed Acceptance Criteria ({criteria.length})</span>
            </h4>

            {criteria.length === 0 ? (
              <p style={{ fontSize: '0.8125rem', color: 'var(--slate)', margin: 0 }}>
                No criteria specified for this milestone.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {criteria.map((c, i) => (
                  <div
                    key={c.id || i}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '6px',
                      backgroundColor: c.passed ? 'rgba(21, 115, 71, 0.04)' : 'var(--chalk)',
                      border: `1px solid ${c.passed ? 'rgba(21, 115, 71, 0.2)' : 'var(--line)'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <span style={{ marginTop: '2px', color: c.passed ? 'var(--settled)' : 'var(--slate)' }}>
                        {c.passed ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--ink)', fontWeight: 500, lineHeight: 1.4 }}>
                          {c.description}
                        </div>
                        {c.evidence && (
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--slate)',
                              marginTop: '4px',
                              fontFamily: 'monospace',
                              backgroundColor: 'rgba(0, 0, 0, 0.03)',
                              padding: '3px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            Evidence: {c.evidence}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
