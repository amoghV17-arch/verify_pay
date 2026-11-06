import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/Button.js';
import { DemoBar } from '../components/ui/DemoBar.js';

export const PublicShell: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Link to="/join" style={{ textDecoration: 'none' }}>
              <Button variant="quiet" size="sm">
                Join a project
              </Button>
            </Link>
            <Link to="/get-started" style={{ textDecoration: 'none' }}>
              <Button variant="primary" size="sm">
                Start a project
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Page Content */}
      <main style={{ flex: 1 }}>
        <Outlet />
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

            <div style={{ display: 'flex', gap: '3rem', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <strong style={{ fontSize: '0.8125rem', textTransform: 'uppercase', color: 'var(--ink)' }}>
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
                <Link to="/styleguide" style={{ color: 'var(--teal-ink)', textDecoration: 'none' }}>
                  Component Styleguide
                </Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <strong style={{ fontSize: '0.8125rem', textTransform: 'uppercase', color: 'var(--ink)' }}>
                  Trust & Code
                </strong>
                <Link to="/safety" style={{ color: 'var(--ink-2)', textDecoration: 'none' }}>
                  Safety & limits
                </Link>
                <a
                  href="https://github.com/amoghV17-arch/verify_pay"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--ink-2)', textDecoration: 'none' }}
                >
                  GitHub repository
                </a>
                <Link to="/demo/split" style={{ color: 'var(--teal-ink)', textDecoration: 'none' }}>
                  Demo Split View
                </Link>
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
            <span>PayPal Sandbox Active • Powered by Bryntum Gantt Pro</span>
          </div>
        </div>
      </footer>

      {/* Demo bar at bottom left */}
      <DemoBar />
    </div>
  );
};

