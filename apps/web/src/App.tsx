import React from 'react';
import { centsToDecimal } from '@milestone/shared';

export function App(): React.ReactElement {
  return (
    <div style={{ fontFamily: 'Instrument Sans, sans-serif', padding: '2rem' }}>
      <header>
        <h1 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', margin: 0 }}>Milestone</h1>
        <p style={{ color: '#5B6B7C' }}>
          Where the plan, the money, and the proof of work live on one Gantt chart.
        </p>
      </header>
      <main style={{ marginTop: '2rem' }}>
        <div
          style={{
            border: '1px solid #DDE3E9',
            borderRadius: '8px',
            padding: '1.5rem',
            background: '#FFFFFF',
            maxWidth: '600px',
          }}
        >
          <h2 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', marginTop: 0 }}>
            Foundation Active (M0)
          </h2>
          <p>
            Demo initial holding balance:{' '}
            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>${centsToDecimal(60000)}</strong>
          </p>
          <div
            style={{
              padding: '0.75rem',
              backgroundColor: '#F5F7F9',
              borderRadius: '4px',
              fontSize: '0.875rem',
            }}
          >
            System Status: <strong>Ready for M1 Bryntum Gantt Spike</strong>
          </div>
        </div>
      </main>
    </div>
  );
}

