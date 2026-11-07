import React from 'react';
import { Skeleton } from '../ui/Skeleton.js';

export const ScheduleSkeleton: React.FC = () => {
  return (
    <div
      data-testid="schedule-skeleton"
      style={{
        padding: '1.5rem',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton width="280px" height="2rem" />
        <Skeleton width="360px" height="2rem" />
      </div>
      <Skeleton width="100%" height="calc(100vh - 180px)" borderRadius="8px" />
    </div>
  );
};

