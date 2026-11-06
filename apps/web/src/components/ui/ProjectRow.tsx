import React from 'react';
import { formatCents } from '@milestone/shared';
import { Button } from './Button.js';
import { StatusBadge, type MoneyState } from './StatusBadge.js';
import { LifecycleProgress } from './LifecycleProgress.js';

export interface ProjectRowProps {
  id: string;
  title: string;
  stateSentence: string;
  heldCents: number;
  paidCents: number;
  totalCents: number;
  nextActionLabel?: string;
  onNextAction?: () => void;
  onClick?: () => void;
  isDemo?: boolean;
}

export const ProjectRow: React.FC<ProjectRowProps> = ({
  title,
  stateSentence,
  heldCents,
  paidCents,
  nextActionLabel,
  onNextAction,
  onClick,
  isDemo,
}) => {
  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-card)',
        padding: '1.25rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1.5rem',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all var(--duration-fast) var(--ease-out)',
        boxShadow: 'var(--shadow-sm)',
        boxSizing: 'border-box',
      }}
    >
      {/* Title & Status Sentence */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h3
            style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--ink)',
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </h3>
          {isDemo && (
            <span
              style={{
                fontSize: '0.6875rem',
                padding: '0.1rem 0.4rem',
                borderRadius: 'var(--radius-chip)',
                backgroundColor: 'var(--paper)',
                border: '1px solid var(--line)',
                color: 'var(--ink-2)',
                fontWeight: 600,
              }}
            >
              Demo project
            </span>
          )}
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--ink-2)', margin: 0 }}>
          {stateSentence}
        </p>
      </div>

      {/* Financials (Held & Paid) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          flexShrink: 0,
          textAlign: 'right',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--ink-2)' }}>Held for project</span>
          <span
            className="tabular-nums"
            style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--teal-ink)' }}
          >
            {formatCents(heldCents)}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--ink-2)' }}>Paid</span>
          <span
            className="tabular-nums"
            style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--ink)' }}
          >
            {formatCents(paidCents)}
          </span>
        </div>
      </div>

      {/* Primary Next Action */}
      {nextActionLabel && onNextAction && (
        <div style={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          <Button variant="primary" size="sm" onClick={onNextAction}>
            {nextActionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};

export interface MilestoneRowProps {
  id: string;
  name: string;
  amountCents: number;
  status: MoneyState;
  backendStatus: string;
  dueDate?: string;
  criteriaCount?: number;
  onClick?: () => void;
  actionLabel?: string;
  onAction?: () => void;
}

export const MilestoneRow: React.FC<MilestoneRowProps> = ({
  name,
  amountCents,
  status,
  backendStatus,
  dueDate,
  criteriaCount,
  onClick,
  actionLabel,
  onAction,
}) => {
  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-card)',
        padding: '1rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        cursor: onClick ? 'pointer' : 'default',
        boxSizing: 'border-box',
      }}
    >
      {/* Left: Status Badge and Milestone Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
        <StatusBadge state={status} size="sm" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', minWidth: 0 }}>
          <span
            style={{
              fontSize: '0.9375rem',
              fontWeight: 600,
              color: 'var(--ink)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {name}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--ink-2)' }}>
            {dueDate && <span>Due {dueDate}</span>}
            {criteriaCount !== undefined && <span>• {criteriaCount} criteria</span>}
          </div>
        </div>
      </div>

      {/* Middle: Compact Lifecycle Progress */}
      <div style={{ flexShrink: 0, display: 'none', minWidth: '160px' }}>
        <LifecycleProgress backendStatus={backendStatus} variant="compact" />
      </div>

      {/* Right: Amount & Action */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
        <span
          className="tabular-nums"
          style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--ink)' }}
        >
          {formatCents(amountCents)}
        </span>

        {actionLabel && onAction && (
          <div onClick={(e) => e.stopPropagation()}>
            <Button variant="secondary" size="sm" onClick={onAction}>
              {actionLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

