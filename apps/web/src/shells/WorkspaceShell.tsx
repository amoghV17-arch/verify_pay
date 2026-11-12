import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  FolderKanban,
  LayoutDashboard,
  Calendar,
  PackageCheck,
  CreditCard,
  Activity,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  Settings,
  Bell,
  LogOut,
  Mail,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react';
import { DemoBar } from '../components/ui/DemoBar.js';
import { NotificationsBell } from '../components/notifications/NotificationsBell.js';
import { ApiError, apiFetch, apiRawFetch } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';

export interface WorkspaceShellProps {
  mode?: 'client' | 'freelancer' | 'account';
  children?: React.ReactNode;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'MS';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export const WorkspaceShell: React.FC<WorkspaceShellProps> = ({ mode = 'client', children }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [projectTitle, setProjectTitle] = useState<string>('');
  const [resendingVerify, setResendingVerify] = useState(false);
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const { id: routeProjectId } = useParams<{ id: string }>();
  const { user, stats, config, logout, switchWorkspace } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);

  const effectiveRole: 'client' | 'freelancer' =
    mode === 'account'
      ? location.pathname.startsWith('/freelancer')
        ? 'freelancer'
        : user?.lastWorkspace || 'client'
      : mode;

  const currentProjectId = routeProjectId || '';

  useEffect(() => {
    setMobileMenuOpen(false);
    setAccountMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!currentProjectId) {
      setProjectTitle('');
      return;
    }
    apiRawFetch(`/api/projects/${currentProjectId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.project?.title) {
          setProjectTitle(data.project.title);
        }
      })
      .catch(() => {});
  }, [currentProjectId]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAccountMenuOpen(false);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const navItems = useMemo(() => {
    if (effectiveRole === 'freelancer') {
      return [
        {
          label: 'Projects',
          path: '/freelancer',
          exact: true,
          icon: <FolderKanban size={18} />,
        },
        ...(currentProjectId
          ? [
              {
                label: 'Overview',
                path: `/freelancer/projects/${currentProjectId}`,
                exact: true,
                icon: <LayoutDashboard size={18} />,
              },
              {
                label: 'Deliverables',
                path: `/freelancer/projects/${currentProjectId}/deliverables`,
                icon: <PackageCheck size={18} />,
              },
              {
                label: 'Schedule',
                path: `/freelancer/projects/${currentProjectId}/schedule`,
                icon: <Calendar size={18} />,
              },
              {
                label: 'Payouts',
                path: `/freelancer/projects/${currentProjectId}/payments`,
                icon: <CreditCard size={18} />,
              },
            ]
          : []),
      ];
    }

    return [
      {
        label: 'Projects',
        path: '/client',
        exact: true,
        icon: <FolderKanban size={18} />,
      },
      ...(currentProjectId
        ? [
            {
              label: 'Overview',
              path: `/client/projects/${currentProjectId}`,
              exact: true,
              icon: <LayoutDashboard size={18} />,
            },
            {
              label: 'Schedule',
              path: `/client/projects/${currentProjectId}/schedule`,
              icon: <Calendar size={18} />,
            },
            {
              label: 'Deliverables',
              path: `/client/projects/${currentProjectId}/deliverables`,
              icon: <PackageCheck size={18} />,
            },
            {
              label: 'Payments',
              path: `/client/projects/${currentProjectId}/payments`,
              icon: <CreditCard size={18} />,
            },
            {
              label: 'Activity',
              path: `/client/projects/${currentProjectId}/activity`,
              icon: <Activity size={18} />,
            },
          ]
        : []),
    ];
  }, [effectiveRole, currentProjectId]);

  const isNavItemActive = (item: { path: string; exact?: boolean; label?: string }) => {
    if (item.exact) {
      return (
        location.pathname === item.path ||
        (currentProjectId &&
          item.label === 'Overview' &&
          location.pathname === `/${effectiveRole}/projects/${currentProjectId}/overview`)
      );
    }
    return location.pathname.startsWith(item.path);
  };

  // Real breadcrumbs (never fallback to "Projects / Workspace")
  const breadcrumbs = useMemo(() => {
    const items: Array<{ label: string; to?: string }> = [];
    if (location.pathname.startsWith('/settings')) {
      items.push({ label: 'Account', to: '/settings/profile' });
      items.push({ label: 'Settings' });
      return items;
    }
    if (location.pathname.startsWith('/notifications')) {
      items.push({ label: 'Account', to: '/settings/profile' });
      items.push({ label: 'Notifications' });
      return items;
    }
    if (location.pathname.startsWith('/onboarding')) {
      items.push({ label: 'Onboarding' });
      return items;
    }
    if (location.pathname.startsWith('/demo/mailbox')) {
      items.push({ label: 'Demo', to: '/demo' });
      items.push({ label: 'Virtual mailbox' });
      return items;
    }

    items.push({
      label: effectiveRole === 'freelancer' ? 'Freelancer' : 'Client',
      to: effectiveRole === 'freelancer' ? '/freelancer' : '/client',
    });

    if (location.pathname === '/client/new') {
      items.push({ label: 'New project' });
    } else if (currentProjectId) {
      items.push({
        label: projectTitle || 'Project',
        to: `/${effectiveRole}/projects/${currentProjectId}`,
      });
      const seg = location.pathname.split('/').pop();
      if (seg && seg !== currentProjectId && seg !== 'overview') {
        const pretty: Record<string, string> = {
          schedule: 'Schedule',
          deliverables: 'Deliverables',
          payments: effectiveRole === 'freelancer' ? 'Payouts' : 'Payments',
          activity: 'Activity',
          proof: 'Proof',
        };
        items.push({ label: pretty[seg] || seg });
      }
    }
    return items;
  }, [location.pathname, effectiveRole, currentProjectId, projectTitle]);

  const handleWorkspaceSwitch = async (target: 'client' | 'freelancer') => {
    await switchWorkspace(target);
    navigate(target === 'freelancer' ? '/freelancer' : '/client');
  };

  const handleResendVerification = async () => {
    setResendingVerify(true);
    setVerifyNotice(null);
    try {
      await apiFetch('/api/auth/resend-verification', { method: 'POST', body: JSON.stringify({}) });
      setVerifyNotice('Verification email sent. Check your inbox.');
    } catch (err: unknown) {
      setVerifyNotice(err instanceof ApiError ? err.message : 'Unable to send verification email.');
    } finally {
      setResendingVerify(false);
    }
  };

  const displayName = user?.displayName || user?.name || 'Milestone User';
  const avatarColor = user?.avatarColor || '#337D70';

  const sidebarContent = (
    <>
      {/* Brand Row */}
      <div
        style={{
          padding: isSidebarCollapsed ? '1.1rem 0.75rem' : '1.1rem 1.2rem',
          borderBottom: '1px solid rgba(245, 242, 234, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isSidebarCollapsed ? 'center' : 'space-between',
          gap: '0.5rem',
        }}
      >
        <Link
          to="/"
          style={{
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            color: 'var(--paper)',
          }}
        >
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '6px',
              backgroundColor: 'var(--teal)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            aria-hidden="true"
          >
            <div
              style={{
                width: '10px',
                height: '10px',
                backgroundColor: '#ffffff',
                transform: 'rotate(45deg)',
              }}
            />
          </div>
          {!isSidebarCollapsed && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
                Milestone
              </span>
              <span
                style={{
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: '99px',
                  backgroundColor: 'rgba(124, 196, 180, 0.18)',
                  color: '#9ee0d1',
                }}
              >
                Sandbox
              </span>
            </span>
          )}
        </Link>

        {!isSidebarCollapsed && (
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(true)}
            aria-label="Collapse sidebar"
            className="hide-on-mobile"
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(245, 242, 234, 0.65)',
              cursor: 'pointer',
              padding: '0.25rem',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>

      {/* Workspace Switcher Pill */}
      {!isSidebarCollapsed && (
        <div style={{ padding: '0.9rem 0.9rem 0.35rem 0.9rem' }}>
          <div
            role="group"
            aria-label="Switch workspace"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.25rem',
              padding: '0.22rem',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
            }}
          >
            {(
              [
                ['client', `Client (${stats.clientCount})`],
                ['freelancer', `Freelancer (${stats.freelancerCount})`],
              ] as const
            ).map(([roleKey, label]) => {
              const active = effectiveRole === roleKey && mode !== 'account';
              return (
                <button
                  key={roleKey}
                  type="button"
                  onClick={() => void handleWorkspaceSwitch(roleKey)}
                  style={{
                    padding: '0.4rem 0.35rem',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: active ? 600 : 500,
                    backgroundColor: active ? 'var(--teal)' : 'transparent',
                    color: active ? '#ffffff' : 'rgba(245, 242, 234, 0.78)',
                    fontFamily: 'var(--font-ui)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Primary Sidebar Navigation */}
      <nav
        aria-label="Workspace navigation"
        style={{
          flex: 1,
          padding: '0.85rem 0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
        }}
      >
        {isSidebarCollapsed && (
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(false)}
            aria-label="Expand sidebar"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: 'none',
              borderRadius: '8px',
              color: 'var(--paper)',
              padding: '0.6rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '0.5rem',
            }}
          >
            <PanelLeftOpen size={16} />
          </button>
        )}

        {navItems.map((item) => {
          const active = isNavItemActive(item);
          return (
            <Link
              key={item.path}
              to={item.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                gap: '0.75rem',
                padding: '0.62rem 0.85rem',
                borderRadius: '8px',
                textDecoration: 'none',
                color: active ? 'var(--paper)' : 'rgba(245, 242, 234, 0.75)',
                backgroundColor: active ? 'rgba(51, 125, 112, 0.25)' : 'transparent',
                border: active ? '1px solid rgba(51, 125, 112, 0.45)' : '1px solid transparent',
                fontSize: '0.875rem',
                fontWeight: active ? 600 : 500,
              }}
              title={isSidebarCollapsed ? item.label : undefined}
            >
              <span style={{ color: active ? '#8fd3c3' : 'inherit', display: 'flex' }}>{item.icon}</span>
              {!isSidebarCollapsed && <span>{item.label}</span>}
            </Link>
          );
        })}

        {!isSidebarCollapsed && (
          <div style={{ marginTop: '0.85rem' }}>
            {effectiveRole === 'client' ? (
              <Link
                to="/client/new"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  padding: '0.65rem 0.9rem',
                  borderRadius: '8px',
                  backgroundColor: 'var(--teal)',
                  color: '#ffffff',
                  textDecoration: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              >
                <Plus size={16} />
                <span>New project</span>
              </Link>
            ) : (
              <Link
                to="/join"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  padding: '0.65rem 0.9rem',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: 'var(--paper)',
                  textDecoration: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              >
                <span>Join via invite</span>
              </Link>
            )}
          </div>
        )}
      </nav>

      {/* Bottom Account Shortcuts */}
      <div
        style={{
          padding: '0.75rem',
          borderTop: '1px solid rgba(245, 242, 234, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
        }}
      >
        <Link
          to="/settings/profile"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
            gap: '0.65rem',
            padding: '0.55rem 0.75rem',
            borderRadius: '8px',
            textDecoration: 'none',
            color: location.pathname.startsWith('/settings')
              ? '#ffffff'
              : 'rgba(245, 242, 234, 0.75)',
            backgroundColor: location.pathname.startsWith('/settings')
              ? 'rgba(255, 255, 255, 0.1)'
              : 'transparent',
            fontSize: '0.84rem',
          }}
        >
          <Settings size={16} />
          {!isSidebarCollapsed && <span>Account settings</span>}
        </Link>
      </div>
    </>
  );

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: 'var(--paper)',
        color: 'var(--ink)',
      }}
    >
      {/* Desktop Forest Sidebar */}
      <aside
        className="hide-on-mobile"
        style={{
          width: isSidebarCollapsed ? '68px' : '248px',
          backgroundColor: 'var(--forest)',
          color: 'var(--paper)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width var(--duration-base) var(--ease-out)',
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
          zIndex: 400,
        }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mobile workspace menu"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 800,
            display: 'flex',
          }}
        >
          <div
            onClick={() => setMobileMenuOpen(false)}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)' }}
          />
          <aside
            style={{
              position: 'relative',
              width: '270px',
              maxWidth: '85vw',
              backgroundColor: 'var(--forest)',
              color: 'var(--paper)',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              zIndex: 810,
            }}
          >
            <button
              type="button"
              aria-label="Close navigation menu"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                position: 'absolute',
                right: '0.75rem',
                top: '0.85rem',
                background: 'none',
                border: 'none',
                color: 'var(--paper)',
                cursor: 'pointer',
              }}
            >
              <X size={20} />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Topbar */}
        <header
          style={{
            height: '60px',
            backgroundColor: 'var(--surface)',
            borderBottom: '1px solid var(--line)',
            padding: '0 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            position: 'sticky',
            top: 0,
            zIndex: 350,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
            <button
              type="button"
              aria-label="Open menu"
              className="show-on-mobile"
              onClick={() => setMobileMenuOpen(true)}
              style={{
                background: 'transparent',
                border: '1px solid var(--line)',
                borderRadius: '8px',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--ink)',
              }}
            >
              <Menu size={18} />
            </button>

            {/* Breadcrumbs */}
            <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', minWidth: 0 }}>
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={`${crumb.label}-${idx}`}>
                  {idx > 0 && <span style={{ color: 'var(--ink-muted)' }}>/</span>}
                  {crumb.to && idx < breadcrumbs.length - 1 ? (
                    <Link to={crumb.to} style={{ color: 'var(--ink-2)', textDecoration: 'none' }}>
                      {crumb.label}
                    </Link>
                  ) : (
                    <span
                      style={{
                        color: 'var(--ink)',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {crumb.label}
                    </span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          </div>

          {/* Right Controls: Notifications Bell & Account Menu */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <NotificationsBell />

            <div ref={menuRef} style={{ position: 'relative' }}>
              <button
                type="button"
                aria-expanded={accountMenuOpen}
                aria-label="Account menu"
                onClick={() => setAccountMenuOpen((o) => !o)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.28rem 0.55rem 0.28rem 0.3rem',
                  borderRadius: '99px',
                  border: '1px solid var(--line)',
                  backgroundColor: 'var(--surface)',
                  cursor: 'pointer',
                  color: 'var(--ink)',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: avatarColor,
                    color: '#ffffff',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {getInitials(displayName)}
                </span>
                <span
                  className="hide-on-mobile"
                  style={{ fontSize: '0.84rem', fontWeight: 600, maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {displayName}
                </span>
                <ChevronDown size={14} style={{ color: 'var(--ink-2)' }} />
              </button>

              {accountMenuOpen && (
                <div
                  role="menu"
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 8px)',
                    width: '240px',
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: '12px',
                    boxShadow: 'var(--shadow-lg)',
                    padding: '0.4rem',
                    zIndex: 600,
                  }}
                >
                  <div style={{ padding: '0.55rem 0.7rem', borderBottom: '1px solid var(--line)', marginBottom: '0.35rem' }}>
                    <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--ink)' }}>{displayName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--ink-2)', wordBreak: 'break-all' }}>
                      {user?.email}
                    </div>
                  </div>

                  <Link
                    role="menuitem"
                    to="/settings/profile"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.55rem',
                      padding: '0.55rem 0.7rem',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      color: 'var(--ink)',
                      fontSize: '0.85rem',
                    }}
                  >
                    <Settings size={15} />
                    <span>Account settings</span>
                  </Link>
                  <Link
                    role="menuitem"
                    to="/notifications"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.55rem',
                      padding: '0.55rem 0.7rem',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      color: 'var(--ink)',
                      fontSize: '0.85rem',
                    }}
                  >
                    <Bell size={15} />
                    <span>Notifications</span>
                  </Link>

                  {config.demoMode && user?.isDemo && (
                    <Link
                      role="menuitem"
                      to="/demo/mailbox"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.55rem',
                        padding: '0.55rem 0.7rem',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        color: 'var(--ink)',
                        fontSize: '0.85rem',
                      }}
                    >
                      <Mail size={15} />
                      <span>Demo mailbox</span>
                    </Link>
                  )}

                  <div style={{ borderTop: '1px solid var(--line)', marginTop: '0.35rem', paddingTop: '0.35rem' }}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={async () => {
                        await logout();
                        navigate('/', { replace: true });
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.55rem',
                        padding: '0.55rem 0.7rem',
                        borderRadius: '8px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--danger)',
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <LogOut size={15} />
                      <span>Sign out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Soft Email Verification Reminder Banner */}
        {user && !user.emailVerified && config.emailVerification !== 'off' && (
          <div
            role="status"
            aria-live="polite"
            style={{
              backgroundColor: '#fef9ec',
              borderBottom: '1px solid #f2dca6',
              padding: '0.6rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
              fontSize: '0.85rem',
              color: '#714b09',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <span>
                {verifyNotice ||
                  (config.emailVerification === 'required'
                    ? 'Verify your email address before creating project invites or funding a project.'
                    : 'Please verify your email address so password resets and notifications reach you.')}
              </span>
            </div>
            <button
              type="button"
              disabled={resendingVerify}
              onClick={() => void handleResendVerification()}
              style={{
                background: 'transparent',
                border: '1px solid #d4b054',
                borderRadius: '6px',
                padding: '0.3rem 0.7rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#714b09',
                cursor: 'pointer',
              }}
            >
              {resendingVerify ? 'Sending…' : 'Resend verification'}
            </button>
          </div>
        )}

        {/* Viewport Content */}
        <main style={{ flex: 1, padding: '1.5rem 1.75rem' }}>
          {children || <Outlet />}
        </main>
      </div>

      {/* Demo Overlay strictly gated on DEMO_MODE */}
      {config.demoMode && <DemoBar />}
    </div>
  );
};

