import React, { useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Check,
  Share2,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { formatCents } from '@milestone/shared';
import { Button } from '../ui/Button.js';
import { useCountUp } from '../SettleMoment.js';

export interface SettlementReceiptCardProps {
  milestoneId: string;
  milestoneTitle: string;
  amountCents: number;
  recipientName: string;
  recipientEmail?: string;
  paypalPayoutBatchId: string;
  timestamp: string;
  ledgerEntryId: string;
  shareUrl?: string;
  onOpenReceiptModal?: () => void;
  style?: React.CSSProperties;
}

export const SettlementReceiptCard: React.FC<SettlementReceiptCardProps> = ({
  milestoneId,
  milestoneTitle,
  amountCents,
  recipientName,
  recipientEmail = '',
  paypalPayoutBatchId,
  timestamp,
  ledgerEntryId,
  shareUrl,
  onOpenReceiptModal,
  style,
}) => {
  const [copiedBatchId, setCopiedBatchId] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const countedAmount = useCountUp(amountCents, 800);

  const handleCopyBatch = () => {
    navigator.clipboard.writeText(paypalPayoutBatchId);
    setCopiedBatchId(true);
    setTimeout(() => setCopiedBatchId(false), 2000);
  };

  const handleCopyShare = () => {
    if (!shareUrl) return;
    const fullUrl = `${window.location.origin}${shareUrl}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedShareLink(true);
    setTimeout(() => setCopiedShareLink(false), 2000);
  };

  return (
    <div
      data-milestone-id={milestoneId}
      style={{
        backgroundColor: 'var(--surface)',
        border: '1.5px solid var(--forest)',
        borderRadius: 'var(--radius-card)',
        padding: '1.5rem',
        boxShadow: '0 8px 24px rgba(32, 39, 34, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        ...style,
      }}
    >
      {/* Header Badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: 'var(--teal-wash)',
              color: 'var(--forest)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle2 size={16} />
          </div>
          <span
            style={{
              fontSize: '0.8125rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--forest)',
            }}
          >
            Deliverable Verified & Settled
          </span>
        </div>

        <span
          style={{
            fontSize: '0.6875rem',
            padding: '0.15rem 0.5rem',
            borderRadius: 'var(--radius-chip)',
            backgroundColor: 'var(--paper)',
            border: '1px solid var(--line)',
            color: 'var(--ink-2)',
            fontWeight: 500,
          }}
        >
          PayPal Sandbox
        </span>
      </div>

      {/* Main Figure & Milestone Info */}
      <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: '1rem' }}>
        <span style={{ fontSize: '0.8125rem', color: 'var(--ink-2)' }}>Milestone Payout Released:</span>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '0.25rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--ink)' }}>
            {milestoneTitle}
          </h3>
          <span
            style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              color: 'var(--forest)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatCents(countedAmount)}
          </span>
        </div>
      </div>

      {/* Settlement Metadata Grid per §8.3 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.75rem',
          fontSize: '0.75rem',
        }}
      >
        <div>
          <span style={{ color: 'var(--ink-2)', display: 'block' }}>Recipient:</span>
          <strong style={{ color: 'var(--ink)' }}>{recipientName}</strong>
          <span style={{ color: 'var(--ink-3)', display: 'block' }}>({recipientEmail})</span>
        </div>

        <div>
          <span style={{ color: 'var(--ink-2)', display: 'block' }}>Settlement Time:</span>
          <strong style={{ color: 'var(--ink)' }}>
            {new Date(timestamp).toLocaleDateString()} at{' '}
            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </strong>
        </div>

        <div>
          <span style={{ color: 'var(--ink-2)', display: 'block' }}>Immutable Ledger ID:</span>
          <code style={{ fontFamily: 'monospace', color: 'var(--ink)', backgroundColor: 'var(--paper)', padding: '1px 4px', borderRadius: '3px' }}>
            {ledgerEntryId}
          </code>
        </div>

        <div>
          <span style={{ color: 'var(--ink-2)', display: 'block' }}>PayPal Sandbox Reference:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '2px' }}>
            <code style={{ fontFamily: 'monospace', color: 'var(--ink)', backgroundColor: 'var(--paper)', padding: '1px 4px', borderRadius: '3px' }}>
              {paypalPayoutBatchId}
            </code>
            <button
              type="button"
              onClick={handleCopyBatch}
              aria-label="Copy PayPal batch ID"
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
              {copiedBatchId ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
        </div>
      </div>

      {/* Action Footer: View Full Receipt + Share Link */}
      <div
        style={{
          borderTop: '1px solid var(--line)',
          paddingTop: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--forest)', fontSize: '0.75rem' }}>
          <ShieldCheck size={15} />
          <span>Cryptographically logged to ledger</span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {shareUrl && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={copiedShareLink ? <Check size={14} /> : <Share2 size={14} />}
              onClick={handleCopyShare}
            >
              {copiedShareLink ? 'Link copied' : 'Share receipt'}
            </Button>
          )}

          {onOpenReceiptModal && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<FileText size={14} />}
              onClick={onOpenReceiptModal}
            >
              Full receipt
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
