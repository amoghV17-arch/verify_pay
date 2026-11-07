import React from 'react';
import { Link } from 'react-router-dom';
import { Monitor, Eye, ExternalLink } from 'lucide-react';
import { formatCents } from '@milestone/shared';
import { getStatusGlyph, formatStatusLabel } from '../Gantt.js';
import type { TaskInspectorData } from './TaskInspectorPanel.js';

interface ScheduleListViewProps {
  tasks: TaskInspectorData[];
  projectId: string;
  role?: 'client' | 'freelancer';
  onSelectTask: (task: TaskInspectorData) => void;
  onSwitchToGantt?: () => void;
  isMobileFallback?: boolean;
}

export const ScheduleListView: React.FC<ScheduleListViewProps> = ({
  tasks,
  projectId,
  role = 'client',
  onSelectTask,
  onSwitchToGantt,
  isMobileFallback = false,
}) => {
  return (
    <div
      data-testid="schedule-list-view"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '1.5rem',
      }}
    >
      {/* Mobile / Screen size advisory notice */}
      {isMobileFallback && (
        <div
          data-testid="mobile-gantt-advisory"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            padding: '1rem 1.25rem',
            backgroundColor: 'rgba(31, 122, 140, 0.06)',
            border: '1px solid rgba(31, 122, 140, 0.2)',
            borderRadius: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <Monitor size={20} style={{ color: 'var(--tide)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink)' }}>
                Mobile Schedule View
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--slate)', margin: '2px 0 0', lineHeight: 1.4 }}>
                The interactive Gantt chart is optimized for larger displays. Below is the full sequential schedule. You can still switch to the interactive Gantt chart anytime.
              </p>
            </div>
          </div>
          {onSwitchToGantt && (
            <div>
              <button
                type="button"
                onClick={onSwitchToGantt}
                data-testid="switch-to-gantt-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--tide)',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <span>Switch to Gantt View</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Task & Milestone List Table */}
      <div
        style={{
          backgroundColor: 'var(--paper)',
          border: '1px solid var(--line)',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(22, 32, 43, 0.04)',
        }}
      >
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--line)',
            backgroundColor: 'var(--chalk)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3
            style={{
              margin: 0,
              fontFamily: 'Bricolage Grotesque, sans-serif',
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--ink)',
            }}
          >
            Project Schedule & Deliverable Sequence
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--slate)' }}>
            {tasks.length} total items
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.875rem',
              textAlign: 'left',
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--line)',
                  backgroundColor: 'var(--surface, #FAFCFD)',
                  color: 'var(--slate)',
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                <th style={{ padding: '0.75rem 1rem', width: '48px' }}>#</th>
                <th style={{ padding: '0.75rem 1rem' }}>Task / Milestone</th>
                <th style={{ padding: '0.75rem 1rem' }}>Start Date</th>
                <th style={{ padding: '0.75rem 1rem' }}>Duration</th>
                <th style={{ padding: '0.75rem 1rem' }}>Progress</th>
                <th style={{ padding: '0.75rem 1rem' }}>Payment Status</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center', width: '130px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task, idx) => {
                const isMilestone = Boolean(task.isMilestone || task.milestone || task.milestoneId || (task.amountCents && task.amountCents > 0));
                const milestoneId = task.milestoneId || (isMilestone ? task.id : undefined);
                const status = task.paymentStatus ?? (isMilestone ? 'unfunded' : '');
                const glyph = getStatusGlyph(status);
                const statusLabel = formatStatusLabel(status);
                const percent = task.percentDone ?? 0;

                return (
                  <tr
                    key={task.id}
                    data-testid={`list-item-${task.id}`}
                    style={{
                      borderBottom: '1px solid var(--line)',
                      backgroundColor: isMilestone ? 'rgba(31, 122, 140, 0.02)' : 'transparent',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = isMilestone ? 'rgba(31, 122, 140, 0.06)' : 'var(--chalk)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = isMilestone ? 'rgba(31, 122, 140, 0.02)' : 'transparent';
                    }}
                  >
                    {/* Index */}
                    <td className="mono" style={{ padding: '0.875rem 1rem', color: 'var(--slate)', fontSize: '0.8125rem' }}>
                      {idx + 1}
                    </td>

                    {/* Name & Type */}
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '18px',
                            height: '18px',
                            borderRadius: isMilestone ? '3px' : '4px',
                            transform: isMilestone ? 'rotate(45deg)' : 'none',
                            backgroundColor: isMilestone ? 'var(--tide)' : 'var(--line)',
                            color: isMilestone ? '#FFFFFF' : 'var(--slate)',
                            fontSize: '0.625rem',
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          <span style={{ transform: isMilestone ? 'rotate(-45deg)' : 'none' }}>
                            {isMilestone ? '◆' : '■'}
                          </span>
                        </span>
                        <div>
                          <div style={{ fontWeight: isMilestone ? 600 : 500, color: 'var(--ink)' }}>
                            {task.name}
                          </div>
                          {task.deliverableType && (
                            <span style={{ fontSize: '0.6875rem', color: 'var(--slate)' }}>
                              Deliverable: {task.deliverableType}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Start Date */}
                    <td className="mono" style={{ padding: '0.875rem 1rem', color: 'var(--slate)', fontSize: '0.8125rem' }}>
                      {task.startDate || '—'}
                    </td>

                    {/* Duration */}
                    <td className="mono" style={{ padding: '0.875rem 1rem', color: 'var(--slate)', fontSize: '0.8125rem' }}>
                      {isMilestone ? '0d (Milestone)' : `${task.duration ?? 1}d`}
                    </td>

                    {/* Progress */}
                    <td style={{ padding: '0.875rem 1rem', minWidth: '120px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div
                          style={{
                            flex: 1,
                            height: '6px',
                            backgroundColor: 'var(--line)',
                            borderRadius: '3px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${percent}%`,
                              backgroundColor: percent === 100 ? 'var(--settled)' : 'var(--tide)',
                            }}
                          />
                        </div>
                        <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--slate)', width: '32px' }}>
                          {percent}%
                        </span>
                      </div>
                    </td>

                    {/* Payment Status (Milestones only) */}
                    <td style={{ padding: '0.875rem 1rem' }}>
                      {isMilestone && status ? (
                        <span
                          className={`status-pill ${status}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                          }}
                        >
                          <span>{glyph}</span>
                          <span>{statusLabel}</span>
                        </span>
                      ) : (
                        <span style={{ color: 'var(--slate)', fontSize: '0.75rem' }}>—</span>
                      )}
                    </td>

                    {/* Amount (Milestones only) */}
                    <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                      {isMilestone && task.amountCents ? (
                        <span
                          className="mono"
                          style={{
                            fontWeight: 700,
                            color: 'var(--ink)',
                            fontFamily: 'Instrument Sans, sans-serif',
                          }}
                        >
                          {formatCents(task.amountCents)}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--slate)', fontSize: '0.75rem' }}>—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => onSelectTask(task)}
                          title="Inspect Task"
                          data-testid={`inspect-btn-${task.id}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid var(--line)',
                            backgroundColor: 'var(--paper)',
                            color: 'var(--slate)',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                          }}
                        >
                          <Eye size={14} style={{ marginRight: '4px' }} />
                          <span>Inspect</span>
                        </button>

                        {isMilestone && milestoneId && (
                          <Link
                            to={
                              role === 'client'
                                ? `/client/projects/${projectId}/deliverables/${milestoneId}`
                                : `/freelancer/projects/${projectId}/deliverables/${milestoneId}`
                            }
                            title="View Review"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '4px 6px',
                              borderRadius: '4px',
                              border: '1px solid var(--line)',
                              backgroundColor: 'var(--paper)',
                              color: 'var(--tide)',
                              fontSize: '0.75rem',
                            }}
                          >
                            <ExternalLink size={14} />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
