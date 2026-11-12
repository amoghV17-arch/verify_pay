import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { AuthLayout } from '../../components/auth/AuthLayout.js';
import { Button } from '../../components/ui/Button.js';
import { ApiError, apiFetch } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.js';

export const ForgotPasswordPage: React.FC = () => {
  const { config } = useAuth();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch('/api/auth/forgot', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setSubmitted(true);
    } catch (err: unknown) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Unable to process password reset requests right now.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout subtitle="Password resets use a single-use 60-minute token and invalidate active sessions on completion.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <h1 className="font-display" style={{ fontSize: '1.85rem', margin: '0 0 0.45rem 0' }}>
            Reset your password
          </h1>
          <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--ink-2)', lineHeight: 1.55 }}>
            Enter your account email and we will send reset instructions if an account matches.
          </p>
        </div>

        {!config.resetAvailable ? (
          <div className="ms-alert ms-alert-info" role="status">
            <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Email password reset is not enabled in this environment.</strong>
              <p style={{ margin: '0.35rem 0 0 0' }}>
                Outbound email delivery is currently configured in local outbox mode without SMTP or Resend credentials.
                {config.supportEmail ? ` Contact ${config.supportEmail} for assistance.` : ''}
              </p>
            </div>
          </div>
        ) : submitted ? (
          <div className="ms-alert ms-alert-info" role="status" aria-live="polite">
            <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--teal)' }} />
            <span>
              If an account exists for <strong>{email}</strong>, we have sent a password reset link expiring in 60 minutes.
            </span>
          </div>
        ) : (
          <>
            {error && (
              <div className="ms-alert ms-alert-danger" role="alert" aria-live="polite">
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{error}</span>
              </div>
            )}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="ms-field">
                <label htmlFor="forgot-email" className="ms-label">
                  Email address
                </label>
                <input
                  id="forgot-email"
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
              <Button type="submit" variant="primary" size="lg" isLoading={submitting} style={{ width: '100%' }}>
                Send reset link
              </Button>
            </form>
          </>
        )}

        <div style={{ fontSize: '0.875rem', color: 'var(--ink-2)' }}>
          <Link to="/login" style={{ color: 'var(--teal)', fontWeight: 600 }}>
            Back to sign in
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
};

