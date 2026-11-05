import React from 'react';
import { formatCents } from '@milestone/shared';

interface FundsMeterProps {
  totalBudget: number;
  paidTotal: number;
  heldTotal: number;
  onFundClick?: () => void;
  showFundAction?: boolean;
}

export const FundsMeter: React.FC<FundsMeterProps> = ({
  totalBudget,
  paidTotal,
  heldTotal,
  onFundClick,
  showFundAction,
}) => {
  const fundedTotal = paidTotal + heldTotal;
  const unfundedTotal = Math.max(0, totalBudget - fundedTotal);

  const paidPct = totalBudget > 0 ? (paidTotal / totalBudget) * 100 : 0;
  const heldPct = totalBudget > 0 ? (heldTotal / totalBudget) * 100 : 0;
  const unfundedPct = totalBudget > 0 ? (unfundedTotal / totalBudget) * 100 : 0;

  return (
    <section
      id="funds-meter"
      aria-label="Funds status meter"
      style={{
        backgroundColor: 'var(--paper)',
        borderBottom: '1px solid var(--line)',
        padding: '0.75rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '2rem',
        flexWrap: 'wrap',
      }}
    >
      {/* Metric 1: Total Project Budget */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
        <span
          style={{
            fontSize: '0.6875rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--slate)',
            fontWeight: 600,
          }}
        >
          Total Budget
        </span>
        <span
          style={{
            fontSize: '1.125rem',
            fontWeight: 700,
            color: 'var(--ink)',
            fontVariantNumeric: 'tabular-nums',
            fontFamily: 'Instrument Sans, sans-serif',
          }}
        >
          {formatCents(totalBudget)}
        </span>
      </div>

      <div style={{ height: '24px', width: '1px', backgroundColor: 'var(--line)' }} />

      {/* Metric 2: Paid (Settled) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
        <span
          style={{
            fontSize: '0.6875rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--settled)',
            fontWeight: 600,
          }}
        >
          Paid (Settled)
        </span>
        <span
          style={{
            fontSize: '1.125rem',
            fontWeight: 700,
            color: 'var(--settled)',
            fontVariantNumeric: 'tabular-nums',
            fontFamily: 'Instrument Sans, sans-serif',
          }}
        >
          {formatCents(paidTotal)}
        </span>
      </div>

      <div style={{ height: '24px', width: '1px', backgroundColor: 'var(--line)' }} />

      {/* Metric 3: Held For This Project */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
        <span
          style={{
            fontSize: '0.6875rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--brass)',
            fontWeight: 600,
          }}
        >
          Holding Balance (Held For This Project)
        </span>
        <span
          style={{
            fontSize: '1.125rem',
            fontWeight: 700,
            color: 'var(--ink)',
            fontVariantNumeric: 'tabular-nums',
            fontFamily: 'Instrument Sans, sans-serif',
          }}
        >
          {formatCents(heldTotal)}
        </span>
      </div>

      {/* Visual Multi-Segment Bar */}
      <div
        style={{
          flex: 1,
          minWidth: '220px',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
            color: 'var(--slate)',
          }}
        >
          <span>
            {formatCents(fundedTotal)} funded · {formatCents(paidTotal)} paid · {formatCents(heldTotal)} held
          </span>
          <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
            {totalBudget > 0 ? Math.round((paidTotal / totalBudget) * 100) : 0}% settled
          </span>
        </div>

        <div
          style={{
            height: '10px',
            backgroundColor: 'var(--chalk)',
            borderRadius: '5px',
            overflow: 'hidden',
            display: 'flex',
            border: '1px solid var(--line)',
          }}
          title={`Paid: ${Math.round(paidPct)}%, Held: ${Math.round(heldPct)}%, Unfunded: ${Math.round(unfundedPct)}%`}
        >
          {/* Paid Segment */}
          <div
            style={{
              width: `${paidPct}%`,
              backgroundColor: 'var(--settled)',
              transition: 'width 0.4s ease',
            }}
          />
          {/* Held Segment */}
          <div
            style={{
              width: `${heldPct}%`,
              backgroundColor: 'var(--brass)',
              transition: 'width 0.4s ease',
            }}
          />
          {/* Unfunded Segment */}
          <div
            style={{
              width: `${unfundedPct}%`,
              backgroundColor: 'var(--chalk)',
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      </div>

      {/* Guarantee & Allocation Modal Trigger */}
      {showFundAction && onFundClick && (
        <button
          id="open-fund-modal-btn"
          type="button"
          onClick={onFundClick}
          style={{
            backgroundColor: 'var(--chalk)',
            color: 'var(--ink)',
            border: '1px solid var(--line)',
            borderRadius: '4px',
            padding: '0.4rem 0.75rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}
        >
          <span>🛡️</span>
          <span>Guarantee & Allocation</span>
        </button>
      )}
    </section>
  );
};

