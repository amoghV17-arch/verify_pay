import React from 'react';
import { formatCents } from '@milestone/shared';

export interface FinancialFigureProps {
  label: string;
  amountCents: number;
  currency?: string;
  subtext?: string;
  size?: 'sm' | 'md' | 'lg';
  trend?: 'neutral' | 'held' | 'paid';
  style?: React.CSSProperties;
}

export const FinancialFigure: React.FC<FinancialFigureProps> = ({
  label,
  amountCents,
  subtext,
  size = 'md',
  trend = 'neutral',
  style,
}) => {
  const fontSizes: Record<'sm' | 'md' | 'lg', { figure: string; label: string }> = {
    sm: { figure: '1.25rem', label: '0.75rem' },
    md: { figure: '1.75rem', label: '0.8125rem' },
    lg: { figure: '2.5rem', label: '0.875rem' },
  };

  const trendColors: Record<'neutral' | 'held' | 'paid', string> = {
    neutral: 'var(--ink)',
    held: 'var(--teal-ink)',
    paid: 'var(--teal)',
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.2rem',
        ...style,
      }}
    >
      <span
        style={{
          fontSize: fontSizes[size].label,
          fontWeight: 500,
          color: 'var(--ink-2)',
          textTransform: 'none',
        }}
      >
        {label}
      </span>
      <span
        className="tabular-nums"
        style={{
          fontSize: fontSizes[size].figure,
          fontWeight: 600,
          color: trendColors[trend],
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
        }}
      >
        {formatCents(amountCents)}
      </span>
      {subtext && (
        <span style={{ fontSize: '0.75rem', color: 'var(--ink-2)', marginTop: '0.15rem' }}>
          {subtext}
        </span>
      )}
    </div>
  );
};

