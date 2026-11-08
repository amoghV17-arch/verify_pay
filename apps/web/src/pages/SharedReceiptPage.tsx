import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { formatCents } from '@milestone/shared';
import { Button } from '../components/ui/Button.js';

interface ReceiptData {
  shareId: string;
  project: {
    id: string;
    title: string;
  };
  client: {
    name: string;
  };
  freelancer: {
    name: string;
  } | null;
  milestone: {
    id: string;
    name: string;
    amountCents: number;
    status: string;
  };
  ledger?: {
    amountCents: number;
    timestamp: string;
    paypalPayoutBatchId?: string;
  };
  sharedAt: string;
}

export const SharedReceiptPage: React.FC = () => {
  const { shareId } = useParams<{ shareId: string }>();

  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedBatchId, setCopiedBatchId] = useState(false);

  useEffect(() => {
    async function fetchReceipt() {
      if (!shareId) {
        setErrorMessage('This receipt share link is invalid or has been revoked.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const res = await fetch(`/api/receipts/shared/${encodeURIComponent(shareId)}`);

        if (!res.ok) {
          throw new Error('This receipt share link is invalid or has been revoked.');
        }

        const data = await res.json();
        if (data.success && data.receipt) {
          setReceipt(data.receipt);
        } else {
          throw new Error('This receipt share link is invalid or has been revoked.');
        }
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'This receipt share link is invalid or has been revoked.');
        setReceipt(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchReceipt();
  }, [shareId]);

  const handleCopyBatch = (batchId: string) => {
    navigator.clipboard.writeText(batchId);
    setCopiedBatchId(true);
    setTimeout(() => setCopiedBatchId(false), 2000);
  };

  if (isLoading) {
    return (
      <div style={{ maxWidth: '640px', margin: '4rem auto', padding: '0 1.5rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--ink-2)', fontSize: '0.9375rem' }}>Loading receipt...</p>
      </div>
    );
  }

  // Calm private-by-default error state per §8.3
  if (errorMessage || !receipt) {
    return (
      <div style={{ maxWidth: '640px', margin: '4rem auto', padding: '0 1.5rem' }}>
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-card)',
            padding: '2.5rem',
            textAlign: 'center',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'var(--amber-wash)',
              color: 'var(--amber-ink)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
            }}
          >
            <AlertCircle size={24} />
          </div>

          <h1
            className="font-display"
            style={{
              fontSize: '1.75rem',
              fontWeight: 600,
              color: 'var(--ink)',
              margin: '0 0 0.5rem',
            }}
          >
            Receipt Unavailable
          </h1>

          <p style={{ margin: '0 0 1.5rem', fontSize: '0.9375rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>
            {errorMessage || 'This receipt share link is invalid or has been revoked.'}
          </p>

          <Link to="/" style={{ textDecoration: 'none' }}>
            <Button variant="secondary" size="md">
              Return to Milestone
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const clientName = receipt.client?.name || (receipt as any).project?.clientName || 'Project Client';
  const freelancerName = receipt.freelancer?.name || (receipt as any).project?.freelancerName || 'Verified Freelancer';
  const transactionBatch =
    receipt.ledger?.paypalPayoutBatchId || (receipt as any).settlement?.paypalRef || 'Pending Settlement';

  return (
    <div
      style={{
        maxWidth: '680px',
        margin: '3rem auto',
        padding: '0 1.5rem',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--surface)',
          border: '1.5px solid var(--line)',
          borderRadius: 'var(--radius-card)',
          padding: '2.5rem',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.75rem',
        }}
      >
        {/* Receipt Header in DM Serif Display */}
        <div style={{ textAlign: 'center', borderBottom: '1px solid var(--line)', paddingBottom: '1.5rem' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: 'var(--teal-wash)',
              color: 'var(--forest)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.75rem',
            }}
          >
            <CheckCircle2 size={24} />
          </div>

          <h1
            className="font-display"
            style={{
              fontSize: '2rem',
              fontWeight: 600,
              color: 'var(--ink)',
              margin: '0 0 0.25rem',
              letterSpacing: '-0.02em',
            }}
          >
            Official Settlement Receipt
          </h1>

          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--ink-2)' }}>
            Official public proof of verified milestone completion & PayPal sandbox payout.
          </p>
        </div>

        {/* Amount Box */}
        <div
          style={{
            backgroundColor: 'var(--teal-wash)',
            border: '1px solid var(--teal)',
            borderRadius: 'var(--radius-card)',
            padding: '1.5rem',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--forest)' }}>
            Total Settlement Amount
          </span>
          <div
            style={{
              fontSize: '2.5rem',
              fontWeight: 800,
              color: 'var(--forest)',
              letterSpacing: '-0.03em',
              margin: '0.25rem 0',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatCents(receipt.milestone.amountCents)}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--ink-2)' }}>
            Released via PayPal Sandbox Payouts API
          </span>
        </div>

        {/* Transaction Metadata Grid */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            fontSize: '0.875rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', paddingBottom: '0.6rem' }}>
            <span style={{ color: 'var(--ink-2)' }}>Project</span>
            <strong style={{ color: 'var(--ink)', textAlign: 'right' }}>{receipt.project.title}</strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', paddingBottom: '0.6rem' }}>
            <span style={{ color: 'var(--ink-2)' }}>Milestone</span>
            <span style={{ color: 'var(--ink)', fontWeight: 600, textAlign: 'right' }}>{receipt.milestone.name}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', paddingBottom: '0.6rem' }}>
            <span style={{ color: 'var(--ink-2)' }}>Project Client</span>
            <span style={{ color: 'var(--ink)' }}>{clientName}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', paddingBottom: '0.6rem' }}>
            <span style={{ color: 'var(--ink-2)' }}>Recipient Freelancer</span>
            <span style={{ color: 'var(--ink)' }}>{freelancerName}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', paddingBottom: '0.6rem' }}>
            <span style={{ color: 'var(--ink-2)' }}>Settlement Timestamp</span>
            <span style={{ color: 'var(--ink)' }}>
              {receipt.ledger?.timestamp ? new Date(receipt.ledger.timestamp).toUTCString() : new Date().toUTCString()}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--ink-2)' }}>PayPal Sandbox Batch</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <code style={{ backgroundColor: 'var(--paper)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                {transactionBatch}
              </code>
              <button
                type="button"
                onClick={() => handleCopyBatch(transactionBatch)}
                aria-label="Copy batch ID"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: copiedBatchId ? 'var(--forest)' : 'var(--ink-2)',
                  padding: '2px',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                {copiedBatchId ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        </div>

        {/* Verification Footer Note */}
        <div
          style={{
            backgroundColor: 'var(--paper)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-input)',
            padding: '1rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.65rem',
            fontSize: '0.75rem',
            color: 'var(--ink-2)',
            lineHeight: 1.45,
          }}
        >
          <ShieldCheck size={18} style={{ color: 'var(--forest)', flexShrink: 0, marginTop: '1px' }} />
          <div>
            <strong style={{ color: 'var(--ink)', display: 'block', marginBottom: '0.15rem' }}>
              Autonomous AI Verification Protocol
            </strong>
            <span>
              This deliverable was evaluated against agreed observable acceptance criteria by the AI Reviewer agent.
              This public share link is revocable at any time by the project owner.
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <Button variant="quiet" size="sm">
              Powered by Milestone • PayPal & AI
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
