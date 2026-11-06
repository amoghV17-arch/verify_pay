import React, { useState, useEffect, useRef } from 'react';
import { LifecycleProgress } from '../ui/LifecycleProgress.js';
import { StatusBadge } from '../ui/StatusBadge.js';
import { FinancialFigure } from '../ui/FinancialFigure.js';
import { EvidenceChip } from '../ui/EvidenceChip.js';
import { Check, Receipt, Sparkles } from 'lucide-react';

interface StageData {
  key: string;
  backendStatus: string;
  stepIndex: number;
  title: string;
  subtitle: string;
  clientPerspective: string;
  freelancerPerspective: string;
  cardBadgeState: 'agreed' | 'funded' | 'in_review' | 'paid';
  cardBadgeLabel: string;
  cardStatusSummary: string;
  criteriaChecks: [boolean, boolean, boolean];
  chipsVisible: boolean;
  payoutVisible: boolean;
}

const STAGES: StageData[] = [
  {
    key: 'agreed',
    backendStatus: 'agreed',
    stepIndex: 0,
    title: '1. Agreed',
    subtitle: 'The plan and acceptance criteria are locked before any code or design begins.',
    clientPerspective: 'Scope, timeline, and criteria agreed. Funds remain in your account until you approve.',
    freelancerPerspective: 'Exact acceptance rules known upfront. No shifting goalposts or surprise requests.',
    cardBadgeState: 'agreed',
    cardBadgeLabel: 'Scope Agreed',
    cardStatusSummary: 'Awaiting PayPal sandbox project funding',
    criteriaChecks: [false, false, false],
    chipsVisible: false,
    payoutVisible: false,
  },
  {
    key: 'funded',
    backendStatus: 'funded',
    stepIndex: 1,
    title: '2. Funded',
    subtitle: 'Client commits milestone funds to the project balance in PayPal Sandbox.',
    clientPerspective: 'Payment authorized in sandbox. Funds held for this project and released on milestone verification.',
    freelancerPerspective: 'Funds confirmed held for this milestone. Work begins with complete payment confidence.',
    cardBadgeState: 'funded',
    cardBadgeLabel: 'Funded in Sandbox',
    cardStatusSummary: '$2,400.00 held for this milestone',
    criteriaChecks: [false, false, false],
    chipsVisible: false,
    payoutVisible: false,
  },
  {
    key: 'submitted',
    backendStatus: 'submitted',
    stepIndex: 2,
    title: '3. Submitted',
    subtitle: 'Freelancer submits verifiable deliverables: GitHub repo, Figma link, deploy URL.',
    clientPerspective: 'Submission notification received with tamper-evident proof links.',
    freelancerPerspective: 'Submitted with attached evidence chips. Automated criteria evaluation initiates.',
    cardBadgeState: 'in_review',
    cardBadgeLabel: 'Evaluating Proof',
    cardStatusSummary: 'AI reviewer checking 3 acceptance criteria',
    criteriaChecks: [true, true, false],
    chipsVisible: true,
    payoutVisible: false,
  },
  {
    key: 'verified',
    backendStatus: 'approved',
    stepIndex: 3,
    title: '4. Verified',
    subtitle: 'AI reviewer inspects proof against agreed criteria with deterministic rule execution.',
    clientPerspective: 'Inspection report ready: all criteria satisfied with 98% confidence. Full tool trace available.',
    freelancerPerspective: 'Proof passed objective verification. Payout release triggered.',
    cardBadgeState: 'in_review',
    cardBadgeLabel: 'Criteria Passed',
    cardStatusSummary: 'All criteria passed • High confidence',
    criteriaChecks: [true, true, true],
    chipsVisible: true,
    payoutVisible: false,
  },
  {
    key: 'paid',
    backendStatus: 'paid',
    stepIndex: 4,
    title: '5. Paid',
    subtitle: 'PayPal sandbox payout executes immediately and logs an immutable ledger entry.',
    clientPerspective: 'Payout issued to freelancer PayPal sandbox. Audit ledger and receipt generated.',
    freelancerPerspective: 'Funds received in sandbox balance ($2,400.00). Milestone settled.',
    cardBadgeState: 'paid',
    cardBadgeLabel: 'Paid via PayPal',
    cardStatusSummary: 'Sandbox payout completed • Ledger seq #42',
    criteriaChecks: [true, true, true],
    chipsVisible: true,
    payoutVisible: true,
  },
];

export const ProofToPaymentScene: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeStageIdx, setActiveStageIdx] = useState(0);
  const [isMobileOrReduced, setIsMobileOrReduced] = useState(false);

  useEffect(() => {
    const checkMedia = () => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const isMobile = window.innerWidth < 768;
      setIsMobileOrReduced(reduced || isMobile);
    };

    checkMedia();
    window.addEventListener('resize', checkMedia);
    return () => window.removeEventListener('resize', checkMedia);
  }, []);

  useEffect(() => {
    if (isMobileOrReduced) return;

    let rafId: number;
    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const containerHeight = containerRef.current.offsetHeight;
      const windowHeight = window.innerHeight;

      // Calculate progress 0 to 1 through container
      const totalScrollable = containerHeight - windowHeight;
      const currentScroll = -rect.top;

      if (totalScrollable <= 0) return;

      const progress = Math.max(0, Math.min(1, currentScroll / totalScrollable));
      // Map progress to 5 stages (0, 1, 2, 3, 4)
      const stage = Math.min(4, Math.floor(progress * 5));
      setActiveStageIdx(stage);
    };

    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(handleScroll);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafId);
    };
  }, [isMobileOrReduced]);

  // Mobile or Reduced Motion: render stacked list
  if (isMobileOrReduced) {
    return (
      <section
        style={{
          backgroundColor: 'var(--forest)',
          color: 'var(--paper)',
          padding: '4rem 1.5rem',
        }}
        aria-label="Proof to payment lifecycle demonstration"
      >
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
            <span
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: '#7ee7d2',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              The five stages
            </span>
            <h2
              className="font-display"
              style={{
                fontSize: '2.25rem',
                color: 'var(--paper)',
                marginTop: '0.5rem',
                marginBottom: '1rem',
              }}
            >
              From agreed proof to instant payout.
            </h2>
            <p style={{ color: 'var(--paper-muted)', maxWidth: '600px', margin: '0 auto' }}>
              Every milestone progresses through five objective steps with complete transparency for both parties.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            {STAGES.map((stage) => (
              <div
                key={stage.key}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.25rem', color: 'var(--paper)', margin: 0 }}>{stage.title}</h3>
                  <StatusBadge state={stage.cardBadgeState} label={stage.cardBadgeLabel} />
                </div>
                <p style={{ color: 'var(--paper-muted)', fontSize: '0.9375rem', marginBottom: '1.25rem' }}>
                  {stage.subtitle}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem', fontSize: '0.8125rem' }}>
                  <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '6px' }}>
                    <strong style={{ color: '#7ee7d2' }}>Client sees: </strong>
                    <span style={{ color: 'var(--paper)' }}>{stage.clientPerspective}</span>
                  </div>
                  <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '6px' }}>
                    <strong style={{ color: '#7ee7d2' }}>Freelancer sees: </strong>
                    <span style={{ color: 'var(--paper)' }}>{stage.freelancerPerspective}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Desktop Pinned Scroll Scene
  const activeStage = STAGES[activeStageIdx];

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        backgroundColor: 'var(--forest)',
        color: 'var(--paper)',
        minHeight: '380vh',
      }}
      aria-label="Proof to payment interactive scroll scene"
    >
      {/* Sticky Inner Viewport */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '2rem 2rem',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
          {/* Top Bar: Section Title + 5-step LifecycleProgress */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '2.5rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
              paddingBottom: '1.25rem',
              gap: '2rem',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#7ee7d2',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Signature Flow
              </span>
              <h2
                className="font-display"
                style={{
                  fontSize: '1.75rem',
                  color: 'var(--paper)',
                  margin: '0.25rem 0 0 0',
                }}
              >
                Proof to Payment
              </h2>
            </div>

            {/* Lifecycle Progress across the top */}
            <div style={{ minWidth: '420px' }}>
              <LifecycleProgress
                backendStatus={activeStage.backendStatus}
                variant="compact"
                style={{ color: 'var(--paper)' }}
              />
            </div>
          </div>

          {/* Main 2-Column Split: Stage Details (Left) + Morphing Card (Right) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.1fr 1fr',
              gap: '3.5rem',
              alignItems: 'center',
            }}
          >
            {/* Left Column: Stage Copy & Perspectives */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '0.25rem 0.65rem',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(126, 231, 210, 0.15)',
                    color: '#7ee7d2',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    marginBottom: '0.75rem',
                  }}
                >
                  Stage {activeStage.stepIndex + 1} of 5
                </span>
                <h3
                  className="font-display"
                  style={{
                    fontSize: '2.5rem',
                    lineHeight: 1.15,
                    color: 'var(--paper)',
                    margin: '0 0 0.75rem 0',
                  }}
                >
                  {activeStage.title}
                </h3>
                <p
                  style={{
                    fontSize: '1.125rem',
                    lineHeight: 1.6,
                    color: 'var(--paper-muted)',
                    margin: 0,
                  }}
                >
                  {activeStage.subtitle}
                </p>
              </div>

              {/* Roles Perspectives Grid */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  marginTop: '0.5rem',
                }}
              >
                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    padding: '1rem',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#7ee7d2',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: '0.25rem',
                    }}
                  >
                    The client sees:
                  </div>
                  <div style={{ fontSize: '0.9375rem', color: 'var(--paper)', lineHeight: 1.45 }}>
                    {activeStage.clientPerspective}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    padding: '1rem',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#7ee7d2',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: '0.25rem',
                    }}
                  >
                    The freelancer sees:
                  </div>
                  <div style={{ fontSize: '0.9375rem', color: 'var(--paper)', lineHeight: 1.45 }}>
                    {activeStage.freelancerPerspective}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Morphing Milestone Card */}
            <div
              style={{
                backgroundColor: 'var(--surface)',
                color: 'var(--ink)',
                borderRadius: '16px',
                padding: '2rem',
                border: '1px solid var(--line)',
                boxShadow: 'var(--shadow-xl)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
                position: 'relative',
                transition: 'all var(--duration-normal) var(--ease-out)',
              }}
            >
              {/* Header: Title + Status + Amount */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--line)',
                  paddingBottom: '1rem',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-2)' }}>
                      Milestone 3
                    </span>
                    <StatusBadge state={activeStage.cardBadgeState} label={activeStage.cardBadgeLabel} />
                  </div>
                  <h4
                    style={{
                      fontSize: '1.25rem',
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
                  label="Agreed payout"
                />
              </div>

              {/* Status Note */}
              <div
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--ink-2)',
                  fontStyle: 'italic',
                }}
              >
                {activeStage.cardStatusSummary}
              </div>

              {/* Acceptance Criteria */}
              <div
                style={{
                  backgroundColor: 'var(--paper)',
                  borderRadius: '10px',
                  border: '1px solid var(--line)',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                }}
              >
                <div
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--ink-2)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: '0.2rem',
                  }}
                >
                  Acceptance Criteria
                </div>

                {[
                  'Figma prototype connects all 4 onboarding states',
                  'Lighthouse accessibility score >= 95 verified',
                  'Video walkthrough covers error and retry states',
                ].map((c, i) => {
                  const isChecked = activeStage.criteriaChecks[i];
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.8125rem',
                        color: isChecked ? 'var(--ink)' : 'var(--ink-2)',
                      }}
                    >
                      <div
                        style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '4px',
                          backgroundColor: isChecked ? 'var(--teal)' : 'var(--line-strong)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background-color var(--duration-fast)',
                          flexShrink: 0,
                        }}
                      >
                        {isChecked && <Check size={11} color="#fff" strokeWidth={3} />}
                      </div>
                      <span>{c}</span>
                    </div>
                  );
                })}
              </div>

              {/* Evidence Chips when Submitted/Verified/Paid */}
              {activeStage.chipsVisible && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    flexWrap: 'wrap',
                    padding: '0.75rem',
                    backgroundColor: 'var(--surface-sunken)',
                    borderRadius: '8px',
                  }}
                >
                  <EvidenceChip type="repo" label="PR #42 merged" />
                  <EvidenceChip type="figma" label="figma.com/proto/v2" />
                  <EvidenceChip type="url" label="Lighthouse Report (98/100)" />
                </div>
              )}

              {/* Final Paid Receipt Stamp */}
              {activeStage.payoutVisible && (
                <div
                  style={{
                    padding: '0.85rem 1rem',
                    backgroundColor: 'rgba(15, 165, 115, 0.08)',
                    border: '1px solid var(--teal)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Receipt size={18} style={{ color: 'var(--teal)' }} />
                    <div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink)' }}>
                        PayPal Sandbox Payout Released
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}>
                        Ref: PAYID-M3-982104 • Ledger seq #42
                      </div>
                    </div>
                  </div>
                  <Sparkles size={16} style={{ color: 'var(--teal)' }} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
