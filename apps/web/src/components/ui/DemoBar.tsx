import React, { useState } from 'react';
import { X, Sparkles, ChevronRight } from 'lucide-react';

export interface DemoBarProps {
  currentStep?: number;
  onStepClick?: (stepNumber: number) => void;
  onSwitchPersona?: (role: 'client' | 'freelancer') => void;
  style?: React.CSSProperties;
}

const DEMO_STEPS = [
  'Create plan',
  'Create invite',
  'Accept as freelancer',
  'Fund project',
  'Submit delivery',
  'Watch AI review & payout',
  'Try prompt injection',
  'Audit & receipt',
];

export const DemoBar: React.FC<DemoBarProps> = ({
  currentStep = 1,
  onStepClick,
  onSwitchPersona,
  style,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  if (isDismissed) return null;

  return (
    <aside
      aria-label="Demo guide bar"
      style={{
        position: 'fixed',
        bottom: '1rem',
        left: '1rem',
        zIndex: 900,
        backgroundColor: 'var(--forest)',
        color: 'var(--paper-on-dark)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-overlay)',
        border: '1px solid var(--line-on-dark)',
        padding: '0.65rem 1rem',
        maxWidth: '420px',
        fontSize: '0.8125rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Sparkles size={14} color="var(--teal-on-dark)" />
          <span style={{ fontWeight: 600 }}>Demo mode: sandbox prototype</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--teal-on-dark)',
              fontSize: '0.75rem',
              cursor: 'pointer',
              padding: '0.2rem',
              textDecoration: 'underline',
            }}
          >
            {isExpanded ? 'Hide steps' : 'Step guide'}
          </button>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            aria-label="Dismiss demo bar"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--paper-on-dark)',
              opacity: 0.7,
              cursor: 'pointer',
              padding: '0.2rem',
              display: 'inline-flex',
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.85, lineHeight: 1.4 }}>
        No real money moves. All transactions use PayPal Sandbox.
      </p>

      {/* Optional Quick Switcher in Demo Mode */}
      {onSwitchPersona && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '0.25rem', borderTop: '1px solid var(--line-on-dark)' }}>
          <span style={{ fontSize: '0.6875rem', opacity: 0.75 }}>Switch persona:</span>
          <button
            type="button"
            onClick={() => onSwitchPersona('client')}
            style={{
              backgroundColor: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: 'var(--paper-on-dark)',
              borderRadius: '4px',
              padding: '0.15rem 0.4rem',
              fontSize: '0.6875rem',
              cursor: 'pointer',
            }}
          >
            Sarah (Client)
          </button>
          <button
            type="button"
            onClick={() => onSwitchPersona('freelancer')}
            style={{
              backgroundColor: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: 'var(--paper-on-dark)',
              borderRadius: '4px',
              padding: '0.15rem 0.4rem',
              fontSize: '0.6875rem',
              cursor: 'pointer',
            }}
          >
            Arjun (Freelancer)
          </button>
        </div>
      )}

      {/* Expanded Step-by-Step Guide */}
      {isExpanded && (
        <ol
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '0.25rem 0 0 0',
            borderTop: '1px solid var(--line-on-dark)',
            paddingTop: '0.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
          }}
        >
          {DEMO_STEPS.map((step, idx) => {
            const stepNum = idx + 1;
            const isCurrent = stepNum === currentStep;
            const isCompleted = stepNum < currentStep;

            return (
              <li
                key={step}
                onClick={() => onStepClick?.(stepNum)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.75rem',
                  cursor: onStepClick ? 'pointer' : 'default',
                  opacity: isCurrent ? 1 : isCompleted ? 0.8 : 0.5,
                  fontWeight: isCurrent ? 600 : 400,
                  color: isCurrent ? 'var(--teal-on-dark)' : 'inherit',
                }}
              >
                <span
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: isCurrent ? 'var(--teal)' : 'rgba(255,255,255,0.1)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.6875rem',
                  }}
                >
                  {stepNum}
                </span>
                <span>{step}</span>
                {isCurrent && <ChevronRight size={12} />}
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
};

