import React, { useId } from 'react';

export interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (props: {
    id: string;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
    'aria-required'?: boolean;
  }) => React.ReactNode;
  style?: React.CSSProperties;
}

export const Field: React.FC<FieldProps> = ({
  label,
  hint,
  error,
  required,
  children,
  style,
}) => {
  const generatedId = useId();
  const inputId = `field-${generatedId}`;
  const hintId = hint ? `hint-${generatedId}` : undefined;
  const errorId = error ? `error-${generatedId}` : undefined;

  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', ...style }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: '0.875rem',
            fontWeight: 500,
            color: 'var(--ink)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          <span>{label}</span>
          {required && (
            <span style={{ color: 'var(--red)', fontSize: '0.875rem' }} aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      {children({
        id: inputId,
        'aria-describedby': describedBy,
        'aria-invalid': !!error,
        'aria-required': required,
      })}

      {hint && !error && (
        <span id={hintId} style={{ fontSize: '0.8125rem', color: 'var(--ink-2)' }}>
          {hint}
        </span>
      )}

      {error && (
        <span
          id={errorId}
          role="alert"
          style={{ fontSize: '0.8125rem', color: 'var(--red)', fontWeight: 500 }}
        >
          {error}
        </span>
      )}
    </div>
  );
};

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  isError?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ isError, style, ...props }, ref) => {
    return (
      <input
        ref={ref}
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '0.875rem',
          color: 'var(--ink)',
          backgroundColor: 'var(--surface)',
          border: `1px solid ${isError ? 'var(--red)' : 'var(--line)'}`,
          borderRadius: 'var(--radius-input)',
          padding: '0.5rem 0.75rem',
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box',
          transition: 'border-color var(--duration-fast) var(--ease-out)',
          ...style,
        }}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  isError?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ isError, style, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '0.875rem',
          color: 'var(--ink)',
          backgroundColor: 'var(--surface)',
          border: `1px solid ${isError ? 'var(--red)' : 'var(--line)'}`,
          borderRadius: 'var(--radius-input)',
          padding: '0.5rem 0.75rem',
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box',
          resize: 'vertical',
          minHeight: '80px',
          lineHeight: 1.5,
          transition: 'border-color var(--duration-fast) var(--ease-out)',
          ...style,
        }}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  isError?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ isError, style, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '0.875rem',
          color: 'var(--ink)',
          backgroundColor: 'var(--surface)',
          border: `1px solid ${isError ? 'var(--red)' : 'var(--line)'}`,
          borderRadius: 'var(--radius-input)',
          padding: '0.5rem 0.75rem',
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box',
          cursor: 'pointer',
          ...style,
        }}
        {...props}
      >
        {children}
      </select>
    );
  }
);

Select.displayName = 'Select';

