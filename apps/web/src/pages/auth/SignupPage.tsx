import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { AuthLayout } from '../../components/auth/AuthLayout.js';
import { Button } from '../../components/ui/Button.js';
import { ApiError, apiFetch } from '../../lib/api.js';
import { sanitizeNextPath, useAuth } from '../../context/AuthContext.js';

function scorePassword(password: string): { label: string; level: 0 | 1 | 2 | 3 } {
  if (!password) return { label: 'At least 10 characters', level: 0 };
  if (password.length < 10) return { label: 'Too short (minimum 10 characters)', level: 1 };
  const classes =
    (/[a-z]/.test(password) ? 1 : 0) +
    (/[A-Z]/.test(password) ? 1 : 0) +
    (/[0-9]/.test(password) ? 1 : 0) +
    (/[^a-zA-Z0-9]/.test(password) ? 1 : 0);
  if (password.length >= 14 || classes >= 3) {
    return { label: 'Strong password', level: 3 };
  }
  return { label: 'Fair — add numbers or symbols to strengthen', level: 2 };
}

export const SignupPage: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { config, refreshAuth } = useAuth();

  const initialIntent = params.get('intent') === 'freelancer' ? 'freelancer' : 'client';
  const nextParam = params.get('next');

  const [intent, setIntent] = useState<'client' | 'freelancer'>(initialIntent);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = useMemo(() => scorePassword(password), [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 10) {
      setError('Password must be at least 10 characters.');
      return;
    }
    if (!agreedToTerms) {
      setError('Please agree to the prototype Terms and Privacy notice to continue.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch<{
        ok: boolean;
        requiresVerification?: boolean;
        checkEmail?: boolean;
        user?: { lastWorkspace: 'client' | 'freelancer' };
      }>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          agreedToTerms: true,
          intent,
          company: company.trim() || undefined,
        }),
      });

      await refreshAuth();

      if (res.requiresVerification || res.checkEmail) {
        const q = new URLSearchParams();
        q.set('email', email.trim());
        if (nextParam) q.set('next', nextParam);
        navigate(`/check-email?${q.toString()}`, { replace: true });
        return;
      }

      const fallback = nextParam
        ? sanitizeNextPath(nextParam, '/onboarding')
        : `/onboarding?intent=${intent}`;
      navigate(fallback, { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Unable to create your account right now. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout subtitle="Create a single Milestone account to plan deliverables, invite collaborators, or accept verified PayPal Sandbox milestones.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.35rem' }}>
        <div>
          <h1
            className="font-display"
            style={{ fontSize: '1.85rem', margin: '0 0 0.4rem 0', color: 'var(--ink)' }}
          >
            Create your account
          </h1>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>
            One account works in both workspaces. Choose where you want to start.
          </p>
        </div>

        {/* Role intent selector */}
        <div
          role="group"
          aria-label="Starting workspace"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.5rem',
            padding: '0.25rem',
            backgroundColor: 'var(--paper)',
            border: '1px solid var(--line)',
            borderRadius: '10px',
          }}
        >
          {(['client', 'freelancer'] as const).map((roleOption) => {
            const active = intent === roleOption;
            return (
              <button
                key={roleOption}
                type="button"
                onClick={() => setIntent(roleOption)}
                style={{
                  padding: '0.55rem 0.75rem',
                  borderRadius: '8px',
                  border: active ? '1px solid var(--teal)' : '1px solid transparent',
                  backgroundColor: active ? 'var(--surface)' : 'transparent',
                  color: active ? 'var(--ink)' : 'var(--ink-2)',
                  fontWeight: active ? 600 : 500,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                {roleOption === 'client' ? 'Start as a client' : 'Join as a freelancer'}
              </button>
            );
          })}
        </div>

        {config.googleAuthEnabled && (
          <>
            <a
              href={`/api/auth/oauth/google/start?intent=${intent}${nextParam ? `&next=${encodeURIComponent(nextParam)}` : ''}`}
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
            <label htmlFor="signup-name" className="ms-label">
              Full name
            </label>
            <input
              id="signup-name"
              name="name"
              type="text"
              required
              autoComplete="name"
              className="ms-input"
              placeholder="Alex Rivera"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="ms-field">
            <label htmlFor="signup-email" className="ms-label">
              Email address
            </label>
            <input
              id="signup-email"
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

          {intent === 'client' && (
            <div className="ms-field">
              <label htmlFor="signup-company" className="ms-label">
                Company or team <span style={{ color: 'var(--ink-muted)', fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                id="signup-company"
                name="company"
                type="text"
                autoComplete="organization"
                className="ms-input"
                placeholder="Northwind Labs"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
          )}

          <div className="ms-field">
            <label htmlFor="signup-password" className="ms-label">
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="signup-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={10}
                maxLength={128}
                autoComplete="new-password"
                className="ms-input"
                style={{ paddingRight: '2.75rem' }}
                placeholder="At least 10 characters"
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
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                marginTop: '0.35rem',
              }}
            >
              {[1, 2, 3].map((step) => (
                <span
                  key={step}
                  style={{
                    flex: 1,
                    height: '4px',
                    borderRadius: '99px',
                    backgroundColor:
                      strength.level >= step
                        ? strength.level === 1
                          ? 'var(--danger)'
                          : strength.level === 2
                          ? 'var(--warning)'
                          : 'var(--teal)'
                        : 'var(--line)',
                  }}
                />
              ))}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--ink-2)', marginTop: '0.25rem' }}>
              {strength.label}. Prototype notice: use a unique password you do not use elsewhere.
            </div>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.6rem',
              fontSize: '0.84rem',
              lineHeight: 1.45,
              color: 'var(--ink-2)',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              style={{ marginTop: '0.2rem', accentColor: 'var(--teal)' }}
            />
            <span>
              I agree to the{' '}
              <Link to="/terms" style={{ color: 'var(--teal)', fontWeight: 600 }}>
                prototype Terms
              </Link>{' '}
              and{' '}
              <Link to="/privacy" style={{ color: 'var(--teal)', fontWeight: 600 }}>
                Privacy notice
              </Link>
              . Sandbox funds only; no real money moves.
            </span>
          </label>

          <Button type="submit" variant="primary" size="lg" isLoading={submitting} style={{ width: '100%' }}>
            Create account
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
            Already have an account?{' '}
            <Link
              to={`/login${nextParam ? `?next=${encodeURIComponent(nextParam)}` : ''}`}
              style={{ color: 'var(--teal)', fontWeight: 600 }}
            >
              Sign in
            </Link>
          </span>
          <Link to="/join" style={{ color: 'var(--ink-2)', textDecoration: 'underline' }}>
            Have an invite code?
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
};

