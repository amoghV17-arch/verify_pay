import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Calendar,
  Sidebar,
  ListFilter,
  BarChart2,
} from 'lucide-react';
import { MilestoneGantt, type MilestoneGanttHandle, getStatusGlyph } from '../components/Gantt.js';
import { TaskInspectorPanel, type TaskInspectorData } from '../components/schedule/TaskInspectorPanel.js';
import { ScheduleListView } from '../components/schedule/ScheduleListView.js';
import { sampleTasks } from '../data/sampleProject.js';
import type { MilestoneTaskModel } from '../models/MilestoneTaskModel.js';
import { ScheduleSkeleton } from '../components/schedule/ScheduleSkeleton.js';

export { ScheduleSkeleton };

interface SchedulePageProps {
  role?: 'client' | 'freelancer';
}

interface ProjectMetadata {
  id: string;
  title: string;
  status: string;
  isDemo?: boolean;
}

export const SchedulePage: React.FC<SchedulePageProps> = ({ role = 'client' }) => {
  const { id: routeProjectId } = useParams<{ id: string }>();
  const projectId = routeProjectId || 'proj_brand_launch';

  const [project, setProject] = useState<ProjectMetadata | null>(null);
  const [tasks, setTasks] = useState<TaskInspectorData[]>(sampleTasks as unknown as TaskInspectorData[]);
  const [view, setView] = useState<'gantt' | 'list'>('gantt');
  const [showDetails, setShowDetails] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskInspectorData | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const ganttRef = useRef<MilestoneGanttHandle>(null);

  // Screen size check for mobile fallback (< 768px)
  useEffect(() => {
    const checkViewport = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setView('list');
      }
    };

    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  // Fetch project details
  useEffect(() => {
    const fetchProject = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.project) {
            setProject(data.project);
          }
        }
      } catch {
        // Fallback default
        setProject({
          id: projectId,
          title: 'Brand-site Redesign & Launch',
          status: 'active',
        });
      }
    };
    fetchProject();
  }, [projectId]);

  // Fetch tasks for list view fallback
  const fetchTasksData = useCallback(async () => {
    try {
      const res = await fetch(`/api/gantt/${projectId}/load`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.tasks?.rows) {
          setTasks(data.tasks.rows);
          return;
        }
      }
    } catch {
      // Use sample data fallback
    }
    setTasks(sampleTasks as unknown as TaskInspectorData[]);
  }, [projectId]);

  useEffect(() => {
    fetchTasksData();
  }, [fetchTasksData, refreshKey]);

  // Handle task selection from Gantt or List
  const handleSelectTask = useCallback((taskRecord: MilestoneTaskModel | TaskInspectorData) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any = taskRecord;
    const taskData: TaskInspectorData = {
      id: raw.id || '',
      name: raw.name || '',
      startDate: typeof raw.startDate === 'object' ? raw.startDate?.toISOString?.()?.split('T')[0] : String(raw.startDate || ''),
      duration: Number(raw.duration ?? 0),
      percentDone: Number(raw.percentDone ?? 0),
      milestone: Boolean(raw.milestone || raw.isMilestone),
      isMilestone: Boolean(raw.milestone || raw.isMilestone),
      milestoneId: raw.milestoneId,
      amountCents: raw.amountCents != null ? Number(raw.amountCents) : undefined,
      paymentStatus: raw.paymentStatus,
      deliverableType: raw.deliverableType,
      acceptanceCriteria: raw.acceptanceCriteria,
    };

    setSelectedTask(taskData);
    setIsInspectorOpen(true);
  }, []);

  // Context bar action handlers
  const handleZoomIn = () => {
    ganttRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    ganttRef.current?.zoomOut();
  };

  const handleFit = () => {
    ganttRef.current?.zoomToFit();
  };

  const handleToggleDetails = () => {
    setShowDetails((prev) => {
      const next = !prev;
      ganttRef.current?.toggleDetails(next);
      return next;
    });
  };

  const handleToggleInspector = () => {
    if (!isInspectorOpen && !selectedTask && tasks.length > 0) {
      // Default select the first milestone if none selected
      const firstMilestone = tasks.find((t) => t.milestone || t.isMilestone) || tasks[0];
      setSelectedTask(firstMilestone || null);
    }
    setIsInspectorOpen((prev) => !prev);
  };

  return (
    <div
      data-testid="schedule-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        backgroundColor: 'var(--paper)',
        color: 'var(--ink)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Slim Context Bar per UI_IMPLEMENTATION.md §9 */}
      <header
        aria-label="Schedule context bar"
        data-testid="schedule-context-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.625rem 1.25rem',
          borderBottom: '1px solid var(--line)',
          backgroundColor: 'var(--chalk)',
          minHeight: '48px',
          flexWrap: 'wrap',
          gap: '0.75rem',
          zIndex: 10,
        }}
      >
        {/* Left: Project title & status indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h2
            style={{
              margin: 0,
              fontFamily: 'Bricolage Grotesque, sans-serif',
              fontSize: '1.125rem',
              fontWeight: 600,
              color: 'var(--ink)',
            }}
          >
            {project?.title || 'Brand-site Redesign & Launch'}
          </h2>
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              padding: '2px 8px',
              borderRadius: '12px',
              backgroundColor: 'rgba(31, 122, 140, 0.12)',
              color: 'var(--tide)',
            }}
          >
            {project?.status || 'Active'}
          </span>
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 500,
              color: 'var(--slate)',
            }}
          >
            {role === 'client' ? 'Client Schedule' : 'Freelancer Schedule'}
          </span>
        </div>

        {/* Center / Right: View mode & controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* View Toggle: Gantt vs List */}
          <div
            style={{
              display: 'inline-flex',
              padding: '2px',
              borderRadius: '6px',
              backgroundColor: 'var(--line)',
              marginRight: '0.25rem',
            }}
          >
            <button
              type="button"
              id="view-gantt-btn"
              onClick={() => setView('gantt')}
              data-testid="view-toggle-gantt"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                fontSize: '0.75rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: '4px',
                backgroundColor: view === 'gantt' ? 'var(--paper)' : 'transparent',
                color: view === 'gantt' ? 'var(--ink)' : 'var(--slate)',
                boxShadow: view === 'gantt' ? '0 1px 2px rgba(22, 32, 43, 0.08)' : 'none',
                cursor: 'pointer',
              }}
            >
              <BarChart2 size={13} />
              <span>Gantt</span>
            </button>
            <button
              type="button"
              id="view-list-btn"
              onClick={() => setView('list')}
              data-testid="view-toggle-list"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                fontSize: '0.75rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: '4px',
                backgroundColor: view === 'list' ? 'var(--paper)' : 'transparent',
                color: view === 'list' ? 'var(--ink)' : 'var(--slate)',
                boxShadow: view === 'list' ? '0 1px 2px rgba(22, 32, 43, 0.08)' : 'none',
                cursor: 'pointer',
              }}
            >
              <ListFilter size={13} />
              <span>List</span>
            </button>
          </div>

          {/* Gantt-specific Controls */}
          {view === 'gantt' && (
            <>
              <button
                type="button"
                onClick={handleZoomOut}
                title="Zoom Out"
                data-testid="zoom-out-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 9px',
                  borderRadius: '6px',
                  border: '1px solid var(--line)',
                  backgroundColor: 'var(--paper)',
                  color: 'var(--ink)',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <ZoomOut size={13} />
                <span>Zoom -</span>
              </button>

              <button
                type="button"
                onClick={handleZoomIn}
                title="Zoom In"
                data-testid="zoom-in-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 9px',
                  borderRadius: '6px',
                  border: '1px solid var(--line)',
                  backgroundColor: 'var(--paper)',
                  color: 'var(--ink)',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <ZoomIn size={13} />
                <span>Zoom +</span>
              </button>

              <button
                type="button"
                onClick={handleFit}
                title="Fit Timeline"
                data-testid="fit-timeline-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 9px',
                  borderRadius: '6px',
                  border: '1px solid var(--line)',
                  backgroundColor: 'var(--paper)',
                  color: 'var(--ink)',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <Maximize2 size={13} />
                <span>Fit</span>
              </button>

              <button
                type="button"
                onClick={handleToggleDetails}
                title="Toggle Start Date and Duration Columns"
                data-testid="toggle-details-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 9px',
                  borderRadius: '6px',
                  border: `1px solid ${showDetails ? 'var(--tide)' : 'var(--line)'}`,
                  backgroundColor: showDetails ? 'rgba(31, 122, 140, 0.08)' : 'var(--paper)',
                  color: showDetails ? 'var(--tide)' : 'var(--ink)',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <Calendar size={13} />
                <span>Details</span>
              </button>
            </>
          )}

          {/* Inspector Panel Toggle Button */}
          <button
            type="button"
            onClick={handleToggleInspector}
            title="Toggle Milestone Inspector"
            data-testid="toggle-inspector-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 9px',
              borderRadius: '6px',
              border: `1px solid ${isInspectorOpen ? 'var(--tide)' : 'var(--line)'}`,
              backgroundColor: isInspectorOpen ? 'rgba(31, 122, 140, 0.08)' : 'var(--paper)',
              color: isInspectorOpen ? 'var(--tide)' : 'var(--ink)',
              fontSize: '0.75rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Sidebar size={13} />
            <span>Inspector</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Area: Gantt or List View */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {view === 'gantt' ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              width: '100%',
              overflow: 'hidden',
            }}
          >
            {/* Bryntum Gantt Instance */}
            <div style={{ flex: 1, height: '100%', width: '100%', overflow: 'hidden' }}>
              <MilestoneGantt
                ref={ganttRef}
                projectId={projectId}
                role={role}
                refreshKey={refreshKey}
                showDetails={showDetails}
                onTaskSelect={handleSelectTask}
                onSyncSuccess={() => {
                  setRefreshKey((k) => k + 1);
                }}
              />
            </div>

            {/* One-line Key under the chart per UI_IMPLEMENTATION.md §9 */}
            <footer
              data-testid="schedule-legend-key"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexWrap: 'wrap',
                gap: '1.25rem',
                padding: '0.5rem 1rem',
                backgroundColor: 'var(--chalk)',
                borderTop: '1px solid var(--line)',
                fontSize: '0.75rem',
                color: 'var(--slate)',
              }}
            >
              <span style={{ fontWeight: 600, color: 'var(--ink)' }}>Milestone States:</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: 'var(--slate)', fontWeight: 700 }}>{getStatusGlyph('unfunded')}</span>
                <span>Unfunded</span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: 'var(--tide)', fontWeight: 700 }}>{getStatusGlyph('funded')}</span>
                <span>Funded</span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: 'var(--brass)', fontWeight: 700 }}>{getStatusGlyph('in_review')}</span>
                <span>In review</span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: 'var(--flag)', fontWeight: 700 }}>{getStatusGlyph('changes_requested')}</span>
                <span>Changes requested</span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: 'var(--brass)', fontWeight: 700 }}>{getStatusGlyph('approved')}</span>
                <span>Approved</span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: 'var(--settled)', fontWeight: 700 }}>{getStatusGlyph('paid')}</span>
                <span>Paid</span>
              </span>
            </footer>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <ScheduleListView
              tasks={tasks}
              projectId={projectId}
              role={role}
              onSelectTask={handleSelectTask}
              onSwitchToGantt={() => setView('gantt')}
              isMobileFallback={isMobile}
            />
          </div>
        )}

        {/* Slide-over Task Inspector Panel */}
        <TaskInspectorPanel
          isOpen={isInspectorOpen}
          onClose={() => setIsInspectorOpen(false)}
          task={selectedTask}
          projectId={projectId}
          role={role}
        />
      </main>
    </div>
  );
};
