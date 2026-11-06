import React from 'react';
import { formatCents } from '@milestone/shared';

interface MilestoneItem {
  id: string;
  name: string;
  amountCents: number;
  paymentPercent?: number;
}

interface FundModalProps {
  projectId: string;
  projectTitle: string;
  milestones: MilestoneItem[];
  totalBudget: number;
  isFunding: boolean;
  onConfirmFund: () => void;
  onClose: () => void;
}

export const FundModal: React.FC<FundModalProps> = ({
  projectId: _projectId,
  projectTitle,
  milestones,
  totalBudget,
  isFunding,
  onConfirmFund,
  onClose,
}) => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="fund-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(22, 32, 43, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--paper)',
          borderRadius: '8px',
          border: '1px solid var(--line)',
          maxWidth: '520px',
          width: '100%',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <span
              style={{
                fontSize: '0.6875rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--tide)',
                fontWeight: 700,
              }}
            >
              PayPal Sandbox Funding
            </span>
            <h2
              id="fund-modal-title"
              style={{
                fontFamily: 'Bricolage Grotesque, sans-serif',
                fontSize: '1.25rem',
                margin: '0.25rem 0 0 0',
                color: 'var(--ink)',
              }}
            >
              Fund Project
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close funding modal"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.25rem',
              color: 'var(--slate)',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--ink)', lineHeight: 1.4 }}>
            Funding <strong>{projectTitle}</strong> commits money into this project's holding balance.
          </p>

          <div
            style={{
              backgroundColor: 'var(--chalk)',
              border: '1px solid var(--line)',
              borderRadius: '6px',
              padding: '0.875rem',
            }}
          >
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--slate)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: '0.5rem',
              }}
            >
              Milestone Allocation Breakdown
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {milestones.map((m, idx) => (
                <div
                  key={m.id || idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.8125rem',
                    color: 'var(--ink)',
                  }}
                >
                  <span>{m.name}</span>
                  <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatCents(m.amountCents)}
                  </strong>
                </div>
              ))}
              <div
                style={{
                  borderTop: '1px solid var(--line)',
                  paddingTop: '0.5rem',
                  marginTop: '0.35rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.9375rem',
                  fontWeight: 700,
                  color: 'var(--ink)',
                }}
              >
                <span>Total Commitment</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--tide)' }}>
                  {formatCents(totalBudget)}
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              backgroundColor: 'rgba(31, 122, 140, 0.08)',
              border: '1px solid rgba(31, 122, 140, 0.25)',
              borderRadius: '6px',
              padding: '0.75rem 0.875rem',
              fontSize: '0.8125rem',
              color: 'var(--ink)',
              lineHeight: 1.4,
            }}
          >
            🔒 <strong>How funds are held:</strong> Funds are held for this project and released milestone by milestone only after deliverables pass agreed acceptance criteria.
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--line)',
            backgroundColor: 'var(--chalk)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isFunding}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'var(--paper)',
              border: '1px solid var(--line)',
              borderRadius: '4px',
              color: 'var(--slate)',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>

          <button
            id="confirm-fund-btn"
            type="button"
            onClick={onConfirmFund}
            disabled={isFunding}
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: 'var(--tide)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: isFunding ? 'not-allowed' : 'pointer',
              opacity: isFunding ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 1px 2px rgba(22, 32, 43, 0.1)',
            }}
          >
            <span>💳</span>
            <span>{isFunding ? 'Processing PayPal Capture...' : `Fund Project (${formatCents(totalBudget)})`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

