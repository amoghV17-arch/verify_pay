import React from 'react';
import { createBrowserRouter, RouterProvider, Navigate, useSearchParams } from 'react-router-dom';
import { PublicShell } from './shells/PublicShell.js';
import { ClientShell } from './shells/ClientShell.js';
import { FreelancerShell } from './shells/FreelancerShell.js';
import { StyleguidePage } from './pages/StyleguidePage.js';
import { LandingPage } from './pages/LandingPage.js';
import { GetStartedPage } from './pages/GetStartedPage.js';
import { SafetyPage } from './pages/SafetyPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { App as LegacyWorkspaceApp } from './App.js';

const RootRoute: React.FC = () => {
  const [params] = useSearchParams();
  if (params.get('workspace') === 'true' || params.get('legacy') === 'true') {
    return <LegacyWorkspaceApp />;
  }
  return (
    <PublicShell>
      <LandingPage />
    </PublicShell>
  );
};

// Route shells & guards per docs/UI_IMPLEMENTATION.md §4.1
export const router = createBrowserRouter([
  // Dev-only Component Styleguide
  {
    path: '/styleguide',
    element: <PublicShell />,
    children: [
      {
        index: true,
        element: <StyleguidePage />,
      },
    ],
  },

  // Public Marketing & Story Routes (Section 5)
  {
    path: '/',
    element: <RootRoute />,
  },
  {
    path: '/safety',
    element: <PublicShell />,
    children: [
      {
        index: true,
        element: <SafetyPage />,
      },
    ],
  },
  {
    path: '/get-started',
    element: <PublicShell />,
    children: [
      {
        index: true,
        element: <GetStartedPage />,
      },
    ],
  },
  {
    path: '/join',
    element: <PublicShell />,
    children: [
      {
        index: true,
        element: (
          <div style={{ maxWidth: '680px', margin: '3rem auto', padding: '0 1rem' }}>
            <h1 className="font-display" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
              Join a project agreement
            </h1>
            <p style={{ fontSize: '1rem', color: 'var(--ink-2)', lineHeight: 1.6 }}>
              Enter your invitation code (e.g. MILE-XXXXXXXXXX) to review the agreed criteria and accept.
            </p>
          </div>
        ),
      },
      {
        path: ':token',
        element: (
          <div style={{ maxWidth: '680px', margin: '3rem auto', padding: '0 1rem' }}>
            <h1 className="font-display" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
              Invitation Preview
            </h1>
            <p style={{ fontSize: '1rem', color: 'var(--ink-2)', lineHeight: 1.6 }}>
              Review the project milestones, payment allocation, and acceptance criteria before accepting.
            </p>
          </div>
        ),
      },
    ],
  },

  // Client Area Shell (Section 6)
  {
    path: '/client',
    element: <ClientShell />,
    children: [
      {
        index: true,
        element: <Navigate to="/client/projects/proj_brand_launch" replace />,
      },
      {
        path: 'new',
        element: (
          <div style={{ padding: '1rem' }}>
            <h2 className="font-display" style={{ fontSize: '2rem' }}>New Project Agreement</h2>
            <p style={{ color: 'var(--ink-2)' }}>Brief, Plan, Invite, Fund wizard (Phase P4).</p>
          </div>
        ),
      },
      {
        path: 'projects/:id',
        element: <LegacyWorkspaceApp />,
      },
      {
        path: 'projects/:id/schedule',
        element: <LegacyWorkspaceApp />,
      },
      {
        path: 'projects/:id/deliverables',
        element: <LegacyWorkspaceApp />,
      },
      {
        path: 'projects/:id/deliverables/:milestoneId',
        element: <LegacyWorkspaceApp />,
      },
      {
        path: 'projects/:id/payments',
        element: <LegacyWorkspaceApp />,
      },
      {
        path: 'projects/:id/activity',
        element: <LegacyWorkspaceApp />,
      },
    ],
  },

  // Freelancer Area Shell (Section 7)
  {
    path: '/freelancer',
    element: <FreelancerShell />,
    children: [
      {
        index: true,
        element: <Navigate to="/freelancer/projects/proj_brand_launch" replace />,
      },
      {
        path: 'projects/:id',
        element: <LegacyWorkspaceApp />,
      },
      {
        path: 'projects/:id/deliverables',
        element: <LegacyWorkspaceApp />,
      },
      {
        path: 'projects/:id/deliverables/:milestoneId',
        element: <LegacyWorkspaceApp />,
      },
      {
        path: 'projects/:id/schedule',
        element: <LegacyWorkspaceApp />,
      },
      {
        path: 'projects/:id/payments',
        element: <LegacyWorkspaceApp />,
      },
    ],
  },

  // Fallback 404
  {
    path: '*',
    element: <PublicShell />,
    children: [
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);

export const AppRouter: React.FC = () => {
  return <RouterProvider router={router} />;
};

