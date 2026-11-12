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
import { apiRawFetch } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.js';

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
    code?: string;
    expiresAt: string;
    hasTargetEmail?: boolean;
    invitedEmailHint?: string | null;
    isOwnInvite?: boolean;
  };
}

export const JoinFlowPage: React.FC = () => {
  const { token: urlToken } = useParams<{ token?: string }>();
  const navigate = useNavigate();
  const { authenticated, user, config, refreshAuth } = useAuth();

  const [inputCode, setInputCode] = useState(urlToken || '');
  const [isSearching, setIsSearching] = useState(false);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Acceptance form state
  const [paypalEmail, setPaypalEmail] = useState(user?.payoutPaypalEmail || '');
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptSuccess, setAcceptSuccess] = useState(false);

  useEffect(() => {
    if (user?.payoutPaypalEmail && !paypalEmail) {
      setPaypalEmail(user.payoutPaypalEmail);
    }
  }, [user?.payoutPaypalEmail, paypalEmail]);

  // Look up invite function (public preview)
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
      const res = await apiRawFetch(`/api/invites/${encodeURIComponent(cleanCode)}`);

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
      setErrorMessage(err instanceof Error ? err.message : 'This invitation is no longer valid.');
      setPreview(null);
    } finally {
      setIsSearching(false);
    }
  };

  // If URL has token, lookup immediately
  useEffect(() => {
    if (urlToken) {
      void lookupInvite(urlToken);
    }
  }, [urlToken]);

  // Handle invitation acceptance (signed-in account required)
  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preview || !authenticated) return;

    const effectivePaypal = paypalEmail.trim() || user?.payoutPaypalEmail?.trim() || '';
    if (!effectivePaypal) {
      setErrorMessage('Enter your PayPal Sandbox payout email to accept this project.');
      return;
    }

    setIsAccepting(true);
    setErrorMessage(null);

    try {
      const codeOrToken = urlToken || inputCode;
      const res = await apiRawFetch(`/api/invites/${encodeURIComponent(codeOrToken)}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paypalEmail: effectivePaypal,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to accept invitation.');
      }

      const data = await res.json();
      await refreshAuth();
      setAcceptSuccess(true);

      setTimeout(() => {
        navigate(`/freelancer/projects/${data.project?.id || preview.project.id}`);
      }, 900);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to accept invitation.');
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
            Enter your invitation code (e.g. <code>MILE-XXXXXXXXXX</code>) or direct invitation link to review the project milestones, observable acceptance criteria, and funds held for this project.
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

          <p style={{ marginTop: '1rem', marginBottom: 0, fontSize: '0.8125rem', color: 'var(--ink-2)' }}>
            Don&apos;t have a code? Ask your client to send one.
          </p>

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
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--forest)',
                margin: 0,
              }}
            >
              Project agreement invitation
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
              Invited by <strong>{preview.client?.name || (preview.project as any)?.clientName || 'Client'}</strong> • Total Budget: <strong>{formatCents(preview.project.totalCents)}</strong>
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
              {(preview.milestones || (preview.project as any)?.milestones || []).map((m: any, idx: number) => {
                const criteria = (m.acceptanceCriteria || m.criteria || []) as any[];
                return (
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

                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-2)' }}>
                    Criteria checked by AI reviewer
                  </span>
                  <ul style={{ margin: '0.35rem 0 0 0', paddingLeft: '1.25rem', fontSize: '0.8125rem', color: 'var(--ink-2)' }}>
                    {criteria.map((rawC: any, cIdx: number) => {
                      const c = typeof rawC === 'string' ? rawC : rawC?.description || rawC?.id || '';
                      return (
                        <li key={cIdx} style={{ marginBottom: '0.2rem' }}>{c}</li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
            </div>
          </div>

          {/* Acceptance Card */}
          <form
            onSubmit={handleAccept}
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-card)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.15rem',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--ink)' }}>
              Accept agreement
            </h3>

            {preview.invite.hasTargetEmail && preview.invite.invitedEmailHint && (
              <div className="ms-alert ms-alert-info">
                <span>
                  This invitation is addressed to <strong>{preview.invite.invitedEmailHint}</strong>.
                </span>
              </div>
            )}

            {preview.invite.isOwnInvite && (
              <div className="ms-alert ms-alert-warning" role="alert">
                <span>
                  You created this project invite. Share this link with your freelancer rather than accepting it yourself.
                </span>
              </div>
            )}

            {!authenticated || !user ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--ink-2)', lineHeight: 1.55 }}>
                  Sign in or create a Milestone account to accept these milestones and attach your PayPal Sandbox payout address.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <Link
                    to={`/signup?intent=freelancer&next=${encodeURIComponent(`/join/${urlToken || inputCode}`)}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <Button variant="primary">Create freelancer account to accept</Button>
                  </Link>
                  <Link
                    to={`/login?next=${encodeURIComponent(`/join/${urlToken || inputCode}`)}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <Button variant="secondary">Sign in</Button>
                  </Link>
                  {config.demoMode && (
                    <Link to="/demo" style={{ textDecoration: 'none' }}>
                      <Button variant="quiet">Try demo workspace</Button>
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div
                  style={{
                    padding: '0.75rem 0.9rem',
                    borderRadius: '8px',
                    backgroundColor: 'var(--paper)',
                    border: '1px solid var(--line)',
                    fontSize: '0.88rem',
                    color: 'var(--ink-2)',
                  }}
                >
                  Accepting as <strong style={{ color: 'var(--ink)' }}>{user.displayName || user.name}</strong> ({user.email})
                </div>

                <Field
                  label="PayPal Sandbox payout email"
                  required
                  hint="Approved milestone payouts settle to this PayPal Sandbox address."
                >
                  {(props) => (
                    <Input
                      {...props}
                      type="email"
                      value={paypalEmail}
                      onChange={(e) => setPaypalEmail(e.target.value)}
                      placeholder="sb-freelancer@personal.example.com"
                    />
                  )}
                </Field>
              </>
            )}

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
                disabled={
                  isAccepting ||
                  acceptSuccess ||
                  !authenticated ||
                  !user ||
                  Boolean(preview.invite.isOwnInvite) ||
                  !paypalEmail.trim()
                }
                leftIcon={<UserCheck size={18} />}
              >
                {isAccepting ? 'Accepting...' : 'Accept agreement & open freelancer workspace'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
