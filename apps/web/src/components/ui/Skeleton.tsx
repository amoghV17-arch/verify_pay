import React from 'react';

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  borderRadius = 'var(--radius-sm)',
  style,
}) => {
  return (
    <div
      aria-hidden="true"
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: 'var(--line)',
        opacity: 0.7,
        animation: 'pulse 1.5s ease-in-out infinite',
        ...style,
      }}
    />
  );
};

export interface AvatarProps {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
  roleBadge?: 'client' | 'freelancer';
  style?: React.CSSProperties;
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  src,
  size = 'md',
  roleBadge,
  style,
}) => {
  const pixelSizes: Record<'sm' | 'md' | 'lg', number> = {
    sm: 28,
    md: 36,
    lg: 48,
  };

  const px = pixelSizes[size];
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${px}px`,
        height: `${px}px`,
        borderRadius: 'var(--radius-full)',
        backgroundColor: 'var(--surface)',
        border: '1.5px solid var(--line)',
        color: 'var(--ink)',
        fontSize: size === 'sm' ? '0.75rem' : size === 'md' ? '0.875rem' : '1.125rem',
        fontWeight: 600,
        overflow: 'visible',
        boxSizing: 'border-box',
        ...style,
      }}
      title={name}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            objectFit: 'cover',
          }}
        />
      ) : (
        <span>{initials}</span>
      )}

      {roleBadge && (
        <span
          title={`Role: ${roleBadge}`}
          style={{
            position: 'absolute',
            bottom: '-2px',
            right: '-2px',
            width: size === 'sm' ? '10px' : '12px',
            height: size === 'sm' ? '10px' : '12px',
            borderRadius: '50%',
            backgroundColor: roleBadge === 'client' ? 'var(--forest)' : 'var(--teal)',
            border: '2px solid var(--surface)',
          }}
        />
      )}
    </div>
  );
};

