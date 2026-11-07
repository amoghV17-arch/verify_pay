import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { EvidenceChip } from '../components/ui/EvidenceChip.js';
import { ProductPreview } from '../components/landing/ProductPreview.js';
import { TimelineSection } from '../components/landing/TimelineSection.js';
import { ProofToPaymentScene } from '../components/landing/ProofToPaymentScene.js';
import { TwoRolesSection } from '../components/landing/TwoRolesSection.js';
import {
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  FileCode,
  Lock,
  Database,
  Sliders,
  Sparkles,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  return (
    <div style={{ backgroundColor: 'var(--paper)', minHeight: '100vh', color: 'var(--ink)', overflowX: 'hidden' }}>
      {/* ========================================================= */}
      {/* SECTION 1: HERO (Above the fold)                          */}
      {/* ========================================================= */}
      <section
        style={{
          padding: '4.5rem 1.5rem 5rem 1.5rem',
          maxWidth: '1200px',
          margin: '0 auto',
          boxSizing: 'border-box',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
          gap: '3.5rem',
          alignItems: 'center',
        }}
      >
        {/* Left Column: Headline, Subhead, CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Prototype Alert Badge */}
          <div style={{ display: 'inline-flex' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                backgroundColor: 'rgba(180, 83, 9, 0.1)',
                color: 'var(--amber-ink)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                border: '1px solid rgba(180, 83, 9, 0.2)',
              }}
            >
              <Sparkles size={13} aria-hidden="true" />
              Sandbox prototype. No real money moves.
            </span>
          </div>

          {/* Display Headline */}
          <h1
            className="font-display"
            style={{
              fontSize: 'clamp(2.5rem, 5.2vw, 4.25rem)',
              lineHeight: 1.08,
              letterSpacing: '-0.02em',
              color: 'var(--ink)',
              margin: 0,
            }}
          >
            Good work deserves a{' '}
            <span style={{ color: 'var(--teal-ink)', fontStyle: 'italic' }}>
              clear agreement.
            </span>
          </h1>

          {/* Subheading */}
          <p
            style={{
              fontSize: '1.25rem',
              lineHeight: 1.55,
              color: 'var(--ink-2)',
              margin: 0,
              maxWidth: '520px',
            }}
          >
            Plan the work, agree the proof, and connect every milestone to its payment.
          </p>

          {/* Plain sentence description */}
          <p
            style={{
              fontSize: '0.9375rem',
              lineHeight: 1.6,
              color: 'var(--ink-2)',
              margin: 0,
              maxWidth: '500px',
            }}
          >
            Milestone turns project briefs into verified milestones. Funds are committed upfront in PayPal
            Sandbox and released only when deliverables meet agreed acceptance criteria.
          </p>

          {/* Action CTAs */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              flexWrap: 'wrap',
              marginTop: '0.5rem',
            }}
          >
            <Link to="/get-started" style={{ textDecoration: 'none' }}>
              <Button variant="primary" size="lg">
                <span>Start a project</span>
                <ArrowRight size={18} aria-hidden="true" />
              </Button>
            </Link>

            <Link to="/join" style={{ textDecoration: 'none' }}>
              <Button variant="quiet" size="lg">
                Join a project
              </Button>
            </Link>
          </div>
        </div>

        {/* Right Column: Layered Built-in CSS Product Preview */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <ProductPreview />
        </div>
      </section>

      {/* ========================================================= */}
      {/* SECTION 2: TIMELINE STRIP (One agreement, every milestone) */}
      {/* ========================================================= */}
      <TimelineSection />

      {/* ========================================================= */}
      {/* SECTION 3: PROOF TO PAYMENT (The signature scroll scene)  */}
      {/* ========================================================= */}
      <ProofToPaymentScene />

      {/* ========================================================= */}
      {/* SECTION 4: TWO ROLES, ONE AGREEMENT                       */}
      {/* ========================================================= */}
      <TwoRolesSection />

      {/* ========================================================= */}
      {/* SECTION 5: PROOF BEFORE PAYMENT                           */}
      {/* ========================================================= */}
      <section
        style={{
          padding: '5rem 1.5rem',
          backgroundColor: 'var(--paper)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            boxSizing: 'border-box',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
            gap: '3.5rem',
            alignItems: 'center',
          }}
        >
          {/* Left Column: Proof Replay & Injection Defense */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--teal-ink)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Verification without bias
            </div>
            <h2
              className="font-display"
              style={{
                fontSize: 'clamp(2rem, 3.5vw, 2.75rem)',
                lineHeight: 1.15,
                color: 'var(--ink)',
                margin: 0,
              }}
            >
              Proof before payment.
            </h2>
            <p
              style={{
                fontSize: '1.0625rem',
                color: 'var(--ink-2)',
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              The AI reviewer inspects submitted work against the exact acceptance rules both parties agreed to.
              It recommends a verdict, but fixed server code enforces policies and human objection is always honored.
            </p>

            {/* Prompt Injection Defense Callout */}
            <div
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--line)',
                borderLeft: '4px solid var(--forest)',
                borderRadius: '8px',
                padding: '1.25rem',
                display: 'flex',
                gap: '1rem',
                alignItems: 'flex-start',
              }}
            >
              <ShieldAlert size={22} style={{ color: 'var(--forest)', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--ink)' }}>
                  Prompt injection defense
                </h4>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>
                  <em style={{ color: 'var(--ink)' }}>"Instructions found inside a delivery were ignored."</em>{' '}
                  Deliverables cannot instruct the AI to approve milestones or alter payout policies.
                  All submitted files and text are treated as untrusted data with strict delimiter isolation.
                </p>
              </div>
            </div>

            <div>
              <Link
                to="/safety"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--teal-ink)',
                  textDecoration: 'none',
                }}
              >
                <span>Read how review safety works</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {/* Right Column: Review Replay Card */}
          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: '16px',
              padding: '1.75rem',
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--line)',
                paddingBottom: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileCode size={18} style={{ color: 'var(--forest)' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink)' }}>
                  AI Review Evaluation
                </span>
              </div>
              <StatusBadge state="in_review" label="High Confidence (98%)" size="sm" />
            </div>

            {/* Criteria Evaluation List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {[
                {
                  text: 'Figma interactive prototype matches design tokens',
                  chip: <EvidenceChip type="figma" label="figma.com/file/v4..." />,
                  confidence: 'Met • 99% match',
                },
                {
                  text: 'Lighthouse accessibility audit >= 95 score',
                  chip: <EvidenceChip type="url" label="Lighthouse Report (98/100)" />,
                  confidence: 'Met • Verified',
                },
                {
                  text: 'Core onboarding flow video walkthrough attached',
                  chip: <EvidenceChip type="repo" label="Loom: 4 min walk" />,
                  confidence: 'Met • Verified',
                },
              ].map((c, i) => (
                <div
                  key={i}
                  style={{
                    padding: '0.85rem',
                    backgroundColor: 'var(--paper)',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--ink)' }}>
                    <CheckCircle2 size={15} style={{ color: 'var(--teal)', flexShrink: 0 }} />
                    <span style={{ fontWeight: 500 }}>{c.text}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: '1.4rem' }}>
                    {c.chip}
                    <span style={{ fontSize: '0.75rem', color: 'var(--teal-ink)', fontWeight: 600 }}>
                      {c.confidence}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Decision Footer */}
            <div
              style={{
                paddingTop: '0.5rem',
                borderTop: '1px solid var(--line)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.75rem',
                color: 'var(--ink-2)',
              }}
            >
              <span>Model: gemini-2.5-flash • Latency: 840ms</span>
              <span style={{ fontWeight: 600, color: 'var(--forest)' }}>Verdict: PASS</span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* SECTION 6: BUILT FOR TRUST                                */}
      {/* ========================================================= */}
      <section
        style={{
          padding: '5rem 1.5rem',
          backgroundColor: 'var(--surface)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ maxWidth: '680px', marginBottom: '3.5rem' }}>
            <div
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--teal-ink)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '0.5rem',
              }}
            >
              Complete transparency
            </div>
            <h2
              className="font-display"
              style={{
                fontSize: 'clamp(2rem, 3.5vw, 2.75rem)',
                lineHeight: 1.15,
                color: 'var(--ink)',
                margin: '0 0 1rem 0',
              }}
            >
              Built for trust.
            </h2>
            <p
              style={{
                fontSize: '1.0625rem',
                color: 'var(--ink-2)',
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              Milestone replaces vague verbal promises with an immutable record of funding,
              review evidence, and payouts.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
              gap: '3rem',
              alignItems: 'start',
              boxSizing: 'border-box',
            }}
          >
            {/* 4-Fact Quiet Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '1.5rem',
              }}
            >
              {[
                {
                  icon: <Lock size={20} style={{ color: 'var(--forest)' }} />,
                  title: 'Held for this project',
                  desc: 'Funds are held in PayPal Sandbox for the project and released milestone by milestone.',
                },
                {
                  icon: <CheckCircle2 size={20} style={{ color: 'var(--forest)' }} />,
                  title: 'Evidence on record',
                  desc: 'Every verification records the exact commit hash, document link, and evaluation trace.',
                },
                {
                  icon: <Database size={20} style={{ color: 'var(--forest)' }} />,
                  title: 'Append-only ledger',
                  desc: 'Every deposit, submission, review, and payout is logged with an immutable sequence id.',
                },
                {
                  icon: <Sliders size={20} style={{ color: 'var(--forest)' }} />,
                  title: 'Client chooses autonomy',
                  desc: 'The client controls review autonomy: automatic release, review-first, or manual approval.',
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: 'var(--paper)',
                    border: '1px solid var(--line)',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--line)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {item.icon}
                  </div>
                  <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--ink)' }}>
                    {item.title}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* Sample Ledger Snippet */}
            <div
              style={{
                backgroundColor: 'var(--paper)',
                border: '1px solid var(--line)',
                borderRadius: '12px',
                padding: '1.5rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1rem',
                  borderBottom: '1px solid var(--line)',
                  paddingBottom: '0.5rem',
                }}
              >
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink)' }}>
                  Sample Project Ledger
                </span>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontFamily: 'var(--font-mono)',
                    backgroundColor: 'var(--surface)',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    border: '1px solid var(--line)',
                    color: 'var(--ink-2)',
                  }}
                >
                  Sample ledger
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[
                  { seq: '#01', event: 'PROJECT_FUNDED', amount: '+$8,000.00', balance: '$8,000.00', date: 'Oct 12' },
                  { seq: '#02', event: 'MILESTONE_1_PAID', amount: '-$1,200.00', balance: '$6,800.00', date: 'Oct 26' },
                  { seq: '#03', event: 'MILESTONE_2_PAID', amount: '-$1,800.00', balance: '$5,000.00', date: 'Nov 16' },
                  { seq: '#04', event: 'MILESTONE_3_VERIFIED', amount: '$0.00', balance: '$5,000.00', date: 'Nov 24' },
                ].map((row) => (
                  <div
                    key={row.seq}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                      padding: '0.4rem 0.5rem',
                      borderRadius: '4px',
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--line)',
                    }}
                  >
                    <span style={{ color: 'var(--ink-2)', width: '32px' }}>{row.seq}</span>
                    <span style={{ fontWeight: 600, color: 'var(--ink)', flex: 1, padding: '0 0.5rem' }}>
                      {row.event}
                    </span>
                    <span style={{ color: row.amount.startsWith('-') ? 'var(--teal-ink)' : 'var(--ink)', width: '75px', textAlign: 'right' }}>
                      {row.amount}
                    </span>
                    <span style={{ color: 'var(--ink-2)', width: '60px', textAlign: 'right' }}>
                      {row.date}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* SECTION 7: FINAL CALL TO ACTION                           */}
      {/* ========================================================= */}
      <section
        style={{
          padding: '6rem 1.5rem',
          backgroundColor: 'var(--forest)',
          color: 'var(--paper)',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
          <h2
            className="font-display"
            style={{
              fontSize: 'clamp(2.25rem, 4.5vw, 3.5rem)',
              lineHeight: 1.1,
              color: 'var(--paper)',
              margin: 0,
            }}
          >
            Make every milestone count.
          </h2>

          <p
            style={{
              fontSize: '1.125rem',
              color: 'var(--paper-muted)',
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            Turn client briefs into verified deliverables and prompt sandbox payouts.
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              flexWrap: 'wrap',
              marginTop: '1rem',
            }}
          >
            <Link to="/get-started" style={{ textDecoration: 'none' }}>
              <Button variant="primary" size="lg">
                <span>Start a project</span>
                <ArrowRight size={18} />
              </Button>
            </Link>

            <Link to="/join" style={{ textDecoration: 'none' }}>
              <Button
                variant="quiet"
                size="lg"
                style={{
                  color: 'var(--paper)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                }}
              >
                Join with an invite
              </Button>
            </Link>
          </div>

          <span
            style={{
              fontSize: '0.8125rem',
              color: '#7ee7d2',
              fontWeight: 500,
              marginTop: '0.5rem',
            }}
          >
            Sandbox prototype. No real money moves.
          </span>
        </div>
      </section>
    </div>
  );
};
