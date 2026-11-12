import React, { useState } from 'react';
import { ProjectRow } from './ProjectRow.js';
import {
  extractLedgerBalances,
  getProjectCategory,
  getProjectStateSentence,
  getProjectStatusBadgeInfo,
  type NormalizedBalances,
  type ProjectCategory,
  type ProjectMilestoneStats,
} from '../../lib/projectHelpers.js';

export interface ProjectListItem {
  id: string;
  title: string;
  brief: string;
  totalCents: number;
  status: string;
  autonomyMode?: string;
  freelancerId?: string | null;
  isDemo?: boolean;
  createdAt: string;
  balances?: NormalizedBalances;
  milestoneStats?: ProjectMilestoneStats;
}

type FilterTab = 'all' | ProjectCategory;

const CATEGORY_SECTIONS: {
  key: ProjectCategory;
  title: string;
  emptyText: string;
}[] = [
  {
    key: 'ongoing',
    title: 'Ongoing',
    emptyText: 'No ongoing projects right now.',
  },
  {
    key: 'draft',
    title: 'Awaiting Funding & Drafts',
    emptyText: 'No draft or awaiting-funding projects.',
  },
  {
    key: 'completed',
    title: 'Completed',
    emptyText: 'No completed projects yet.',
  },
  {
    key: 'cancelled',
    title: 'Cancelled / Failed',
    emptyText: 'No cancelled or failed projects.',
  },
];

interface ProjectCategoryListProps {
  projects: ProjectListItem[];
  ledgerMap: Record<string, NormalizedBalances>;
  role: 'client' | 'freelancer';
  getNextAction: (project: ProjectListItem) => { label: string; action: () => void };
  onProjectClick: (project: ProjectListItem) => void;
  onManageStatus?: (project: ProjectListItem) => void;
  onDeleteProject?: (project: ProjectListItem) => void;
}

export const ProjectCategoryList: React.FC<ProjectCategoryListProps> = ({
  projects,
  ledgerMap,
  role,
  getNextAction,
  onProjectClick,
  onManageStatus,
  onDeleteProject,
}) => {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const categorized: Record<ProjectCategory, ProjectListItem[]> = {
    ongoing: [],
    draft: [],
    completed: [],
    cancelled: [],
  };

  for (const project of projects) {
    const category = getProjectCategory(project);
    categorized[category].push(project);
  }

  const filterTabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: projects.length },
    { key: 'ongoing', label: 'Ongoing', count: categorized.ongoing.length },
    { key: 'draft', label: 'Awaiting Funding', count: categorized.draft.length },
    { key: 'completed', label: 'Completed', count: categorized.completed.length },
    { key: 'cancelled', label: 'Cancelled / Failed', count: categorized.cancelled.length },
  ];

  const sectionsToRender =
    activeTab === 'all'
      ? CATEGORY_SECTIONS.filter((sec) => categorized[sec.key].length > 0)
      : CATEGORY_SECTIONS.filter((sec) => sec.key === activeTab);

  const renderRow = (project: ProjectListItem) => {
    const nextAction = getNextAction(project);
    const balances = ledgerMap[project.id] || extractLedgerBalances(project);
    const category = getProjectCategory(project);
    const milestoneProgressLabel =
      project.milestoneStats && project.milestoneStats.total > 0
        ? `${project.milestoneStats.paid}/${project.milestoneStats.total} paid`
        : undefined;

    return (
      <ProjectRow
        key={project.id}
        id={project.id}
        title={project.title}
        stateSentence={getProjectStateSentence(project, role)}
        heldCents={balances.heldCents}
        paidCents={balances.paidCents}
        totalCents={project.totalCents}
        nextActionLabel={nextAction.label}
        onNextAction={nextAction.action}
        onClick={() => onProjectClick(project)}
        isDemo={project.isDemo}
        statusBadge={getProjectStatusBadgeInfo(project)}
        milestoneProgressLabel={milestoneProgressLabel}
        onManageStatus={
          onManageStatus && category !== 'completed' && category !== 'cancelled'
            ? () => onManageStatus(project)
            : undefined
        }
        onDeleteProject={onDeleteProject ? () => onDeleteProject(project) : undefined}
      />
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Category Filter Tabs */}
      <div
        role="tablist"
        aria-label="Filter projects by lifecycle status"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
        }}
      >
        {filterTabs.map((tab) => {
          const isSelected = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isSelected}
              data-testid={`project-filter-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.4rem 0.85rem',
                borderRadius: '999px',
                border: `1px solid ${isSelected ? 'var(--forest)' : 'var(--line)'}`,
                backgroundColor: isSelected ? 'var(--forest)' : 'var(--surface)',
                color: isSelected ? '#ffffff' : 'var(--ink-2)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{tab.label}</span>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '0.05rem 0.4rem',
                  borderRadius: '999px',
                  backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--paper)',
                  color: isSelected ? '#ffffff' : 'var(--ink-2)',
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Grouped Sections */}
      {sectionsToRender.map((sec) => {
        const items = categorized[sec.key];
        return (
          <section
            key={sec.key}
            aria-label={sec.title}
            data-testid={`project-section-${sec.key}`}
            style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--ink-2)',
                }}
              >
                {sec.title} ({items.length})
              </h2>
            </div>

            {items.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {items.map(renderRow)}
              </div>
            ) : (
              <div
                style={{
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-card)',
                  border: '1px dashed var(--line)',
                  backgroundColor: 'var(--surface)',
                  color: 'var(--ink-2)',
                  fontSize: '0.875rem',
                }}
              >
                {sec.emptyText}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};

