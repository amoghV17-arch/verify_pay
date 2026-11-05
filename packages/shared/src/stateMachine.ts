/**
 * Milestone status state machine per docs/ARCHITECTURE.md section 6.
 * Transitions in this module are the only sanctioned way status changes.
 */

export const MilestoneStatuses = [
  'unfunded',
  'funded',
  'submitted',
  'in_review',
  'changes_requested',
  'awaiting_client',
  'approved',
  'releasing',
  'paid',
  'appealed',
] as const;

export type MilestoneStatus = (typeof MilestoneStatuses)[number];

export const VALID_TRANSITIONS: Record<MilestoneStatus, readonly MilestoneStatus[]> = {
  unfunded: ['funded'],
  funded: ['submitted'],
  submitted: ['in_review'],
  in_review: ['changes_requested', 'awaiting_client', 'approved'],
  changes_requested: ['submitted', 'appealed'],
  awaiting_client: ['approved', 'changes_requested'],
  approved: ['releasing', 'changes_requested'], // changes_requested on client objection during release window
  releasing: ['paid', 'approved'], // approved on payout failure/retry
  paid: [],
  appealed: ['approved', 'awaiting_client'],
};

export function canTransition(current: MilestoneStatus, next: MilestoneStatus): boolean {
  const allowed = VALID_TRANSITIONS[current];
  return allowed ? allowed.includes(next) : false;
}

export function assertTransition(current: MilestoneStatus, next: MilestoneStatus): void {
  if (!canTransition(current, next)) {
    throw new Error(`Invalid milestone state transition: "${current}" -> "${next}"`);
  }
}

