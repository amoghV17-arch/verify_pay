import React, { useState } from 'react';
import { FinancialFigure } from '../ui/FinancialFigure.js';
import { StatusBadge } from '../ui/StatusBadge.js';
import { Button } from '../ui/Button.js';
import {
  Briefcase,
  UserCheck,
  CheckCircle,
  Shield,
  ArrowRight,
  Lock,
  FileCheck2,
} from 'lucide-react';

export const TwoRolesSection: React.FC = () => {
  const [activeRole, setActiveRole] = useState<'client' | 'freelancer'>('client');

  return (
    <section
      id="for-clients"
      style={{
        padding: '5rem 1.5rem',
        backgroundColor: 'var(--surface)',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        {/* Section Header */}
        <div
          style={{
            maxWidth: '680px',
            marginBottom: '3rem',
          }}
        >
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
            Tailored interfaces
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
            Two roles, one agreement.
          </h2>
          <p
            style={{
              fontSize: '1.0625rem',
              color: 'var(--ink-2)',
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            Both parties share the exact same milestone agreement and ledger truth,
            while having an interface purpose-built for their distinct daily responsibilities.
          </p>
        </div>

        {/* Segmented Role Toggle */}
        <div
          role="tablist"
          aria-label="Select role perspective to preview"
          style={{
            display: 'inline-flex',
            backgroundColor: 'var(--paper)',
            padding: '4px',
            borderRadius: '10px',
            border: '1px solid var(--line)',
            marginBottom: '2rem',
          }}
        >
          <button
            role="tab"
            type="button"
            aria-selected={activeRole === 'client'}
            onClick={() => setActiveRole('client')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1.25rem',
              borderRadius: '7px',
              border: 'none',
              backgroundColor: activeRole === 'client' ? 'var(--surface)' : 'transparent',
              color: activeRole === 'client' ? 'var(--ink)' : 'var(--ink-2)',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
              boxShadow: activeRole === 'client' ? 'var(--shadow-sm)' : 'none',
              transition: 'all var(--duration-fast)',
            }}
          >
            <Briefcase size={16} />
            <span>I'm hiring (Client)</span>
          </button>

          <button
            role="tab"
            type="button"
            aria-selected={activeRole === 'freelancer'}
            onClick={() => setActiveRole('freelancer')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1.25rem',
              borderRadius: '7px',
              border: 'none',
              backgroundColor: activeRole === 'freelancer' ? 'var(--surface)' : 'transparent',
              color: activeRole === 'freelancer' ? 'var(--ink)' : 'var(--ink-2)',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
              boxShadow: activeRole === 'freelancer' ? 'var(--shadow-sm)' : 'none',
              transition: 'all var(--duration-fast)',
            }}
          >
            <UserCheck size={16} />
            <span>I'm delivering work (Freelancer)</span>
          </button>
        </div>

        {/* Dynamic Preview Container */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '2.5rem',
            alignItems: 'start',
          }}
        >
          {/* Left: Component Mockup */}
          <div
            style={{
              backgroundColor: 'var(--paper)',
              border: '1px solid var(--line)',
              borderRadius: '16px',
              padding: '1.75rem',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--line)',
                paddingBottom: '1rem',
                marginBottom: '1.25rem',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--teal-ink)',
                    letterSpacing: '0.04em',
                  }}
                >
                  {activeRole === 'client' ? 'Client Workspace' : 'Freelancer Workspace'}
                </span>
                <h4 style={{ margin: '0.2rem 0 0 0', fontSize: '1.125rem', color: 'var(--ink)' }}>
                  Brand-site Redesign & Launch
                </h4>
              </div>

              <StatusBadge state="funded" label="Sandbox Active" size="sm" />
            </div>

            {/* Financial Status Summary */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '1rem',
                marginBottom: '1.5rem',
                padding: '1rem',
                backgroundColor: 'var(--surface)',
                borderRadius: '8px',
                border: '1px solid var(--line)',
              }}
            >
              <FinancialFigure
                amountCents={activeRole === 'client' ? 540000 : 540000}
                size="md"
                label={activeRole === 'client' ? 'Funds held for project' : 'Locked for your work'}
                trend="held"
              />
              <FinancialFigure
                amountCents={260000}
                size="md"
                label={activeRole === 'client' ? 'Released to date' : 'Paid out to date'}
                trend="paid"
              />
            </div>

            {/* Next Up Action Box */}
            <div
              style={{
                border: '1px solid var(--line)',
                borderRadius: '10px',
                padding: '1.25rem',
                backgroundColor: 'var(--surface)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-2)', textTransform: 'uppercase' }}>
                  Next Required Action
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--amber-ink)', fontWeight: 600 }}>
                  Due in 4 days
                </span>
              </div>

              <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--ink)' }}>
                {activeRole === 'client'
                  ? 'Review Milestone 3 submission (Interactive Prototype)'
                  : 'Submit proof for Milestone 3 (Interactive Prototype)'}
              </div>

              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--ink-2)', lineHeight: 1.4 }}>
                {activeRole === 'client'
                  ? 'Freelancer submitted PR and Figma links. Automated AI criteria checks passed with 98% confidence.'
                  : 'Funds ($2,400.00) are confirmed held. Upload deploy URL and Figma files to trigger automated verification.'}
              </p>

              <div style={{ marginTop: '0.5rem' }}>
                <Button variant="primary" size="sm">
                  {activeRole === 'client' ? 'Open Review & Authorize Release' : 'Attach Proof & Submit Work'}
                  <ArrowRight size={14} />
                </Button>
              </div>
            </div>
          </div>

          {/* Right: 3 Key Value Propositions per Role */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingTop: '0.5rem' }}>
            <h3
              style={{
                fontSize: '1.25rem',
                fontWeight: 600,
                color: 'var(--ink)',
                margin: 0,
              }}
            >
              {activeRole === 'client'
                ? 'Control your budget with objective verification'
                : 'Get paid promptly with zero payment uncertainty'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {(activeRole === 'client'
                ? [
                    {
                      icon: <FileCheck2 size={20} style={{ color: 'var(--teal)' }} />,
                      title: 'Structured plans from plain briefs',
                      description: 'Turn project goals into verifiable milestone criteria automatically. You review and edit before approving.',
                    },
                    {
                      icon: <Lock size={20} style={{ color: 'var(--teal)' }} />,
                      title: 'Funds held securely for each milestone',
                      description: 'Authorize funds upfront in PayPal Sandbox. Money stays committed to the project and releases only as each milestone passes.',
                    },
                    {
                      icon: <Shield size={20} style={{ color: 'var(--teal)' }} />,
                      title: 'Evidence-based AI review',
                      description: 'Every deliverable is evaluated against the agreed criteria. Review the evidence, check the trace, or object with one click.',
                    },
                  ]
                : [
                    {
                      icon: <FileCheck2 size={20} style={{ color: 'var(--teal)' }} />,
                      title: 'Explicit acceptance criteria upfront',
                      description: 'No vague scopes or moving targets. Both sides agree to exact deliverables and passing criteria before you begin.',
                    },
                    {
                      icon: <Lock size={20} style={{ color: 'var(--teal)' }} />,
                      title: 'Work only when funds are confirmed held',
                      description: 'See the verified project balance in PayPal Sandbox. Deliver with complete confidence that payment is reserved for you.',
                    },
                    {
                      icon: <CheckCircle size={20} style={{ color: 'var(--teal)' }} />,
                      title: 'Automated verification & prompt payout',
                      description: 'Submit proof links and let AI verify compliance with agreed criteria. Approved milestones release funds straight to your PayPal sandbox.',
                    },
                  ]
              ).map((item, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--paper)',
                      border: '1px solid var(--line)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {item.icon}
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--ink)' }}>
                      {item.title}
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
