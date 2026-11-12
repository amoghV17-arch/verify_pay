import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Calendar, CheckCircle2, CreditCard, Mail, ShieldCheck } from 'lucide-react';
import { Card } from '../components/ui/Card.js';

export const HelpPage: React.FC = () => {
  return (
    <div style={{ maxWidth: '880px', margin: '0 auto', padding: '3rem 1.5rem 4rem' }}>
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
        Help &amp; guide
      </p>
      <h1 className="font-display" style={{ fontSize: '2.2rem', fontWeight: 700, margin: '0 0 0.75rem' }}>
        How Milestone works
      </h1>
      <p style={{ fontSize: '1.02rem', color: 'var(--ink-2)', lineHeight: 1.6, margin: '0 0 2rem' }}>
        Milestone structures a project into clear deliverables, acceptance criteria, and milestone-based PayPal Sandbox payouts. Both sides can use one account to switch between Client and Freelancer workspaces.
      </p>

      <div style={{ display: 'grid', gap: '1.25rem' }}>
        <Card>
          <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
            <Calendar size={20} color="var(--forest)" style={{ marginTop: '0.15rem', flexShrink: 0 }} />
            <div>
              <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.05rem', fontWeight: 700 }}>
                1. Plan &amp; fund in Client workspace
              </h2>
              <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--ink-2)', lineHeight: 1.55 }}>
                Start a project from a brief, generate an interactive Bryntum Gantt schedule, refine criteria, fund the agreement budget through PayPal Sandbox, and send a scoped invite link or email to your freelancer.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
            <Mail size={20} color="var(--forest)" style={{ marginTop: '0.15rem', flexShrink: 0 }} />
            <div>
              <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.05rem', fontWeight: 700 }}>
                2. Accept invitation &amp; set payout email
              </h2>
              <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--ink-2)', lineHeight: 1.55 }}>
                Open the invite link (`/join/:token`), sign in or create an account, confirm your PayPal Sandbox payout email, and accept. Every project strictly checks your membership so uninvited users cannot view or modify project records.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
            <CheckCircle2 size={20} color="var(--forest)" style={{ marginTop: '0.15rem', flexShrink: 0 }} />
            <div>
              <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.05rem', fontWeight: 700 }}>
                3. AI review &amp; human oversight
              </h2>
              <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--ink-2)', lineHeight: 1.55 }}>
                When a freelancer submits deliverables (links or notes), the AI reviewer checks each acceptance criterion with tool traces. Server-side policy recomputes the final status — the language model cannot trigger a payout on its own.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
            <CreditCard size={20} color="var(--forest)" style={{ marginTop: '0.15rem', flexShrink: 0 }} />
            <div>
              <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.05rem', fontWeight: 700 }}>
                4. Milestone payout release
              </h2>
              <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--ink-2)', lineHeight: 1.55 }}>
                Once a milestone passes, its payout is released via idempotent server requests to the freelancer&apos;s verified PayPal Sandbox payout email, recorded in an immutable ledger with shareable receipts.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
            <ShieldCheck size={20} color="var(--forest)" style={{ marginTop: '0.15rem', flexShrink: 0 }} />
            <div>
              <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.05rem', fontWeight: 700 }}>
                Need help or status diagnostics?
              </h2>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.92rem', color: 'var(--ink-2)', lineHeight: 1.55 }}>
                Check system adapter status on the Status page or inspect security guarantees on the Safety page.
              </p>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.9rem', fontWeight: 600 }}>
                <Link to="/safety" style={{ color: 'var(--forest)' }}>
                  <BookOpen size={14} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />
                  Safety &amp; trust model
                </Link>
                <Link to="/status" style={{ color: 'var(--forest)' }}>
                  System status &rarr;
                </Link>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

