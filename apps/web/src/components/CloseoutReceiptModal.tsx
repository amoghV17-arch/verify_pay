import React, { useState } from 'react';
import { formatCents } from '@milestone/shared';

interface MilestoneSummaryItem {
  id: string;
  name: string;
  amountCents: number;
  paymentStatus: string;
}

interface CloseoutReceiptModalProps {
  projectId: string;
  projectTitle: string;
  clientName: string;
  freelancerName: string;
  totalBudget: number;
  paidTotal: number;
  heldTotal: number;
  milestones: MilestoneSummaryItem[];
  onClose: () => void;
}

export const CloseoutReceiptModal: React.FC<CloseoutReceiptModalProps> = ({
  projectId,
  projectTitle,
  clientName,
  freelancerName,
  totalBudget,
  paidTotal,
  heldTotal,
  milestones,
  onClose,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleDownloadAuditJson = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/audit`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch audit trail');
      const data = await res.json();

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `milestone-audit-${projectId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setExportError('Failed to export audit trail. Please check your connection and retry.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      id="closeout-receipt-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="closeout-receipt-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(22, 32, 43, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--paper)',
          borderRadius: '8px',
          border: '1px solid var(--line)',
          maxWidth: '680px',
          width: '100%',
          maxHeight: '90vh',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Receipt Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--line)',
            backgroundColor: 'var(--chalk)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <span
              style={{
                fontSize: '0.6875rem',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--slate)',
                fontWeight: 700,
              }}
            >
              Project Settlement Record
            </span>
            <h2
              id="closeout-receipt-title"
              style={{
                fontFamily: 'Bricolage Grotesque, sans-serif',
                fontSize: '1.25rem',
                margin: '0.25rem 0 0 0',
                color: 'var(--ink)',
              }}
            >
              Closeout Receipt
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close receipt"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.25rem',
              color: 'var(--slate)',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Receipt Body */}
        <div
          style={{
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            overflowY: 'auto',
          }}
        >
          {/* Metadata Block */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1rem',
              backgroundColor: 'var(--chalk)',
              padding: '1rem',
              borderRadius: '6px',
              border: '1px solid var(--line)',
            }}
          >
            <div>
              <span style={{ fontSize: '0.6875rem', textTransform: 'uppercase', color: 'var(--slate)', fontWeight: 600 }}>
                Project
              </span>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink)' }}>{projectTitle}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.6875rem', textTransform: 'uppercase', color: 'var(--slate)', fontWeight: 600 }}>
                Client Persona
              </span>
              <div style={{ fontSize: '0.875rem', color: 'var(--ink)' }}>{clientName}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.6875rem', textTransform: 'uppercase', color: 'var(--slate)', fontWeight: 600 }}>
                Freelancer Persona
              </span>
              <div style={{ fontSize: '0.875rem', color: 'var(--ink)' }}>{freelancerName}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.6875rem', textTransform: 'uppercase', color: 'var(--slate)', fontWeight: 600 }}>
                Settlement Status
              </span>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: paidTotal >= totalBudget ? 'var(--settled)' : 'var(--brass)' }}>
                {paidTotal >= totalBudget ? 'Fully Settled' : 'In Progress'}
              </div>
            </div>
          </div>

          {/* Milestones Settlement Table */}
          <div>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink)', margin: '0 0 0.5rem 0' }}>
              Milestones & Payments Breakdown
            </h3>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.8125rem',
                border: '1px solid var(--line)',
                borderRadius: '6px',
                overflow: 'hidden',
              }}
            >
              <thead>
                <tr style={{ backgroundColor: 'var(--chalk)', borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                  <th style={{ padding: '0.6rem 0.75rem', color: 'var(--slate)', fontWeight: 600 }}>Milestone</th>
                  <th style={{ padding: '0.6rem 0.75rem', color: 'var(--slate)', fontWeight: 600 }}>Amount</th>
                  <th style={{ padding: '0.6rem 0.75rem', color: 'var(--slate)', fontWeight: 600 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {milestones.map((m, idx) => (
                  <tr key={m.id || idx} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '0.6rem 0.75rem', color: 'var(--ink)' }}>{m.name}</td>
                    <td style={{ padding: '0.6rem 0.75rem', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {formatCents(m.amountCents)}
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>
                      <span className={`status-pill ${m.paymentStatus}`}>
                        {m.paymentStatus.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Totals */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.75rem 1rem',
              backgroundColor: 'rgba(29, 143, 90, 0.08)',
              border: '1px solid rgba(29, 143, 90, 0.25)',
              borderRadius: '6px',
            }}
          >
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--slate)' }}>Total Budget: </span>
              <strong style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>
                {formatCents(totalBudget)}
              </strong>
              <span style={{ margin: '0 0.5rem', color: 'var(--slate)' }}>·</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--slate)' }}>Held: </span>
              <strong style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--brass)' }}>
                {formatCents(heldTotal)}
              </strong>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--slate)' }}>Paid to Date: </span>
              <strong style={{ fontSize: '1.05rem', fontVariantNumeric: 'tabular-nums', color: 'var(--settled)' }}>
                {formatCents(paidTotal)}
              </strong>
            </div>
          </div>
        </div>

        {/* Receipt Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--line)',
            backgroundColor: 'var(--chalk)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <button
              id="download-audit-btn"
              type="button"
              onClick={handleDownloadAuditJson}
              disabled={isExporting}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'var(--paper)',
                color: 'var(--ink)',
                border: '1px solid var(--line)',
                borderRadius: '4px',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: isExporting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <span>📥</span>
              <span>{isExporting ? 'Exporting...' : 'Export Audit Trail (JSON)'}</span>
            </button>
            {exportError && (
              <span style={{ color: 'var(--red)', fontSize: '0.75rem' }}>{exportError}</span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: 'var(--tide)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

