import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { apiFetch } from '../lib/api.js';
import { NotFoundPage } from '../pages/NotFoundPage.js';

export interface AuthUser {
  id: string;
  userId?: string;
  name: string;
  displayName?: string | null;
  email: string;
  company?: string | null;
  avatarColor?: string;
  emailVerified: boolean;
  payoutPaypalEmail?: string | null;
  payoutEmailChangedAt?: string | null;
  lastWorkspace: 'client' | 'freelancer';
  isDemo: boolean;
  role: 'client' | 'freelancer';
}

export interface WorkspaceStats {
  clientCount: number;
  freelancerCount: number;
}

export interface AuthPublicConfig {
  demoMode: boolean;
  emailVerification: 'off' | 'soft' | 'required';
  resetAvailable: boolean;
  emailProvider: 'outbox' | 'resend' | 'smtp';
  googleAuthEnabled: boolean;
  supportEmail?: string | null;
}

interface AuthMeResponse {
  authenticated: boolean;
  user: AuthUser | null;
  stats?: WorkspaceStats;
  config?: AuthPublicConfig;
}

interface AuthContextValue {
  loading: boolean;
  authenticated: boolean;
  user: AuthUser | null;
  stats: WorkspaceStats;
  config: AuthPublicConfig;
  refreshAuth: () => Promise<AuthMeResponse | null>;
  logout: () => Promise<void>;
  switchWorkspace: (workspace: 'client' | 'freelancer') => Promise<void>;
}

const DEFAULT_CONFIG: AuthPublicConfig = {
  demoMode: false,
  emailVerification: 'soft',
  resetAvailable: false,
  emailProvider: 'outbox',
  googleAuthEnabled: false,
  supportEmail: null,
};

const AuthContext = createContext<AuthContextValue>({
  loading: true,
  authenticated: false,
  user: null,
  stats: { clientCount: 0, freelancerCount: 0 },
  config: DEFAULT_CONFIG,
  refreshAuth: async () => null,
  logout: async () => {},
  switchWorkspace: async () => {},
});

export function sanitizeNextPath(raw: string | null | undefined, fallback = '/client'): string {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return fallback;
  }
  return trimmed;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [stats, setStats] = useState<WorkspaceStats>({ clientCount: 0, freelancerCount: 0 });
  const [config, setConfig] = useState<AuthPublicConfig>(DEFAULT_CONFIG);

  const refreshAuth = useCallback(async (): Promise<AuthMeResponse | null> => {
    try {
      const data = await apiFetch<AuthMeResponse>('/api/auth/me');
      setAuthenticated(Boolean(data.authenticated && data.user));
      setUser(data.user || null);
      setStats(data.stats || { clientCount: 0, freelancerCount: 0 });
      if (data.config) {
        setConfig(data.config);
      }
      return data;
    } catch {
      setAuthenticated(false);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAuth();
    const handler = () => {
      void refreshAuth();
    };
    window.addEventListener('ms:auth-changed', handler);
    return () => window.removeEventListener('ms:auth-changed', handler);
  }, [refreshAuth]);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) });
    } catch {
      // Proceed cleanly even if already signed out
    }
    setAuthenticated(false);
    setUser(null);
    setStats({ clientCount: 0, freelancerCount: 0 });
    window.dispatchEvent(new CustomEvent('ms:auth-changed'));
  }, []);

  const switchWorkspace = useCallback(async (workspace: 'client' | 'freelancer') => {
    setUser((prev) => (prev ? { ...prev, lastWorkspace: workspace } : prev));
    try {
      await apiFetch('/api/me', {
        method: 'PATCH',
        body: JSON.stringify({ lastWorkspace: workspace }),
      });
    } catch {
      // Non-fatal
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        loading,
        authenticated,
        user,
        stats,
        config,
        refreshAuth,
        logout,
        switchWorkspace,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

export const RequireAuth: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { loading, authenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-muted)',
          fontSize: '0.9375rem',
        }}
        role="status"
        aria-live="polite"
      >
        Loading workspace…
      </div>
    );
  }

  if (!authenticated) {
    const nextPath = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(nextPath)}`} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export const RedirectIfAuth: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { loading, authenticated, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        style={{
          minHeight: '50vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-muted)',
          fontSize: '0.9375rem',
        }}
        role="status"
        aria-live="polite"
      >
        Checking session…
      </div>
    );
  }

  if (authenticated && user) {
    const params = new URLSearchParams(location.search);
    const defaultDest = user.lastWorkspace === 'freelancer' ? '/freelancer' : '/client';
    const next = sanitizeNextPath(params.get('next'), defaultDest);
    return <Navigate to={next} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export const RequireDemoMode: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { loading, config } = useAuth();
  if (loading) {
    return (
      <div
        style={{
          minHeight: '50vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-muted)',
          fontSize: '0.9375rem',
        }}
        role="status"
        aria-live="polite"
      >
        Loading demo mode…
      </div>
    );
  }

  if (!config.demoMode) {
    return <NotFoundPage />;
  }

  return children ? <>{children}</> : <Outlet />;
};

