import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { AuthLayout } from '../../components/auth/AuthLayout.js';
import { Button } from '../../components/ui/Button.js';
import { ApiError, apiFetch } from '../../lib/api.js';
import { sanitizeNextPath, useAuth } from '../../context/AuthContext.js';

const OAUTH_ERRORS: Record<string, string> = {
  oauth_cancelled: 'Google sign-in was cancelled before finishing.',
  oauth_state_mismatch: 'Sign-in session check failed. Please try signing in again.',
  oauth_exchange_failed: 'Could not complete Google sign-in. Please use email and password.',
  oauth_unverified_email: 'Google did not confirm a verified email address for this account.',
};

export const LoginPage: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { config, refreshAuth } = useAuth();

  const nextParam = params.get('next');
  const oauthErr = params.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(
    oauthErr ? OAUTH_ERRORS[oauthErr] || 'Sign-in could not be completed.' : null
  );

  useEffect(() => {
    if (oauthErr) {
      setError(OAUTH_ERRORS[oauthErr] || 'Sign-in could not be completed.');
    }
  }, [oauthErr]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await apiFetch<{
        ok: boolean;
        user: { lastWorkspace: 'client' | 'freelancer' };
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      await refreshAuth();
      const defaultDest = res.user.lastWorkspace === 'freelancer' ? '/freelancer' : '/client';
      navigate(sanitizeNextPath(nextParam, defaultDest), { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Unable to sign in right now. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout subtitle="Sign in to view your milestones, submit deliverables, or settle PayPal Sandbox payouts.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.35rem' }}>
        <div>
          <h1
            className="font-display"
            style={{ fontSize: '1.85rem', margin: '0 0 0.4rem 0', color: 'var(--ink)' }}
          >
            Sign in to Milestone
          </h1>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>
            Access both your client and freelancer workspaces from one account.
          </p>
        </div>

        {config.googleAuthEnabled && (
          <>
            <a
              href={`/api/auth/oauth/google/start${nextParam ? `?next=${encodeURIComponent(nextParam)}` : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.6rem',
                padding: '0.65rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--line)',
                backgroundColor: 'var(--surface)',
                color: 'var(--ink)',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.9rem',
              }}
            >
              Continue with Google
            </a>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                fontSize: '0.75rem',
                color: 'var(--ink-muted)',
              }}
            >
              <span style={{ flex: 1, height: '1px', backgroundColor: 'var(--line)' }} />
              <span>or with email</span>
              <span style={{ flex: 1, height: '1px', backgroundColor: 'var(--line)' }} />
            </div>
          </>
        )}

        {error && (
          <div className="ms-alert ms-alert-danger" role="alert" aria-live="polite">
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="ms-field">
            <label htmlFor="login-email" className="ms-label">
              Email address
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="ms-input"
              placeholder="alex@studio.example"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="ms-field">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
              }}
            >
              <label htmlFor="login-password" className="ms-label">
                Password
              </label>
              {config.resetAvailable && (
                <Link
                  to="/forgot-password"
                  style={{ fontSize: '0.82rem', color: 'var(--teal)', fontWeight: 500 }}
                >
                  Forgot password?
                </Link>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                className="ms-input"
                style={{ paddingRight: '2.75rem' }}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((s) => !s)}
                style={{
                  position: 'absolute',
                  right: '0.65rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--ink-2)',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <Button type="submit" variant="primary" size="lg" isLoading={submitting} style={{ width: '100%' }}>
            Sign in
          </Button>
        </form>

        <div
          style={{
            borderTop: '1px solid var(--line)',
            paddingTop: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
            fontSize: '0.85rem',
            color: 'var(--ink-2)',
          }}
        >
          <span>
            New to Milestone?{' '}
            <Link
              to={`/signup${nextParam ? `?next=${encodeURIComponent(nextParam)}` : ''}`}
              style={{ color: 'var(--teal)', fontWeight: 600 }}
            >
              Create account
            </Link>
          </span>
          {config.demoMode && (
            <Link to="/demo" style={{ color: 'var(--teal)', fontWeight: 600 }}>
              Open interactive demo
            </Link>
          )}
        </div>
      </div>
    </AuthLayout>
  );
};

