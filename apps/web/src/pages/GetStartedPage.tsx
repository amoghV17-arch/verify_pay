import React from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../components/auth/AuthLayout.js';
import { Briefcase, UserCheck, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export const GetStartedPage: React.FC = () => {
  const { authenticated } = useAuth();
  const clientHref = authenticated ? '/client/new' : '/signup?intent=client';
  const freelancerHref = authenticated ? '/join' : '/signup?intent=freelancer';

  return (
    <AuthLayout subtitle="Milestone replaces vague scope arguments with objective acceptance criteria, sandbox funding, and verifiable payouts.">
      <div>
        <div style={{ marginBottom: '2rem' }}>
          <span
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--teal-ink)',
            }}
          >
            Get started
          </span>
          <h1
            className="font-display"
            style={{
              fontSize: 'clamp(2rem, 3.8vw, 2.75rem)',
              lineHeight: 1.15,
              color: 'var(--ink)',
              margin: '0.35rem 0 0.75rem 0',
            }}
          >
            How will you use Milestone?
          </h1>
          <p style={{ fontSize: '1.0625rem', color: 'var(--ink-2)', margin: 0 }}>
            Choose your starting workspace. You can use the same account for both roles later.
          </p>
        </div>

        {/* Two Selectable Role Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Card 1: I'm hiring */}
          <Link
            to={clientHref}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div
              id="role-card-client"
              tabIndex={0}
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: '16px',
                padding: '1.5rem',
                cursor: 'pointer',
                display: 'flex',
                gap: '1.25rem',
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
                  <h2 style={{ fontSize: '1.1875rem', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
                    I&apos;m hiring
                  </h2>
                  <ArrowRight size={18} style={{ color: 'var(--ink-2)' }} />
                </div>
                <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>
                  Turn a brief into a structured plan. Invite your freelancer. Fund and review each milestone.
                </p>
                <div style={{ marginTop: '0.9rem' }}>
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
                    <span>Create a client account</span>
                    <ArrowRight size={14} />
                  </span>
                </div>
              </div>
            </div>
          </Link>

          {/* Card 2: I'm delivering work */}
          <Link
            to={freelancerHref}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div
              id="role-card-freelancer"
              tabIndex={0}
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: '16px',
                padding: '1.5rem',
                cursor: 'pointer',
                display: 'flex',
                gap: '1.25rem',
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
                  <h2 style={{ fontSize: '1.1875rem', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
                    I&apos;m delivering work
                  </h2>
                  <ArrowRight size={18} style={{ color: 'var(--ink-2)' }} />
                </div>
                <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>
                  Join a project with an invite. Know what is expected. Submit proof and track payouts.
                </p>
                <div style={{ marginTop: '0.9rem' }}>
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
                    <span>Create a freelancer account</span>
                    <ArrowRight size={14} />
                  </span>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Direct links for existing accounts & invite codes */}
        <div
          style={{
            marginTop: '2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
            textAlign: 'center',
            fontSize: '0.875rem',
            color: 'var(--ink-2)',
          }}
        >
          <span>
            Already received an invite code or link?{' '}
            <Link
              to="/join"
              style={{
                color: 'var(--teal-ink)',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Preview invite agreement &rarr;
            </Link>
          </span>
          <span>
            Already have an account?{' '}
            <Link
              to="/login"
              style={{
                color: 'var(--teal-ink)',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Log in
            </Link>
          </span>
        </div>
      </div>
    </AuthLayout>
  );
};

