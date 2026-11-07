import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LifecycleProgress } from '../components/ui/LifecycleProgress.js';
import { Briefcase, UserCheck, ArrowRight } from 'lucide-react';

const LIFECYCLE_STAGES = ['agreed', 'funded', 'submitted', 'approved', 'paid'];

export const GetStartedPage: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 5);
    }, 2200);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 70px)',
        display: 'grid',
        gridTemplateColumns: 'minmax(320px, 420px) 1fr',
        backgroundColor: 'var(--paper)',
      }}
      className="get-started-container"
    >
      {/* Left Panel: Forest background with looping lifecycle */}
      <aside
        style={{
          backgroundColor: 'var(--forest)',
          color: 'var(--paper)',
          padding: '3.5rem 2.5rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '2rem',
        }}
        className="get-started-aside"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Brand mark badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-hidden="true"
            >
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  backgroundColor: 'var(--teal)',
                  transform: 'rotate(45deg)',
                }}
              />
            </div>
            <span style={{ fontSize: '1.125rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--paper)' }}>
              Milestone
            </span>
          </div>

          <div>
            <h2
              className="font-display"
              style={{
                fontSize: 'clamp(1.75rem, 2.5vw, 2.25rem)',
                lineHeight: 1.2,
                color: 'var(--paper)',
                margin: '0 0 1rem 0',
              }}
            >
              Plan the work. Agree the proof. Settle the milestone.
            </h2>
            <p style={{ fontSize: '0.9375rem', lineHeight: 1.6, color: 'var(--paper-muted)', margin: 0 }}>
              Milestone replaces vague scope arguments with objective acceptance criteria,
              secure sandbox funding, and verifiable payouts.
            </p>
          </div>

          {/* Compact Looping Lifecycle */}
          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '1.25rem',
            }}
          >
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#7ee7d2',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: '1rem',
              }}
            >
              The Standard Flow
            </div>
            <LifecycleProgress
              backendStatus={LIFECYCLE_STAGES[activeStep]}
              variant="compact"
              style={{ color: 'var(--paper)' }}
            />
          </div>
        </div>

        {/* Prototype footnote */}
        <div style={{ fontSize: '0.75rem', color: 'var(--paper-muted)' }}>
          <span style={{ color: 'var(--paper)', fontWeight: 600 }}>PayPal Sandbox Active</span> • No real money moves.
        </div>
      </aside>

      {/* Right Panel: Role Choice */}
      <main
        style={{
          padding: '4rem 2.5rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          maxWidth: '680px',
        }}
      >
        <div style={{ marginBottom: '2.5rem' }}>
          <span
            style={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--teal-ink)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Get Started
          </span>
          <h1
            className="font-display"
            style={{
              fontSize: 'clamp(2.25rem, 4vw, 3rem)',
              lineHeight: 1.15,
              color: 'var(--ink)',
              margin: '0.5rem 0 0.75rem 0',
            }}
          >
            How will you use Milestone?
          </h1>
          <p style={{ fontSize: '1.0625rem', color: 'var(--ink-2)', margin: 0 }}>
            Choose your role to enter the appropriate workspace.
          </p>
        </div>

        {/* Two Selectable Role Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Card 1: I'm hiring */}
          <Link
            to="/client/new"
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div
              id="role-card-client"
              tabIndex={0}
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: '16px',
                padding: '1.75rem',
                cursor: 'pointer',
                display: 'flex',
                gap: '1.5rem',
                alignItems: 'flex-start',
                transition: 'all var(--duration-fast) var(--ease-out)',
                boxShadow: 'var(--shadow-sm)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--forest)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--line)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--paper)',
                  border: '1px solid var(--line)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: 'var(--forest)',
                }}
              >
                <Briefcase size={22} />
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
                    I'm hiring
                  </h2>
                  <ArrowRight size={18} style={{ color: 'var(--ink-2)' }} />
                </div>
                <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>
                  Turn a brief into a structured plan. Invite your freelancer. Fund and review each milestone.
                </p>
                <div style={{ marginTop: '1rem' }}>
                  <span
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--teal-ink)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    <span>Create a project</span>
                    <ArrowRight size={14} />
                  </span>
                </div>
              </div>
            </div>
          </Link>

          {/* Card 2: I'm delivering work */}
          <Link
            to="/join"
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div
              id="role-card-freelancer"
              tabIndex={0}
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: '16px',
                padding: '1.75rem',
                cursor: 'pointer',
                display: 'flex',
                gap: '1.5rem',
                alignItems: 'flex-start',
                transition: 'all var(--duration-fast) var(--ease-out)',
                boxShadow: 'var(--shadow-sm)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--forest)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--line)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--paper)',
                  border: '1px solid var(--line)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: 'var(--teal)',
                }}
              >
                <UserCheck size={22} />
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
                    I'm delivering work
                  </h2>
                  <ArrowRight size={18} style={{ color: 'var(--ink-2)' }} />
                </div>
                <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>
                  Join a project with an invite. Know exactly what is expected. Submit proof and track your payouts.
                </p>
                <div style={{ marginTop: '1rem' }}>
                  <span
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--teal-ink)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    <span>Join with an invite</span>
                    <ArrowRight size={14} />
                  </span>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Direct link for existing code */}
        <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--ink-2)' }}>
            Already received an invite token or link?{' '}
            <Link
              to="/join"
              style={{
                color: 'var(--teal-ink)',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Enter invite code &rarr;
            </Link>
          </span>
        </div>
      </main>

      <style>{`
        @media (max-width: 768px) {
          .get-started-container {
            grid-template-columns: 1fr !important;
          }
          .get-started-aside {
            padding: 2rem 1.5rem !important;
          }
        }
      `}</style>
    </div>
  );
};
