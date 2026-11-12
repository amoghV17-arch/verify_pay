import React, { useEffect, useState } from 'react';
import { LifecycleProgress } from '../ui/LifecycleProgress.js';

const SAMPLE_STAGES = ['agreed', 'funded', 'submitted', 'approved', 'paid'] as const;

export interface AuthLayoutProps {
  children: React.ReactNode;
  subtitle?: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  subtitle = 'Agree on deliverables up front, fund milestones in PayPal Sandbox, and settle automatically when criteria pass.',
}) => {
  const [activeStep, setActiveStep] = useState(1);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % SAMPLE_STAGES.length);
    }, 2400);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="ms-auth-split">
      <aside className="ms-auth-aside" aria-label="How Milestone works">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          <div>
            <h2
              className="font-display"
              style={{
                fontSize: 'clamp(1.75rem, 2.5vw, 2.25rem)',
                lineHeight: 1.2,
                color: 'var(--paper)',
                margin: '0 0 0.9rem 0',
              }}
            >
              Plan the work. Agree the proof. Settle the milestone.
            </h2>
            <p
              style={{
                fontSize: '0.9375rem',
                lineHeight: 1.6,
                color: 'rgba(245, 242, 234, 0.78)',
                margin: 0,
              }}
            >
              {subtitle}
            </p>
          </div>

          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '12px',
              padding: '1.25rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem',
              }}
            >
              <span
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--teal-on-dark)',
                }}
              >
                Sample lifecycle
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'rgba(245, 242, 234, 0.72)',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: 'var(--radius-chip)',
                  padding: '0.15rem 0.55rem',
                }}
              >
                Sample
              </span>
            </div>
            <LifecycleProgress
              backendStatus={SAMPLE_STAGES[activeStep]}
              variant="compact"
              style={{ color: 'var(--paper)' }}
            />
          </div>
        </div>

        <div style={{ fontSize: '0.75rem', color: 'rgba(245, 242, 234, 0.75)' }}>
          Sandbox prototype. No real money moves.
        </div>
      </aside>

      <main className="ms-auth-main">
        <div className="ms-auth-card">{children}</div>
      </main>

      <style>{`
        .ms-auth-split {
          min-height: calc(100vh - 64px);
          display: grid;
          grid-template-columns: minmax(320px, 430px) 1fr;
          background-color: var(--paper);
        }
        .ms-auth-aside {
          background-color: var(--forest);
          color: var(--paper);
          padding: 3.5rem 2.5rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 2rem;
        }
        .ms-auth-main {
          padding: 3.5rem 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .ms-auth-card {
          width: 100%;
          max-width: 520px;
          margin: 0 auto;
        }
        @media (max-width: 900px) {
          .ms-auth-split {
            grid-template-columns: 1fr;
          }
          .ms-auth-aside {
            display: none;
          }
          .ms-auth-main {
            padding: 2rem 1.25rem 3rem;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
};

