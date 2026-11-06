import React from 'react';
import { EmptyState } from '../components/ui/EmptyState.js';

export const NotFoundPage: React.FC = () => {
  return (
    <div
      style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
      }}
    >
      <EmptyState
        title="Page not found"
        description="The page you requested does not exist or may have moved."
        actionLabel="Return home"
        onAction={() => {
          window.location.href = '/';
        }}
      />
    </div>
  );
};
