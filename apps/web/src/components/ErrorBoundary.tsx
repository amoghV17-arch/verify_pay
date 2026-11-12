import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from './ui/Button.js';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'An unexpected rendering error occurred.',
    };
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          backgroundColor: 'var(--paper)',
          color: 'var(--ink)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <div
          style={{
            maxWidth: '480px',
            width: '100%',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-card)',
            padding: '2rem',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.75rem' }}>
            <AlertTriangle size={22} color="var(--crimson)" />
            <h1 className="font-display" style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>
              Something went wrong
            </h1>
          </div>
          <p style={{ margin: '0 0 1rem', fontSize: '0.92rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>
            Milestone hit an unexpected interface error. Your saved project data is unaffected.
          </p>
          {this.state.errorMessage && (
            <div
              style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                backgroundColor: 'var(--paper)',
                border: '1px solid var(--line)',
                fontSize: '0.8rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--ink-2)',
                marginBottom: '1.25rem',
                wordBreak: 'break-word',
              }}
            >
              {this.state.errorMessage}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Button
              type="button"
              variant="primary"
              leftIcon={<RefreshCw size={16} />}
              onClick={() => window.location.reload()}
            >
              Reload page
            </Button>
            <Button
              type="button"
              variant="secondary"
              leftIcon={<Home size={16} />}
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                window.location.href = '/';
              }}
            >
              Go home
            </Button>
          </div>
        </div>
      </main>
    );
  }
}

