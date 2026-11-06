import React from 'react';
import { Link2, GitBranch, FileText, Image as ImageIcon, Layers } from 'lucide-react';

export type DeliverableType = 'url' | 'repo' | 'document' | 'image' | 'figma' | 'text';

export interface EvidenceChipProps {
  type: DeliverableType;
  label?: string;
  url?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export const EvidenceChip: React.FC<EvidenceChipProps> = ({
  type,
  label,
  url,
  onClick,
  style,
}) => {
  const icons: Record<DeliverableType, React.ReactNode> = {
    url: <Link2 size={13} />,
    repo: <GitBranch size={13} />,
    document: <FileText size={13} />,
    image: <ImageIcon size={13} />,
    figma: <Layers size={13} />,
    text: <FileText size={13} />,
  };

  const defaultLabels: Record<DeliverableType, string> = {
    url: 'Live Preview',
    repo: 'Git Repo',
    document: 'Document',
    image: 'Visual Asset',
    figma: 'Figma File',
    text: 'Written Proof',
  };

  const text = label || defaultLabels[type] || 'Evidence';

  const content = (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.2rem 0.55rem',
        borderRadius: 'var(--radius-chip)',
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--line)',
        fontSize: '0.75rem',
        fontWeight: 500,
        color: 'var(--teal-ink)',
        textDecoration: 'none',
        cursor: url || onClick ? 'pointer' : 'default',
        transition: 'border-color var(--duration-fast) var(--ease-out)',
        ...style,
      }}
    >
      <span aria-hidden="true" style={{ display: 'inline-flex' }}>
        {icons[type]}
      </span>
      <span>{text}</span>
    </span>
  );

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: 'none' }}
      >
        {content}
      </a>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{ background: 'none', border: 'none', padding: 0 }}
      >
        {content}
      </button>
    );
  }

  return content;
};

export interface TimelineEvent {
  id: string;
  actor: 'client' | 'freelancer' | 'ai' | 'system';
  title: string;
  description?: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

export interface TimelineProps {
  events: TimelineEvent[];
  style?: React.CSSProperties;
}

export const Timeline: React.FC<TimelineProps> = ({ events, style }) => {
  const actorBadges: Record<'client' | 'freelancer' | 'ai' | 'system', { label: string; color: string }> = {
    client: { label: 'Client', color: 'var(--forest)' },
    freelancer: { label: 'Freelancer', color: 'var(--teal-ink)' },
    ai: { label: 'AI Reviewer', color: 'var(--teal-ink)' },
    system: { label: 'System', color: 'var(--ink-2)' },
  };

  return (
    <ol
      style={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        ...style,
      }}
    >
      {events.map((evt, idx) => {
        const actor = actorBadges[evt.actor] || actorBadges.system;
        const isLast = idx === events.length - 1;

        return (
          <li
            key={evt.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '1rem',
              position: 'relative',
            }}
          >
            {/* Vertical connector line */}
            {!isLast && (
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: '20px',
                  left: '11px',
                  bottom: '-20px',
                  width: '2px',
                  backgroundColor: 'var(--line)',
                }}
              />
            )}

            {/* Event dot */}
            <div
              aria-hidden="true"
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: 'var(--surface)',
                border: '2px solid var(--forest)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: actor.color,
                }}
              />
            </div>

            {/* Event Details */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink)' }}>
                  {evt.title}
                </span>
                <time
                  dateTime={evt.timestamp}
                  style={{ fontSize: '0.75rem', color: 'var(--ink-2)' }}
                >
                  {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </time>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.1rem' }}>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    color: actor.color,
                  }}
                >
                  {actor.label}
                </span>
                {evt.description && (
                  <span style={{ fontSize: '0.8125rem', color: 'var(--ink-2)' }}>
                    • {evt.description}
                  </span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
};
