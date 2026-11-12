import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface RouteMeta {
  title: string;
  description: string;
  noindex?: boolean;
}

const DEFAULT_DESCRIPTION =
  'Milestone holds a project budget in PayPal Sandbox, verifies deliveries against agreed criteria, and releases milestone payouts when approved.';

function resolveRouteMeta(pathname: string): RouteMeta {
  if (pathname === '/') {
    return {
      title: 'Milestone — Verified Project Agreements & PayPal Payouts',
      description: DEFAULT_DESCRIPTION,
      noindex: false,
    };
  }
  if (pathname.startsWith('/get-started')) {
    return {
      title: 'Get started — Milestone',
      description: 'Create an account to fund a project brief or accept a milestone invitation.',
      noindex: false,
    };
  }
  if (pathname.startsWith('/safety')) {
    return {
      title: 'Safety & Trust Architecture — Milestone',
      description: 'How Milestone separates AI review from deterministic PayPal Sandbox payout policy.',
      noindex: false,
    };
  }
  if (pathname.startsWith('/help')) {
    return {
      title: 'Help & Guide — Milestone',
      description: 'How Milestone works for clients and freelancers, including PayPal Sandbox testing.',
      noindex: false,
    };
  }
  if (pathname.startsWith('/status')) {
    return {
      title: 'System Status & Readiness — Milestone',
      description: 'Live database, PayPal Sandbox, AI provider, and email adapter readiness.',
      noindex: false,
    };
  }
  if (pathname.startsWith('/terms')) {
    return {
      title: 'Terms of Use (Sandbox Prototype) — Milestone',
      description: 'Terms and sandbox disclosure for using Milestone.',
      noindex: false,
    };
  }
  if (pathname.startsWith('/privacy')) {
    return {
      title: 'Privacy Notice — Milestone',
      description: 'How Milestone handles account data, PayPal Sandbox identifiers, and notifications.',
      noindex: false,
    };
  }
  if (pathname.startsWith('/signup')) {
    return { title: 'Create account — Milestone', description: DEFAULT_DESCRIPTION, noindex: true };
  }
  if (pathname.startsWith('/login')) {
    return { title: 'Log in — Milestone', description: DEFAULT_DESCRIPTION, noindex: true };
  }
  if (pathname.startsWith('/check-email') || pathname.startsWith('/verify-email')) {
    return { title: 'Verify email — Milestone', description: DEFAULT_DESCRIPTION, noindex: true };
  }
  if (pathname.startsWith('/forgot-password') || pathname.startsWith('/reset-password')) {
    return { title: 'Password reset — Milestone', description: DEFAULT_DESCRIPTION, noindex: true };
  }
  if (pathname.startsWith('/onboarding')) {
    return { title: 'Complete your profile — Milestone', description: DEFAULT_DESCRIPTION, noindex: true };
  }
  if (pathname.startsWith('/settings')) {
    return { title: 'Account settings — Milestone', description: DEFAULT_DESCRIPTION, noindex: true };
  }
  if (pathname.startsWith('/notifications')) {
    return { title: 'Notifications — Milestone', description: DEFAULT_DESCRIPTION, noindex: true };
  }
  if (pathname.startsWith('/join')) {
    return { title: 'Join project invitation — Milestone', description: DEFAULT_DESCRIPTION, noindex: true };
  }
  if (pathname.startsWith('/receipt')) {
    return { title: 'Shared Payment Receipt — Milestone', description: DEFAULT_DESCRIPTION, noindex: true };
  }
  if (pathname.startsWith('/demo')) {
    return { title: 'Interactive Demo — Milestone', description: DEFAULT_DESCRIPTION, noindex: true };
  }
  if (pathname.startsWith('/client')) {
    return { title: 'Client Workspace — Milestone', description: DEFAULT_DESCRIPTION, noindex: true };
  }
  if (pathname.startsWith('/freelancer')) {
    return { title: 'Freelancer Workspace — Milestone', description: DEFAULT_DESCRIPTION, noindex: true };
  }
  return { title: 'Milestone', description: DEFAULT_DESCRIPTION, noindex: true };
}

export function RouteMetaUpdater() {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta = resolveRouteMeta(pathname);
    document.title = meta.title;

    const descEl = document.querySelector('meta[name="description"]');
    if (descEl) {
      descEl.setAttribute('content', meta.description);
    }

    let robotsEl = document.querySelector('meta[name="robots"]');
    if (meta.noindex) {
      if (!robotsEl) {
        robotsEl = document.createElement('meta');
        robotsEl.setAttribute('name', 'robots');
        document.head.appendChild(robotsEl);
      }
      robotsEl.setAttribute('content', 'noindex, nofollow');
    } else if (robotsEl) {
      robotsEl.setAttribute('content', 'index, follow');
    }
  }, [pathname]);

  return null;
}

