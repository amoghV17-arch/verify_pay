import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Download,
  Share2,
  ShieldCheck,
  Copy,
  Check,
} from 'lucide-react';
import { formatCents } from '@milestone/shared';
import { Button } from '../../components/ui/Button.js';
import { StatusBadge } from '../../components/ui/StatusBadge.js';
import {
  extractLedgerBalances,
  formatDateTimeSafe,
  isMilestoneSettled,
  mapStatusToMoneyState,
} from '../../lib/projectHelpers.js';

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
}

export const ClientPaymentsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [milestones, setMilestones] = useState<MilestoneSummary[]>([]);
  const [totals, setTotals] = useState({
    budget: 0,
    funded: 0,
    released: 0,
    remaining: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Share receipt state
  const [activeShareModal, setActiveShareModal] = useState<{
    milestoneId: string;
    shareUrl: string;
    shareId: string;
  } | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [copyShareSuccess, setCopyShareSuccess] = useState(false);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;

    async function fetchLedgerData() {
      try {
        setIsLoading(true);
        setError(null);

        const [projRes, ledgerRes] = await Promise.all([
          fetch(`/api/projects/${id}`, { credentials: 'include', headers: { 'X-Persona': 'client' } }),
          fetch(`/api/projects/${id}/ledger`, { credentials: 'include', headers: { 'X-Persona': 'client' } }),
        ]);

        if (!projRes.ok || !ledgerRes.ok) {
          throw new Error('Failed to load payments and ledger data');
        }

        const projData = await projRes.json();
        const ledgerData = await ledgerRes.json();

        if (isMounted) {
          setMilestones(projData.milestones || []);
          const rawEntries = Array.isArray(ledgerData.entries) ? ledgerData.entries : [];
          setLedgerEntries(
            rawEntries.map((entry: any) => ({
              ...entry,
              timestamp: entry.timestamp || entry.createdAt || entry.ts || '',
              referenceId: entry.referenceId || entry.paypalRef || '',
            }))
          );

          const totalBudget = projData.project?.totalCents || 0;
          const primaryBalances = extractLedgerBalances(ledgerData);
          const fallbackBalances = extractLedgerBalances(projData.ledger);
          const funded = primaryBalances.fundedCents || fallbackBalances.fundedCents;
          const released = primaryBalances.paidCents || fallbackBalances.paidCents;
          const remaining = Math.max(0, totalBudget - funded);

          setTotals({
            budget: totalBudget,
            funded,
            released,
            remaining,
          });
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load payments');
          setMilestones([]);
          setLedgerEntries([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchLedgerData();
    return () => {
      isMounted = false;
    };
  }, [id]);

  // Export audit JSON per §6.6
  const handleExportAudit = async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/projects/${id}/audit`, {
        headers: { 'X-Persona': 'client' },
      });
      if (res.ok) {
        const auditData = await res.json();
        const blob = new Blob([JSON.stringify(auditData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `milestone-audit-${id}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Audit export failed:', err);
    }
  };

  // Generate share receipt link per §6.6 & §10.2
  const handleShareReceipt = async (milestoneId: string) => {
    setIsSharing(true);
    try {
      const res = await fetch(`/api/milestones/${milestoneId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Persona': 'client',
        },
      });

      if (res.ok) {
        const data = await res.json();
        setActiveShareModal({
          milestoneId,
          shareUrl: data.shareUrl,
          shareId: data.shareId,
        });
      }
    } catch (err) {
      console.error('Share link generation failed:', err);
    } finally {
      setIsSharing(false);
    }
  };

  // Revoke receipt share link
  const handleRevokeShare = async (milestoneId: string) => {
    try {
      const res = await fetch(`/api/milestones/${milestoneId}/share/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Persona': 'client',
        },
      });
      if (res.ok) {
        setActiveShareModal(null);
      }
    } catch (err) {
      console.error('Share link revocation failed:', err);
    }
  };

  const copyShareLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopyShareSuccess(true);
    setTimeout(() => setCopyShareSuccess(false), 2000);
  };

  if (isLoading) {
    return (
      <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '2.5rem 1.5rem', width: '100%' }}>
        <div style={{ height: '240px', backgroundColor: 'var(--surface)', borderRadius: 'var(--radius-card)', animation: 'pulse 1.5s infinite' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '2.5rem 1.5rem', width: '100%' }}>
        <div style={{ backgroundColor: 'var(--amber-wash)', border: '1px solid var(--amber)', borderRadius: 'var(--radius-card)', padding: '1.5rem' }}>
          <h3>Unable to load payment records</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: '1080px',
        margin: '0 auto',
        padding: '2.5rem 1.5rem',
        width: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
      }}
    >
      {/* Header & Export Audit Action */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <h1
              className="font-display"
              style={{
                fontSize: '2rem',
                fontWeight: 600,
                color: 'var(--ink)',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              Payments & Ledger
            </h1>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: 'var(--forest-10)',
                color: 'var(--forest)',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.25rem 0.6rem',
                borderRadius: 'var(--radius-badge)',
                border: '1px solid var(--forest)',
              }}
            >
              <ShieldCheck size={12} />
              PayPal Sandbox
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--ink-2)' }}>
            Cryptographically-verifiable double-entry ledger entries and PayPal sandbox transaction references.
          </p>
        </div>

        <Button
          variant="secondary"
          onClick={handleExportAudit}
          leftIcon={<Download size={16} />}
        >
          Export Audit JSON
        </Button>
      </div>

      {/* Financial Totals Cards per §6.6 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-card)',
            padding: '1.25rem',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--ink-2)', textTransform: 'uppercase', fontWeight: 600 }}>
            Total Budget
          </span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.5rem', fontWeight: 700, color: 'var(--ink)' }}>
            {formatCents(totals.budget)}
          </p>
        </div>

        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-card)',
            padding: '1.25rem',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--ink-2)', textTransform: 'uppercase', fontWeight: 600 }}>
            Funded into Holding
          </span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.5rem', fontWeight: 700, color: 'var(--forest)' }}>
            {formatCents(totals.funded)}
          </p>
        </div>

        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-card)',
            padding: '1.25rem',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--ink-2)', textTransform: 'uppercase', fontWeight: 600 }}>
            Released to Freelancer
          </span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.5rem', fontWeight: 700, color: 'var(--teal-ink)' }}>
            {formatCents(totals.released)}
          </p>
        </div>

        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-card)',
            padding: '1.25rem',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--ink-2)', textTransform: 'uppercase', fontWeight: 600 }}>
            Remaining to Fund
          </span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.5rem', fontWeight: 700, color: 'var(--ink-2)' }}>
            {formatCents(totals.remaining)}
          </p>
        </div>
      </div>

      {/* Per-Milestone Settlement Breakdown */}
      <div
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-card)',
          padding: '1.5rem',
        }}
      >
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: 600, color: 'var(--ink)' }}>
          Milestone Settlement Breakdown
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {milestones.map((m) => {
            const isPaid = isMilestoneSettled(m.status);
            return (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem',
                  borderRadius: 'var(--radius-btn)',
                  backgroundColor: 'var(--paper)',
                  border: '1px solid var(--line)',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--ink)' }}>
                    {m.name}
                  </h4>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--ink-2)' }}>
                    Payout: {formatCents(m.amountCents)}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <StatusBadge state={mapStatusToMoneyState(m.status)} />

                  {isPaid ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isSharing}
                      onClick={() => handleShareReceipt(m.id)}
                      leftIcon={<Share2 size={14} />}
                    >
                      {isSharing ? 'Generating...' : 'Share receipt'}
                    </Button>
                  ) : (
                    <span style={{ fontSize: '0.8125rem', color: 'var(--ink-3)' }}>Unreleased</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Complete Immutable Ledger Entries Table per §6.6 */}
      <div
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-card)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--line)' }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--ink)' }}>
            Immutable Ledger Entries
          </h3>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: 'var(--ink-2)' }}>
            Append-only double-entry records with PayPal sandbox reference identifiers.
          </p>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr
                style={{
                  backgroundColor: 'var(--paper)',
                  borderBottom: '1px solid var(--line)',
                  color: 'var(--ink-2)',
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                }}
              >
                <th style={{ padding: '0.75rem 1.25rem' }}>Type</th>
                <th style={{ padding: '0.75rem 1.25rem' }}>Amount</th>
                <th style={{ padding: '0.75rem 1.25rem' }}>Date & Time</th>
                <th style={{ padding: '0.75rem 1.25rem' }}>PayPal Reference</th>
              </tr>
            </thead>
            <tbody>
              {ledgerEntries.map((entry) => {
                const paypalRef =
                  entry.paypalCaptureId ||
                  entry.paypalPayoutBatchId ||
                  entry.paypalOrderId ||
                  entry.referenceId ||
                  'N/A';

                return (
                  <tr key={entry.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '0.875rem 1.25rem' }}>
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: '0.8125rem',
                          textTransform: 'uppercase',
                          color:
                            entry.type === 'released'
                              ? 'var(--teal-ink)'
                              : entry.type === 'funded'
                              ? 'var(--forest)'
                              : 'var(--ink)',
                        }}
                      >
                        {entry.type}
                      </span>
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem', fontWeight: 600, color: 'var(--ink)' }}>
                      {formatCents(entry.amountCents)}
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem', color: 'var(--ink-2)', fontSize: '0.8125rem' }}>
                      {formatDateTimeSafe(entry.timestamp)}
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem', fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--ink-2)' }}>
                      {paypalRef}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Share Receipt Link Modal */}
      {activeShareModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
          onClick={() => setActiveShareModal(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--surface)',
              borderRadius: 'var(--radius-card)',
              maxWidth: '560px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--line)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Share2 size={20} style={{ color: 'var(--forest)' }} />
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--ink)' }}>
                Public Settlement Receipt Link
              </h3>
            </div>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.875rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>
              Anyone with this link can view the read-only cryptographic proof of delivery, AI evaluation trace, and PayPal payout confirmation.
            </p>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <input
                type="text"
                readOnly
                value={activeShareModal.shareUrl}
                style={{
                  flex: 1,
                  padding: '0.6rem 0.75rem',
                  fontSize: '0.875rem',
                  backgroundColor: 'var(--paper)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-btn)',
                  color: 'var(--ink)',
                }}
              />
              <Button
                variant="primary"
                onClick={() => copyShareLink(activeShareModal.shareUrl)}
                leftIcon={copyShareSuccess ? <Check size={16} /> : <Copy size={16} />}
              >
                {copyShareSuccess ? 'Copied' : 'Copy link'}
              </Button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => handleRevokeShare(activeShareModal.milestoneId)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--amber)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Revoke public access
              </button>
              <Button variant="secondary" onClick={() => setActiveShareModal(null)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

