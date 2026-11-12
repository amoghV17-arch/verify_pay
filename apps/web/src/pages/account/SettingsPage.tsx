import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  User,
  Shield,
  Bell,
  Wallet,
  Settings as SettingsIcon,
  CheckCircle2,
  AlertCircle,
  Download,
  Trash2,
  LogOut,
} from 'lucide-react';
import { Button } from '../../components/ui/Button.js';
import { ApiError, apiFetch } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.js';

type SectionKey = 'profile' | 'security' | 'notifications' | 'payouts' | 'account';

interface SessionRow {
  id: string;
  userAgentSummary?: string | null;
  lastSeenAt: string;
  createdAt: string;
  current: boolean;
}

interface SecurityEventRow {
  id: string;
  type: string;
  ipHash?: string | null;
  createdAt: string;
}

interface PrefsState {
  emailInviteAccepted: boolean;
  emailFunded: boolean;
  emailSubmitted: boolean;
  emailReviewed: boolean;
  emailReleasePending: boolean;
  emailChangesRequested: boolean;
  emailPaid: boolean;
}

const DEFAULT_PREFS: PrefsState = {
  emailInviteAccepted: true,
  emailFunded: true,
  emailSubmitted: true,
  emailReviewed: true,
  emailReleasePending: true,
  emailChangesRequested: true,
  emailPaid: true,
};

const AVATAR_SWATCHES = ['#337D70', '#202722', '#1F5E85', '#8E4A2E', '#5A4A78'];

export const SettingsPage: React.FC = () => {
  const { section } = useParams<{ section?: string }>();
  const navigate = useNavigate();
  const { user, config, refreshAuth, logout } = useAuth();

  const activeSection: SectionKey =
    section === 'security' ||
    section === 'notifications' ||
    section === 'payouts' ||
    section === 'account'
      ? section
      : 'profile';

  // Feedback state
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Profile form
  const [displayName, setDisplayName] = useState(user?.displayName || user?.name || '');
  const [company, setCompany] = useState(user?.company || '');
  const [avatarColor, setAvatarColor] = useState(user?.avatarColor || '#337D70');
  const [lastWorkspace, setLastWorkspace] = useState<'client' | 'freelancer'>(
    user?.lastWorkspace || 'client'
  );
  const [savingProfile, setSavingProfile] = useState(false);

  // Security state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [events, setEvents] = useState<SecurityEventRow[]>([]);
  const [hasPassword, setHasPassword] = useState(true);

  // Notifications state
  const [prefs, setPrefs] = useState<PrefsState>(DEFAULT_PREFS);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Payouts state
  const [payoutEmail, setPayoutEmail] = useState(user?.payoutPaypalEmail || '');
  const [savingPayout, setSavingPayout] = useState(false);

  // Delete state
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    setDisplayName(user?.displayName || user?.name || '');
    setCompany(user?.company || '');
    setAvatarColor(user?.avatarColor || '#337D70');
    setLastWorkspace(user?.lastWorkspace || 'client');
    setPayoutEmail(user?.payoutPaypalEmail || '');
  }, [user]);

  const loadSectionData = useCallback(async () => {
    setError(null);
    if (activeSection === 'security') {
      try {
        const [meData, sessData, evData] = await Promise.all([
          apiFetch<{ user: { hasPassword?: boolean } }>('/api/me'),
          apiFetch<{ sessions: SessionRow[] }>('/api/me/sessions'),
          apiFetch<{ events: SecurityEventRow[] }>('/api/me/security-events'),
        ]);
        setHasPassword(meData.user?.hasPassword !== false);
        setSessions(sessData.sessions || []);
        setEvents(evData.events || []);
      } catch (err: unknown) {
        setError(err instanceof ApiError ? err.message : 'Unable to load security details.');
      }
    } else if (activeSection === 'notifications') {
      try {
        const data = await apiFetch<{ prefs: PrefsState }>('/api/notifications/prefs');
        if (data.prefs) setPrefs(data.prefs);
      } catch {
        // Keep defaults
      }
    }
  }, [activeSection]);

  useEffect(() => {
    setNotice(null);
    void loadSectionData();
  }, [loadSectionData]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSavingProfile(true);
    try {
      await apiFetch('/api/me', {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: displayName.trim(),
          company: company.trim() || null,
          avatarColor,
          lastWorkspace,
        }),
      });
      await refreshAuth();
      setNotice('Profile saved.');
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Unable to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (newPassword.length < 10) {
      setError('New password must be at least 10 characters.');
      return;
    }
    setSavingPassword(true);
    try {
      await apiFetch('/api/me/password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: hasPassword ? currentPassword : '',
          newPassword,
        }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setHasPassword(true);
      setNotice('Password updated. Other active sessions were signed out.');
      void loadSectionData();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Unable to update password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleResendVerification = async () => {
    setError(null);
    setNotice(null);
    try {
      await apiFetch('/api/auth/resend-verification', { method: 'POST', body: JSON.stringify({}) });
      setNotice('Verification email sent.');
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Unable to resend verification email.');
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await apiFetch(`/api/me/sessions/${sessionId}`, { method: 'DELETE' });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setNotice('Session signed out.');
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Unable to revoke session.');
    }
  };

  const handleLogoutOthers = async () => {
    try {
      await apiFetch('/api/auth/logout-others', { method: 'POST', body: JSON.stringify({}) });
      setNotice('All other sessions signed out.');
      void loadSectionData();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign out other sessions.');
    }
  };

  const handleSavePrefs = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSavingPrefs(true);
    try {
      await apiFetch('/api/notifications/prefs', {
        method: 'PUT',
        body: JSON.stringify(prefs),
      });
      setNotice('Notification preferences updated.');
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Unable to update preferences.');
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleSavePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSavingPayout(true);
    try {
      await apiFetch('/api/me/payout', {
        method: 'PUT',
        body: JSON.stringify({ payoutPaypalEmail: payoutEmail.trim() }),
      });
      await refreshAuth();
      setNotice('PayPal Sandbox payout email updated.');
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Unable to update payout email.');
    } finally {
      setSavingPayout(false);
    }
  };

  const handleExportAccount = async () => {
    try {
      const data = await apiFetch<Record<string, unknown>>('/api/me/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `milestone-account-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setNotice('Account export downloaded.');
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Unable to export account data.');
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDeleting(true);
    try {
      await apiFetch('/api/me', {
        method: 'DELETE',
        body: JSON.stringify({ currentPassword: deletePassword }),
      });
      await logout();
      navigate('/', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Unable to delete account.');
      setDeleting(false);
    }
  };

  const navItems: Array<{ key: SectionKey; label: string; icon: React.ReactNode }> = [
    { key: 'profile', label: 'Profile', icon: <User size={16} /> },
    { key: 'security', label: 'Security & sessions', icon: <Shield size={16} /> },
    { key: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
    { key: 'payouts', label: 'PayPal payouts', icon: <Wallet size={16} /> },
    { key: 'account', label: 'Data & account', icon: <SettingsIcon size={16} /> },
  ];

  return (
    <div style={{ maxWidth: '1040px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 className="font-display" style={{ fontSize: '1.85rem', margin: '0 0 0.25rem 0' }}>
          Account settings
        </h1>
        <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: '0.92rem' }}>
          Manage your identity, password security, active devices, notifications, and PayPal Sandbox payout address.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.5rem',
          alignItems: 'start',
        }}
      >
        {/* Left Settings Nav */}
        <nav
          aria-label="Settings sections"
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: '12px',
            padding: '0.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            maxWidth: '280px',
          }}
        >
          {navItems.map((item) => {
            const active = activeSection === item.key;
            return (
              <Link
                key={item.key}
                to={`/settings/${item.key}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontSize: '0.88rem',
                  fontWeight: active ? 600 : 500,
                  backgroundColor: active ? 'var(--teal-soft)' : 'transparent',
                  color: active ? 'var(--ink)' : 'var(--ink-2)',
                }}
              >
                <span style={{ color: active ? 'var(--teal)' : 'var(--ink-2)', display: 'flex' }}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Panel */}
        <section
          style={{
            gridColumn: 'span 2',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: '14px',
            padding: '1.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          {notice && (
            <div className="ms-alert ms-alert-info" role="status" aria-live="polite">
              <CheckCircle2 size={16} style={{ color: 'var(--teal)', flexShrink: 0, marginTop: '2px' }} />
              <span>{notice}</span>
            </div>
          )}

          {error && (
            <div className="ms-alert ms-alert-danger" role="alert" aria-live="polite">
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{error}</span>
            </div>
          )}

          {activeSection === 'profile' && (
            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Profile</h2>

              <div className="ms-field">
                <label className="ms-label" htmlFor="set-email">
                  Email address
                </label>
                <input id="set-email" className="ms-input" type="email" disabled value={user?.email || ''} />
              </div>

              <div className="ms-field">
                <label className="ms-label" htmlFor="set-name">
                  Display name
                </label>
                <input
                  id="set-name"
                  className="ms-input"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>

              <div className="ms-field">
                <label className="ms-label" htmlFor="set-company">
                  Company or studio
                </label>
                <input
                  id="set-company"
                  className="ms-input"
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Optional"
                />
              </div>

              <div className="ms-field">
                <span className="ms-label">Avatar color</span>
                <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.2rem' }}>
                  {AVATAR_SWATCHES.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      aria-label={`Select avatar color ${swatch}`}
                      aria-pressed={avatarColor === swatch}
                      onClick={() => setAvatarColor(swatch)}
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '50%',
                        backgroundColor: swatch,
                        border: avatarColor === swatch ? '3px solid var(--ink)' : '2px solid transparent',
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="ms-field">
                <label className="ms-label" htmlFor="set-workspace">
                  Default workspace on sign in
                </label>
                <select
                  id="set-workspace"
                  className="ms-input"
                  value={lastWorkspace}
                  onChange={(e) => setLastWorkspace(e.target.value as 'client' | 'freelancer')}
                >
                  <option value="client">Client workspace (create & fund projects)</option>
                  <option value="freelancer">Freelancer workspace (deliver & collect payouts)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button type="submit" variant="primary" isLoading={savingProfile}>
                  Save profile
                </Button>
              </div>
            </form>
          )}

          {activeSection === 'security' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              <div>
                <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem' }}>Email verification</h2>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.92rem', color: 'var(--ink-2)' }}>
                    Status:{' '}
                    <strong style={{ color: user?.emailVerified ? 'var(--teal-ink)' : 'var(--warning)' }}>
                      {user?.emailVerified ? 'Verified' : 'Pending verification'}
                    </strong>
                  </span>
                  {!user?.emailVerified && config.emailVerification !== 'off' && (
                    <Button variant="secondary" size="sm" onClick={handleResendVerification}>
                      Resend verification email
                    </Button>
                  )}
                </div>
              </div>

              <form
                onSubmit={handleChangePassword}
                style={{
                  borderTop: '1px solid var(--line)',
                  paddingTop: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}
              >
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Change password</h3>
                {hasPassword && (
                  <div className="ms-field">
                    <label className="ms-label" htmlFor="sec-curr">
                      Current password
                    </label>
                    <input
                      id="sec-curr"
                      type="password"
                      required
                      autoComplete="current-password"
                      className="ms-input"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </div>
                )}
                <div className="ms-field">
                  <label className="ms-label" htmlFor="sec-new">
                    New password (minimum 10 characters)
                  </label>
                  <input
                    id="sec-new"
                    type="password"
                    required
                    minLength={10}
                    autoComplete="new-password"
                    className="ms-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button type="submit" variant="primary" isLoading={savingPassword}>
                    Update password
                  </Button>
                </div>
              </form>

              <div style={{ borderTop: '1px solid var(--line)', paddingTop: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Active sessions ({sessions.length})</h3>
                  {sessions.length > 1 && (
                    <Button variant="secondary" size="sm" leftIcon={<LogOut size={14} />} onClick={handleLogoutOthers}>
                      Sign out all other devices
                    </Button>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        padding: '0.75rem 0.9rem',
                        borderRadius: '8px',
                        border: '1px solid var(--line)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                          {s.userAgentSummary || 'Browser session'}{' '}
                          {s.current && (
                            <span style={{ color: 'var(--teal-ink)', fontSize: '0.78rem' }}>(Current)</span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--ink-2)' }}>
                          Last active: {new Date(s.lastSeenAt).toLocaleString()}
                        </div>
                      </div>
                      {!s.current && (
                        <Button variant="quiet" size="sm" onClick={() => void handleRevokeSession(s.id)}>
                          Sign out
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {events.length > 0 && (
                <div style={{ borderTop: '1px solid var(--line)', paddingTop: '1.25rem' }}>
                  <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.05rem' }}>Recent security events</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.84rem' }}>
                    {events.slice(0, 12).map((ev) => (
                      <div
                        key={ev.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                          padding: '0.45rem 0',
                          borderBottom: '1px solid var(--line)',
                        }}
                      >
                        <span style={{ fontWeight: 500 }}>{ev.type.replace(/_/g, ' ')}</span>
                        <span style={{ color: 'var(--ink-muted)' }}>
                          {new Date(ev.createdAt).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSection === 'notifications' && (
            <form onSubmit={handleSavePrefs} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Email notifications</h2>
              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--ink-2)' }}>
                In-app notifications always update live. Choose which events also send email updates.
              </p>

              {(
                [
                  ['emailInviteAccepted', 'Invite accepted by freelancer'],
                  ['emailFunded', 'Project funded in PayPal Sandbox'],
                  ['emailSubmitted', 'Deliverable submitted for AI review'],
                  ['emailReviewed', 'AI review finished'],
                  ['emailReleasePending', 'Assisted release window started'],
                  ['emailChangesRequested', 'Changes requested on a milestone'],
                  ['emailPaid', 'Milestone payout settled'],
                ] as Array<[keyof PrefsState, string]>
              ).map(([key, label]) => (
                <label
                  key={key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.7rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    checked={prefs[key]}
                    onChange={(e) => setPrefs((prev) => ({ ...prev, [key]: e.target.checked }))}
                    style={{ accentColor: 'var(--teal)', width: '17px', height: '17px' }}
                  />
                </label>
              ))}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <Button type="submit" variant="primary" isLoading={savingPrefs}>
                  Save notification preferences
                </Button>
              </div>
            </form>
          )}

          {activeSection === 'payouts' && (
            <form onSubmit={handleSavePayout} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>PayPal Sandbox payout email</h2>
              <div className="ms-alert ms-alert-warning">
                <span>
                  PayPal Sandbox only. Approved milestone payouts send funds to this Sandbox receiver address at release time. Updating is paused while any milestone is releasing.
                </span>
              </div>

              <div className="ms-field">
                <label className="ms-label" htmlFor="pay-email">
                  PayPal Sandbox email
                </label>
                <input
                  id="pay-email"
                  type="email"
                  required
                  className="ms-input"
                  value={payoutEmail}
                  onChange={(e) => setPayoutEmail(e.target.value)}
                  placeholder="sb-freelancer@personal.example.com"
                />
                {user?.payoutEmailChangedAt && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
                    Last updated {new Date(user.payoutEmailChangedAt).toLocaleString()}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button type="submit" variant="primary" isLoading={savingPayout}>
                  Save payout email
                </Button>
              </div>
            </form>
          )}

          {activeSection === 'account' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <h2 style={{ margin: '0 0 0.4rem 0', fontSize: '1.2rem' }}>Export your data</h2>
                <p style={{ margin: '0 0 0.85rem 0', fontSize: '0.88rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>
                  Download a JSON copy of your profile, notification preferences, projects you belong to, and security log.
                </p>
                <Button variant="secondary" leftIcon={<Download size={15} />} onClick={handleExportAccount}>
                  Download JSON export
                </Button>
              </div>

              <div style={{ borderTop: '1px solid var(--line)', paddingTop: '1.25rem' }}>
                <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.1rem', color: 'var(--danger)' }}>
                  Delete account
                </h3>
                <p style={{ margin: '0 0 0.9rem 0', fontSize: '0.88rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>
                  Removes your login credentials and anonymizes personal profile fields. Deletion is blocked while any active project holds sandbox funds or a payout release is pending. Historical financial ledger references remain anonymized for audit integrity.
                </p>

                {!confirmDeleteOpen ? (
                  <Button
                    variant="destructive"
                    leftIcon={<Trash2 size={15} />}
                    onClick={() => setConfirmDeleteOpen(true)}
                  >
                    Delete account…
                  </Button>
                ) : (
                  <form
                    onSubmit={handleDeleteAccount}
                    style={{
                      padding: '1rem',
                      borderRadius: '10px',
                      border: '1px solid #f0c2be',
                      backgroundColor: '#fdf2f1',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem',
                    }}
                  >
                    <div className="ms-field">
                      <label htmlFor="del-pw" className="ms-label">
                        Confirm with your current password
                      </label>
                      <input
                        id="del-pw"
                        type="password"
                        required
                        className="ms-input"
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
                      <Button type="button" variant="quiet" onClick={() => setConfirmDeleteOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" variant="destructive" isLoading={deleting}>
                        Permanently delete account
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

