import React, { useState } from 'react';
import { formatCents } from '@milestone/shared';
import { MilestoneGantt } from './components/Gantt.js';
import { MilestoneTaskModel } from './models/MilestoneTaskModel.js';
import { sampleTasks } from './data/sampleProject.js';

export function App(): React.ReactElement {
  const [selectedTask, setSelectedTask] = useState<MilestoneTaskModel | null>(null);
  const [persona, setPersona] = useState<'client' | 'freelancer'>('client');

  const handlePersonaChange = async (targetPersona: 'client' | 'freelancer') => {
    setPersona(targetPersona);
    try {
      await fetch('/api/auth/persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ persona: targetPersona }),
      });
    } catch {
      // offline dev fallback
    }
  };

  // Compute summary metrics from sample tasks
  const milestones = sampleTasks.filter((t) => t.milestone);
  const totalBudget = milestones.reduce((sum, m) => sum + (m.amountCents ?? 0), 0);
  const paidTotal = milestones
    .filter((m) => m.paymentStatus === 'paid')
    .reduce((sum, m) => sum + (m.amountCents ?? 0), 0);
  const heldTotal = milestones
    .filter((m) => m.paymentStatus === 'funded' || m.paymentStatus === 'in_review' || m.paymentStatus === 'approved')
    .reduce((sum, m) => sum + (m.amountCents ?? 0), 0);

  const activeMilestone =
    selectedTask?.isMilestone
      ? selectedTask
      : (milestones[0] as unknown as MilestoneTaskModel);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--chalk)', display: 'flex', flexDirection: 'column' }}>
      {/* Top Application Bar */}
      <header
        style={{
          backgroundColor: 'var(--paper)',
          borderBottom: '1px solid var(--line)',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                width: '24px',
                height: '24px',
                backgroundColor: 'var(--tide)',
                color: '#fff',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.875rem',
              }}
            >
              M
            </span>
            <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: '1.25rem', color: 'var(--ink)' }}>
              Milestone
            </span>
          </div>

          <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--line)' }} />

          <div>
            <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--ink)' }}>
              Brand-site Redesign & Launch
            </span>
            <span
              style={{
                marginLeft: '0.5rem',
                fontSize: '0.75rem',
                padding: '0.15rem 0.5rem',
                borderRadius: '999px',
                backgroundColor: 'rgba(31, 122, 140, 0.1)',
                color: 'var(--tide)',
                fontWeight: 600,
              }}
            >
              PayPal Sandbox Active
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          {/* Persona Switch (Viewing As) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              backgroundColor: 'var(--chalk)',
              padding: '0.25rem',
              borderRadius: '6px',
              border: '1px solid var(--line)',
              fontSize: '0.8125rem',
            }}
          >
            <span style={{ color: 'var(--slate)', padding: '0 0.35rem', fontWeight: 500 }}>Viewing as:</span>
            <button
              type="button"
              onClick={() => handlePersonaChange('client')}
              style={{
                padding: '0.25rem 0.6rem',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                backgroundColor: persona === 'client' ? 'var(--paper)' : 'transparent',
                color: persona === 'client' ? 'var(--ink)' : 'var(--slate)',
                boxShadow: persona === 'client' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              Client (Acme Corp)
            </button>
            <button
              type="button"
              onClick={() => handlePersonaChange('freelancer')}
              style={{
                padding: '0.25rem 0.6rem',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                backgroundColor: persona === 'freelancer' ? 'var(--paper)' : 'transparent',
                color: persona === 'freelancer' ? 'var(--ink)' : 'var(--slate)',
                boxShadow: persona === 'freelancer' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              Freelancer (Arjun)
            </button>
          </div>

          {/* Settle Target / Balance Chip */}
          <div
            id="balance-chip"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '999px',
              backgroundColor: 'rgba(29, 143, 90, 0.12)',
              border: '1px solid rgba(29, 143, 90, 0.3)',
              color: 'var(--settled)',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--settled)',
              }}
            />
            <span>Arjun Balance:</span>
            <strong style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'Instrument Sans, sans-serif' }}>
              {formatCents(paidTotal)}
            </strong>
          </div>
        </div>
      </header>

      {/* Funds Meter Sub-bar */}
      <section
        aria-label="Funds status meter"
        style={{
          backgroundColor: 'var(--paper)',
          borderBottom: '1px solid var(--line)',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', fontSize: '0.875rem' }}>
          <div>
            <span style={{ color: 'var(--slate)' }}>Total Budget: </span>
            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCents(totalBudget)}</strong>
          </div>
          <div style={{ width: '1px', height: '14px', backgroundColor: 'var(--line)' }} />
          <div>
            <span style={{ color: 'var(--settled)' }}>Paid: </span>
            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCents(paidTotal)}</strong>
          </div>
          <div style={{ width: '1px', height: '14px', backgroundColor: 'var(--line)' }} />
          <div>
            <span style={{ color: 'var(--tide)' }}>Committed / Held: </span>
            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCents(heldTotal)}</strong>
          </div>
        </div>

        {/* Horizontal Meter Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '320px', flex: '0 1 450px' }}>
          <div
            style={{
              flex: 1,
              height: '8px',
              backgroundColor: '#E2E8F0',
              borderRadius: '4px',
              overflow: 'hidden',
              display: 'flex',
            }}
          >
            <div
              style={{
                width: `${(paidTotal / totalBudget) * 100}%`,
                backgroundColor: 'var(--settled)',
              }}
              title={`Paid: ${formatCents(paidTotal)}`}
            />
            <div
              style={{
                width: `${(heldTotal / totalBudget) * 100}%`,
                backgroundColor: 'var(--tide)',
              }}
              title={`Committed: ${formatCents(heldTotal)}`}
            />
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--slate)', fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(((paidTotal + heldTotal) / totalBudget) * 100)}% Protected
          </span>
        </div>
      </section>

      {/* Main Workspace: Central Gantt + Side Trust Panel Preview */}
      <main
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 340px',
          gap: '1rem',
          padding: '1rem 1.5rem',
          boxSizing: 'border-box',
        }}
      >
        {/* Gantt Container */}
        <div style={{ minWidth: 0, height: '100%' }}>
          <MilestoneGantt projectId="proj_brand_launch" onTaskSelect={setSelectedTask} />
        </div>

        {/* Side Trust Panel Drawer Preview */}
        <aside
          aria-label="Milestone Trust Panel"
          style={{
            backgroundColor: 'var(--paper)',
            border: '1px solid var(--line)',
            borderRadius: '8px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            height: 'fit-content',
            boxShadow: '0 1px 3px rgba(22, 32, 43, 0.05)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--slate)', fontWeight: 600 }}>
                Trust Panel
              </span>
              <span
                className={`status-pill ${activeMilestone?.paymentStatus ?? 'paid'}`}
                style={{ fontSize: '0.75rem' }}
              >
                {activeMilestone?.paymentStatus?.replace(/_/g, ' ') ?? 'Paid'}
              </span>
            </div>
            <h3
              style={{
                fontFamily: 'Bricolage Grotesque, sans-serif',
                margin: '0.5rem 0 0 0',
                fontSize: '1.05rem',
                color: 'var(--ink)',
              }}
            >
              {activeMilestone?.name ?? 'Milestone 1: Brand Strategy'}
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: 'var(--slate)' }}>
              Amount attached:{' '}
              <strong style={{ color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                {formatCents(activeMilestone?.amountCents ?? 120000)}
              </strong>
            </p>
          </div>

          <div style={{ borderTop: '1px solid var(--line)', paddingTop: '0.75rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink)' }}>
              Acceptance Criteria
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {(activeMilestone?.acceptanceCriteria ?? [
                { id: '1', description: 'At least 5 customer interview summaries documented', passed: true },
                { id: '2', description: 'Positioning matrix compares 4 primary competitors', passed: true },
              ]).map((c) => (
                <li
                  key={c.id}
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--ink)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                  }}
                >
                  <span
                    style={{
                      color: c.passed ? 'var(--settled)' : 'var(--slate)',
                      fontWeight: 700,
                    }}
                  >
                    {c.passed ? '✓' : '○'}
                  </span>
                  <span>{c.description}</span>
                </li>
              ))}
            </ul>
          </div>

          <div style={{ borderTop: '1px solid var(--line)', paddingTop: '0.75rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink)' }}>
              Money & Sandbox Settlement
            </h4>
            <div
              style={{
                fontSize: '0.8125rem',
                backgroundColor: 'var(--chalk)',
                padding: '0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--line)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
              }}
            >
              <div>
                <span style={{ color: 'var(--slate)' }}>Deliverable Type: </span>
                <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                  {activeMilestone?.deliverableType ?? 'document'}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--slate)' }}>Ledger Invariant: </span>
                <span style={{ fontWeight: 600, color: 'var(--settled)' }}>Funded before start</span>
              </div>
              <div>
                <span style={{ color: 'var(--slate)' }}>PayPal Mode: </span>
                <span style={{ fontWeight: 600 }}>Sandbox / Mock Safe</span>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
