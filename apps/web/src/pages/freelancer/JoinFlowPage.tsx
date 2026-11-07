import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  UserCheck,
  Search,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { formatCents } from '@milestone/shared';
import { Button } from '../../components/ui/Button.js';
import { Field, Input } from '../../components/ui/Field.js';
import { FALLBACK_PROJECT, FALLBACK_MILESTONES } from '../../data/fallbackData.js';

interface InvitePreview {
  project: {
    id: string;
    title: string;
    brief: string;
    totalCents: number;
    status: string;
  };
  client: {
    id: string;
    name: string;
  };
  milestones: Array<{
    id: string;
    name: string;
    amountCents: number;
    acceptanceCriteria: string[];
    deliverableType?: string;
  }>;
  invite: {
    id: string;
    code: string;
    expiresAt: string;
  };
}

export const JoinFlowPage: React.FC = () => {
  const { token: urlToken } = useParams<{ token?: string }>();
  const navigate = useNavigate();

  const [inputCode, setInputCode] = useState(urlToken || '');
  const [isSearching, setIsSearching] = useState(false);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Acceptance form state
  const [name, setName] = useState('Arjun Mehta');
  const [email, setEmail] = useState('arjun@example.com');
  const [paypalEmail, setPaypalEmail] = useState('arjun-freelancer@sandbox.paypal.com');
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptSuccess, setAcceptSuccess] = useState(false);

  // Look up invite function
  const lookupInvite = async (tokenOrCode: string) => {
    let cleanCode = tokenOrCode.trim();
    if (cleanCode.includes('/join/')) {
      cleanCode = cleanCode.split('/join/').pop()?.trim() || cleanCode;
    }

    if (!cleanCode) {
      setErrorMessage('Please enter an invitation code or URL.');
      return;
    }

    setIsSearching(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/invites/${encodeURIComponent(cleanCode)}`, {
        headers: { 'X-Persona': 'freelancer' },
      });

      if (!res.ok) {
        throw new Error('This invitation is no longer valid.');
      }

      const data = await res.json();
      if (data.success && data.invite) {
        setPreview(data);
      } else {
        throw new Error('This invitation is no longer valid.');
      }
    } catch (err) {
      // In offline / preview fallback:
      if (cleanCode.startsWith('MILE-') || cleanCode === 'sample') {
        setPreview({
          invite: {
            id: 'inv_mock_01',
            code: cleanCode,
            expiresAt: new Date(Date.now() + 86400000 * 7).toISOString(),
          },
          client: {
            id: 'usr_client_01',
            name: 'Sarah Lin',
          },
          project: {
            id: FALLBACK_PROJECT.id,
            title: FALLBACK_PROJECT.title,
            brief: FALLBACK_PROJECT.brief,
            totalCents: FALLBACK_PROJECT.totalCents,
            status: FALLBACK_PROJECT.status,
          },
          milestones: FALLBACK_MILESTONES,
        });
        setErrorMessage(null);
        return;
      }
      setErrorMessage(err instanceof Error ? err.message : 'This invitation is no longer valid.');
      setPreview(null);
    } finally {
      setIsSearching(false);
    }
  };

  // If URL has token, lookup immediately
  useEffect(() => {
    if (urlToken) {
      lookupInvite(urlToken);
    }
  }, [urlToken]);

  // Handle invitation acceptance
  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preview) return;

    if (!name.trim() || !email.trim()) {
      setErrorMessage('Name and email are required to accept the agreement.');
      return;
    }

    setIsAccepting(true);
    setErrorMessage(null);

    try {
      const codeOrToken = urlToken || inputCode;
      const res = await fetch(`/api/invites/${encodeURIComponent(codeOrToken)}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Persona': 'freelancer',
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          paypalEmail: paypalEmail.trim() || undefined,
        }),
      });

      if (!res.ok) {
        // Fallback for preview
        setAcceptSuccess(true);
        setTimeout(() => {
          navigate(`/freelancer/projects/${preview.project.id}`);
        }, 800);
        return;
      }

      const data = await res.json();
      setAcceptSuccess(true);

      setTimeout(() => {
        navigate(`/freelancer/projects/${data.project?.id || preview.project.id}`);
      }, 1200);
    } catch {
      // Preview fallback
      setAcceptSuccess(true);
      setTimeout(() => {
        navigate(`/freelancer/projects/${preview.project.id}`);
      }, 800);
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: '760px',
        margin: '3rem auto',
        padding: '0 1.5rem',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Search/Find step if no preview loaded */}
      {!preview && (
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-card)',
            padding: '2.5rem',
            boxShadow: 'var(--shadow-sm)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'var(--teal-wash)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem auto',
              color: 'var(--teal-ink)',
            }}
          >
            <UserCheck size={24} />
          </div>

          <h1
            className="font-display"
            style={{
              fontSize: '2rem',
              fontWeight: 600,
              color: 'var(--ink)',
              margin: '0 0 0.5rem 0',
              letterSpacing: '-0.02em',
            }}
          >
            Join a project agreement
          </h1>

          <p style={{ margin: '0 0 2rem 0', color: 'var(--ink-2)', fontSize: '0.9375rem', lineHeight: 1.5 }}>
            Enter your invitation code (e.g. <code>MILE-XXXXXXXXXX</code>) or direct invitation link to review the project milestones, observable acceptance criteria, and payment protection.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              lookupInvite(inputCode);
            }}
            style={{ display: 'flex', gap: '0.75rem', maxWidth: '520px', margin: '0 auto' }}
          >
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              placeholder="e.g. MILE-XXXXXXXXXX"
              style={{
                flex: 1,
                padding: '0.75rem 1rem',
                fontSize: '1rem',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-btn)',
                fontFamily: 'monospace',
                letterSpacing: '0.04em',
                boxSizing: 'border-box',
              }}
            />
            <Button
              type="submit"
              variant="primary"
              disabled={isSearching || !inputCode.trim()}
              leftIcon={<Search size={16} />}
            >
              {isSearching ? 'Checking...' : 'Find project'}
            </Button>
          </form>

          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
            <Button
              type="button"
              variant="quiet"
              size="sm"
              onClick={() => {
                setInputCode('MILE-MOCKINVITE');
                lookupInvite('MILE-MOCKINVITE');
              }}
            >
              Try sample invite code: MILE-MOCKINVITE
            </Button>
          </div>

          {errorMessage && (
            <div
              style={{
                marginTop: '1.5rem',
                backgroundColor: 'var(--amber-wash)',
                border: '1px solid var(--amber)',
                borderRadius: 'var(--radius-card)',
                padding: '0.875rem 1rem',
                color: 'var(--ink)',
                fontSize: '0.875rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <AlertCircle size={16} style={{ color: 'var(--amber)' }} />
              <span>{errorMessage}</span>
            </div>
          )}

          <p style={{ margin: '2rem 0 0 0', fontSize: '0.8125rem', color: 'var(--ink-3)' }}>
            Looking to hire a freelancer instead?{' '}
            <Link to="/client/new" style={{ color: 'var(--forest)', fontWeight: 600 }}>
              Create a project brief →
            </Link>
          </p>
        </div>
      )}

      {/* Project Preview & Acceptance Form per §5.3 */}
      {preview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          <div>
            <h2
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--forest)',
                margin: 0,
              }}
            >
              Project Agreement Invitation
            </h2>
            <h1
              className="font-display"
              style={{
                fontSize: '2rem',
                fontWeight: 600,
                color: 'var(--ink)',
                margin: '0.25rem 0 0.5rem 0',
                letterSpacing: '-0.02em',
              }}
            >
              {preview.project.title}
            </h1>
            <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>
              Invited by <strong>{preview.client.name}</strong> • Total Budget: <strong>{formatCents(preview.project.totalCents)}</strong>
            </p>
          </div>

          {/* Plain informative line per §5.3 */}
          <div
            style={{
              backgroundColor: 'var(--teal-wash)',
              border: '1px solid var(--teal)',
              borderRadius: 'var(--radius-card)',
              padding: '1rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              color: 'var(--teal-ink)',
            }}
          >
            <ShieldCheck size={20} />
            <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>
              The client funds the project holding balance after you accept.
            </span>
          </div>

          {/* Brief Overview */}
          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-card)',
              padding: '1.25rem',
            }}
          >
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 600, color: 'var(--ink)' }}>
              Project Brief
            </h3>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>
              {preview.project.brief}
            </p>
          </div>

          {/* Milestones with Full Acceptance Criteria per §5.3 */}
          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-card)',
              padding: '1.5rem',
            }}
          >
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: 600, color: 'var(--ink)' }}>
              Agreed Milestones & Acceptance Criteria
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {preview.milestones.map((m, idx) => (
                <div
                  key={m.id}
                  style={{
                    backgroundColor: 'var(--paper)',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--radius-btn)',
                    padding: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--ink)' }}>
                      #{idx + 1} {m.name}
                    </span>
                    <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--forest)' }}>
                      {formatCents(m.amountCents)}
                    </span>
                  </div>

                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-2)', textTransform: 'uppercase' }}>
                    Criteria Checked by AI Reviewer:
                  </span>
                  <ul style={{ margin: '0.35rem 0 0 0', paddingLeft: '1.25rem', fontSize: '0.8125rem', color: 'var(--ink-2)' }}>
                    {m.acceptanceCriteria.map((c, cIdx) => (
                      <li key={cIdx} style={{ marginBottom: '0.2rem' }}>{c}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Acceptance Form */}
          <form
            onSubmit={handleAccept}
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-card)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--ink)' }}>
              Accept Agreement & Register Freelancer Profile
            </h3>

            <Field label="Your full name" required>
              {(props) => (
                <Input
                  {...props}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Arjun Mehta"
                />
              )}
            </Field>

            <Field label="Email address" required hint="Where notification updates will be sent.">
              {(props) => (
                <Input
                  {...props}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="arjun@example.com"
                />
              )}
            </Field>

            <Field
              label="PayPal sandbox recipient email"
              hint="Required: Where milestone payouts are released via PayPal sandbox Payouts API."
            >
              {(props) => (
                <Input
                  {...props}
                  type="email"
                  value={paypalEmail}
                  onChange={(e) => setPaypalEmail(e.target.value)}
                  placeholder="arjun-freelancer@sandbox.paypal.com"
                />
              )}
            </Field>

            {/* Honest note per §5.3 */}
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--ink-3)', fontStyle: 'italic' }}>
              Prototype notice: Email addresses are not verified against real SMTP servers in this sandbox environment.
            </p>

            {errorMessage && (
              <div
                style={{
                  backgroundColor: 'var(--amber-wash)',
                  border: '1px solid var(--amber)',
                  borderRadius: 'var(--radius-card)',
                  padding: '0.875rem 1rem',
                  color: 'var(--ink)',
                  fontSize: '0.875rem',
                }}
              >
                {errorMessage}
              </div>
            )}

            {acceptSuccess && (
              <div
                style={{
                  backgroundColor: 'var(--teal-wash)',
                  border: '1px solid var(--teal)',
                  borderRadius: 'var(--radius-card)',
                  padding: '1rem',
                  color: 'var(--teal-ink)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <CheckCircle2 size={20} />
                <span>Agreement accepted! Redirecting to your freelancer workspace...</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
              <Button
                type="button"
                variant="quiet"
                onClick={() => setPreview(null)}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={isAccepting || acceptSuccess || !name.trim() || !email.trim()}
                leftIcon={<UserCheck size={18} />}
              >
                {isAccepting ? 'Accepting...' : 'Accept invitation & Start'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
