import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Sparkles, ChevronRight, RotateCcw, Split, Key, Check } from 'lucide-react';

export interface DemoBarProps {
  currentStep?: number;
  onStepClick?: (stepNumber: number) => void;
  onSwitchPersona?: (role: 'client' | 'freelancer') => void;
  style?: React.CSSProperties;
}

interface StepItem {
  number: number;
  label: string;
  route: string;
  role: 'client' | 'freelancer' | 'public';
  description: string;
}

const DEMO_STEPS: StepItem[] = [
  {
    number: 1,
    label: 'Create a plan',
    route: '/client/projects/new',
    role: 'client',
    description: 'Enter brief and let AI generate topological milestones & budget split.',
  },
  {
    number: 2,
    label: 'Create an invite',
    route: '/client/projects/proj_brand_launch/overview',
    role: 'client',
    description: 'Generate secure hashed invitation link and code for the freelancer.',
  },
  {
    number: 3,
    label: 'Accept as freelancer',
    route: '/join',
    role: 'freelancer',
    description: 'Join with invitation code, preview terms, and link PayPal sandbox email.',
  },
  {
    number: 4,
    label: 'Fund project',
    route: '/client/projects/proj_brand_launch/overview',
    role: 'client',
    description: 'Lock project funds into PayPal Sandbox capture before work begins.',
  },
  {
    number: 5,
    label: 'Submit a good delivery',
    route: '/freelancer/projects/proj_brand_launch/deliverables',
    role: 'freelancer',
    description: 'Submit Figma wireframes or repo URL for Milestone 2.',
  },
  {
    number: 6,
    label: 'Watch review & payout',
    route: '/client/projects/proj_brand_launch/deliverables/ms-02',
    role: 'client',
    description: 'Inspect AI criteria evaluations, tool execution trace, and release payout.',
  },
  {
    number: 7,
    label: 'Try prompt injection',
    route: '/freelancer/projects/proj_brand_launch/deliverables',
    role: 'freelancer',
    description: 'Test adversarial prompt injection delivery to verify reviewer defense.',
  },
  {
    number: 8,
    label: 'Audit & receipt',
    route: '/client/projects/proj_brand_launch/payments',
    role: 'client',
    description: 'Inspect immutable ledger proof, sandbox batch ID, and shareable settlement receipt.',
  },
];

export const DemoBar: React.FC<DemoBarProps> = ({
  currentStep = 1,
  onStepClick,
  onSwitchPersona,
  style,
}) => {
  const navigate = useNavigate();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  async function handleSwitch(role: 'client' | 'freelancer') {
    if (onSwitchPersona) {
      onSwitchPersona(role);
      return;
    }
    try {
      await fetch('/api/demo/login-as', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona: role }),
        credentials: 'include',
      });
    } catch {
      // Ignore network errors in mock mode
    }
    navigate(role === 'client' ? '/client/projects' : '/freelancer/projects');
  }

  async function handleReset() {
    setIsResetting(true);
    setResetMessage(null);
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST', credentials: 'include' });
      if (res.ok) {
        setResetMessage('Demo reset successfully');
      } else {
        setResetMessage('Workspace reset');
      }
    } catch {
      setResetMessage('Workspace reset');
    } finally {
      setIsResetting(false);
      setTimeout(() => setResetMessage(null), 3000);
    }
  }

  function handleNavigateStep(step: StepItem) {
    if (onStepClick) {
      onStepClick(step.number);
      return;
    }
    navigate(step.route);
  }

  if (isDismissed) {
    return (
      <button
        type="button"
        id="restore-demobar-btn"
        onClick={() => setIsDismissed(false)}
        aria-label="Open demo guide bar"
        style={{
          position: 'fixed',
          bottom: '1rem',
          left: '1rem',
          zIndex: 900,
          backgroundColor: 'var(--forest)',
          color: 'var(--paper-on-dark)',
          border: '1px solid var(--line-on-dark)',
          borderRadius: 'var(--radius-pill)',
          padding: '0.4rem 0.75rem',
          fontSize: '0.75rem',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          boxShadow: 'var(--shadow-overlay)',
        }}
      >
        <Sparkles size={14} color="var(--teal-on-dark)" />
        Demo Guide
      </button>
    );
  }

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
        padding: '0.75rem 1rem',
        width: 'calc(100vw - 2rem)',
        maxWidth: '430px',
        fontSize: '0.8125rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.55rem',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <Sparkles size={15} color="var(--teal-on-dark)" />
          <span style={{ fontWeight: 600 }}>Demo mode: sandbox prototype</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button
            type="button"
            id="demobar-toggle-steps-btn"
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--teal-on-dark)',
              fontSize: '0.75rem',
              cursor: 'pointer',
              padding: '0.15rem 0.3rem',
              textDecoration: 'underline',
            }}
          >
            {isExpanded ? 'Hide steps' : 'Step guide'}
          </button>
          <button
            type="button"
            id="demobar-dismiss-btn"
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
            <X size={15} />
          </button>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.85, lineHeight: 1.4 }}>
        No real money moves. All transactions use PayPal Sandbox.
      </p>

      {/* Control bar: Switcher + Split view + Reset */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.4rem',
          paddingTop: '0.35rem',
          borderTop: '1px solid var(--line-on-dark)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.6875rem', opacity: 0.75 }}>Role:</span>
          <button
            type="button"
            id="demobar-persona-client-btn"
            onClick={() => handleSwitch('client')}
            style={{
              backgroundColor: 'rgba(255,255,255,0.12)',
              border: 'none',
              color: 'var(--paper-on-dark)',
              borderRadius: '4px',
              padding: '0.15rem 0.45rem',
              fontSize: '0.6875rem',
              cursor: 'pointer',
            }}
          >
            Client
          </button>
          <button
            type="button"
            id="demobar-persona-freelancer-btn"
            onClick={() => handleSwitch('freelancer')}
            style={{
              backgroundColor: 'rgba(255,255,255,0.12)',
              border: 'none',
              color: 'var(--paper-on-dark)',
              borderRadius: '4px',
              padding: '0.15rem 0.45rem',
              fontSize: '0.6875rem',
              cursor: 'pointer',
            }}
          >
            Freelancer
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button
            type="button"
            id="demobar-split-view-btn"
            onClick={() => navigate('/demo/split')}
            title="Open side-by-side split screen"
            style={{
              backgroundColor: 'rgba(255,255,255,0.12)',
              border: 'none',
              color: 'var(--teal-on-dark)',
              borderRadius: '4px',
              padding: '0.15rem 0.45rem',
              fontSize: '0.6875rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            <Split size={11} />
            Split View
          </button>

          <button
            type="button"
            id="demobar-credentials-btn"
            onClick={() => setShowCredentials(!showCredentials)}
            title="View demo accounts"
            style={{
              backgroundColor: 'rgba(255,255,255,0.12)',
              border: 'none',
              color: 'var(--paper-on-dark)',
              borderRadius: '4px',
              padding: '0.15rem 0.45rem',
              fontSize: '0.6875rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.2rem',
            }}
          >
            <Key size={11} />
            Accounts
          </button>

          <button
            type="button"
            id="demobar-reset-btn"
            onClick={handleReset}
            disabled={isResetting}
            title="Reset demo data to initial state"
            style={{
              backgroundColor: 'rgba(255,255,255,0.12)',
              border: 'none',
              color: 'var(--paper-on-dark)',
              borderRadius: '4px',
              padding: '0.15rem 0.45rem',
              fontSize: '0.6875rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.2rem',
            }}
          >
            <RotateCcw size={11} className={isResetting ? 'spin' : ''} />
            {isResetting ? 'Resetting...' : 'Reset'}
          </button>
        </div>
      </div>

      {/* Reset status confirmation */}
      {resetMessage && (
        <div
          role="status"
          style={{
            fontSize: '0.6875rem',
            color: 'var(--teal-on-dark)',
            backgroundColor: 'rgba(0, 168, 150, 0.2)',
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}
        >
          <Check size={12} />
          {resetMessage}
        </div>
      )}

      {/* Prepopulated Credentials Popover */}
      {showCredentials && (
        <div
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            borderRadius: 'var(--radius-input)',
            padding: '0.5rem 0.65rem',
            fontSize: '0.6875rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
            border: '1px solid var(--line-on-dark)',
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--teal-on-dark)' }}>Prepopulated Demo Credentials:</div>
          <div>
            <strong>Client:</strong> Sarah Lin (<code style={{ color: 'var(--teal-on-dark)' }}>sarah@acme-corp.com</code>)
          </div>
          <div>
            <strong>Freelancer:</strong> Arjun Mehta (<code style={{ color: 'var(--teal-on-dark)' }}>arjun@freelance.dev</code>)
          </div>
          <div>
            <strong>PayPal Sandbox:</strong> <code style={{ color: 'var(--teal-on-dark)' }}>arjun-sandbox@freelance.dev</code>
          </div>
        </div>
      )}

      {/* Expanded Step-by-Step Walkthrough */}
      {isExpanded && (
        <div
          style={{
            borderTop: '1px solid var(--line-on-dark)',
            paddingTop: '0.5rem',
            maxHeight: '260px',
            overflowY: 'auto',
          }}
        >
          <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', opacity: 0.75, marginBottom: '0.35rem' }}>
            5-Beat Demo Journey
          </div>
          <ol
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
            }}
          >
            {DEMO_STEPS.map((step) => {
              const isCurrent = step.number === currentStep;

              return (
                <li
                  key={step.number}
                  id={`demobar-step-${step.number}`}
                  onClick={() => handleNavigateStep(step)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    padding: '0.35rem 0.4rem',
                    borderRadius: '4px',
                    backgroundColor: isCurrent ? 'rgba(0, 168, 150, 0.2)' : 'transparent',
                    color: isCurrent ? 'var(--teal-on-dark)' : 'inherit',
                    transition: 'background 120ms ease',
                  }}
                >
                  <span
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      backgroundColor: isCurrent ? 'var(--teal)' : 'rgba(255,255,255,0.15)',
                      color: isCurrent ? '#fff' : 'inherit',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      flexShrink: 0,
                      marginTop: '0.1rem',
                    }}
                  >
                    {step.number}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: isCurrent ? 600 : 500, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span>{step.label}</span>
                      <span style={{ fontSize: '0.625rem', opacity: 0.65, textTransform: 'uppercase' }}>({step.role})</span>
                    </div>
                    <div style={{ fontSize: '0.6875rem', opacity: 0.75, lineHeight: 1.3, marginTop: '0.1rem' }}>
                      {step.description}
                    </div>
                  </div>
                  <ChevronRight size={13} style={{ flexShrink: 0, marginTop: '0.2rem', opacity: 0.6 }} />
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </aside>
  );
};
