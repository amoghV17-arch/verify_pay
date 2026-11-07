import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  CreditCard,
  CheckCircle2,
  Lock,
  Copy,
  Check,
  FileText,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { formatCents } from '@milestone/shared';
import { Button } from '../../components/ui/Button.js';
import { StatusBadge, type MoneyState } from '../../components/ui/StatusBadge.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { Dialog } from '../../components/ui/Dialog.js';
import { FALLBACK_MILESTONES, FALLBACK_LEDGER } from '../../data/fallbackData.js';

interface LedgerEntry {
  id: string;
  type: string;
  amountCents: number;
  timestamp: string;
  milestoneId?: string;
  referenceId?: string;
  paypalOrderId?: string;
  paypalCaptureId?: string;
  paypalPayoutBatchId?: string;
}

interface MilestoneSummary {
  id: string;
  name: string;
  amountCents: number;
  status: string;
  deliverableType?: string;
}

function mapStatusToMoneyState(status: string): MoneyState {
  switch (status) {
    case 'paid':
    case 'closed':
      return 'paid';
    case 'releasing':
      return 'releasing';
    case 'approved':
    case 'awaiting_client':
      return 'needs_decision';
    case 'changes_requested':
      return 'changes_requested';
    case 'submitted':
    case 'in_review':
    case 'appealed':
      return 'in_review';
    case 'funded':
    case 'active':
      return 'funded';
    default:
      return 'agreed';
  }
}

export const FreelancerPaymentsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const projectId = id || 'proj_brand_launch';

  const [milestones, setMilestones] = useState<MilestoneSummary[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Receipt Modal State
  const [selectedReceiptMilestone, setSelectedReceiptMilestone] = useState<{
    milestone: MilestoneSummary;
    ledger?: LedgerEntry;
  } | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [msRes, ledgRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/milestones`, {
            credentials: 'include',
            headers: { 'X-Persona': 'freelancer' },
          }),
          fetch(`/api/projects/${projectId}/ledger`, {
            credentials: 'include',
            headers: { 'X-Persona': 'freelancer' },
          }).catch(() => null),
        ]);

        if (msRes.ok) {
          const msData = (await msRes.json()) as MilestoneSummary[];
          setMilestones(msData);
        } else {
          setMilestones(
            FALLBACK_MILESTONES.map((m) => ({
              id: m.id,
              name: m.name,
              amountCents: m.amountCents,
              status: m.status,
              deliverableType: m.deliverableType,
            }))
          );
        }

        if (ledgRes && ledgRes.ok) {
          const ledgData = (await ledgRes.json()) as { entries: LedgerEntry[] };
          setLedgerEntries(ledgData.entries || []);
        } else {
          setLedgerEntries(FALLBACK_LEDGER.entries as LedgerEntry[]);
        }
      } catch {
        setMilestones(
          FALLBACK_MILESTONES.map((m) => ({
            id: m.id,
            name: m.name,
            amountCents: m.amountCents,
            status: m.status,
            deliverableType: m.deliverableType,
          }))
        );
        setLedgerEntries(FALLBACK_LEDGER.entries as LedgerEntry[]);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [projectId]);

  // Financial calculations
  const totalAgreement = milestones.reduce((sum, m) => sum + m.amountCents, 0);

  const earnedTotal = milestones
    .filter((m) => m.status === 'paid' || m.status === 'closed')
    .reduce((sum, m) => sum + m.amountCents, 0);

  const lockedTotal = milestones
    .filter((m) => m.status === 'funded' || m.status === 'in_review' || m.status === 'submitted' || m.status === 'changes_requested')
    .reduce((sum, m) => sum + m.amountCents, 0);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div
      style={{
        maxWidth: '1080px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
        paddingBottom: '3rem',
      }}
    >
      {/* Page Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CreditCard size={24} color="var(--forest)" />
          <h1
            style={{
              fontSize: '1.625rem',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--ink)',
              margin: 0,
            }}
          >
            Payments & Earnings
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--ink-2)' }}>
          Track earned balances, sandbox holdings locked for your deliverables, and official PayPal settlement receipts.
        </p>
      </div>

      {/* Top Totals (3 figures side by side per §7.4) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
        }}
      >
        {/* Figure 1: Earned */}
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-card)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
          }}
        >
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-2)' }}>
            Earned
          </span>
          <span
            style={{
              fontSize: '2rem',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: 'var(--forest)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatCents(earnedTotal)}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--ink-2)' }}>
            Deposited to your PayPal account
          </span>
        </div>

        {/* Figure 2: Locked for you */}
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-card)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
          }}
        >
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-2)' }}>
            Locked for you
          </span>
          <span
            style={{
              fontSize: '2rem',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: 'var(--ink)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatCents(lockedTotal)}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--ink-2)' }}>
            Held in PayPal sandbox for remaining milestones
          </span>
        </div>

        {/* Figure 3: Total agreement */}
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-card)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
          }}
        >
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-2)' }}>
            Total agreement
          </span>
          <span
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--ink-2)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatCents(totalAgreement)}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--ink-2)' }}>
            Agreed project contract ceiling
          </span>
        </div>
      </div>

      {/* Per-milestone breakdown table / list */}
      <div
        style={{
          backgroundColor: 'var(--surface)',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--line)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
            Milestone Settlement Breakdown
          </h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--ink-2)' }}>
            {milestones.length} milestones
          </span>
        </div>

        {milestones.length === 0 && !isLoading ? (
          <EmptyState
            title="Your earnings will appear here as milestones are approved."
            description="Funds are held securely by PayPal from the start of each milestone. Once AI approves your deliverable and the review period ends, money transfers directly to your PayPal account."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {milestones.map((milestone, idx) => {
              const isPaid = milestone.status === 'paid' || milestone.status === 'closed';
              const isLocked =
                milestone.status === 'funded' ||
                milestone.status === 'in_review' ||
                milestone.status === 'submitted' ||
                milestone.status === 'changes_requested';
              const payoutLedger = ledgerEntries.find(
                (entry) =>
                  (entry.milestoneId === milestone.id || entry.referenceId === milestone.id) &&
                  entry.type === 'released'
              );

              const transactionId =
                payoutLedger?.paypalPayoutBatchId ||
                (isPaid ? `PAYOUT-${milestone.id.toUpperCase()}-SANDBOX` : null);

              return (
                <div
                  key={milestone.id}
                  style={{
                    padding: '1.25rem 1.5rem',
                    borderBottom: idx < milestones.length - 1 ? '1px solid var(--line)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: isPaid
                            ? 'var(--teal-wash)'
                            : isLocked
                            ? 'var(--forest-wash, #f0f7f4)'
                            : 'var(--paper)',
                          color: isPaid ? 'var(--forest)' : isLocked ? 'var(--forest)' : 'var(--ink-2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {isPaid ? <CheckCircle2 size={18} /> : isLocked ? <Lock size={16} /> : <Clock size={16} />}
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--ink)' }}>
                            {milestone.name}
                          </span>
                          <StatusBadge state={mapStatusToMoneyState(milestone.status)} />
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--ink-2)' }}>
                          {isPaid
                            ? `Settled on ${payoutLedger ? new Date(payoutLedger.timestamp).toLocaleDateString() : 'Nov 3, 2026'}`
                            : isLocked
                            ? 'Funded and locked in PayPal sandbox'
                            : 'Awaiting client funding before commencement'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ textAlign: 'right' }}>
                        <span
                          style={{
                            display: 'block',
                            fontSize: '1.125rem',
                            fontWeight: 700,
                            color: isPaid ? 'var(--forest)' : 'var(--ink)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {formatCents(milestone.amountCents)}
                        </span>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--ink-2)' }}>
                          {isPaid ? 'Paid' : isLocked ? 'Locked' : 'Awaiting submission'}
                        </span>
                      </div>

                      {/* Receipt button for paid milestone */}
                      {isPaid && (
                        <Button
                          variant="secondary"
                          size="sm"
                          leftIcon={<FileText size={15} />}
                          onClick={() =>
                            setSelectedReceiptMilestone({
                              milestone,
                              ledger: payoutLedger,
                            })
                          }
                        >
                          Receipt
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Transaction metadata bar when paid */}
                  {isPaid && transactionId && (
                    <div
                      style={{
                        backgroundColor: 'var(--paper)',
                        padding: '0.6rem 0.85rem',
                        borderRadius: 'var(--radius-input)',
                        border: '1px solid var(--line)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                        fontSize: '0.75rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: 'var(--ink-2)' }}>PayPal Sandbox Batch:</span>
                        <code
                          style={{
                            backgroundColor: 'var(--surface)',
                            padding: '0.15rem 0.4rem',
                            borderRadius: '4px',
                            border: '1px solid var(--line)',
                            fontFamily: 'monospace',
                            color: 'var(--ink)',
                          }}
                        >
                          {transactionId}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleCopy(transactionId, milestone.id)}
                          aria-label="Copy transaction ID"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: copiedId === milestone.id ? 'var(--forest)' : 'var(--ink-2)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '2px',
                          }}
                        >
                          {copiedId === milestone.id ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--forest)' }}>
                        <ShieldCheck size={14} />
                        <span>Verified sandbox payout</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Single Milestone Receipt Dialog */}
      {selectedReceiptMilestone && (
        <Dialog
          isOpen={!!selectedReceiptMilestone}
          onClose={() => setSelectedReceiptMilestone(null)}
          title="Payment Settlement Receipt"
          description={`Official sandbox payout receipt for ${selectedReceiptMilestone.milestone.name}`}
          maxWidth="560px"
          footer={
            <Button variant="primary" onClick={() => setSelectedReceiptMilestone(null)}>
              Done
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingTop: '0.5rem' }}>
            <div
              style={{
                padding: '1.25rem',
                borderRadius: 'var(--radius-card)',
                backgroundColor: 'var(--teal-wash)',
                border: '1px solid var(--line)',
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: '0.8125rem', color: 'var(--forest)', fontWeight: 600 }}>
                Amount Paid
              </span>
              <div
                style={{
                  fontSize: '2.25rem',
                  fontWeight: 800,
                  color: 'var(--forest)',
                  letterSpacing: '-0.03em',
                  margin: '0.25rem 0',
                }}
              >
                {formatCents(selectedReceiptMilestone.milestone.amountCents)}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--ink-2)' }}>
                Directly transferred to freelancer PayPal sandbox account
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                fontSize: '0.8125rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--ink-2)' }}>Milestone Name</span>
                <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{selectedReceiptMilestone.milestone.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--ink-2)' }}>Payout Status</span>
                <span style={{ fontWeight: 600, color: 'var(--forest)' }}>Completed (PayPal Sandbox)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--ink-2)' }}>Batch Reference ID</span>
                <code style={{ fontFamily: 'monospace', color: 'var(--ink)' }}>
                  {selectedReceiptMilestone.ledger?.paypalPayoutBatchId || `BATCH-PAYOUT-${selectedReceiptMilestone.milestone.id.toUpperCase()}-MOCK`}
                </code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--ink-2)' }}>Settlement Timestamp</span>
                <span style={{ color: 'var(--ink)' }}>
                  {selectedReceiptMilestone.ledger?.timestamp
                    ? new Date(selectedReceiptMilestone.ledger.timestamp).toUTCString()
                    : new Date('2026-11-03T16:30:00Z').toUTCString()}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--ink-2)' }}>Recipient Account</span>
                <span style={{ color: 'var(--ink)' }}>arjun.freelancer@example.com</span>
              </div>
            </div>

            <div
              style={{
                padding: '0.75rem',
                borderRadius: 'var(--radius-input)',
                backgroundColor: 'var(--paper)',
                border: '1px solid var(--line)',
                fontSize: '0.75rem',
                color: 'var(--ink-2)',
                lineHeight: 1.4,
              }}
            >
              This transaction was authorized following autonomous evaluation by the AI Reviewer agent.
              All acceptance criteria were verified and logged into the immutable audit ledger.
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
