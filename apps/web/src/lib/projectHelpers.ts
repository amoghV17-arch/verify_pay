import type { MoneyState } from '../components/ui/StatusBadge';

export interface NormalizedBalances {
  fundedCents: number;
  paidCents: number;
  heldCents: number;
}

export interface ProjectMilestoneStats {
  total: number;
  paid: number;
  active: number;
}

export type ProjectCategory = 'ongoing' | 'draft' | 'completed' | 'cancelled';

export interface ProjectCategorizationInput {
  status?: string;
  balances?: Partial<NormalizedBalances>;
  heldCents?: number;
  paidCents?: number;
  fundedCents?: number;
  milestoneStats?: ProjectMilestoneStats;
}

export interface ProjectStatusBadgeInfo {
  label: string;
  tone: 'teal' | 'forest' | 'amber' | 'neutral' | 'red';
}

export interface NormalizedActivityEvent {
  id: string;
  timestamp: string;
  type: string;
  actor: string;
  description: string;
  metadata?: Record<string, unknown>;
}

/**
 * Extracts normalized financial balances from ledger or project payloads.
 */
export function extractLedgerBalances(data: unknown): NormalizedBalances {
  if (!data || typeof data !== 'object') {
    return { fundedCents: 0, paidCents: 0, heldCents: 0 };
  }
  const obj = data as Record<string, unknown>;
  const nested = obj.balances ?? obj.summary;
  const src =
    nested && typeof nested === 'object' ? (nested as Record<string, unknown>) : obj;

  const fundedCents = Number(src.fundedCents ?? src.totalFundedCents ?? 0) || 0;
  const paidCents = Number(src.paidCents ?? src.totalReleasedCents ?? 0) || 0;
  const rawHeld = src.heldCents ?? src.remainingHeldCents;
  const heldCents =
    rawHeld !== undefined && rawHeld !== null && !Number.isNaN(Number(rawHeld))
      ? Math.max(0, Number(rawHeld))
      : Math.max(0, fundedCents - paidCents);

  return { fundedCents, paidCents, heldCents };
}

/**
 * Parses timestamps from ISO strings, Date objects, epoch milliseconds, or SQL strings.
 */
export function parseDateSafe(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) {
      const d = new Date(Number(trimmed));
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const isoCandidate = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(trimmed)
      ? trimmed.replace(' ', 'T')
      : trimmed;
    const d = new Date(isoCandidate);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function formatDateSafe(
  value: unknown,
  fallback = 'Pending',
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
): string {
  const parsed = parseDateSafe(value);
  if (!parsed) return fallback;
  return parsed.toLocaleDateString(undefined, options);
}

export function formatDateTimeSafe(value: unknown, fallback = 'Pending'): string {
  const parsed = parseDateSafe(value);
  if (!parsed) return fallback;
  return parsed.toLocaleString();
}

export function formatTimeSafe(value: unknown, fallback = ''): string {
  const parsed = parseDateSafe(value);
  if (!parsed) return fallback;
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Formats calendar dates using local year/month/day to avoid UTC timezone shifts.
 */
export function formatLocalYmd(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  const d = parseDateSafe(value);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function inferActorFromType(type: string): string {
  const lower = type.toLowerCase();
  if (lower.includes('ai') || lower.includes('review') || lower.includes('verdict')) {
    return 'AI Reviewer';
  }
  if (lower.includes('submit') || lower.includes('deliverable') || lower.includes('appeal')) {
    return 'Freelancer';
  }
  if (
    lower.includes('fund') ||
    lower.includes('payout') ||
    lower.includes('paypal') ||
    lower.includes('webhook')
  ) {
    return 'PayPal';
  }
  if (lower.includes('client') || lower.includes('object') || lower.includes('project_completed')) {
    return 'Client';
  }
  return 'System';
}

export function normalizeActivityEvent(raw: unknown, fallbackIndex = 0): NormalizedActivityEvent {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const type = String(row.type || row.kind || 'system');
  const timestamp = String(row.timestamp || row.ts || row.createdAt || '');
  const description = String(row.description || row.text || row.summary || type);
  const metadataRaw = row.metadata ?? row.meta;
  const metadata =
    metadataRaw && typeof metadataRaw === 'object' && !Array.isArray(metadataRaw)
      ? (metadataRaw as Record<string, unknown>)
      : undefined;

  return {
    id: String(row.id || `evt-${fallbackIndex}`),
    timestamp,
    type,
    actor: String(row.actor || inferActorFromType(type)),
    description,
    metadata,
  };
}

export function mapStatusToMoneyState(status?: string): MoneyState {
  switch (status) {
    case 'funded':
    case 'active':
      return 'funded';
    case 'in_review':
    case 'submitted':
    case 'appealed':
      return 'in_review';
    case 'awaiting_client':
    case 'approved':
    case 'needs_decision':
      return 'needs_decision';
    case 'changes_requested':
      return 'changes_requested';
    case 'releasing':
      return 'releasing';
    case 'paid':
    case 'closed':
      return 'paid';
    default:
      return 'agreed';
  }
}

export function isMilestoneSettled(status?: string): boolean {
  return status === 'paid' || status === 'closed';
}

export function isMilestoneFundedOrActive(status?: string): boolean {
  return (
    status === 'funded' ||
    status === 'in_review' ||
    status === 'submitted' ||
    status === 'changes_requested' ||
    status === 'awaiting_client' ||
    status === 'approved' ||
    status === 'releasing' ||
    status === 'appealed'
  );
}

export function deriveMilestoneProgressPercent(status?: string, persistedPercent?: number): number {
  const numeric = typeof persistedPercent === 'number' && !Number.isNaN(persistedPercent) ? persistedPercent : 0;
  if (
    status === 'paid' ||
    status === 'closed' ||
    status === 'approved' ||
    status === 'awaiting_client' ||
    status === 'releasing'
  ) {
    return 100;
  }
  if (status === 'in_review' || status === 'submitted' || status === 'appealed') {
    return Math.max(numeric, 75);
  }
  if (status === 'changes_requested') {
    return Math.max(numeric, 50);
  }
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

export function isProjectCompletedStatus(project: ProjectCategorizationInput): boolean {
  if (project.status === 'closed' || project.status === 'completed') {
    return true;
  }
  if (
    project.milestoneStats &&
    project.milestoneStats.total > 0 &&
    project.milestoneStats.paid >= project.milestoneStats.total
  ) {
    return true;
  }
  return false;
}

export function getProjectCategory(project: ProjectCategorizationInput): ProjectCategory {
  if (project.status === 'cancelled' || project.status === 'failed') {
    return 'cancelled';
  }
  if (isProjectCompletedStatus(project)) {
    return 'completed';
  }
  if (project.status === 'draft' || project.status === 'planned') {
    return 'draft';
  }
  return 'ongoing';
}

export function getProjectStatusBadgeInfo(project: ProjectCategorizationInput): ProjectStatusBadgeInfo {
  const category = getProjectCategory(project);
  if (category === 'cancelled') {
    return project.status === 'failed'
      ? { label: 'Failed', tone: 'red' }
      : { label: 'Cancelled', tone: 'red' };
  }
  if (category === 'completed') {
    return { label: 'Completed', tone: 'forest' };
  }
  if (category === 'ongoing') {
    return { label: 'Ongoing', tone: 'teal' };
  }
  if (project.status === 'planned') {
    return { label: 'Awaiting Funding', tone: 'amber' };
  }
  return { label: 'Draft', tone: 'neutral' };
}

export function getProjectStateSentence(
  project: ProjectCategorizationInput,
  role: 'client' | 'freelancer'
): string {
  const category = getProjectCategory(project);
  if (category === 'cancelled') {
    return project.status === 'failed' ? 'Project marked failed.' : 'Project cancelled.';
  }
  if (category === 'completed') {
    return 'All milestones verified and settled via PayPal.';
  }
  const balances = extractLedgerBalances(project);
  if (category === 'ongoing') {
    if (project.milestoneStats && project.milestoneStats.paid > 0) {
      return `${project.milestoneStats.paid} of ${project.milestoneStats.total} milestones settled via PayPal.`;
    }
    if (balances.heldCents > 0) {
      return role === 'client'
        ? 'Funded and active — freelancer delivering work.'
        : 'Funded and active — ready for milestone delivery.';
    }
    return 'Active project.';
  }
  if (project.status === 'planned') {
    return role === 'client'
      ? 'Plan agreed — fund holding account to unlock work.'
      : 'Plan agreed — awaiting client funding.';
  }
  return role === 'client'
    ? 'Draft plan ready for scope confirmation.'
    : 'Client is finalizing scope and milestones.';
}
