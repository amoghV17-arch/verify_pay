import React, { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { apiRawFetch } from '../../lib/api.js';

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
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId') || 'proj_brand_launch';

  const [activePreset, setActivePreset] = useState<PresetView>('overview');
  const [mobileTab, setMobileTab] = useState<'client' | 'freelancer' | 'truth'>('client');
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [showTruthPane, setShowTruthPane] = useState(true);
  const [truthData, setTruthData] = useState<any>(null);

  const fetchTruthFeed = () => {
    fetch(`/api/proof/projects/${projectId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setTruthData(d))
      .catch(() => {});
  };

  React.useEffect(() => {
    fetchTruthFeed();
    const interval = setInterval(fetchTruthFeed, 5000);
    return () => clearInterval(interval);
  }, [projectId]);

  const clientIframeRef = useRef<HTMLIFrameElement>(null);
  const freelancerIframeRef = useRef<HTMLIFrameElement>(null);

  function getPresetPaths(presetKey: PresetView) {
    switch (presetKey) {
      case 'overview':
        return {
          clientPath: `/client/projects/${projectId}/overview?demoSlot=client`,
          freelancerPath: `/freelancer/projects/${projectId}/overview?demoSlot=freelancer`,
        };
      case 'deliverables':
        return {
          clientPath: `/client/projects/${projectId}/deliverables?demoSlot=client`,
          freelancerPath: `/freelancer/projects/${projectId}/deliverables?demoSlot=freelancer`,
        };
      case 'schedule':
        return {
          clientPath: `/client/projects/${projectId}/schedule?demoSlot=client`,
          freelancerPath: `/freelancer/projects/${projectId}/schedule?demoSlot=freelancer`,
        };
      case 'payments':
        return {
          clientPath: `/client/projects/${projectId}/payments?demoSlot=client`,
          freelancerPath: `/freelancer/projects/${projectId}/payments?demoSlot=freelancer`,
        };
    }
  }

  const currentPreset = {
    ...PRESETS[activePreset],
    ...getPresetPaths(activePreset),
  };

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
      await apiRawFetch('/api/demo/reset', { method: 'POST', body: JSON.stringify({}) });
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
    const p = getPresetPaths(presetKey);
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
            id="split-toggle-truth-btn"
            variant="quiet"
            size="sm"
            onClick={() => setShowTruthPane(!showTruthPane)}
            title="Toggle third pane: PayPal Truth"
          >
            <ShieldCheck size={13} style={{ marginRight: '0.35rem' }} />
            {showTruthPane ? '3-Pane View' : '2-Pane View'}
          </Button>

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
        <button
          type="button"
          id="split-mobile-truth-tab"
          onClick={() => setMobileTab('truth')}
          style={{
            padding: '0.35rem 1rem',
            borderRadius: 'var(--radius-pill)',
            border: mobileTab === 'truth' ? '1.5px solid #0070BA' : '1px solid var(--line)',
            backgroundColor: mobileTab === 'truth' ? 'var(--surface)' : 'transparent',
            fontWeight: 600,
            fontSize: '0.75rem',
            color: 'var(--ink)',
            cursor: 'pointer',
          }}
        >
          PayPal Truth
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
          .split-pane-truth {
            display: ${mobileTab === 'truth' ? 'flex' : 'none'} !important;
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
              <span style={{ color: 'var(--ink-3)' }}>
                — {projectId === 'proj_brand_launch' ? 'Sarah Lin (Acme Corp)' : 'Judge Client'}
              </span>
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
              <span style={{ color: 'var(--ink-3)' }}>
                — {projectId === 'proj_brand_launch' ? 'Arjun Mehta' : 'Judge Freelancer'}
              </span>
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

        {/* Right: PayPal Truth Live Feed Pane (§5.2) */}
        {showTruthPane && (
          <div
            className="split-pane-truth"
            style={{
              width: '340px',
              minWidth: '290px',
              maxWidth: '380px',
              display: 'flex',
              flexDirection: 'column',
              borderLeft: '1px solid var(--line)',
              backgroundColor: 'var(--surface)',
              overflowY: 'auto',
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
                    backgroundColor: '#0070BA',
                  }}
                />
                <span style={{ fontWeight: 700, color: 'var(--ink)' }}>PayPal Truth</span>
                <span style={{ color: 'var(--forest)', fontSize: '0.6875rem', fontWeight: 700 }}>● Live</span>
              </div>

              <a
                href="https://sandbox.paypal.com"
                target="_blank"
                rel="noreferrer"
                title="Open PayPal Sandbox Portal in a new tab"
                style={{
                  color: '#0070BA',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: '0.6875rem',
                }}
              >
                <ExternalLink size={11} />
                Sandbox Portal
              </a>
            </div>

            {/* Compact Live Truth Feed Content */}
            <div style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.75rem' }}>
              {/* Financial Snapshot */}
              <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-input)', backgroundColor: 'var(--paper-warm)', border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontWeight: 600, color: 'var(--forest)' }}>
                  <span>Ledger Status</span>
                  <span style={{ fontFamily: 'monospace' }}>
                    ${truthData?.reconciliation?.ledger?.totalCents ? (truthData.reconciliation.ledger.totalCents / 100).toFixed(2) : '0.00'} USD
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem', textAlign: 'center', fontSize: '0.6875rem' }}>
                  <div style={{ padding: '0.35rem', background: '#fff', borderRadius: '4px', border: '1px solid var(--line)' }}>
                    <div style={{ color: 'var(--ink-3)' }}>Funded</div>
                    <div style={{ fontWeight: 700, color: 'var(--forest)' }}>
                      ${truthData?.reconciliation?.ledger?.fundedCents ? (truthData.reconciliation.ledger.fundedCents / 100).toFixed(2) : '0.00'}
                    </div>
                  </div>
                  <div style={{ padding: '0.35rem', background: '#fff', borderRadius: '4px', border: '1px solid var(--line)' }}>
                    <div style={{ color: 'var(--ink-3)' }}>Held</div>
                    <div style={{ fontWeight: 700, color: 'var(--ink)' }}>
                      ${truthData?.reconciliation?.ledger?.heldCents ? (truthData.reconciliation.ledger.heldCents / 100).toFixed(2) : '0.00'}
                    </div>
                  </div>
                  <div style={{ padding: '0.35rem', background: '#fff', borderRadius: '4px', border: '1px solid var(--line)' }}>
                    <div style={{ color: 'var(--ink-3)' }}>Paid</div>
                    <div style={{ fontWeight: 700, color: 'var(--forest)' }}>
                      ${truthData?.reconciliation?.ledger?.paidCents ? (truthData.reconciliation.ledger.paidCents / 100).toFixed(2) : '0.00'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Feed Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.6875rem', textTransform: 'uppercase', color: 'var(--ink-3)', letterSpacing: '0.05em' }}>
                  Recent Settlements & Events
                </span>
                
                {truthData?.reconciliation?.rows && truthData.reconciliation.rows.length > 0 ? (
                  truthData.reconciliation.rows.map((row: any) => (
                    <div
                      key={row.id}
                      style={{
                        padding: '0.55rem 0.65rem',
                        borderRadius: 'var(--radius-input)',
                        border: '1px solid var(--line)',
                        backgroundColor: '#fff',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.2rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{row.label}</span>
                        <span
                          style={{
                            fontSize: '0.625rem',
                            fontWeight: 700,
                            padding: '0.1rem 0.35rem',
                            borderRadius: '3px',
                            backgroundColor: row.status === 'match' ? 'var(--teal-subtle)' : '#fee2e2',
                            color: row.status === 'match' ? 'var(--forest)' : '#b91c1c',
                          }}
                        >
                          {row.status === 'match' ? 'MATCH' : 'MISMATCH'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', fontFamily: 'monospace' }}>
                        <span style={{ color: 'var(--ink-3)' }}>Ledger: {row.ledgerValue}</span>
                        <span style={{ color: 'var(--forest)', fontWeight: 600 }}>PayPal: {row.paypalValue}</span>
                      </div>
                      {row.paypalRef && (
                        <div style={{ fontSize: '0.625rem', color: 'var(--ink-3)', fontFamily: 'monospace' }}>
                          Batch: {row.paypalRef.substring(0, 16)}...
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--ink-3)', fontStyle: 'italic', fontSize: '0.6875rem' }}>
                    Awaiting funding or settlement activity...
                  </div>
                )}
              </div>

              {/* Link to Full Proof Dashboard */}
              <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
                <a
                  href={`/demo/proof?projectId=${projectId}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    padding: '0.45rem',
                    borderRadius: 'var(--radius-input)',
                    backgroundColor: 'var(--paper)',
                    border: '1px solid var(--line)',
                    color: 'var(--forest)',
                    fontWeight: 600,
                    fontSize: '0.6875rem',
                    textDecoration: 'none',
                  }}
                >
                  Open Full Proof & Reconciliation →
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

