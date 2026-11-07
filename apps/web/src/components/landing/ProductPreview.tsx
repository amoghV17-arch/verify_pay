import React, { useState, useEffect } from 'react';
import { StatusBadge } from '../ui/StatusBadge.js';
import { FinancialFigure } from '../ui/FinancialFigure.js';
import { EvidenceChip } from '../ui/EvidenceChip.js';
import { CheckCircle2, Circle, Clock, DollarSign, Sparkles } from 'lucide-react';

type PreviewState = 0 | 1 | 2 | 3;

interface StateConfig {
  name: string;
  badgeState: 'agreed' | 'funded' | 'in_review' | 'paid';
  badgeLabel: string;
  timelineStep: number;
  description: string;
  checks: [boolean, boolean, boolean];
  showEvidence: boolean;
  actionText: string;
}

const STATES: StateConfig[] = [
  {
    name: 'Funded',
    badgeState: 'funded',
    badgeLabel: 'Funded in Sandbox',
    timelineStep: 1,
    description: 'Funds held in project balance. Freelancer notified to begin.',
    checks: [false, false, false],
    showEvidence: false,
    actionText: 'Ready for delivery',
  },
  {
    name: 'Submitted',
    badgeState: 'in_review',
    badgeLabel: 'Under AI Review',
    timelineStep: 2,
    description: 'Work submitted with proof links. Verifying against criteria.',
    checks: [true, true, false],
    showEvidence: true,
    actionText: 'Evaluating evidence...',
  },
  {
    name: 'Verified',
    badgeState: 'in_review',
    badgeLabel: 'Criteria Passed',
    timelineStep: 3,
    description: 'All 3 acceptance criteria verified with high confidence.',
    checks: [true, true, true],
    showEvidence: true,
    actionText: 'Payout authorized',
  },
  {
    name: 'Paid',
    badgeState: 'paid',
    badgeLabel: 'Released to PayPal',
    timelineStep: 4,
    description: 'PayPal sandbox payout completed. Logged to ledger.',
    checks: [true, true, true],
    showEvidence: true,
    actionText: 'Milestone settled',
  },
];

export const ProductPreview: React.FC = () => {
  const [currentState, setCurrentState] = useState<PreviewState>(0);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);

    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || isPaused) return;

    // Hold final state for 3.2s, others for 2.4s
    const delay = currentState === 3 ? 3200 : 2400;
    const timer = setTimeout(() => {
      setCurrentState((prev) => ((prev + 1) % 4) as PreviewState);
    }, delay);

    return () => clearTimeout(timer);
  }, [currentState, isPaused, prefersReducedMotion]);

  const activeConfig = prefersReducedMotion ? STATES[3] : STATES[currentState];

  return (
    <div
      role="region"
      aria-label="Milestone product preview demonstration"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      tabIndex={0}
      style={{
        position: 'relative',
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: '16px',
        padding: '1.5rem',
        boxShadow: 'var(--shadow-lg)',
        outline: 'none',
        maxWidth: '540px',
        width: '100%',
        boxSizing: 'border-box',
        margin: '0 auto',
        transition: 'border-color var(--duration-fast)',
      }}
    >
      {/* Screen reader only description */}
      <span className="sr-only">
        Interactive preview showing a project milestone cycle: Milestone 3 Interactive Prototype
        Verified at $2,400.00 progressing from Funded through Submitted, Verified, and Paid with automated acceptance checks.
      </span>

      {/* Top Context Bar: Sample Project & State Pills */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--line)',
          paddingBottom: '0.85rem',
          marginBottom: '1.25rem',
          fontSize: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--teal)',
            }}
            aria-hidden="true"
          />
          <span style={{ fontWeight: 600, color: 'var(--ink-2)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Sample Project
          </span>
        </div>

        {/* Milestone Diamond Strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} aria-hidden="true">
          {[1, 2, 3, 4].map((step) => {
            const isCurrent = step === 3;
            const isDone = step < 3 || (isCurrent && activeConfig.timelineStep === 4);
            return (
              <div
                key={step}
                title={`Milestone ${step}`}
                style={{
                  width: '10px',
                  height: '10px',
                  transform: 'rotate(45deg)',
                  borderRadius: '1px',
                  backgroundColor: isDone
                    ? 'var(--teal)'
                    : isCurrent
                    ? 'var(--forest)'
                    : 'var(--line-strong)',
                  transition: 'background-color var(--duration-normal)',
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Milestone Card Body */}
      <div
        style={{
          backgroundColor: 'var(--paper)',
          border: '1px solid var(--line)',
          borderRadius: '12px',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        {/* Card Header: Title + Status + Amount */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-2)' }}>
                Milestone 3 of 4
              </span>
              <StatusBadge state={activeConfig.badgeState} label={activeConfig.badgeLabel} size="sm" />
            </div>
            <h4
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '1.125rem',
                fontWeight: 600,
                color: 'var(--ink)',
                margin: 0,
              }}
            >
              Interactive Prototype Verified
            </h4>
          </div>

          <FinancialFigure
            amountCents={240000}
            size="md"
            label="Milestone budget"
            trend="held"
          />
        </div>

        {/* Criteria Checklist */}
        <div
          style={{
            backgroundColor: 'var(--surface)',
            borderRadius: '8px',
            border: '1px solid var(--line)',
            padding: '0.75rem 0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--ink-2)',
              letterSpacing: '0.02em',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Acceptance Criteria</span>
            <span style={{ color: 'var(--teal-ink)', fontWeight: 500 }}>
              {activeConfig.checks.filter(Boolean).length} of 3 verified
            </span>
          </div>

          {[
            'Figma flow complete and matches design tokens',
            'Lighthouse accessibility score is 95 or higher',
            'Video walkthrough demonstrates core user journeys',
          ].map((criterion, idx) => {
            const isChecked = activeConfig.checks[idx];
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.8125rem',
                  color: isChecked ? 'var(--ink)' : 'var(--ink-2)',
                  transition: 'color var(--duration-fast)',
                }}
              >
                {isChecked ? (
                  <CheckCircle2
                    size={15}
                    style={{
                      color: 'var(--teal)',
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  />
                ) : (
                  <Circle
                    size={15}
                    style={{
                      color: 'var(--line-strong)',
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  />
                )}
                <span style={{ textDecoration: isChecked ? 'none' : 'none' }}>{criterion}</span>
              </div>
            );
          })}
        </div>

        {/* Evidence Chips when Submitted or Beyond */}
        {activeConfig.showEvidence && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              flexWrap: 'wrap',
              fontSize: '0.75rem',
            }}
          >
            <span style={{ color: 'var(--ink-2)', fontWeight: 500 }}>Submitted proof:</span>
            <EvidenceChip type="figma" label="figma.com/file/v4..." />
            <EvidenceChip type="repo" label="PR #28 merged" />
            <EvidenceChip type="url" label="Lighthouse Report" />
          </div>
        )}

        {/* State Status Line */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '0.5rem',
            borderTop: '1px solid var(--line)',
            fontSize: '0.8125rem',
            color: 'var(--ink-2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {activeConfig.timelineStep === 4 ? (
              <DollarSign size={14} style={{ color: 'var(--teal)' }} />
            ) : activeConfig.timelineStep === 3 ? (
              <Sparkles size={14} style={{ color: 'var(--teal)' }} />
            ) : (
              <Clock size={14} style={{ color: 'var(--ink-2)' }} />
            )}
            <span>{activeConfig.description}</span>
          </div>

          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--forest)',
            }}
          >
            {activeConfig.actionText}
          </span>
        </div>
      </div>

      {/* Loop control indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '0.85rem',
          fontSize: '0.75rem',
          color: 'var(--ink-2)',
        }}
      >
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          {STATES.map((s, idx) => (
            <button
              key={s.name}
              type="button"
              onClick={() => setCurrentState(idx as PreviewState)}
              aria-label={`Jump to ${s.name} simulation stage`}
              style={{
                width: idx === currentState ? '24px' : '8px',
                height: '6px',
                borderRadius: '3px',
                backgroundColor: idx === currentState ? 'var(--forest)' : 'var(--line-strong)',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                transition: 'all var(--duration-fast)',
              }}
            />
          ))}
        </div>

        <span style={{ fontSize: '0.6875rem', color: 'var(--ink-2)' }}>
          {isPaused ? 'Paused on hover' : 'Hover or focus to pause'}
        </span>
      </div>
    </div>
  );
};
