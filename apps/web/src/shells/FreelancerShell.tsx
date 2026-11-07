import React, { useState } from 'react';
import { Outlet, Link, useLocation, useParams } from 'react-router-dom';
import {
  FolderKanban,
  LayoutDashboard,
  PackageCheck,
  Calendar,
  CreditCard,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { Avatar } from '../components/ui/Skeleton.js';
import { DemoBar } from '../components/ui/DemoBar.js';

export const FreelancerShell: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const location = useLocation();
  const { id: routeProjectId } = useParams<{ id: string }>();

  const currentProjectId = routeProjectId || 'proj_brand_launch';

  // Section 7 navigation: Projects, Overview, My deliverables, Schedule, Payments (NO funding, autonomy, or invite controls)
  const navItems = [
    {
      label: 'Projects',
      path: '/freelancer',
      icon: <FolderKanban size={18} />,
    },
    {
      label: 'Overview',
      path: `/freelancer/projects/${currentProjectId}`,
      icon: <LayoutDashboard size={18} />,
    },
    {
      label: 'My deliverables',
      path: `/freelancer/projects/${currentProjectId}/deliverables`,
      icon: <PackageCheck size={18} />,
    },
    {
      label: 'Schedule',
      path: `/freelancer/projects/${currentProjectId}/schedule`,
      icon: <Calendar size={18} />,
    },
    {
      label: 'Payments',
      path: `/freelancer/projects/${currentProjectId}/payments`,
      icon: <CreditCard size={18} />,
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        backgroundColor: 'var(--paper)',
        color: 'var(--ink)',
      }}
    >
      {/* Freelancer Sidebar */}
      <aside
        aria-label="Freelancer navigation rail"
        style={{
          width: isSidebarCollapsed ? '64px' : '240px',
          backgroundColor: 'var(--surface)',
          borderRight: '1px solid var(--line)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width var(--duration-base) var(--ease-out)',
          flexShrink: 0,
          zIndex: 40,
        }}
      >
        {/* Header */}
        <div
          style={{
            height: '56px',
            padding: '0 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isSidebarCollapsed ? 'center' : 'space-between',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <Link
            to="/freelancer"
            style={{
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              color: 'var(--ink)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '6px',
                backgroundColor: 'var(--forest)',
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
                  backgroundColor: 'var(--teal)',
                  transform: 'rotate(45deg)',
                }}
              />
            </div>
            {!isSidebarCollapsed && (
              <span style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
                Milestone
              </span>
            )}
          </Link>

          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--ink-2)',
              cursor: 'pointer',
              padding: '0.3rem',
              display: isSidebarCollapsed ? 'none' : 'inline-flex',
            }}
          >
            <PanelLeftClose size={16} />
          </button>
        </div>

        {/* Section Title */}
        {!isSidebarCollapsed && (
          <div style={{ padding: '0.75rem 1rem 0.25rem', fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink-2)' }}>
            Freelancer Workspace
          </div>
        )}

        {/* Navigation Items */}
        <nav
          aria-label="Freelancer project sections"
          style={{
            flex: 1,
            padding: '0.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            overflowY: 'auto',
          }}
        >
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.label !== 'Overview' && location.pathname.startsWith(item.path));

            return (
              <Link
                key={item.label}
                to={item.path}
                title={item.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                  gap: '0.75rem',
                  padding: isSidebarCollapsed ? '0.65rem 0' : '0.6rem 0.75rem',
                  borderRadius: 'var(--radius-btn)',
                  backgroundColor: isActive ? 'var(--teal-wash)' : 'transparent',
                  color: isActive ? 'var(--teal-ink)' : 'var(--ink-2)',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.875rem',
                  textDecoration: 'none',
                  transition: 'all var(--duration-fast) var(--ease-out)',
                }}
              >
                <span aria-hidden="true" style={{ display: 'inline-flex' }}>
                  {item.icon}
                </span>
                {!isSidebarCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Freelancer Profile Footer */}
        <div
          style={{
            padding: '0.75rem 1rem',
            borderTop: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
          }}
        >
          <Avatar name="Arjun Mehta" roleBadge="freelancer" size="sm" />
          {!isSidebarCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink)', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Arjun Mehta
              </span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--ink-2)' }}>
                Freelancer
              </span>
            </div>
          )}
        </div>
      </aside>

      {/* Main Freelancer Viewport */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          height: '100vh',
          overflow: 'hidden',
        }}
      >
        {/* Top Header */}
        <header
          style={{
            height: '56px',
            backgroundColor: 'var(--surface)',
            borderBottom: '1px solid var(--line)',
            padding: '0 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {isSidebarCollapsed && (
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(false)}
                aria-label="Expand sidebar"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--ink-2)',
                  cursor: 'pointer',
                  padding: '0.3rem',
                  display: 'inline-flex',
                }}
              >
                <PanelLeftOpen size={16} />
              </button>
            )}
            <Link
              to="/freelancer"
              style={{
                fontSize: '0.875rem',
                color: 'var(--ink-2)',
                textDecoration: 'none',
              }}
            >
              My Projects
            </Link>
            <span style={{ color: 'var(--line)' }}>/</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink)' }}>
              Brand-site Redesign & Launch
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span
              style={{
                fontSize: '0.75rem',
                padding: '0.2rem 0.55rem',
                borderRadius: 'var(--radius-chip)',
                backgroundColor: 'var(--paper)',
                border: '1px solid var(--line)',
                color: 'var(--ink-2)',
                fontWeight: 500,
              }}
            >
              PayPal Sandbox Active
            </span>
          </div>
        </header>

        {/* Viewport Outlet */}
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.5rem',
            backgroundColor: 'var(--paper)',
            boxSizing: 'border-box',
          }}
        >
          <Outlet />
        </main>
      </div>

      <DemoBar />
    </div>
  );
};

