import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button.js';
import { apiFetch } from '../../lib/api.js';
import type { NotificationItem } from '../../components/notifications/NotificationsBell.js';

export const NotificationsPage: React.FC = () => {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ notifications: NotificationItem[] }>('/api/notifications?limit=50');
      setItems(Array.isArray(data.notifications) ? data.notifications : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = async (id: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, readAt: i.readAt || new Date().toISOString() } : i))
    );
    await apiFetch(`/api/notifications/${id}/read`, { method: 'POST', body: JSON.stringify({}) }).catch(() => {});
  };

  const markAllRead = async () => {
    setItems((prev) => prev.map((i) => ({ ...i, readAt: i.readAt || new Date().toISOString() })));
    await apiFetch('/api/notifications/read-all', { method: 'POST', body: JSON.stringify({}) }).catch(() => {});
  };

  const filtered = filter === 'unread' ? items.filter((i) => !i.readAt) : items;
  const unreadCount = items.filter((i) => !i.readAt).length;

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1 className="font-display" style={{ fontSize: '1.85rem', margin: '0 0 0.25rem 0' }}>
            Notifications
          </h1>
          <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: '0.92rem' }}>
            Updates for milestone funding, deliverable submissions, AI reviews, and sandbox payouts.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Button
            variant={filter === 'all' ? 'secondary' : 'quiet'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All ({items.length})
          </Button>
          <Button
            variant={filter === 'unread' ? 'secondary' : 'quiet'}
            size="sm"
            onClick={() => setFilter('unread')}
          >
            Unread ({unreadCount})
          </Button>
          {unreadCount > 0 && (
            <Button variant="primary" size="sm" leftIcon={<CheckCheck size={15} />} onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </div>
      </div>

      <div
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: '14px',
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--ink-2)' }}>
            Loading notifications…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--ink-2)' }}>
            <Bell size={28} style={{ color: 'var(--ink-muted)', marginBottom: '0.6rem' }} />
            <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: '0.25rem' }}>
              {filter === 'unread' ? 'You are all caught up' : 'No notifications yet'}
            </div>
            <div style={{ fontSize: '0.88rem' }}>
              Adjust email preferences anytime in{' '}
              <Link to="/settings/notifications" style={{ color: 'var(--teal-ink)', fontWeight: 600 }}>
                notification settings
              </Link>
              .
            </div>
          </div>
        ) : (
          filtered.map((item) => {
            const isUnread = !item.readAt;
            return (
              <div
                key={item.id}
                style={{
                  padding: '1rem 1.25rem',
                  borderBottom: '1px solid var(--line)',
                  backgroundColor: isUnread ? 'rgba(51, 125, 112, 0.04)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                    {isUnread && (
                      <span
                        aria-label="Unread"
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--teal)',
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <Link
                      to={item.payload?.linkUrl || '/client'}
                      onClick={() => {
                        if (isUnread) void markRead(item.id);
                      }}
                      style={{
                        color: 'var(--ink)',
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        textDecoration: 'none',
                      }}
                    >
                      {item.payload?.title || 'Project update'}
                    </Link>
                  </div>
                  {item.payload?.body && (
                    <p style={{ margin: '0 0 0.3rem 0', fontSize: '0.875rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>
                      {item.payload.body}
                    </p>
                  )}
                  <span style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                </div>

                {isUnread && (
                  <Button
                    variant="quiet"
                    size="sm"
                    leftIcon={<Check size={14} />}
                    onClick={() => void markRead(item.id)}
                  >
                    Mark read
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

