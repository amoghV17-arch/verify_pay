import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MailCheck, AlertCircle } from 'lucide-react';
import { AuthLayout } from '../../components/auth/AuthLayout.js';
import { Button } from '../../components/ui/Button.js';
import { ApiError, apiFetch } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.js';

export const CheckEmailPage: React.FC = () => {
  const [params] = useSearchParams();
  const { authenticated, user, config } = useAuth();
  const email = params.get('email') || user?.email || 'your email address';

  const [resending, setResending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleResend = async () => {
    setError(null);
    setStatusMessage(null);
    setResending(true);
    try {
      await apiFetch('/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setStatusMessage('A fresh verification link has been sent.');
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Unable to resend verification email.');
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout subtitle="One quick confirmation keeps invites and PayPal Sandbox funding tied to a verified account owner.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
          <MailCheck size={24} />
        </div>

        <div>
          <h1
            className="font-display"
            style={{ fontSize: '1.85rem', margin: '0 0 0.5rem 0', color: 'var(--ink)' }}
          >
            Check your inbox
          </h1>
          <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--ink-2)', lineHeight: 1.55 }}>
            We sent a verification link to <strong>{email}</strong>. Open the link inside to confirm your email address.
          </p>
        </div>

        {config.emailProvider === 'outbox' && (
          <div className="ms-alert ms-alert-info" role="note" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div>
              <strong>Development outbox active:</strong> External email delivery (Resend / SMTP) is not configured in this environment, so messages are stored locally.
            </div>
            <div>
              You can view stored messages in the{' '}
              <Link to="/demo/mailbox" style={{ color: 'var(--teal)', fontWeight: 600 }}>
                Demo mailbox
              </Link>
              .
            </div>
          </div>
        )}

        {statusMessage && (
          <div className="ms-alert ms-alert-info" role="status" aria-live="polite">
            <span>{statusMessage}</span>
          </div>
        )}

        {error && (
          <div className="ms-alert ms-alert-danger" role="alert" aria-live="polite">
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {authenticated && !user?.emailVerified && (
            <Button variant="secondary" onClick={handleResend} isLoading={resending}>
              Resend verification email
            </Button>
          )}
          <Link to={authenticated ? '/onboarding' : '/login'} style={{ textDecoration: 'none' }}>
            <Button variant="primary" style={{ width: '100%' }}>
              {authenticated ? 'Continue to onboarding' : 'Go to sign in'}
            </Button>
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
};

