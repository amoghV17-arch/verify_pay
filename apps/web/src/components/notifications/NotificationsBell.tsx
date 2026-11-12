import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { apiFetch } from '../../lib/api.js';

export interface NotificationItem {
  id: string;
  type: string;
  projectId?: string | null;
  milestoneId?: string | null;
  payload: {
    title?: string;
    body?: string;
    linkUrl?: string;
  };
  readAt?: string | null;
  createdAt: string;
}

export const NotificationsBell: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await apiFetch<{
        notifications: NotificationItem[];
        unreadCount: number;
      }>('/api/notifications?limit=10');
      setItems(Array.isArray(data.notifications) ? data.notifications : []);
      setUnreadCount(typeof data.unreadCount === 'number' ? data.unreadCount : 0);
    } catch {
      // Ignore background notification load failure
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  // Real-time SSE stream for instant notification badge updates
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/notifications/events');
      es.addEventListener('notification.created', (ev: MessageEvent) => {
        try {
          const parsed = JSON.parse(ev.data) as NotificationItem;
          setItems((prev) => [parsed, ...prev.filter((i) => i.id !== parsed.id)].slice(0, 12));
          setUnreadCount((c) => c + 1);
        } catch {
          // Ignore malformed event
        }
      });
    } catch {
      // Ignore SSE errors
    }
    return () => {
      es?.close();
    };
  }, []);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const markRead = async (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, readAt: item.readAt || new Date().toISOString() } : item))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'POST', body: JSON.stringify({}) });
    } catch {
      void loadNotifications();
    }
  };

  const markAllRead = async () => {
    setItems((prev) => prev.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
    setUnreadCount(0);
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST', body: JSON.stringify({}) });
    } catch {
      void loadNotifications();
    }
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          position: 'relative',
          background: 'transparent',
          border: '1px solid var(--line)',
          borderRadius: '8px',
          width: '36px',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--ink-2)',
        }}
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '-5px',
              right: '-5px',
              minWidth: '18px',
              height: '18px',
              padding: '0 4px',
              borderRadius: '99px',
              backgroundColor: 'var(--teal)',
              color: '#ffffff',
              fontSize: '0.6875rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 0 2px var(--surface)',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Recent notifications"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: 'min(360px, calc(100vw - 2rem))',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 600,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '0.8rem 1rem',
              borderBottom: '1px solid var(--line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <strong style={{ fontSize: '0.9rem', color: 'var(--ink)' }}>Notifications</strong>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--teal-ink)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}
          </div>

          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {items.length === 0 ? (
              <div style={{ padding: '1.5rem 1rem', textAlign: 'center', color: 'var(--ink-2)', fontSize: '0.85rem' }}>
                No notifications yet. Activity on your milestones will appear here.
              </div>
            ) : (
              items.slice(0, 8).map((item) => {
                const isUnread = !item.readAt;
                return (
                  <div
                    key={item.id}
                    style={{
                      padding: '0.75rem 1rem',
                      borderBottom: '1px solid var(--line)',
                      backgroundColor: isUnread ? 'rgba(51, 125, 112, 0.05)' : 'transparent',
                      display: 'flex',
                      gap: '0.6rem',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link
                        to={item.payload?.linkUrl || '/notifications'}
                        onClick={() => {
                          if (isUnread) void markRead(item.id);
                          setOpen(false);
                        }}
                        style={{
                          textDecoration: 'none',
                          color: 'var(--ink)',
                          fontWeight: isUnread ? 600 : 500,
                          fontSize: '0.85rem',
                          display: 'block',
                          marginBottom: '0.2rem',
                        }}
                      >
                        {item.payload?.title || 'Project update'}
                      </Link>
                      {item.payload?.body && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--ink-2)', lineHeight: 1.4 }}>
                          {item.payload.body}
                        </div>
                      )}
                    </div>
                    {isUnread && (
                      <button
                        type="button"
                        aria-label="Mark as read"
                        onClick={() => void markRead(item.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--teal)',
                          cursor: 'pointer',
                          padding: '0.2rem',
                        }}
                      >
                        <Check size={14} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div
            style={{
              padding: '0.65rem 1rem',
              backgroundColor: 'var(--paper)',
              borderTop: '1px solid var(--line)',
              textAlign: 'center',
            }}
          >
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--teal-ink)', textDecoration: 'none' }}
            >
              Open notifications inbox &rarr;
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

