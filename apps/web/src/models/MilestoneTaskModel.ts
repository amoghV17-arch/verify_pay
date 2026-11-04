import { TaskModel } from '@bryntum/gantt';
import type { MilestoneStatus } from '@milestone/shared';

export interface AcceptanceCriterion {
  id: string;
  description: string;
  passed?: boolean;
  evidence?: string;
}

export class MilestoneTaskModel extends TaskModel {
  static override get fields() {
    return [
      { name: 'milestoneId', type: 'string' },
      { name: 'amountCents', type: 'integer' },
      { name: 'paymentStatus', type: 'string', defaultValue: 'unfunded' },
      { name: 'acceptanceCriteria', type: 'auto' },
      { name: 'deliverableType', type: 'string' },
    ];
  }

  declare milestoneId?: string;
  declare amountCents?: number;
  declare paymentStatus?: MilestoneStatus;
  declare acceptanceCriteria?: AcceptanceCriterion[];
  declare deliverableType?: string;
}

