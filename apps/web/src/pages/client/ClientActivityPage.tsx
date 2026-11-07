import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Activity,
  User,
  Bot,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState.js';

interface ActivityEvent {
  id: string;
  projectId: string;
  actor: string;
  type: string;
  description: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export const ClientActivityPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;

    async function fetchActivity() {
      try {
        setIsLoading(true);
        setError(null);

        const res = await fetch(`/api/projects/${id}/activity`, {
          headers: { 'X-Persona': 'client' },
        });

        if (!res.ok) {
          throw new Error('Failed to load activity events');
        }

        const data = await res.json();
        if (isMounted) {
          setActivities(data.activity || []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Error loading activity log');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchActivity();
    return () => {
      isMounted = false;
    };
  }, [id]);

  function getActorIcon(actor: string) {
    switch (actor.toLowerCase()) {
      case 'ai':
      case 'reviewer':
      case 'planner':
        return <Bot size={16} style={{ color: 'var(--teal-ink)' }} />;
      case 'freelancer':
        return <User size={16} style={{ color: 'var(--forest)' }} />;
      case 'paypal':
      case 'system':
        return <ShieldCheck size={16} style={{ color: 'var(--ink-2)' }} />;
      default:
        return <User size={16} style={{ color: 'var(--ink)' }} />;
    }
  }

  if (isLoading) {
    return (
      <div style={{ maxWidth: '840px', margin: '0 auto', padding: '2.5rem 1.5rem', width: '100%' }}>
        <div style={{ height: '240px', backgroundColor: 'var(--surface)', borderRadius: 'var(--radius-card)', animation: 'pulse 1.5s infinite' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: '840px', margin: '0 auto', padding: '2.5rem 1.5rem', width: '100%' }}>
        <div style={{ backgroundColor: 'var(--amber-wash)', border: '1px solid var(--amber)', borderRadius: 'var(--radius-card)', padding: '1.5rem' }}>
          <h3>Unable to load activity log</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: '840px',
        margin: '0 auto',
        padding: '2.5rem 1.5rem',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ marginBottom: '2rem' }}>
        <h1
          className="font-display"
          style={{
            fontSize: '2rem',
            fontWeight: 600,
            color: 'var(--ink)',
            margin: '0 0 0.25rem 0',
            letterSpacing: '-0.02em',
          }}
        >
          Activity Timeline
        </h1>
        <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--ink-2)' }}>
          Audit trail of project events, submissions, automated AI evaluations, and money movements.
        </p>
      </div>

      {activities.length > 0 ? (
        <div
          style={{
            position: 'relative',
            paddingLeft: '2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          }}
        >
          {/* Vertical connecting line */}
          <div
            style={{
              position: 'absolute',
              top: '1rem',
              bottom: '1rem',
              left: '11px',
              width: '2px',
              backgroundColor: 'var(--line)',
            }}
          />

          {activities.map((event) => {
            const isExpanded = expandedEventId === event.id;
            const hasMetadata = event.metadata && Object.keys(event.metadata).length > 0;

            return (
              <div
                key={event.id}
                style={{
                  position: 'relative',
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-card)',
                  padding: '1.25rem',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {/* Timeline node circle */}
                <div
                  style={{
                    position: 'absolute',
                    left: '-2.35rem',
                    top: '1.25rem',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--paper)',
                    border: '2px solid var(--forest)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxSizing: 'border-box',
                  }}
                >
                  {getActorIcon(event.actor)}
                </div>

                {/* Event Header */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '1rem',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color: 'var(--forest)',
                        }}
                      >
                        {event.actor}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>•</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>
                        {new Date(event.timestamp).toLocaleString([], {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>

                    <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--ink)', fontWeight: 500, lineHeight: 1.4 }}>
                      {event.description}
                    </p>
                  </div>

                  {hasMetadata && (
                    <button
                      type="button"
                      onClick={() => setExpandedEventId(isExpanded ? null : event.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--ink-2)',
                        cursor: 'pointer',
                        padding: '0.25rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.75rem',
                      }}
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  )}
                </div>

                {/* Expandable Metadata JSON */}
                {isExpanded && hasMetadata && (
                  <div
                    style={{
                      marginTop: '1rem',
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-btn)',
                      backgroundColor: 'var(--paper)',
                      border: '1px solid var(--line)',
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                      overflowX: 'auto',
                    }}
                  >
                    <pre style={{ margin: 0 }}>{JSON.stringify(event.metadata, null, 2)}</pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Activity size={40} style={{ color: 'var(--forest)' }} />}
          title="No activity recorded yet"
          description="Timeline events will be logged here as milestones are agreed, funded, delivered, and paid."
        />
      )}
    </div>
  );
};

