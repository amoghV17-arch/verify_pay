import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Gantt, ProjectModel, Model, TaskModel } from '@bryntum/gantt';
import '@bryntum/gantt/gantt.css';
import '@bryntum/gantt/stockholm-light.css';
import './Gantt.css';

import { formatCents } from '@milestone/shared';
import { MilestoneTaskModel } from '../models/MilestoneTaskModel.js';
import { getCookie } from '../lib/api.js';

export function getStatusGlyph(status?: string): string {
  switch (status) {
    case 'paid':
      return '✓';
    case 'approved':
    case 'releasing':
      return '⟳';
    case 'in_review':
    case 'awaiting_client':
      return '◷';
    case 'changes_requested':
    case 'appealed':
      return '⚐';
    case 'funded':
    case 'submitted':
      return '●';
    case 'unfunded':
    default:
      return '○';
  }
}

export function formatStatusLabel(status?: string): string {
  if (!status) return 'Unfunded';
  return status.replace(/_/g, ' ');
}

export interface MilestoneGanttHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  zoomToFit: () => void;
  toggleDetails: (show: boolean) => void;
  getTasks: () => MilestoneTaskModel[];
}

export interface GanttProps {
  projectId?: string;
  refreshKey?: number;
  tasksData?: unknown[];
  dependenciesData?: unknown[];
  readOnly?: boolean;
  role?: 'client' | 'freelancer';
  showDetails?: boolean;
  onTaskSelect?: (task: MilestoneTaskModel) => void;
  onSyncSuccess?: () => void;
}

export const MilestoneGantt = forwardRef<MilestoneGanttHandle, GanttProps>(({
  projectId = '',
  refreshKey = 0,
  tasksData,
  dependenciesData,
  readOnly = false,
  role = 'client',
  showDetails = false,
  onTaskSelect,
  onSyncSuccess,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const ganttInstanceRef = useRef<Gantt | null>(null);

  // Helper to toggle column hidden state
  const setDetailsVisible = (show: boolean) => {
    if (ganttInstanceRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const columns = ganttInstanceRef.current.columns as any;
      const startCol = columns.get ? columns.get('startdate') : columns.find?.((c: { id?: string; type?: string }) => c.id === 'startdate' || c.type === 'startdate');
      const durCol = columns.get ? columns.get('duration') : columns.find?.((c: { id?: string; type?: string }) => c.id === 'duration' || c.type === 'duration');
      if (startCol) startCol.hidden = !show;
      if (durCol) durCol.hidden = !show;
    }
  };

  // Expose imperative handle for toolbar controls
  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      ganttInstanceRef.current?.zoomIn();
    },
    zoomOut: () => {
      ganttInstanceRef.current?.zoomOut();
    },
    zoomToFit: () => {
      ganttInstanceRef.current?.zoomToFit();
    },
    toggleDetails: (show: boolean) => {
      setDetailsVisible(show);
    },
    getTasks: () => {
      if (!ganttInstanceRef.current?.taskStore) return [];
      return ganttInstanceRef.current.taskStore.allRecords as MilestoneTaskModel[];
    },
  }), []);

  // Update column visibility when showDetails prop changes
  useEffect(() => {
    setDetailsVisible(showDetails);
  }, [showDetails]);

  // Handle data reload on refreshKey
  useEffect(() => {
    if (refreshKey > 0 && ganttInstanceRef.current?.project) {
      if (!tasksData) {
        ganttInstanceRef.current.project.load();
      }
    }
  }, [refreshKey, tasksData]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create ProjectModel with Bryntum Load/Sync transport or preview data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const projectConfig: any = {
      taskModelClass: MilestoneTaskModel,
    };

    if (tasksData && tasksData.length > 0) {
      projectConfig.tasksData = tasksData;
      projectConfig.dependenciesData = dependenciesData || [];
      projectConfig.autoLoad = false;
      projectConfig.autoSync = false;
    } else if (projectId) {
      const csrf = getCookie('ms_csrf');
      projectConfig.transport = {
        load: {
          url: `/api/gantt/${projectId}/load`,
          credentials: 'include',
        },
        sync: {
          url: `/api/gantt/${projectId}/sync`,
          credentials: 'include',
          headers: csrf ? { 'X-CSRF-Token': csrf } : undefined,
        },
      };
      projectConfig.autoLoad = true;
      projectConfig.autoSync = true;
    } else {
      projectConfig.autoLoad = false;
      projectConfig.autoSync = false;
    }

    const project = new ProjectModel(projectConfig);

    project.on('beforeSend', (ev: { requestConfig?: { headers?: Record<string, string> } }) => {
      const latestCsrf = getCookie('ms_csrf');
      if (latestCsrf && ev?.requestConfig) {
        ev.requestConfig.headers = {
          ...(ev.requestConfig.headers || {}),
          'X-CSRF-Token': latestCsrf,
        };
      }
    });

    if (onSyncSuccess) {
      project.on('sync', () => {
        onSyncSuccess();
      });
    }

    // Role-scoped permissions:
    // Client: tasks editable (names, dates, order), money & status protected
    // Freelancer: task dates/resize disabled, only progress editable
    const isFreelancer = role === 'freelancer';

    const gantt = new Gantt({
      appendTo: containerRef.current,
      project,
      readOnly,
      rowHeight: 46,
      barMargin: 8,
      startDate: new Date('2026-11-08'),
      endDate: new Date('2026-12-28'),
      viewPreset: 'weekAndDayLetter',
      subGridConfigs: {
        locked: {
          width: 440,
        },
      },
      // Hide default Bryntum toolbar per UI_IMPLEMENTATION.md §9
      tbar: undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      taskRenderer: ({ taskRecord, renderData }: { taskRecord: TaskModel; renderData: any }) => {
        const model = taskRecord as MilestoneTaskModel;
        if (model.isMilestone) {
          const status = model.paymentStatus ?? 'unfunded';
          const statusCls = `milestone-status-${status}`;
          if (typeof renderData.cls === 'string') {
            renderData.cls += ` ${statusCls}`;
          } else if (renderData.cls && typeof renderData.cls === 'object' && 'add' in renderData.cls) {
            renderData.cls.add(statusCls);
          }
        }
        return '';
      },
      features: {
        taskDrag: !isFreelancer,
        taskResize: !isFreelancer,
        dependencies: true,
        taskEdit: true,
        labels: {
          right: {
            field: 'name',
            renderer: ({ taskRecord }: { taskRecord: TaskModel }) => {
              const model = taskRecord as MilestoneTaskModel;
              if (model.isMilestone && model.amountCents) {
                const glyph = getStatusGlyph(model.paymentStatus);
                const status = model.paymentStatus ?? 'unfunded';
                const formatted = formatCents(model.amountCents);
                return `
                  <span class="milestone-timeline-badge milestone-badge-${status}">
                    <span>${glyph}</span>
                    <span>${model.name}</span>
                    <span>${formatted}</span>
                  </span>
                `;
              }
              return model.name;
            },
          },
        },
      },
      columns: [
        {
          type: 'sequence',
          text: '#',
          width: 44,
          align: 'center',
        },
        {
          type: 'name',
          field: 'name',
          text: 'Task / Milestone',
          width: 250,
        },
        {
          type: 'startdate',
          id: 'startdate',
          text: 'Start',
          width: 105,
          hidden: !showDetails,
        },
        {
          type: 'duration',
          id: 'duration',
          text: 'Duration',
          width: 85,
          hidden: !showDetails,
        },
        {
          text: 'Payment Status',
          field: 'paymentStatus',
          width: 145,
          renderer: ({ record }: { record: Model }) => {
            const model = record as MilestoneTaskModel;
            const status = model.paymentStatus ?? (model.isMilestone ? 'unfunded' : '');
            if (!status) return '';
            const glyph = getStatusGlyph(status);
            const label = formatStatusLabel(status);
            return `
              <span class="status-pill ${status}">
                <span>${glyph}</span>
                <span>${label}</span>
              </span>
            `;
          },
        },
        {
          text: 'Amount',
          field: 'amountCents',
          width: 110,
          align: 'right',
          renderer: ({ record }: { record: Model }) => {
            const model = record as MilestoneTaskModel;
            if (!model.isMilestone || model.amountCents == null) return '';
            return `<strong class="money-cell mono" style="font-family: 'Instrument Sans', sans-serif;">${formatCents(model.amountCents)}</strong>`;
          },
        },
      ],
    });

    gantt.on('taskClick', ({ taskRecord }: { taskRecord: TaskModel }) => {
      if (onTaskSelect && taskRecord) {
        onTaskSelect(taskRecord as MilestoneTaskModel);
      }
    });

    gantt.on('cellClick', ({ record }: { record?: Model }) => {
      if (onTaskSelect && record) {
        onTaskSelect(record as MilestoneTaskModel);
      }
    });

    gantt.on('selectionChange', ({ selected }: { selected?: TaskModel[] }) => {
      if (onTaskSelect && selected && selected.length > 0 && selected[0]) {
        onTaskSelect(selected[0] as MilestoneTaskModel);
      }
    });

    ganttInstanceRef.current = gantt;

    if (!tasksData && projectId) {
      project.on('load', () => {
        try {
          const allRecords = (gantt.taskStore?.allRecords || []) as MilestoneTaskModel[];
          let minStart = Infinity;
          let maxEnd = -Infinity;
          for (const rec of allRecords) {
            if ((rec as any).isRoot) continue;
            const s = rec.startDate instanceof Date ? rec.startDate.getTime() : NaN;
            const e = rec.endDate instanceof Date ? rec.endDate.getTime() : s;
            if (!Number.isNaN(s) && s < minStart) minStart = s;
            if (!Number.isNaN(e) && e > maxEnd) maxEnd = e;
          }
          if (minStart < Infinity && maxEnd > -Infinity) {
            const dayMs = 24 * 60 * 60 * 1000;
            const spanStart = new Date(minStart - 2 * dayMs);
            const spanEnd = new Date(Math.max(maxEnd + 7 * dayMs, minStart + 21 * dayMs));
            gantt.setTimeSpan(spanStart, spanEnd);
          }
        } catch {
          // Ignore viewport resize timing issues when unmounting
        }
      });
    }

    return () => {
      gantt.destroy();
      ganttInstanceRef.current = null;
    };
  }, [projectId, role]);

  return (
    <div className="milestone-gantt-wrapper" data-testid="bryntum-gantt-wrapper">
      <div className="milestone-gantt-container" ref={containerRef} />
    </div>
  );
});

MilestoneGantt.displayName = 'MilestoneGantt';
