import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { AuthLayout } from '../../components/auth/AuthLayout.js';
import { Button } from '../../components/ui/Button.js';
import { ApiError, apiFetch } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.js';

export const VerifyEmailPage: React.FC = () => {
  const { token: paramToken } = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();
  const { refreshAuth, authenticated } = useAuth();
  const token = paramToken || searchParams.get('token') || '';

  const [state, setState] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (!token) {
      setState('error');
      setErrorMessage('Verification token is missing from this link.');
      return;
    }

    let cancelled = false;
    apiFetch('/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
      .then(async () => {
        if (cancelled) return;
        await refreshAuth();
        setState('success');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState('error');
        setErrorMessage(
          err instanceof ApiError
            ? err.message
            : 'This verification link is invalid or has already expired.'
        );
      });

    return () => {
      cancelled = true;
    };
  }, [token, refreshAuth]);

  return (
    <AuthLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }} role="status" aria-live="polite">
        {state === 'verifying' && (
          <>
            <h1 className="font-display" style={{ fontSize: '1.75rem', margin: 0 }}>
              Confirming your email…
            </h1>
            <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: '0.95rem' }}>
              Checking your single-use verification token.
            </p>
          </>
        )}

        {state === 'success' && (
          <>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: 'var(--teal-soft)',
                color: 'var(--teal)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h1 className="font-display" style={{ fontSize: '1.8rem', margin: '0 0 0.45rem 0' }}>
                Email verified
              </h1>
              <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: '0.95rem', lineHeight: 1.55 }}>
                Your email address is confirmed. All Milestone workspace actions are ready.
              </p>
            </div>
            <Link to={authenticated ? '/client' : '/login'} style={{ textDecoration: 'none' }}>
              <Button variant="primary" size="lg" style={{ width: '100%' }}>
                {authenticated ? 'Open workspace' : 'Sign in to continue'}
              </Button>
            </Link>
          </>
        )}

        {state === 'error' && (
          <>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: 'rgba(180, 60, 50, 0.1)',
                color: 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertCircle size={24} />
            </div>
            <div>
              <h1 className="font-display" style={{ fontSize: '1.8rem', margin: '0 0 0.45rem 0' }}>
                Verification link expired
              </h1>
              <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: '0.95rem', lineHeight: 1.55 }}>
                {errorMessage}
              </p>
            </div>
            <Link to="/check-email" style={{ textDecoration: 'none' }}>
              <Button variant="secondary" style={{ width: '100%' }}>
                Request a fresh verification email
              </Button>
            </Link>
          </>
        )}
      </div>
    </AuthLayout>
  );
};

