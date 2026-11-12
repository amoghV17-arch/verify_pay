import React from 'react';
import { formatCents } from '@milestone/shared';
import { Trash2, XCircle } from 'lucide-react';
import { Button, IconButton } from './Button.js';
import { StatusBadge, type MoneyState } from './StatusBadge.js';
import { LifecycleProgress } from './LifecycleProgress.js';
import type { ProjectStatusBadgeInfo } from '../../lib/projectHelpers.js';

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
  statusBadge?: ProjectStatusBadgeInfo;
  milestoneProgressLabel?: string;
  onManageStatus?: () => void;
  onDeleteProject?: () => void;
}

export const ProjectRow: React.FC<ProjectRowProps> = ({
  id,
  title,
  stateSentence,
  heldCents,
  paidCents,
  nextActionLabel,
  onNextAction,
  onClick,
  isDemo,
  statusBadge,
  milestoneProgressLabel,
  onManageStatus,
  onDeleteProject,
}) => {
  const badgeStyleMap: Record<ProjectStatusBadgeInfo['tone'], { bg: string; color: string; border: string }> = {
    teal: { bg: 'rgba(31, 122, 140, 0.12)', color: 'var(--teal-ink)', border: 'rgba(31, 122, 140, 0.28)' },
    forest: { bg: 'rgba(21, 115, 71, 0.12)', color: 'var(--forest)', border: 'rgba(21, 115, 71, 0.28)' },
    amber: { bg: 'rgba(176, 122, 18, 0.14)', color: '#825605', border: 'rgba(176, 122, 18, 0.3)' },
    red: { bg: 'rgba(200, 64, 47, 0.12)', color: '#C8402F', border: 'rgba(200, 64, 47, 0.28)' },
    neutral: { bg: 'var(--paper)', color: 'var(--ink-2)', border: 'var(--line)' },
  };
  const badgeColors = statusBadge ? badgeStyleMap[statusBadge.tone] : null;
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
        flexWrap: 'wrap',
        gap: '1.25rem',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all var(--duration-fast) var(--ease-out)',
        boxShadow: 'var(--shadow-sm)',
        boxSizing: 'border-box',
      }}
      data-testid={`project-row-${id}`}
    >
      {/* Title & Status Sentence */}
      <div style={{ flex: '1 1 240px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
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
          {statusBadge && badgeColors && (
            <span
              data-testid={`project-status-badge-${id}`}
              style={{
                fontSize: '0.6875rem',
                padding: '0.1rem 0.5rem',
                borderRadius: 'var(--radius-chip)',
                backgroundColor: badgeColors.bg,
                border: `1px solid ${badgeColors.border}`,
                color: badgeColors.color,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {statusBadge.label}
            </span>
          )}
          {milestoneProgressLabel && (
            <span
              style={{
                fontSize: '0.6875rem',
                padding: '0.1rem 0.45rem',
                borderRadius: 'var(--radius-chip)',
                backgroundColor: 'var(--paper)',
                border: '1px solid var(--line)',
                color: 'var(--ink-2)',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {milestoneProgressLabel}
            </span>
          )}
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
                flexShrink: 0,
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

      {/* Primary Next Action & Management Controls */}
      {(nextActionLabel || onManageStatus || onDeleteProject) && (
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {nextActionLabel && onNextAction && (
            <Button variant="primary" size="sm" onClick={onNextAction}>
              {nextActionLabel}
            </Button>
          )}
          {onManageStatus && (
            <IconButton
              icon={<XCircle size={15} />}
              label={`Cancel or mark ${title} failed`}
              size="sm"
              onClick={onManageStatus}
              data-testid={`cancel-project-${id}`}
            />
          )}
          {onDeleteProject && (
            <IconButton
              icon={<Trash2 size={15} />}
              label={`Delete project ${title}`}
              size="sm"
              onClick={onDeleteProject}
              data-testid={`delete-project-${id}`}
              style={{ color: '#C8402F' }}
            />
          )}
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

