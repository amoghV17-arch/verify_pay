import React from 'react';
import { Card } from '../components/ui/Card.js';

export const PrivacyPage: React.FC = () => {
  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', padding: '3rem 1.5rem 4rem' }}>
      <p
        style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--teal)',
          margin: '0 0 0.5rem',
        }}
      >
        Privacy notice
      </p>
      <h1 className="font-display" style={{ fontSize: '2.1rem', fontWeight: 700, margin: '0 0 1rem' }}>
        Privacy &amp; Data Handling
      </h1>

      <Card style={{ display: 'grid', gap: '1.25rem', lineHeight: 1.65, fontSize: '0.93rem', color: 'var(--ink-2)' }}>
        <section>
          <h2 style={{ fontSize: '1.05rem', color: 'var(--ink)', margin: '0 0 0.4rem' }}>
            1. Account Information We Store
          </h2>
          <p style={{ margin: 0 }}>
            When you register on Milestone, we store your display name, email address, optional company name, notification preferences, and optional PayPal Sandbox payout email. Passwords are hashed using Node&apos;s `crypto.scrypt` with unique per-user salts and are never stored in plain text.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: '1.05rem', color: 'var(--ink)', margin: '0 0 0.4rem' }}>
            2. Cookies &amp; Session Security
          </h2>
          <p style={{ margin: 0 }}>
            Milestone uses signed/opaque HTTP-only session cookies (`ms_session`) and a CSRF protection cookie (`ms_csrf`). Session tokens stored in the database are SHA-256 hashed so active sessions can be viewed or revoked at any time from Settings.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: '1.05rem', color: 'var(--ink)', margin: '0 0 0.4rem' }}>
            3. Audit Events &amp; IP Privacy
          </h2>
          <p style={{ margin: 0 }}>
            Security audit logs (sign-ins, password changes, and payout email updates) record HMAC-hashed IP identifiers rather than raw IP addresses wherever possible.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: '1.05rem', color: 'var(--ink)', margin: '0 0 0.4rem' }}>
            4. Managing or Removing Your Data
          </h2>
          <p style={{ margin: 0 }}>
            You can update your profile, change notification preferences, revoke all other active sessions, or request account closure directly from Account Settings once any active funded projects are settled.
          </p>
        </section>
      </Card>
    </div>
  );
};

