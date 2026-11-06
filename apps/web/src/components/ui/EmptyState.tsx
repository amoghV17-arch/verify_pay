import React from 'react';
import { Button } from './Button.js';

export interface EmptyStateProps {
  title?: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  style?: React.CSSProperties;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  style,
}) => {
  return (
    <div
      style={{
        padding: '3rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        backgroundColor: 'var(--surface)',
        border: '1px dashed var(--line)',
        borderRadius: 'var(--radius-card)',
        gap: '1rem',
        maxWidth: '540px',
        margin: '0 auto',
        ...style,
      }}
    >
      {icon && (
        <div
          style={{
            color: 'var(--ink-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {title && (
          <h3
            className="font-display"
            style={{
              fontSize: '1.5rem',
              color: 'var(--ink)',
              margin: 0,
            }}
          >
            {title}
          </h3>
        )}
        <p
          style={{
            fontSize: '0.9375rem',
            color: 'var(--ink-2)',
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      </div>

      {actionLabel && onAction && (
        <Button variant="primary" size="md" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

