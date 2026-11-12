import React, { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { AuthLayout } from '../../components/auth/AuthLayout.js';
import { Button } from '../../components/ui/Button.js';
import { ApiError, apiFetch } from '../../lib/api.js';

export const ResetPasswordPage: React.FC = () => {
  const { token: paramToken } = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();
  const token = paramToken || searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError('Reset token is missing from this link.');
      return;
    }
    if (password.length < 10) {
      setError('Password must be at least 10 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch('/api/auth/reset', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
    } catch (err: unknown) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'This reset link is invalid or expired. Request a new reset link.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <h1 className="font-display" style={{ fontSize: '1.85rem', margin: 0 }}>
          Choose a new password
        </h1>

        {done ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="ms-alert ms-alert-info" role="status" aria-live="polite">
              <CheckCircle2 size={16} style={{ flexShrink: 0, color: 'var(--teal)' }} />
              <span>Your password has been updated and all earlier sessions were signed out.</span>
            </div>
            <Link to="/login" style={{ textDecoration: 'none' }}>
              <Button variant="primary" size="lg" style={{ width: '100%' }}>
                Sign in with your new password
              </Button>
            </Link>
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
                <label htmlFor="reset-password" className="ms-label">
                  New password
                </label>
                <input
                  id="reset-password"
                  type="password"
                  required
                  minLength={10}
                  maxLength={128}
                  autoComplete="new-password"
                  className="ms-input"
                  placeholder="At least 10 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="ms-field">
                <label htmlFor="reset-confirm" className="ms-label">
                  Confirm new password
                </label>
                <input
                  id="reset-confirm"
                  type="password"
                  required
                  minLength={10}
                  maxLength={128}
                  autoComplete="new-password"
                  className="ms-input"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <Button type="submit" variant="primary" size="lg" isLoading={submitting} style={{ width: '100%' }}>
                Update password
              </Button>
            </form>
          </>
        )}
      </div>
    </AuthLayout>
  );
};

