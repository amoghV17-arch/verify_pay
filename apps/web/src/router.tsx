import React from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  useSearchParams,
  Outlet,
} from 'react-router-dom';

import { PublicShell } from './shells/PublicShell.js';
import { WorkspaceShell } from './shells/WorkspaceShell.js';
import { ClientShell } from './shells/ClientShell.js';
import { FreelancerShell } from './shells/FreelancerShell.js';

import {
  AuthProvider,
  RedirectIfAuth,
  RequireAuth,
  RequireDemoMode,
} from './context/AuthContext.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { RouteMetaUpdater } from './hooks/useDocumentMeta.js';

// Public pages
import { LandingPage } from './pages/LandingPage.js';
import { StyleguidePage } from './pages/StyleguidePage.js';
import { SafetyPage } from './pages/SafetyPage.js';
import { GetStartedPage } from './pages/GetStartedPage.js';
import { JoinFlowPage } from './pages/freelancer/JoinFlowPage.js';
import { SharedReceiptPage } from './pages/SharedReceiptPage.js';
import { StatusPage } from './pages/StatusPage.js';
import { HelpPage } from './pages/HelpPage.js';
import { TermsPage } from './pages/TermsPage.js';
import { PrivacyPage } from './pages/PrivacyPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';

// Auth pages
import { SignupPage } from './pages/auth/SignupPage.js';
import { LoginPage } from './pages/auth/LoginPage.js';
import { CheckEmailPage } from './pages/auth/CheckEmailPage.js';
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage.js';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage.js';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage.js';

// Account & onboarding pages
import { OnboardingPage } from './pages/OnboardingPage.js';
import { SettingsPage } from './pages/account/SettingsPage.js';
import { NotificationsPage } from './pages/account/NotificationsPage.js';

// Demo pages
import { DemoLandingPage } from './pages/demo/DemoLandingPage.js';
import { SplitDemoPage } from './pages/demo/SplitDemoPage.js';
import { ProofPage } from './pages/demo/ProofPage.js';
import { DemoMailboxPage } from './pages/demo/DemoMailboxPage.js';

// Client workspace pages
import { ClientProjectsPage } from './pages/client/ClientProjectsPage.js';
import { NewProjectWizard } from './pages/client/NewProjectWizard.js';
import { ClientOverviewPage } from './pages/client/ClientOverviewPage.js';
import { ClientDeliverablesPage } from './pages/client/ClientDeliverablesPage.js';
import { ClientPaymentsPage } from './pages/client/ClientPaymentsPage.js';
import { ClientActivityPage } from './pages/client/ClientActivityPage.js';

// Freelancer workspace pages
import { FreelancerProjectsPage } from './pages/freelancer/FreelancerProjectsPage.js';
import { FreelancerOverviewPage } from './pages/freelancer/FreelancerOverviewPage.js';
import { FreelancerDeliverablesPage } from './pages/freelancer/FreelancerDeliverablesPage.js';
import { FreelancerPaymentsPage } from './pages/freelancer/FreelancerPaymentsPage.js';

// Shared workspace pages
import { ReviewPage } from './pages/ReviewPage.js';
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

const RootLayout: React.FC = () => {
  return (
    <>
      <RouteMetaUpdater />
      <Outlet />
    </>
  );
};

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
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

      // Public Marketing & Story Routes
      {
        path: '/',
        element: <RootRoute />,
      },
      {
        path: '/safety',
        element: <PublicShell />,
        children: [{ index: true, element: <SafetyPage /> }],
      },
      {
        path: '/help',
        element: <PublicShell />,
        children: [{ index: true, element: <HelpPage /> }],
      },
      {
        path: '/terms',
        element: <PublicShell />,
        children: [{ index: true, element: <TermsPage /> }],
      },
      {
        path: '/privacy',
        element: <PublicShell />,
        children: [{ index: true, element: <PrivacyPage /> }],
      },
      {
        path: '/get-started',
        element: <PublicShell />,
        children: [{ index: true, element: <GetStartedPage /> }],
      },
      {
        path: '/join',
        element: <PublicShell />,
        children: [
          { index: true, element: <JoinFlowPage /> },
          { path: ':token', element: <JoinFlowPage /> },
        ],
      },
      {
        path: '/receipt/:shareId',
        element: <PublicShell />,
        children: [{ index: true, element: <SharedReceiptPage /> }],
      },
      {
        path: '/receipts/shared/:shareId',
        element: <PublicShell />,
        children: [{ index: true, element: <SharedReceiptPage /> }],
      },
      {
        path: '/status',
        element: <StatusPage />,
      },

      // Guest-only auth routes
      {
        path: '/signup',
        element: (
          <RedirectIfAuth>
            <PublicShell>
              <SignupPage />
            </PublicShell>
          </RedirectIfAuth>
        ),
      },
      {
        path: '/login',
        element: (
          <RedirectIfAuth>
            <PublicShell>
              <LoginPage />
            </PublicShell>
          </RedirectIfAuth>
        ),
      },
      {
        path: '/forgot-password',
        element: (
          <RedirectIfAuth>
            <PublicShell>
              <ForgotPasswordPage />
            </PublicShell>
          </RedirectIfAuth>
        ),
      },
      {
        path: '/reset-password',
        element: (
          <RedirectIfAuth>
            <PublicShell>
              <ResetPasswordPage />
            </PublicShell>
          </RedirectIfAuth>
        ),
      },
      {
        path: '/reset-password/:token',
        element: (
          <RedirectIfAuth>
            <PublicShell>
              <ResetPasswordPage />
            </PublicShell>
          </RedirectIfAuth>
        ),
      },

      // Email verification routes
      {
        path: '/check-email',
        element: (
          <PublicShell>
            <CheckEmailPage />
          </PublicShell>
        ),
      },
      {
        path: '/verify-email',
        element: (
          <PublicShell>
            <VerifyEmailPage />
          </PublicShell>
        ),
      },
      {
        path: '/verify-email/:token',
        element: (
          <PublicShell>
            <VerifyEmailPage />
          </PublicShell>
        ),
      },

      // Demo routes
      {
        path: '/demo',
        element: (
          <RequireDemoMode>
            <PublicShell>
              <DemoLandingPage />
            </PublicShell>
          </RequireDemoMode>
        ),
      },
      {
        path: '/demo/split',
        element: (
          <RequireDemoMode>
            <SplitDemoPage />
          </RequireDemoMode>
        ),
      },
      {
        path: '/demo/proof',
        element: (
          <RequireDemoMode>
            <ProofPage />
          </RequireDemoMode>
        ),
      },
      {
        path: '/demo/mailbox',
        element: (
          <RequireDemoMode>
            <RequireAuth>
              <WorkspaceShell mode="account">
                <DemoMailboxPage />
              </WorkspaceShell>
            </RequireAuth>
          </RequireDemoMode>
        ),
      },

      // Protected account / onboarding routes
      {
        path: '/onboarding',
        element: (
          <RequireAuth>
            <WorkspaceShell mode="account">
              <OnboardingPage />
            </WorkspaceShell>
          </RequireAuth>
        ),
      },
      {
        path: '/settings',
        element: (
          <RequireAuth>
            <WorkspaceShell mode="account">
              <SettingsPage />
            </WorkspaceShell>
          </RequireAuth>
        ),
      },
      {
        path: '/settings/:section',
        element: (
          <RequireAuth>
            <WorkspaceShell mode="account">
              <SettingsPage />
            </WorkspaceShell>
          </RequireAuth>
        ),
      },
      {
        path: '/notifications',
        element: (
          <RequireAuth>
            <WorkspaceShell mode="account">
              <NotificationsPage />
            </WorkspaceShell>
          </RequireAuth>
        ),
      },

      // Client workspace routes
      {
        path: '/client',
        element: (
          <RequireAuth>
            <ClientShell />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <ClientProjectsPage /> },
          { path: 'new', element: <NewProjectWizard /> },
          { path: 'projects', element: <ClientProjectsPage /> },
          { path: 'projects/:id', element: <ClientOverviewPage /> },
          { path: 'projects/:id/overview', element: <ClientOverviewPage /> },
          {
            path: 'projects/:id/schedule',
            element: (
              <React.Suspense fallback={<ScheduleSkeleton />}>
                <LazySchedulePage role="client" />
              </React.Suspense>
            ),
          },
          { path: 'projects/:id/deliverables', element: <ClientDeliverablesPage /> },
          { path: 'projects/:id/deliverables/:milestoneId', element: <ReviewPage role="client" /> },
          { path: 'projects/:id/payments', element: <ClientPaymentsPage /> },
          { path: 'projects/:id/activity', element: <ClientActivityPage /> },
          { path: 'projects/:id/proof', element: <ProofPage /> },
        ],
      },

      // Freelancer workspace routes
      {
        path: '/freelancer',
        element: (
          <RequireAuth>
            <FreelancerShell />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <FreelancerProjectsPage /> },
          { path: 'projects', element: <FreelancerProjectsPage /> },
          { path: 'projects/:id', element: <FreelancerOverviewPage /> },
          { path: 'projects/:id/overview', element: <FreelancerOverviewPage /> },
          { path: 'projects/:id/deliverables', element: <FreelancerDeliverablesPage /> },
          { path: 'projects/:id/deliverables/:milestoneId', element: <ReviewPage role="freelancer" /> },
          {
            path: 'projects/:id/schedule',
            element: (
              <React.Suspense fallback={<ScheduleSkeleton />}>
                <LazySchedulePage role="freelancer" />
              </React.Suspense>
            ),
          },
          { path: 'projects/:id/payments', element: <FreelancerPaymentsPage /> },
        ],
      },

      // Catch-all 404
      {
        path: '*',
        element: (
          <PublicShell>
            <NotFoundPage />
          </PublicShell>
        ),
      },
    ],
  },
]);

export const AppRouter: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ErrorBoundary>
  );
};
