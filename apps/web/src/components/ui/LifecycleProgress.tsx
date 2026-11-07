import React from 'react';
import { Check, AlertCircle } from 'lucide-react';

export type LifecycleStage = 'agreed' | 'funded' | 'submitted' | 'verified' | 'paid';

export interface LifecycleProgressProps {
  backendStatus: string;
  subStatusText?: string;
  variant?: 'full' | 'compact';
  style?: React.CSSProperties;
}

const STAGES: Array<{ id: LifecycleStage; label: string }> = [
  { id: 'agreed', label: 'Agreed' },
  { id: 'funded', label: 'Funded' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'verified', label: 'Verified' },
  { id: 'paid', label: 'Paid' },
];

export function mapBackendStatusToStage(status: string): {
  activeStageIndex: number;
  subStatusText: string;
  isProblemTone?: boolean;
} {
  switch (status) {
    case 'not_accepted':
    case 'none':
      return { activeStageIndex: -1, subStatusText: 'Waiting for the freelancer to accept' };
    case 'unfunded':
    case 'draft':
    case 'planned':
      return { activeStageIndex: 0, subStatusText: 'Waiting for funding' };
    case 'funded':
    case 'active':
      return { activeStageIndex: 1, subStatusText: 'Ready for work' };
    case 'submitted':
    case 'in_review':
      return { activeStageIndex: 2, subStatusText: 'AI reviewing' };
    case 'changes_requested':
      return { activeStageIndex: 2, subStatusText: 'Changes requested', isProblemTone: true };
    case 'appealed':
      return { activeStageIndex: 2, subStatusText: 'Appeal under review' };
    case 'awaiting_client':
      return { activeStageIndex: 3, subStatusText: 'Waiting for the client' };
    case 'approved':
      return { activeStageIndex: 3, subStatusText: 'Ready to release' };
    case 'releasing':
      return { activeStageIndex: 3, subStatusText: 'Releasing' };
    case 'paid':
    case 'closed':
      return { activeStageIndex: 4, subStatusText: 'Settled' };
    default:
      return { activeStageIndex: 0, subStatusText: status };
  }
}

export const LifecycleProgress: React.FC<LifecycleProgressProps> = ({
  backendStatus,
  subStatusText: customSubStatus,
  variant = 'full',
  style,
}) => {
  const { activeStageIndex, subStatusText, isProblemTone } = mapBackendStatusToStage(backendStatus);
  const activeText = customSubStatus || subStatusText;
  const isPaidFinal = activeStageIndex === 4;

  if (variant === 'compact') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          fontSize: '0.75rem',
          ...style,
        }}
        aria-label={`Milestone progress: ${activeText}`}
      >
        <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
          {STAGES.map((stage, idx) => {
            const isCompleted = isPaidFinal ? true : idx < activeStageIndex;
            const isCurrent = !isPaidFinal && idx === activeStageIndex;
            return (
              <span
                key={stage.id}
                style={{
                  width: '16px',
                  height: '4px',
                  borderRadius: '2px',
                  backgroundColor: isCompleted
                    ? 'var(--teal)'
                    : isCurrent
                      ? isProblemTone
                        ? 'var(--amber)'
                        : 'var(--teal-ink)'
                      : 'var(--line)',
                }}
              />
            );
          })}
        </div>
        <span
          style={{
            color: isProblemTone ? 'var(--amber-ink)' : style?.color || 'var(--ink-2)',
            fontWeight: 500,
          }}
        >
          {activeText}
        </span>
      </div>
    );
  }

  return (
    <nav
      aria-label="Milestone delivery lifecycle"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        width: '100%',
        ...style,
      }}
    >
      <ol
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          listStyle: 'none',
          padding: 0,
          margin: 0,
          position: 'relative',
        }}
      >
        {STAGES.map((stage, idx) => {
          // When milestone is paid/closed, all stages including Paid show as complete with checkmark
          const isCompleted = isPaidFinal ? true : idx < activeStageIndex;
          const isCurrent = !isPaidFinal && idx === activeStageIndex;

          return (
            <React.Fragment key={stage.id}>
              {/* Connecting line between stages */}
              {idx > 0 && (
                <li
                  aria-hidden="true"
                  style={{
                    flex: 1,
                    height: '2px',
                    backgroundColor:
                      isPaidFinal || idx <= activeStageIndex
                        ? 'var(--teal)'
                        : 'var(--line)',
                    margin: '0 0.5rem',
                    transition: 'background-color var(--duration-base) var(--ease-out)',
                  }}
                />
              )}

              {/* Step indicator node */}
              <li
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.35rem',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    transition: 'all var(--duration-base) var(--ease-out)',
                    backgroundColor: isCompleted
                      ? 'var(--teal)'
                      : isCurrent
                        ? 'var(--surface)'
                        : 'var(--surface)',
                    border: isCompleted
                      ? '2px solid var(--teal)'
                      : isCurrent
                        ? `2px solid ${isProblemTone ? 'var(--amber)' : 'var(--teal)'}`
                        : '1.5px solid var(--line)',
                    color: isCompleted
                      ? '#FFFFFF'
                      : isCurrent
                        ? isProblemTone
                          ? 'var(--amber-ink)'
                          : 'var(--teal-ink)'
                        : 'var(--ink-2)',
                  }}
                >
                  {isCompleted ? (
                    <Check size={14} strokeWidth={2.5} />
                  ) : isCurrent && isProblemTone ? (
                    <AlertCircle size={14} />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>

                <span
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: isCurrent || isCompleted ? 600 : 500,
                    color: isCompleted
                      ? 'var(--ink)'
                      : isCurrent
                        ? isProblemTone
                          ? 'var(--amber-ink)'
                          : 'var(--teal-ink)'
                        : 'var(--ink-2)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {stage.label}
                </span>
              </li>
            </React.Fragment>
          );
        })}
      </ol>

      {/* Sub-status line with calm or problem tone */}
      {activeText && (
        <div
          role="status"
          aria-live="polite"
          style={{
            fontSize: '0.8125rem',
            color: isProblemTone ? 'var(--amber-ink)' : 'var(--ink-2)',
            textAlign: 'center',
            padding: '0.3rem 0.65rem',
            backgroundColor: isProblemTone ? 'var(--amber-wash)' : 'var(--surface)',
            borderRadius: 'var(--radius-sm)',
            border: `1px solid ${isProblemTone ? 'var(--amber)' : 'var(--line)'}`,
            marginTop: '0.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
          }}
        >
          {isProblemTone && <AlertCircle size={14} style={{ color: 'var(--amber)' }} />}
          <span>Status: </span>
          <strong
            style={{
              color: isProblemTone ? 'var(--amber-ink)' : 'var(--ink)',
              fontWeight: 600,
            }}
          >
            {activeText}
          </strong>
        </div>
      )}
    </nav>
  );
};
