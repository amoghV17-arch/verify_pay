import React from 'react';
import { createBrowserRouter, RouterProvider, useSearchParams } from 'react-router-dom';
import { PublicShell } from './shells/PublicShell.js';
import { ClientShell } from './shells/ClientShell.js';
import { FreelancerShell } from './shells/FreelancerShell.js';
import { StyleguidePage } from './pages/StyleguidePage.js';
import { LandingPage } from './pages/LandingPage.js';
import { GetStartedPage } from './pages/GetStartedPage.js';
import { SafetyPage } from './pages/SafetyPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { ClientProjectsPage } from './pages/client/ClientProjectsPage.js';
import { NewProjectWizard } from './pages/client/NewProjectWizard.js';
import { ClientOverviewPage } from './pages/client/ClientOverviewPage.js';
import { ClientDeliverablesPage } from './pages/client/ClientDeliverablesPage.js';
import { ClientPaymentsPage } from './pages/client/ClientPaymentsPage.js';
import { ClientActivityPage } from './pages/client/ClientActivityPage.js';
import { JoinFlowPage } from './pages/freelancer/JoinFlowPage.js';
import { FreelancerProjectsPage } from './pages/freelancer/FreelancerProjectsPage.js';
import { FreelancerOverviewPage } from './pages/freelancer/FreelancerOverviewPage.js';
import { FreelancerDeliverablesPage } from './pages/freelancer/FreelancerDeliverablesPage.js';
import { FreelancerPaymentsPage } from './pages/freelancer/FreelancerPaymentsPage.js';
import { ReviewPage } from './pages/ReviewPage.js';
import { SharedReceiptPage } from './pages/SharedReceiptPage.js';
import { SplitDemoPage } from './pages/demo/SplitDemoPage.js';
import { ScheduleSkeleton } from './components/schedule/ScheduleSkeleton.js';

// Lazy-loaded Legacy Workspace App (for ?workspace=true)
const LegacyWorkspaceApp = React.lazy(() => import('./App.js').then((m) => ({ default: m.App })));

// Lazy-loaded Bryntum Gantt schedule page per UI_IMPLEMENTATION.md §9 and §14 (Phase P7)
const LazySchedulePage = React.lazy(() =>
  import('./pages/SchedulePage.js').then((module) => ({ default: module.SchedulePage }))
);

const RootRoute: React.FC = () => {
  const [params] = useSearchParams();
  if (params.get('workspace') === 'true' || params.get('legacy') === 'true') {
    return (
      <React.Suspense fallback={<ScheduleSkeleton />}>
        <LegacyWorkspaceApp />
      </React.Suspense>
    );
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
        element: <JoinFlowPage />,
      },
      {
        path: ':token',
        element: <JoinFlowPage />,
      },
    ],
  },
  {
    path: '/receipt/:shareId',
    element: <PublicShell />,
    children: [
      {
        index: true,
        element: <SharedReceiptPage />,
      },
    ],
  },
  {
    path: '/receipts/shared/:shareId',
    element: <PublicShell />,
    children: [
      {
        index: true,
        element: <SharedReceiptPage />,
      },
    ],
  },
  {
    path: '/demo/split',
    element: <SplitDemoPage />,
  },

  // Client Area Shell (Section 6)
  {
    path: '/client',
    element: <ClientShell />,
    children: [
      {
        index: true,
        element: <ClientProjectsPage />,
      },
      {
        path: 'new',
        element: <NewProjectWizard />,
      },
      {
        path: 'projects/:id',
        element: <ClientOverviewPage />,
      },
      {
        path: 'projects/:id/overview',
        element: <ClientOverviewPage />,
      },
      {
        path: 'projects/:id/schedule',
        element: (
          <React.Suspense fallback={<ScheduleSkeleton />}>
            <LazySchedulePage role="client" />
          </React.Suspense>
        ),
      },
      {
        path: 'projects/:id/deliverables',
        element: <ClientDeliverablesPage />,
      },
      {
        path: 'projects/:id/deliverables/:milestoneId',
        element: <ReviewPage role="client" />,
      },
      {
        path: 'projects/:id/payments',
        element: <ClientPaymentsPage />,
      },
      {
        path: 'projects/:id/activity',
        element: <ClientActivityPage />,
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
        element: <FreelancerProjectsPage />,
      },
      {
        path: 'projects/:id',
        element: <FreelancerOverviewPage />,
      },
      {
        path: 'projects/:id/overview',
        element: <FreelancerOverviewPage />,
      },
      {
        path: 'projects/:id/deliverables',
        element: <FreelancerDeliverablesPage />,
      },
      {
        path: 'projects/:id/deliverables/:milestoneId',
        element: <ReviewPage role="freelancer" />,
      },
      {
        path: 'projects/:id/schedule',
        element: (
          <React.Suspense fallback={<ScheduleSkeleton />}>
            <LazySchedulePage role="freelancer" />
          </React.Suspense>
        ),
      },
      {
        path: 'projects/:id/payments',
        element: <FreelancerPaymentsPage />,
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

