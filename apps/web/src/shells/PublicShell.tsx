import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button.js';
import { DemoBar } from '../components/ui/DemoBar.js';
import { useAuth } from '../context/AuthContext.js';

export const PublicShell: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { authenticated, user, config, logout } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 8);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--paper)',
        color: 'var(--ink)',
      }}
    >
      {/* Sticky Header with hairline on scroll */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 500,
          backgroundColor: isScrolled ? 'rgba(245, 242, 234, 0.92)' : 'var(--paper)',
          backdropFilter: isScrolled ? 'blur(8px)' : 'none',
          borderBottom: isScrolled ? '1px solid var(--line)' : '1px solid transparent',
          transition: 'all var(--duration-fast) var(--ease-out)',
          padding: '0.85rem 1.5rem',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          {/* Logo / Wordmark */}
          <Link
            to="/"
            style={{
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              color: 'var(--ink)',
            }}
          >
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                backgroundColor: 'var(--forest)',
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
            <span
              style={{
                fontSize: '1.125rem',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                fontFamily: 'var(--font-ui)',
              }}
            >
              Milestone
            </span>
          </Link>

          {/* Nav Links */}
          <nav
            aria-label="Public marketing navigation"
            className="hide-on-mobile"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1.75rem',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            <a
              href="/#how-it-works"
              style={{ color: 'var(--ink-2)', textDecoration: 'none' }}
            >
              How it works
            </a>
            <a
              href="/#for-clients"
              style={{ color: 'var(--ink-2)', textDecoration: 'none' }}
            >
              For clients
            </a>
            <a
              href="/#for-freelancers"
              style={{ color: 'var(--ink-2)', textDecoration: 'none' }}
            >
              For freelancers
            </a>
            <Link
              to="/safety"
              style={{
                color: location.pathname === '/safety' ? 'var(--ink)' : 'var(--ink-2)',
                textDecoration: 'none',
              }}
            >
              Safety
            </Link>
          </nav>

          {/* Action CTAs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            {authenticated && user ? (
              <>
                <Link to="/settings" className="hide-on-mobile" style={{ textDecoration: 'none' }}>
                  <Button variant="quiet" size="sm">
                    Settings
                  </Button>
                </Link>
                <Button
                  variant="quiet"
                  size="sm"
                  className="hide-on-mobile"
                  onClick={async () => {
                    await logout();
                    navigate('/');
                  }}
                >
                  Sign out
                </Button>
                <Link
                  to={user.lastWorkspace === 'freelancer' ? '/freelancer' : '/client'}
                  style={{ textDecoration: 'none' }}
                >
                  <Button variant="primary" size="sm">
                    Open workspace
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link to="/join" className="hide-on-mobile" style={{ textDecoration: 'none' }}>
                  <Button variant="quiet" size="sm">
                    Join a project
                  </Button>
                </Link>
                <Link to="/login" style={{ textDecoration: 'none' }}>
                  <Button variant="secondary" size="sm">
                    Log in
                  </Button>
                </Link>
                <Link to="/get-started" style={{ textDecoration: 'none' }}>
                  <Button variant="primary" size="sm">
                    Get started
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Page Content */}
      <main style={{ flex: 1 }}>
        {children || <Outlet />}
      </main>

      {/* Public Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--line)',
          backgroundColor: 'var(--paper)',
          padding: '3rem 1.5rem',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '2rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '2rem',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '340px' }}>
              <span style={{ fontSize: '1.125rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
                Milestone
              </span>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>
                Milestone holds a project's budget, checks each delivery against criteria both sides agreed to, and releases payment when it passes.
              </p>
              <span
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--amber-ink)',
                  marginTop: '0.5rem',
                }}
              >
                Sandbox prototype. No real money moves.
              </span>
            </div>

            <div style={{ display: 'flex', gap: '3rem', fontSize: '0.875rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <strong style={{ fontSize: '0.8125rem', color: 'var(--ink)' }}>
                  Product
                </strong>
                <a href="/#how-it-works" style={{ color: 'var(--ink-2)', textDecoration: 'none' }}>
                  How it works
                </a>
                <a href="/#for-clients" style={{ color: 'var(--ink-2)', textDecoration: 'none' }}>
                  For clients
                </a>
                <a href="/#for-freelancers" style={{ color: 'var(--ink-2)', textDecoration: 'none' }}>
                  For freelancers
                </a>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <strong style={{ fontSize: '0.8125rem', color: 'var(--ink)' }}>
                  Trust
                </strong>
                <Link to="/safety" style={{ color: 'var(--ink-2)', textDecoration: 'none' }}>
                  Safety and limits
                </Link>
                <Link to="/status" style={{ color: 'var(--ink-2)', textDecoration: 'none' }}>
                  Status
                </Link>
                <Link to="/help" style={{ color: 'var(--ink-2)', textDecoration: 'none' }}>
                  Help
                </Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <strong style={{ fontSize: '0.8125rem', color: 'var(--ink)' }}>
                  Legal
                </strong>
                <Link to="/terms" style={{ color: 'var(--ink-2)', textDecoration: 'none' }}>
                  Prototype terms
                </Link>
                <Link to="/privacy" style={{ color: 'var(--ink-2)', textDecoration: 'none' }}>
                  Privacy notice
                </Link>
                <a
                  href="https://github.com/amoghV17-arch/verify_pay"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--ink-2)', textDecoration: 'none' }}
                >
                  GitHub repository
                </a>
              </div>
            </div>
          </div>

          <div
            style={{
              paddingTop: '1.5rem',
              borderTop: '1px solid var(--line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              color: 'var(--ink-2)',
            }}
          >
            <span>© 2026 Milestone. Built for the PayPal & AI Hackathon.</span>
            <span>PayPal Sandbox • Bryntum Gantt</span>
          </div>
        </div>
      </footer>

      {/* Demo bar (shown only when DEMO_MODE=true) */}
      {config.demoMode && <DemoBar />}
    </div>
  );
};

