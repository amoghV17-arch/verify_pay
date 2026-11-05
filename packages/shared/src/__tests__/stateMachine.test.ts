import { describe, it, expect } from 'vitest';
import {
  MilestoneStatuses,
  VALID_TRANSITIONS,
  canTransition,
  assertTransition,
  type MilestoneStatus,
} from '../stateMachine.js';

describe('MilestoneStatuses', () => {
  it('contains all 10 expected statuses', () => {
    expect(MilestoneStatuses).toHaveLength(10);
    expect(MilestoneStatuses).toContain('unfunded');
    expect(MilestoneStatuses).toContain('funded');
    expect(MilestoneStatuses).toContain('submitted');
    expect(MilestoneStatuses).toContain('in_review');
    expect(MilestoneStatuses).toContain('changes_requested');
    expect(MilestoneStatuses).toContain('awaiting_client');
    expect(MilestoneStatuses).toContain('approved');
    expect(MilestoneStatuses).toContain('releasing');
    expect(MilestoneStatuses).toContain('paid');
    expect(MilestoneStatuses).toContain('appealed');
  });
});

describe('VALID_TRANSITIONS', () => {
  it('has an entry for every status', () => {
    for (const status of MilestoneStatuses) {
      expect(Object.prototype.hasOwnProperty.call(VALID_TRANSITIONS, status)).toBe(true);
    }
  });

  it('paid is a terminal state with no outgoing transitions', () => {
    expect(VALID_TRANSITIONS.paid).toHaveLength(0);
  });
});

describe('canTransition — valid paths', () => {
  const validCases: [MilestoneStatus, MilestoneStatus][] = [
    ['unfunded', 'funded'],
    ['funded', 'submitted'],
    ['submitted', 'in_review'],
    ['in_review', 'changes_requested'],
    ['in_review', 'awaiting_client'],
    ['in_review', 'approved'],
    ['changes_requested', 'submitted'],
    ['changes_requested', 'appealed'],
    ['awaiting_client', 'approved'],
    ['awaiting_client', 'changes_requested'],
    ['approved', 'releasing'],
    ['approved', 'changes_requested'], // client objection during assisted release window
    ['releasing', 'paid'],
    ['releasing', 'approved'], // payout failure rollback
    ['appealed', 'approved'],
    ['appealed', 'awaiting_client'],
  ];

  for (const [from, to] of validCases) {
    it(`${from} → ${to}`, () => {
      expect(canTransition(from, to)).toBe(true);
    });
  }
});

describe('canTransition — invalid paths', () => {
  const invalidCases: [MilestoneStatus, MilestoneStatus][] = [
    ['paid', 'approved'],
    ['paid', 'funded'],
    ['unfunded', 'approved'],
    ['unfunded', 'in_review'],
    ['funded', 'in_review'],        // must go funded → submitted → in_review
    ['funded', 'approved'],
    ['submitted', 'approved'],      // must go through in_review
    ['submitted', 'funded'],
    ['in_review', 'funded'],
    ['in_review', 'releasing'],
    ['approved', 'funded'],
    ['approved', 'submitted'],
    ['releasing', 'funded'],
    ['releasing', 'changes_requested'],
    ['changes_requested', 'paid'],
  ];

  for (const [from, to] of invalidCases) {
    it(`${from} → ${to} returns false`, () => {
      expect(canTransition(from, to)).toBe(false);
    });
  }
});

describe('assertTransition', () => {
  it('does not throw for a valid transition', () => {
    expect(() => assertTransition('funded', 'submitted')).not.toThrow();
  });

  it('throws for an invalid transition with a descriptive message', () => {
    expect(() => assertTransition('paid', 'funded')).toThrowError(
      /Invalid milestone state transition: "paid" -> "funded"/
    );
  });

  it('throws for every invalid same-state self-loop', () => {
    for (const status of MilestoneStatuses) {
      expect(() => assertTransition(status, status)).toThrow();
    }
  });
});

