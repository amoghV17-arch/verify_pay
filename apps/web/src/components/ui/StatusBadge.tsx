import React from 'react';
import { Circle, Disc, Clock, Flag, RotateCcw, Loader2, Check } from 'lucide-react';

export type MoneyState =
  | 'agreed'
  | 'funded'
  | 'in_review'
  | 'needs_decision'
  | 'changes_requested'
  | 'releasing'
  | 'paid';

export interface StatusBadgeProps {
  state: MoneyState;
  label?: string;
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  state,
  label,
  size = 'md',
  style,
}) => {
  // Configuration per Section 3.1
  const config: Record<
    MoneyState,
    {
      defaultLabel: string;
      icon: React.ReactNode;
      containerStyle: React.CSSProperties;
      textColor: string;
    }
  > = {
    agreed: {
      defaultLabel: 'Agreed, unfunded',
      icon: <Circle size={size === 'sm' ? 12 : 14} strokeWidth={1.75} />,
      containerStyle: {
        backgroundColor: 'transparent',
        border: '1px dashed var(--line)',
        color: 'var(--ink-2)',
      },
      textColor: 'var(--ink-2)',
    },
    funded: {
      defaultLabel: 'Funded (held)',
      icon: <Disc size={size === 'sm' ? 12 : 14} strokeWidth={2} />,
      containerStyle: {
        backgroundColor: 'var(--teal-wash)',
        border: '1px solid var(--teal)',
        color: 'var(--teal-ink)',
      },
      textColor: 'var(--teal-ink)',
    },
    in_review: {
      defaultLabel: 'Submitted, in review',
      icon: <Clock size={size === 'sm' ? 12 : 14} strokeWidth={1.75} />,
      containerStyle: {
        backgroundColor: 'var(--amber-wash)',
        border: '1px solid var(--amber)',
        color: 'var(--amber-ink)',
      },
      textColor: 'var(--amber-ink)',
    },
    needs_decision: {
      defaultLabel: 'Needs decision',
      icon: <Flag size={size === 'sm' ? 12 : 14} strokeWidth={2} />,
      containerStyle: {
        backgroundColor: 'var(--amber-wash)',
        border: '1.5px solid var(--amber-ink)',
        color: 'var(--amber-ink)',
      },
      textColor: 'var(--amber-ink)',
    },
    changes_requested: {
      defaultLabel: 'Changes requested',
      icon: <RotateCcw size={size === 'sm' ? 12 : 14} strokeWidth={2} />,
      containerStyle: {
        backgroundColor: 'var(--red-wash)',
        border: '1px solid var(--red)',
        color: 'var(--red)',
      },
      textColor: 'var(--red)',
    },
    releasing: {
      defaultLabel: 'Releasing payout',
      icon: (
        <Loader2
          size={size === 'sm' ? 12 : 14}
          strokeWidth={2}
          style={{ animation: 'spin 1s linear infinite' }}
        />
      ),
      containerStyle: {
        backgroundColor: 'var(--amber-wash)',
        border: '1px solid var(--amber)',
        color: 'var(--amber-ink)',
      },
      textColor: 'var(--amber-ink)',
    },
    paid: {
      defaultLabel: 'Paid',
      icon: <Check size={size === 'sm' ? 12 : 14} strokeWidth={2.5} />,
      containerStyle: {
        backgroundColor: 'var(--teal)',
        border: '1px solid var(--teal)',
        color: '#FFFFFF',
      },
      textColor: '#FFFFFF',
    },
  };

  const item = config[state] || config.agreed;
  const displayLabel = label || item.defaultLabel;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: size === 'sm' ? '0.15rem 0.45rem' : '0.25rem 0.6rem',
        borderRadius: 'var(--radius-chip)',
        fontSize: size === 'sm' ? '0.75rem' : '0.8125rem',
        fontWeight: 500,
        lineHeight: 1.2,
        fontFamily: 'var(--font-ui)',
        whiteSpace: 'nowrap',
        boxSizing: 'border-box',
        ...item.containerStyle,
        ...style,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center' }} aria-hidden="true">
        {item.icon}
      </span>
      <span style={{ color: item.textColor }}>{displayLabel}</span>
    </span>
  );
};

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'neutral' | 'teal' | 'amber' | 'red';
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  style,
}) => {
  const variantStyles: Record<string, React.CSSProperties> = {
    neutral: {
      backgroundColor: 'var(--surface)',
      border: '1px solid var(--line)',
      color: 'var(--ink-2)',
    },
    teal: {
      backgroundColor: 'var(--teal-wash)',
      border: '1px solid var(--teal)',
      color: 'var(--teal-ink)',
    },
    amber: {
      backgroundColor: 'var(--amber-wash)',
      border: '1px solid var(--amber)',
      color: 'var(--amber-ink)',
    },
    red: {
      backgroundColor: 'var(--red-wash)',
      border: '1px solid var(--red)',
      color: 'var(--red)',
    },
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: size === 'sm' ? '0.15rem 0.45rem' : '0.25rem 0.55rem',
        borderRadius: 'var(--radius-chip)',
        fontSize: size === 'sm' ? '0.75rem' : '0.8125rem',
        fontWeight: 500,
        lineHeight: 1.2,
        fontFamily: 'var(--font-ui)',
        ...variantStyles[variant],
        ...style,
      }}
    >
      {children}
    </span>
  );
};

