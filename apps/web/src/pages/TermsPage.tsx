import React from 'react';
import { Card } from '../components/ui/Card.js';

export const TermsPage: React.FC = () => {
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
        Legal &amp; sandbox disclosure
      </p>
      <h1 className="font-display" style={{ fontSize: '2.1rem', fontWeight: 700, margin: '0 0 1rem' }}>
        Terms of Use (Sandbox Prototype)
      </h1>

      <Card style={{ display: 'grid', gap: '1.25rem', lineHeight: 1.65, fontSize: '0.93rem', color: 'var(--ink-2)' }}>
        <section>
          <h2 style={{ fontSize: '1.05rem', color: 'var(--ink)', margin: '0 0 0.4rem' }}>
            1. PayPal Sandbox Environment Only
          </h2>
          <p style={{ margin: 0 }}>
            Milestone is an application prototype built exclusively for evaluation and testing with PayPal Sandbox and test adapters. No real money, live bank accounts, or production payment processing occurs on this deployment.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: '1.05rem', color: 'var(--ink)', margin: '0 0 0.4rem' }}>
            2. User Accounts &amp; Project Access
          </h2>
          <p style={{ margin: 0 }}>
            Each account belongs to a single user who may participate as a client or freelancer on separate projects. Do not enter real financial credentials, production secrets, or sensitive personal data into test briefs or deliverables.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: '1.05rem', color: 'var(--ink)', margin: '0 0 0.4rem' }}>
            3. Automated Review &amp; Deterministic Policy
          </h2>
          <p style={{ margin: 0 }}>
            AI deliverable reviews evaluate submitted links and summaries against agreed acceptance criteria. Final payout eligibility is determined strictly by server-side state validation and client/reviewer policy controls rather than autonomous model actions.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: '1.05rem', color: 'var(--ink)', margin: '0 0 0.4rem' }}>
            4. Account Deletion &amp; Held Sandbox Budgets
          </h2>
          <p style={{ margin: 0 }}>
            Accounts with active funded milestones cannot be deleted until held sandbox funds are released or refunded back to the funded balance owner so audit and ledger records remain consistent.
          </p>
        </section>
      </Card>
    </div>
  );
};

