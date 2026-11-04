import React, { useEffect, useRef } from 'react';
import { Gantt, ProjectModel, Model, TaskModel } from '@bryntum/gantt';
import '@bryntum/gantt/gantt.css';
import '@bryntum/gantt/stockholm-light.css';
import './Gantt.css';

import { formatCents } from '@milestone/shared';
import { MilestoneTaskModel } from '../models/MilestoneTaskModel.js';
import { sampleTasks, sampleDependencies } from '../data/sampleProject.js';

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

interface GanttProps {
  onTaskSelect?: (task: MilestoneTaskModel) => void;
}

export const MilestoneGantt: React.FC<GanttProps> = ({ onTaskSelect }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const ganttInstanceRef = useRef<Gantt | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create ProjectModel with custom MilestoneTaskModel
    const project = new ProjectModel({
      taskModelClass: MilestoneTaskModel,
      tasksData: sampleTasks as unknown as Record<string, unknown>[],
      dependenciesData: sampleDependencies as unknown as Record<string, unknown>[],
    });

    const gantt = new Gantt({
      appendTo: containerRef.current,
      project,
      rowHeight: 46,
      barMargin: 8,
      startDate: new Date('2026-11-08'),
      endDate: new Date('2026-12-28'),
      viewPreset: 'weekAndDayLetter',
      features: {
        taskDrag: true,
        taskResize: true,
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
          text: 'Start',
          width: 105,
        },
        {
          type: 'duration',
          text: 'Duration',
          width: 85,
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
            if (model.amountCents != null && model.amountCents > 0) {
              return `<span class="money-cell">${formatCents(model.amountCents)}</span>`;
            }
            return '<span style="color: var(--slate); font-size: 0.8rem;">—</span>';
          },
        },
      ],
      taskRenderer: ({ taskRecord, renderData }) => {
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
    });

    if (onTaskSelect) {
      gantt.on('taskClick', ({ taskRecord }: { taskRecord: TaskModel }) => {
        onTaskSelect(taskRecord as MilestoneTaskModel);
      });
      gantt.on('cellClick', ({ record }: { record: Model }) => {
        onTaskSelect(record as MilestoneTaskModel);
      });
    }

    ganttInstanceRef.current = gantt;

    return () => {
      gantt.destroy();
      ganttInstanceRef.current = null;
    };
  }, [onTaskSelect]);

  return (
    <div className="milestone-gantt-wrapper">
      <div className="milestone-gantt-header">
        <h2 className="milestone-gantt-title">
          <span>Brand Platform Redesign</span>
          <span style={{ fontSize: '0.8125rem', fontWeight: 400, color: 'var(--slate)' }}>
            (12 Tasks • 4 Milestones • $8,000 Total)
          </span>
        </h2>
        <div className="milestone-gantt-legend">
          <span style={{ fontWeight: 600, color: 'var(--ink)' }}>Milestone States:</span>
          <div className="milestone-legend-item">
            <span
              className="milestone-legend-dot"
              style={{ border: '2px solid var(--settled)', background: 'var(--settled)' }}
            />
            <span>Paid (✓)</span>
          </div>
          <div className="milestone-legend-item">
            <span
              className="milestone-legend-dot"
              style={{ border: '2px solid var(--brass)', background: 'var(--brass)' }}
            />
            <span>Approved (⟳)</span>
          </div>
          <div className="milestone-legend-item">
            <span
              className="milestone-legend-dot"
              style={{
                border: '2px solid var(--brass)',
                background: 'repeating-linear-gradient(45deg, var(--brass), var(--brass) 2px, #cf972a 2px, #cf972a 4px)',
              }}
            />
            <span>In review (◷)</span>
          </div>
          <div className="milestone-legend-item">
            <span
              className="milestone-legend-dot"
              style={{ border: '2px solid var(--tide)', background: 'rgba(31, 122, 140, 0.25)' }}
            />
            <span>Funded (●)</span>
          </div>
          <div className="milestone-legend-item">
            <span
              className="milestone-legend-dot"
              style={{ border: '2px solid var(--flag)', background: 'rgba(200, 64, 47, 0.2)' }}
            />
            <span>Changes req (⚐)</span>
          </div>
          <div className="milestone-legend-item">
            <span
              className="milestone-legend-dot"
              style={{ border: '2px dashed var(--slate)', background: 'var(--paper)' }}
            />
            <span>Unfunded (○)</span>
          </div>
        </div>
      </div>
      <div className="milestone-gantt-container" ref={containerRef} />
    </div>
  );
};
