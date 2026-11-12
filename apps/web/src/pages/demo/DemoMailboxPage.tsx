import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button.js';
import { ApiError, apiFetch } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.js';

interface OutboxRow {
  id: string;
  toAddress: string;
  template: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  status: string;
  deliveredVia: string;
  createdAt: string;
}

export const DemoMailboxPage: React.FC = () => {
  const { authenticated, user, config, refreshAuth } = useAuth();
  const [messages, setMessages] = useState<OutboxRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMailboxAllowed = Boolean(
    authenticated && (user?.isDemo || config.emailProvider === 'outbox' || config.demoMode)
  );

  const loadMailbox = useCallback(async () => {
    if (!isMailboxAllowed) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ messages: OutboxRow[] }>('/api/demo/mailbox');
      const rows = Array.isArray(data.messages) ? data.messages : [];
      setMessages(rows);
      if (rows.length > 0 && !selectedId) {
        setSelectedId(rows[0].id);
      }
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Unable to load demo mailbox.');
    } finally {
      setLoading(false);
    }
  }, [isMailboxAllowed, selectedId]);

  useEffect(() => {
    void loadMailbox();
  }, [loadMailbox]);

  const handleQuickDemoSignIn = async (persona: 'client' | 'freelancer') => {
    setError(null);
    try {
      await apiFetch('/api/demo/login-as', {
        method: 'POST',
        body: JSON.stringify({ persona }),
      });
      await refreshAuth();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in to demo account.');
    }
  };

  const selected = messages.find((m) => m.id === selectedId) || messages[0] || null;

  return (
    <div style={{ maxWidth: '1040px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 className="font-display" style={{ fontSize: '1.85rem', margin: '0 0 0.25rem 0' }}>
            Demo virtual mailbox
          </h1>
          <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: '0.9rem' }}>
            Scoped strictly to the currently signed-in demo account. Real outbound emails are not sent for `.invalid` demo addresses.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button variant="secondary" size="sm" onClick={() => void handleQuickDemoSignIn('client')}>
            Demo Client
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void handleQuickDemoSignIn('freelancer')}>
            Demo Freelancer
          </Button>
          <Button variant="quiet" size="sm" leftIcon={<RefreshCw size={14} />} onClick={() => void loadMailbox()} isLoading={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="ms-alert ms-alert-danger" role="alert">
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {!isMailboxAllowed ? (
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: '14px',
            padding: '2rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.9rem',
            alignItems: 'center',
          }}
        >
          <Mail size={28} style={{ color: 'var(--teal)' }} />
          <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>
            {authenticated ? 'Virtual mailbox is restricted in production' : 'Sign in to view stored messages'}
          </div>
          <p style={{ margin: 0, maxWidth: '460px', color: 'var(--ink-2)', fontSize: '0.9rem' }}>
            Use either quick-switch button above to sign in with an ephemeral demo account, or return to{' '}
            <Link to="/demo" style={{ color: 'var(--teal-ink)', fontWeight: 600 }}>
              the demo launcher
            </Link>
            .
          </p>
        </div>
      ) : messages.length === 0 ? (
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: '14px',
            padding: '2.5rem',
            textAlign: 'center',
            color: 'var(--ink-2)',
          }}
        >
          No outbox emails captured yet for <strong>{user?.email || 'your account'}</strong>. Trigger a project invite, funding event, review, or payout first.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(240px, 320px) 1fr',
            gap: '1rem',
            alignItems: 'start',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            {messages.map((msg) => {
              const active = selected?.id === msg.id;
              return (
                <button
                  key={msg.id}
                  type="button"
                  onClick={() => setSelectedId(msg.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.85rem 1rem',
                    border: 'none',
                    borderBottom: '1px solid var(--line)',
                    backgroundColor: active ? 'var(--teal-soft)' : 'transparent',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--ink)', marginBottom: '0.2rem' }}>
                    {msg.subject}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--ink-2)' }}>
                    {msg.template} • {new Date(msg.createdAt).toLocaleTimeString()}
                  </div>
                </button>
              );
            })}
          </div>

          {selected && (
            <div
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: '12px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.9rem',
              }}
            >
              <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: '0.85rem' }}>
                <h2 style={{ margin: '0 0 0.35rem 0', fontSize: '1.2rem' }}>{selected.subject}</h2>
                <div style={{ fontSize: '0.82rem', color: 'var(--ink-2)' }}>
                  To: <strong>{selected.toAddress}</strong> • Delivered via: {selected.deliveredVia} ({selected.status})
                </div>
              </div>
              <pre
                style={{
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.92rem',
                  lineHeight: 1.6,
                  color: 'var(--ink)',
                  backgroundColor: 'var(--paper)',
                  padding: '1rem',
                  borderRadius: '8px',
                  border: '1px solid var(--line)',
                }}
              >
                {selected.bodyText}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

