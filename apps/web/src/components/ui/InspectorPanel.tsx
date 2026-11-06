import React from 'react';
import { X, Calendar, CheckCircle2, Clock } from 'lucide-react';
import { formatCents } from '@milestone/shared';
import { IconButton, Button } from './Button.js';
import { StatusBadge, type MoneyState } from './StatusBadge.js';
import { LifecycleProgress } from './LifecycleProgress.js';

export interface InspectorTask {
  id: string;
  name: string;
  isMilestone: boolean;
  amountCents?: number;
  paymentStatus?: MoneyState;
  backendStatus?: string;
  startDate?: string;
  durationDays?: number;
  percentDone?: number;
  acceptanceCriteria?: string[];
  deliverableType?: string;
}

export interface InspectorPanelProps {
  task: InspectorTask | null;
  onClose: () => void;
  onOpenReview?: (milestoneId: string) => void;
  onSubmitDeliverable?: (milestoneId: string) => void;
  isFreelancer?: boolean;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  task,
  onClose,
  onOpenReview,
  onSubmitDeliverable,
  isFreelancer,
}) => {
  if (!task) return null;

  return (
    <aside
      aria-label="Task inspector details"
      style={{
        width: '360px',
        height: '100%',
        backgroundColor: 'var(--surface)',
        borderLeft: '1px solid var(--line)',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '0.75rem',
        }}
      >
        <div>
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              color: 'var(--ink-2)',
            }}
          >
            {task.isMilestone ? 'Financial Milestone' : 'Schedule Task'}
          </span>
          <h3
            style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--ink)',
              margin: '0.2rem 0 0 0',
              lineHeight: 1.3,
            }}
          >
            {task.name}
          </h3>
        </div>
        <IconButton icon={<X size={16} />} label="Close inspector" size="sm" onClick={onClose} />
      </div>

      {/* Body */}
      <div
        style={{
          padding: '1.25rem',
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          fontSize: '0.875rem',
        }}
      >
        {/* Money & Status Section (for milestones) */}
        {task.isMilestone && (
          <div
            style={{
              backgroundColor: 'var(--paper)',
              padding: '1rem',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--line)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--ink-2)' }}>Milestone Payout</span>
              <span
                className="tabular-nums"
                style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--ink)' }}
              >
                {formatCents(task.amountCents ?? 0)}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--ink-2)' }}>State</span>
              <StatusBadge state={task.paymentStatus || 'agreed'} size="sm" />
            </div>

            {task.backendStatus && (
              <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--line)' }}>
                <LifecycleProgress backendStatus={task.backendStatus} variant="compact" />
              </div>
            )}
          </div>
        )}

        {/* Schedule Timing */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <h4 style={{ fontSize: '0.8125rem', color: 'var(--ink-2)', margin: 0 }}>Timing</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8125rem' }}>
            {task.startDate && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={14} color="var(--ink-2)" />
                <span>Starts: {task.startDate}</span>
              </div>
            )}
            {task.durationDays !== undefined && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={14} color="var(--ink-2)" />
                <span>Duration: {task.durationDays} day(s)</span>
              </div>
            )}
          </div>
        </div>

        {/* Acceptance Criteria */}
        {task.acceptanceCriteria && task.acceptanceCriteria.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <h4 style={{ fontSize: '0.8125rem', color: 'var(--ink-2)', margin: 0 }}>
              Agreed acceptance criteria ({task.acceptanceCriteria.length})
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {task.acceptanceCriteria.map((crit, idx) => (
                <li
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                    fontSize: '0.8125rem',
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--line)',
                    padding: '0.5rem 0.65rem',
                    borderRadius: 'var(--radius-sm)',
                    lineHeight: 1.4,
                  }}
                >
                  <CheckCircle2 size={14} color="var(--teal-ink)" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <span>{crit}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Deliverable Type */}
        {task.deliverableType && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
            <span style={{ color: 'var(--ink-2)' }}>Deliverable format:</span>
            <strong style={{ textTransform: 'capitalize' }}>{task.deliverableType}</strong>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      {task.isMilestone && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderTop: '1px solid var(--line)',
            backgroundColor: 'var(--paper)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          {onOpenReview && (
            <Button
              variant="secondary"
              size="sm"
              style={{ flex: 1 }}
              onClick={() => onOpenReview(task.id)}
            >
              View verification
            </Button>
          )}
          {isFreelancer && onSubmitDeliverable && task.paymentStatus !== 'paid' && (
            <Button
              variant="primary"
              size="sm"
              style={{ flex: 1 }}
              onClick={() => onSubmitDeliverable(task.id)}
            >
              Submit deliverable
            </Button>
          )}
        </div>
      )}
    </aside>
  );
};
