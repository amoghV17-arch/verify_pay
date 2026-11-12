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
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const isPaused = isHovered || isFocused;

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

  const activeConfig = prefersReducedMotion && !isPaused ? STATES[3] : STATES[currentState];
  const isPaidStage = activeConfig.timelineStep === 4;

  const smoothEase = prefersReducedMotion ? '0ms linear' : '360ms cubic-bezier(0.22, 1, 0.36, 1)';
  const fastEase = prefersReducedMotion ? '0ms linear' : '240ms cubic-bezier(0.22, 1, 0.36, 1)';

  return (
    <div
      role="region"
      aria-label="Milestone product preview demonstration"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setIsFocused(false);
        }
      }}
      tabIndex={0}
      style={{
        position: 'relative',
        backgroundColor: 'var(--surface)',
        border: isHovered
          ? '1px solid rgba(21, 52, 43, 0.34)'
          : '1px solid var(--line)',
        borderRadius: '16px',
        padding: '1.5rem',
        boxShadow: isHovered && !prefersReducedMotion
          ? '0 26px 56px -14px rgba(21, 52, 43, 0.22), 0 8px 20px -6px rgba(15, 165, 115, 0.14)'
          : 'var(--shadow-lg)',
        transform: isHovered && !prefersReducedMotion ? 'translateY(-6px) scale(1.016)' : 'translateY(0) scale(1)',
        outline: 'none',
        maxWidth: '540px',
        width: '100%',
        boxSizing: 'border-box',
        margin: '0 auto',
        transition: `transform ${smoothEase}, box-shadow ${smoothEase}, border-color ${fastEase}`,
        willChange: 'transform',
      }}
    >
      {/* Screen reader only description */}
      <span className="sr-only">
        Interactive preview showing a project milestone cycle: Milestone 3 Interactive prototype
        at $2,400.00 progressing from Funded through Submitted, Verified, and Paid with automated acceptance checks.
      </span>

      {/* Top Context Bar: Sample Project & State Diamonds */}
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
              backgroundColor: isPaidStage ? 'var(--teal)' : 'var(--forest)',
              boxShadow: isPaidStage ? '0 0 0 4px rgba(15, 165, 115, 0.16)' : 'none',
              transition: `background-color ${fastEase}, box-shadow ${fastEase}`,
            }}
            aria-hidden="true"
          />
          <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>
            Sample project
          </span>
        </div>

        {/* Milestone Diamond Strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} aria-hidden="true">
          {[1, 2, 3, 4].map((step) => {
            const isCurrent = step === 3;
            const isDone = step < 3 || (isCurrent && isPaidStage);
            return (
              <div
                key={step}
                title={`Milestone ${step}`}
                style={{
                  width: '10px',
                  height: '10px',
                  transform: isCurrent && isHovered && !prefersReducedMotion
                    ? 'rotate(45deg) scale(1.18)'
                    : 'rotate(45deg) scale(1)',
                  borderRadius: '1px',
                  backgroundColor: isDone
                    ? 'var(--teal)'
                    : isCurrent
                    ? 'var(--forest)'
                    : 'var(--line-strong)',
                  transition: `background-color ${smoothEase}, transform ${smoothEase}`,
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
          border: isPaidStage ? '1px solid rgba(15, 165, 115, 0.35)' : '1px solid var(--line)',
          borderRadius: '12px',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          transition: `border-color ${smoothEase}, box-shadow ${smoothEase}`,
          boxShadow: isPaidStage ? '0 8px 22px -12px rgba(15, 165, 115, 0.25)' : 'none',
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
              <span style={{ transition: `transform ${fastEase}`, display: 'inline-flex' }}>
                <StatusBadge state={activeConfig.badgeState} label={activeConfig.badgeLabel} size="sm" />
              </span>
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
              Interactive prototype
            </h4>
          </div>

          <FinancialFigure
            amountCents={240000}
            size="md"
            label={isPaidStage ? 'Released payout' : 'Milestone budget'}
            trend={isPaidStage ? 'paid' : 'held'}
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
            gap: '0.45rem',
          }}
        >
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--ink-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.15rem',
            }}
          >
            <span>Acceptance criteria</span>
            <span
              style={{
                color: isPaidStage ? 'var(--teal)' : 'var(--teal-ink)',
                fontWeight: 600,
                transition: `color ${fastEase}`,
              }}
            >
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
                  padding: '0.22rem 0.4rem',
                  marginLeft: '-0.4rem',
                  marginRight: '-0.4rem',
                  borderRadius: '6px',
                  backgroundColor: isChecked ? 'rgba(15, 165, 115, 0.06)' : 'transparent',
                  color: isChecked ? 'var(--ink)' : 'var(--ink-2)',
                  transition: `background-color ${fastEase}, color ${fastEase}`,
                  transitionDelay: prefersReducedMotion ? '0ms' : `${idx * 45}ms`,
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    flexShrink: 0,
                    transform: isChecked ? 'scale(1)' : 'scale(0.9)',
                    transition: `transform ${fastEase}`,
                    transitionDelay: prefersReducedMotion ? '0ms' : `${idx * 45}ms`,
                  }}
                >
                  {isChecked ? (
                    <CheckCircle2 size={15} style={{ color: 'var(--teal)' }} aria-hidden="true" />
                  ) : (
                    <Circle size={15} style={{ color: 'var(--line-strong)' }} aria-hidden="true" />
                  )}
                </span>
                <span>{criterion}</span>
              </div>
            );
          })}
        </div>

        {/* Smooth animated collapsible Evidence Row (prevents height snapping) */}
        <div
          aria-hidden={!activeConfig.showEvidence}
          style={{
            display: 'grid',
            gridTemplateRows: activeConfig.showEvidence ? '1fr' : '0fr',
            opacity: activeConfig.showEvidence ? 1 : 0,
            transform: activeConfig.showEvidence || prefersReducedMotion ? 'translateY(0)' : 'translateY(6px)',
            marginTop: activeConfig.showEvidence ? '0' : '-0.65rem',
            transition: `grid-template-rows ${smoothEase}, opacity ${fastEase}, transform ${smoothEase}, margin-top ${smoothEase}`,
            pointerEvents: activeConfig.showEvidence ? 'auto' : 'none',
          }}
        >
          <div style={{ overflow: 'hidden' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                flexWrap: 'wrap',
                fontSize: '0.75rem',
                paddingTop: '0.1rem',
              }}
            >
              <span style={{ color: 'var(--ink-2)', fontWeight: 500 }}>Submitted proof:</span>
              <EvidenceChip type="figma" label="figma.com/file/v4..." />
              <EvidenceChip type="repo" label="PR #28 merged" />
              <EvidenceChip type="url" label="Lighthouse Report" />
            </div>
          </div>
        </div>

        {/* State Status Line */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            paddingTop: '0.6rem',
            borderTop: '1px solid var(--line)',
            fontSize: '0.8125rem',
            color: 'var(--ink-2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {activeConfig.timelineStep === 4 ? (
              <DollarSign size={14} style={{ color: 'var(--teal)', flexShrink: 0 }} />
            ) : activeConfig.timelineStep === 3 ? (
              <Sparkles size={14} style={{ color: 'var(--teal)', flexShrink: 0 }} />
            ) : (
              <Clock size={14} style={{ color: 'var(--ink-2)', flexShrink: 0 }} />
            )}
            <span>{activeConfig.description}</span>
          </div>

          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: isPaidStage ? 'var(--teal)' : 'var(--forest)',
              whiteSpace: 'nowrap',
              transition: `color ${fastEase}`,
            }}
          >
            {activeConfig.actionText}
          </span>
        </div>
      </div>

      {/* Interactive Stage Selector Bar: auto-cycles on idle; hover or click any box manually */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.55rem',
          marginTop: '0.95rem',
        }}
      >
        <div
          role="tablist"
          aria-label="Preview lifecycle stages"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '0.45rem',
          }}
        >
          {STATES.map((s, idx) => {
            const isSelected = idx === currentState;
            return (
              <button
                key={s.name}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-label={`${idx + 1}. ${s.name}: Jump to simulation stage`}
                onMouseEnter={() => setCurrentState(idx as PreviewState)}
                onFocus={() => setCurrentState(idx as PreviewState)}
                onClick={() => setCurrentState(idx as PreviewState)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  padding: '0.45rem 0.5rem',
                  borderRadius: '8px',
                  border: isSelected
                    ? '1px solid var(--forest)'
                    : '1px solid var(--line)',
                  backgroundColor: isSelected
                    ? 'var(--forest)'
                    : isHovered
                    ? 'var(--paper)'
                    : 'transparent',
                  color: isSelected ? 'var(--paper)' : 'var(--ink-2)',
                  fontSize: '0.75rem',
                  fontWeight: isSelected ? 600 : 500,
                  cursor: 'pointer',
                  transform: isSelected && isHovered && !prefersReducedMotion
                    ? 'translateY(-2px)'
                    : 'translateY(0)',
                  boxShadow: isSelected
                    ? '0 4px 12px rgba(21, 52, 43, 0.16)'
                    : 'none',
                  transition: `all ${fastEase}`,
                }}
              >
                <span>{idx + 1}. {s.name}</span>
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.6875rem',
            color: 'var(--ink-2)',
          }}
        >
          <span>
            {isPaused
              ? 'Paused • Hover or click any stage to switch'
              : 'Auto-playing • Move cursor here to explore'}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
            {currentState + 1} / 4
          </span>
        </div>
      </div>
    </div>
  );
};
