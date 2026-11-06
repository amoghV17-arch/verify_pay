import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'secondary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      style,
      className,
      ...props
    },
    ref
  ) => {
    // Variant styles
    const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
      primary: {
        backgroundColor: 'var(--forest)',
        color: 'var(--paper-on-dark)',
        border: '1px solid var(--forest)',
      },
      secondary: {
        backgroundColor: 'var(--surface)',
        color: 'var(--ink)',
        border: '1px solid var(--line)',
      },
      quiet: {
        backgroundColor: 'transparent',
        color: 'var(--ink-2)',
        border: '1px solid transparent',
      },
      destructive: {
        backgroundColor: 'var(--surface)',
        color: 'var(--red)',
        border: '1px solid var(--red)',
      },
    };

    // Size styles
    const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
      sm: {
        padding: '0.35rem 0.65rem',
        fontSize: '0.8125rem',
        borderRadius: 'var(--radius-btn)',
        height: '32px',
      },
      md: {
        padding: '0.5rem 1rem',
        fontSize: '0.875rem',
        borderRadius: 'var(--radius-btn)',
        height: '40px',
      },
      lg: {
        padding: '0.75rem 1.5rem',
        fontSize: '1rem',
        borderRadius: 'var(--radius-btn)',
        height: '48px',
      },
    };

    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        style={{
          fontFamily: 'var(--font-ui)',
          fontWeight: 500,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          opacity: isDisabled ? 0.6 : 1,
          transition: 'all var(--duration-fast) var(--ease-out)',
          outline: 'none',
          whiteSpace: 'nowrap',
          textDecoration: 'none',
          boxSizing: 'border-box',
          ...variantStyles[variant],
          ...sizeStyles[size],
          ...style,
        }}
        className={className}
        {...props}
      >
        {isLoading && (
          <span
            aria-hidden="true"
            style={{
              width: '1em',
              height: '1em',
              border: '2px solid currentColor',
              borderRightColor: 'transparent',
              borderRadius: '50%',
              display: 'inline-block',
              animation: 'spin 0.75s linear infinite',
            }}
          />
        )}
        {!isLoading && leftIcon && <span style={{ display: 'inline-flex' }}>{leftIcon}</span>}
        <span>{children}</span>
        {!isLoading && rightIcon && <span style={{ display: 'inline-flex' }}>{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, label, variant = 'quiet', size = 'md', style, ...props }, ref) => {
    const squareSizes: Record<ButtonSize, number> = {
      sm: 32,
      md: 40,
      lg: 48,
    };

    const px = squareSizes[size];

    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        aria-label={label}
        title={label}
        style={{
          width: `${px}px`,
          height: `${px}px`,
          padding: 0,
          borderRadius: size === 'sm' ? 'var(--radius-btn)' : 'var(--radius-btn)',
          ...style,
        }}
        {...props}
      >
        {icon}
      </Button>
    );
  }
);

IconButton.displayName = 'IconButton';

