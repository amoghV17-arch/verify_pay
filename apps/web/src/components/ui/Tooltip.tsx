import React, { useState } from 'react';

export interface TooltipProps {
  content: string;
  children: React.ReactElement;
  position?: 'top' | 'bottom';
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top' }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            [position === 'top' ? 'bottom' : 'top']: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1100,
            backgroundColor: 'var(--forest)',
            color: 'var(--paper-on-dark)',
            fontSize: '0.75rem',
            padding: '0.25rem 0.55rem',
            borderRadius: 'var(--radius-sm)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            boxShadow: 'var(--shadow-md)',
            animation: 'fadeIn var(--duration-fast) var(--ease-out)',
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
};

export interface ToastProps {
  message: string;
  type?: 'info' | 'success' | 'error';
  onDismiss?: () => void;
  style?: React.CSSProperties;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  onDismiss,
  style,
}) => {
  const typeStyles: Record<string, React.CSSProperties> = {
    info: { backgroundColor: 'var(--forest)', color: 'var(--paper-on-dark)' },
    success: { backgroundColor: 'var(--teal-ink)', color: '#FFFFFF' },
    error: { backgroundColor: 'var(--red)', color: '#FFFFFF' },
  };

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        padding: '0.65rem 1rem',
        borderRadius: 'var(--radius-input)',
        fontSize: '0.875rem',
        fontWeight: 500,
        boxShadow: 'var(--shadow-lg)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.75rem',
        ...typeStyles[type],
        ...style,
      }}
    >
      <span>{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            padding: 0,
            fontSize: '1rem',
            lineHeight: 1,
          }}
          aria-label="Dismiss notification"
        >
          ×
        </button>
      )}
    </div>
  );
};

