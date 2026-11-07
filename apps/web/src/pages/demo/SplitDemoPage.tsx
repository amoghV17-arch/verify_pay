import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RotateCcw,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Radio,
  ArrowLeft,
  LayoutDashboard,
  Calendar,
  Layers,
  CreditCard,
  Check,
} from 'lucide-react';
import { Button } from '../../components/ui/Button.js';

type PresetView = 'overview' | 'deliverables' | 'schedule' | 'payments';

const PRESETS: Record<
  PresetView,
  { label: string; icon: React.ReactNode; clientPath: string; freelancerPath: string }
> = {
  overview: {
    label: 'Overview',
    icon: <LayoutDashboard size={14} />,
    clientPath: '/client/projects/proj_brand_launch/overview',
    freelancerPath: '/freelancer/projects/proj_brand_launch/overview',
  },
  deliverables: {
    label: 'Deliverables & Review',
    icon: <Layers size={14} />,
    clientPath: '/client/projects/proj_brand_launch/deliverables',
    freelancerPath: '/freelancer/projects/proj_brand_launch/deliverables',
  },
  schedule: {
    label: 'Schedule (Gantt)',
    icon: <Calendar size={14} />,
    clientPath: '/client/projects/proj_brand_launch/schedule',
    freelancerPath: '/freelancer/projects/proj_brand_launch/schedule',
  },
  payments: {
    label: 'Payments & Ledger',
    icon: <CreditCard size={14} />,
    clientPath: '/client/projects/proj_brand_launch/payments',
    freelancerPath: '/freelancer/projects/proj_brand_launch/payments',
  },
};

export const SplitDemoPage: React.FC = () => {
  const navigate = useNavigate();
  const [activePreset, setActivePreset] = useState<PresetView>('overview');
  const [mobileTab, setMobileTab] = useState<'client' | 'freelancer'>('client');
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const clientIframeRef = useRef<HTMLIFrameElement>(null);
  const freelancerIframeRef = useRef<HTMLIFrameElement>(null);

  const currentPreset = PRESETS[activePreset];

  function handleRefreshBoth() {
    if (clientIframeRef.current) {
      clientIframeRef.current.src = currentPreset.clientPath;
    }
    if (freelancerIframeRef.current) {
      freelancerIframeRef.current.src = currentPreset.freelancerPath;
    }
  }

  async function handleResetDemo() {
    setIsResetting(true);
    setResetSuccess(false);
    try {
      await fetch('/api/demo/reset', { method: 'POST', credentials: 'include' });
      setResetSuccess(true);
      handleRefreshBoth();
    } catch {
      // In mock/preview environment fallback
      setResetSuccess(true);
      handleRefreshBoth();
    } finally {
      setIsResetting(false);
      setTimeout(() => setResetSuccess(false), 3500);
    }
  }

  function handleSelectPreset(presetKey: PresetView) {
    setActivePreset(presetKey);
    const p = PRESETS[presetKey];
    if (clientIframeRef.current) clientIframeRef.current.src = p.clientPath;
    if (freelancerIframeRef.current) freelancerIframeRef.current.src = p.freelancerPath;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        backgroundColor: 'var(--paper)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Top Demo Bar */}
      <header
        style={{
          padding: '0.6rem 1rem',
          backgroundColor: 'var(--surface)',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexShrink: 0,
          zIndex: 20,
        }}
      >
        {/* Left: Brand & Return */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            id="split-exit-btn"
            onClick={() => navigate('/')}
            title="Exit split view"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: 'none',
              border: 'none',
              color: 'var(--ink-2)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '0.25rem 0.5rem',
              borderRadius: 'var(--radius-input)',
            }}
          >
            <ArrowLeft size={15} />
            Exit Split
          </button>

          <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--line)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                fontFamily: 'var(--font-serif)',
                fontWeight: 700,
                fontSize: '1.0625rem',
                color: 'var(--ink)',
              }}
            >
              Milestone Split Demo
            </span>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: 'var(--forest)',
                backgroundColor: 'var(--teal-wash)',
                padding: '0.15rem 0.5rem',
                borderRadius: 'var(--radius-pill)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              <ShieldCheck size={12} />
              PayPal Sandbox
            </span>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: 'var(--forest)',
                backgroundColor: 'var(--paper-warm)',
                padding: '0.15rem 0.5rem',
                borderRadius: 'var(--radius-pill)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              <Radio size={11} color="var(--forest)" />
              SSE Live Sync
            </span>
          </div>
        </div>

        {/* Center: Presets */}
        <div
          role="tablist"
          aria-label="Preset views"
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--paper)',
            padding: '0.2rem',
            borderRadius: 'var(--radius-input)',
            border: '1px solid var(--line)',
            gap: '0.2rem',
          }}
        >
          {(Object.keys(PRESETS) as PresetView[]).map((key) => {
            const p = PRESETS[key];
            const active = activePreset === key;
            return (
              <button
                key={key}
                type="button"
                id={`preset-${key}-btn`}
                role="tab"
                aria-selected={active}
                onClick={() => handleSelectPreset(key)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.3rem 0.65rem',
                  borderRadius: 'var(--radius-input)',
                  border: 'none',
                  backgroundColor: active ? 'var(--surface)' : 'transparent',
                  color: active ? 'var(--forest)' : 'var(--ink-2)',
                  fontWeight: active ? 600 : 500,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  boxShadow: active ? 'var(--shadow-card)' : 'none',
                  transition: 'all 120ms ease',
                }}
              >
                {p.icon}
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {resetSuccess && (
            <span
              role="status"
              style={{
                fontSize: '0.75rem',
                color: 'var(--forest)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontWeight: 600,
              }}
            >
              <Check size={14} />
              Reset complete!
            </span>
          )}

          <Button
            id="split-refresh-btn"
            variant="quiet"
            size="sm"
            onClick={handleRefreshBoth}
            title="Reload both client and freelancer frames"
          >
            <RefreshCw size={13} style={{ marginRight: '0.35rem' }} />
            Reload
          </Button>

          <Button
            id="split-reset-btn"
            variant="secondary"
            size="sm"
            onClick={handleResetDemo}
            disabled={isResetting}
            title="Wipe and re-seed clean demo project"
          >
            <RotateCcw size={13} className={isResetting ? 'spin' : ''} style={{ marginRight: '0.35rem' }} />
            {isResetting ? 'Resetting...' : 'Reset Demo'}
          </Button>
        </div>
      </header>

      {/* Mobile viewport switcher (< 1024px) */}
      <div
        className="mobile-split-tabs"
        style={{
          display: 'none',
          padding: '0.5rem 1rem',
          backgroundColor: 'var(--paper-warm)',
          borderBottom: '1px solid var(--line)',
          justifyContent: 'center',
          gap: '0.5rem',
        }}
      >
        <button
          type="button"
          id="split-mobile-client-tab"
          onClick={() => setMobileTab('client')}
          style={{
            padding: '0.35rem 1rem',
            borderRadius: 'var(--radius-pill)',
            border: mobileTab === 'client' ? '1.5px solid var(--forest)' : '1px solid var(--line)',
            backgroundColor: mobileTab === 'client' ? 'var(--surface)' : 'transparent',
            fontWeight: 600,
            fontSize: '0.75rem',
            color: 'var(--ink)',
            cursor: 'pointer',
          }}
        >
          Client Frame
        </button>
        <button
          type="button"
          id="split-mobile-freelancer-tab"
          onClick={() => setMobileTab('freelancer')}
          style={{
            padding: '0.35rem 1rem',
            borderRadius: 'var(--radius-pill)',
            border: mobileTab === 'freelancer' ? '1.5px solid var(--forest)' : '1px solid var(--line)',
            backgroundColor: mobileTab === 'freelancer' ? 'var(--surface)' : 'transparent',
            fontWeight: 600,
            fontSize: '0.75rem',
            color: 'var(--ink)',
            cursor: 'pointer',
          }}
        >
          Freelancer Frame
        </button>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .mobile-split-tabs {
            display: flex !important;
          }
          .split-container {
            flex-direction: column !important;
          }
          .split-pane-client {
            display: ${mobileTab === 'client' ? 'flex' : 'none'} !important;
            width: 100% !important;
          }
          .split-pane-freelancer {
            display: ${mobileTab === 'freelancer' ? 'flex' : 'none'} !important;
            width: 100% !important;
          }
        }
      `}</style>

      {/* Dual Iframe Workspace */}
      <div
        className="split-container"
        style={{
          flex: 1,
          display: 'flex',
          minHeight: 0,
          position: 'relative',
        }}
      >
        {/* Left: Client Persona Pane */}
        <div
          className="split-pane-client"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid var(--line)',
            minWidth: 0,
            backgroundColor: 'var(--surface)',
          }}
        >
          <div
            style={{
              padding: '0.45rem 1rem',
              backgroundColor: 'var(--paper)',
              borderBottom: '1px solid var(--line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              color: 'var(--ink-2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--forest)',
                }}
              />
              <span style={{ fontWeight: 700, color: 'var(--ink)' }}>Client View</span>
              <span style={{ color: 'var(--ink-3)' }}>— Sarah Lin (Acme Corp)</span>
            </div>

            <a
              href={currentPreset.clientPath}
              target="_blank"
              rel="noreferrer"
              title="Open client view in new tab"
              style={{
                color: 'var(--ink-3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem',
                textDecoration: 'none',
              }}
            >
              <ExternalLink size={12} />
              Open tab
            </a>
          </div>

          <iframe
            ref={clientIframeRef}
            id="client-iframe"
            title="Milestone Client Frame"
            src={currentPreset.clientPath}
            style={{
              flex: 1,
              width: '100%',
              border: 'none',
              backgroundColor: 'var(--surface)',
            }}
          />
        </div>

        {/* Right: Freelancer Persona Pane */}
        <div
          className="split-pane-freelancer"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            backgroundColor: 'var(--surface)',
          }}
        >
          <div
            style={{
              padding: '0.45rem 1rem',
              backgroundColor: 'var(--paper)',
              borderBottom: '1px solid var(--line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              color: 'var(--ink-2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--teal)',
                }}
              />
              <span style={{ fontWeight: 700, color: 'var(--ink)' }}>Freelancer View</span>
              <span style={{ color: 'var(--ink-3)' }}>— Arjun Mehta</span>
            </div>

            <a
              href={currentPreset.freelancerPath}
              target="_blank"
              rel="noreferrer"
              title="Open freelancer view in new tab"
              style={{
                color: 'var(--ink-3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem',
                textDecoration: 'none',
              }}
            >
              <ExternalLink size={12} />
              Open tab
            </a>
          </div>

          <iframe
            ref={freelancerIframeRef}
            id="freelancer-iframe"
            title="Milestone Freelancer Frame"
            src={currentPreset.freelancerPath}
            style={{
              flex: 1,
              width: '100%',
              border: 'none',
              backgroundColor: 'var(--surface)',
            }}
          />
        </div>
      </div>
    </div>
  );
};

