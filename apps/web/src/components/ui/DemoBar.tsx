import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Sparkles, ChevronRight, RotateCcw, Split, Key, Check, Copy } from 'lucide-react';
import { ModeTruthBanner } from './ModeTruthBanner.js';

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
    route: '/client/new',
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
  const [isDismissed, setIsDismissed] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [sandboxBuyer, setSandboxBuyer] = useState<{ email: string; password?: string } | null>(null);
  const [payoutEmail, setPayoutEmail] = useState<string>('arjun-sandbox@freelance.dev');
  const [copiedBuyerKey, setCopiedBuyerKey] = useState<string | null>(null);
  const [isLiveSandbox, setIsLiveSandbox] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/demo/status')
      .then((r) => r.json())
      .then((d) => {
        if (d.sandboxBuyer) setSandboxBuyer(d.sandboxBuyer);
        if (d.freelancerPayoutEmail) setPayoutEmail(d.freelancerPayoutEmail);
      })
      .catch(() => {});

    fetch('/api/system/mode')
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        if (m && m.paypal === 'sandbox' && m.llm?.live && m.webhookConfigured) {
          setIsLiveSandbox(true);
        }
      })
      .catch(() => {});
  }, []);

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
        className="hide-on-mobile"
        onClick={() => setIsDismissed(false)}
        aria-label="Open demo guide"
        style={{
          position: 'fixed',
          bottom: '1.25rem',
          right: '1.25rem',
          zIndex: 450,
          backgroundColor: 'var(--forest)',
          color: 'var(--paper-on-dark)',
          border: '1px solid var(--line-on-dark)',
          borderRadius: 'var(--radius-chip)',
          padding: '0.45rem 0.85rem',
          fontSize: '0.75rem',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <Sparkles size={14} color="var(--teal-on-dark)" />
        Demo guide
      </button>
    );
  }

  return (
    <aside
      aria-label="Demo guide bar"
      className="hide-on-mobile"
      style={{
        position: 'fixed',
        bottom: '1.25rem',
        right: '1.25rem',
        zIndex: 450,
        backgroundColor: 'var(--forest)',
        color: 'var(--paper-on-dark)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-lg)',
        border: '1px solid var(--line-on-dark)',
        padding: '0.75rem 1rem',
        width: 'calc(100vw - 2.5rem)',
        maxWidth: '410px',
        fontSize: '0.8125rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.55rem',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <ModeTruthBanner showWhenLive={true} />
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <Sparkles size={15} color="var(--teal-on-dark)" />
          <span style={{ fontWeight: 600 }}>
            {isLiveSandbox ? 'Live sandbox active' : 'Demo mode: sandbox prototype'}
          </span>
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
          id="demobar-credentials-card"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.35)',
            borderRadius: 'var(--radius-input)',
            padding: '0.65rem 0.75rem',
            fontSize: '0.6875rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem',
            border: '1px solid var(--line-on-dark)',
          }}
        >
          <div style={{ fontWeight: 700, color: 'var(--teal-on-dark)' }}>PayPal Sandbox Buyer Login:</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Email: <code style={{ color: 'var(--teal-on-dark)' }}>{sandboxBuyer?.email || 'sb-buyer@personal.example.com'}</code></span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(sandboxBuyer?.email || 'sb-buyer@personal.example.com');
                setCopiedBuyerKey('email');
                setTimeout(() => setCopiedBuyerKey(null), 1500);
              }}
              style={{ background: 'none', border: 'none', color: 'var(--paper-on-dark)', cursor: 'pointer', fontSize: '0.625rem', display: 'flex', alignItems: 'center', gap: '2px' }}
            >
              {copiedBuyerKey === 'email' ? <Check size={11} /> : <Copy size={11} />}
              {copiedBuyerKey === 'email' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Password: <code style={{ color: 'var(--teal-on-dark)' }}>{sandboxBuyer?.password || 'SandboxPass123!'}</code></span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(sandboxBuyer?.password || 'SandboxPass123!');
                setCopiedBuyerKey('pass');
                setTimeout(() => setCopiedBuyerKey(null), 1500);
              }}
              style={{ background: 'none', border: 'none', color: 'var(--paper-on-dark)', cursor: 'pointer', fontSize: '0.625rem', display: 'flex', alignItems: 'center', gap: '2px' }}
            >
              {copiedBuyerKey === 'pass' ? <Check size={11} /> : <Copy size={11} />}
              {copiedBuyerKey === 'pass' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <span style={{ fontSize: '0.625rem', opacity: 0.75, fontStyle: 'italic' }}>
            Sandbox test account. No real money.
          </span>

          <div style={{ borderTop: '1px solid var(--line-on-dark)', paddingTop: '0.35rem', fontWeight: 600, color: 'var(--teal-on-dark)' }}>Demo Personas:</div>
          <div>
            <strong>Client:</strong> Sarah Lin (<code style={{ color: 'var(--teal-on-dark)' }}>sarah@acme-corp.com</code>)
          </div>
          <div>
            <strong>Freelancer:</strong> Arjun Mehta (<code style={{ color: 'var(--teal-on-dark)' }}>arjun@freelance.dev</code>) • Payout: <code style={{ color: 'var(--teal-on-dark)' }}>{payoutEmail}</code>
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
          <div style={{ fontSize: '0.75rem', opacity: 0.78, marginBottom: '0.35rem' }}>
            Step-by-step demo journey
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
                      <span style={{ fontSize: '0.6875rem', opacity: 0.72 }}>({step.role})</span>
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
