import { z } from 'zod';

// ==========================================
// 1. Core LLM Port Interfaces
// ==========================================

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema object
}

export interface LlmToolCall {
  id: string;
  name: string;
  arguments: string; // JSON encoded arguments string
}

export interface LlmCompletionRequest {
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  tools?: LlmToolDefinition[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  responseFormat?: 'json_object' | 'text';
}

export interface LlmCompletionResponse {
  content: string | null;
  toolCalls?: LlmToolCall[];
  provider: string;
  model: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  promptVersion?: string;
}

export interface LlmPort {
  readonly provider: string;
  readonly model: string;
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse>;
}

// ==========================================
// 2. Planner Schemas & Types
// ==========================================

export const CriterionSchema = z
  .string()
  .min(8, 'Acceptance criterion must be at least 8 characters')
  .max(200, 'Acceptance criterion cannot exceed 200 characters');

export const DeliverableTypeSchema = z.enum([
  'text',
  'repo',
  'url',
  'image',
  'document',
]);
export type DeliverableType = z.infer<typeof DeliverableTypeSchema>;

export const PlanTaskSchema = z.object({
  id: z.string().regex(/^t\d{1,2}$/, 'Task id must match format t1, t2, ...'),
  name: z.string().min(3, 'Task name must be at least 3 characters').max(80, 'Task name cannot exceed 80 characters'),
  durationDays: z
    .number()
    .min(0.5, 'Task duration must be at least 0.5 days')
    .max(10, 'Task duration cannot exceed 10 days')
    .refine((val) => val % 0.5 === 0, { message: 'Task duration must be a multiple of 0.5 days' }),
  dependsOn: z.array(z.string()).max(4, 'Task cannot have more than 4 dependencies'),
});
export type PlanTask = z.infer<typeof PlanTaskSchema>;

export const PlanMilestoneSchema = z.object({
  id: z.string().regex(/^m\d$/, 'Milestone id must match format m1, m2, ...'),
  name: z.string().min(3, 'Milestone name must be at least 3 characters').max(60, 'Milestone name cannot exceed 60 characters'),
  afterTaskIds: z.array(z.string()).min(1, 'Milestone must depend on at least 1 task'),
  paymentPercent: z
    .number()
    .int('Payment percent must be an integer')
    .min(5, 'Milestone payment percent must be at least 5%')
    .max(40, 'Milestone payment percent cannot exceed 40%'),
  deliverableType: DeliverableTypeSchema,
  acceptanceCriteria: z
    .array(CriterionSchema)
    .min(2, 'Milestone must have at least 2 acceptance criteria')
    .max(5, 'Milestone cannot have more than 5 acceptance criteria'),
  reviewHint: z.string().max(200, 'Review hint cannot exceed 200 characters'),
});
export type PlanMilestone = z.infer<typeof PlanMilestoneSchema>;

export const PlanSuccessSchema = z.object({
  error: z.undefined().optional(),
  projectTitle: z.string().min(3, 'Project title must be at least 3 characters').max(80, 'Project title cannot exceed 80 characters'),
  summary: z.string().max(400, 'Project summary cannot exceed 400 characters'),
  assumptions: z.array(z.string().max(200)).max(6, 'Assumptions cannot exceed 6 items'),
  currency: z.literal('USD'),
  totalBudget: z.number().positive('Total budget must be greater than zero'),
  tasks: z.array(PlanTaskSchema).min(6, 'Plan must contain at least 6 tasks').max(18, 'Plan cannot exceed 18 tasks'),
  milestones: z.array(PlanMilestoneSchema).min(3, 'Plan must contain at least 3 milestones').max(5, 'Plan cannot exceed 5 milestones'),
});
export type PlanSuccessOutput = z.infer<typeof PlanSuccessSchema>;

export const PlanErrorSchema = z.object({
  error: z.string().min(1).max(300),
  projectTitle: z.string().optional(),
  summary: z.string().optional(),
  assumptions: z.array(z.string()).optional(),
  currency: z.literal('USD').optional(),
  totalBudget: z.number().optional(),
  tasks: z.array(PlanTaskSchema).optional(),
  milestones: z.array(PlanMilestoneSchema).optional(),
});
export type PlanErrorOutput = z.infer<typeof PlanErrorSchema>;

export const PlanSchema = z.union([PlanSuccessSchema, PlanErrorSchema]);
export type PlanOutput = z.infer<typeof PlanSchema>;

// ==========================================
// 3. Computed / Scheduled Plan Representations
// ==========================================

export interface ScheduledTask extends PlanTask {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  milestoneId: string | null;
}

export interface ScheduledMilestone extends PlanMilestone {
  date: string; // YYYY-MM-DD
  amountCents: number;
}

export interface ComputedPlan {
  projectTitle: string;
  summary: string;
  assumptions: string[];
  currency: 'USD';
  totalBudget: number;
  totalCents: number;
  tasks: ScheduledTask[];
  milestones: ScheduledMilestone[];
  promptVersion: string;
}

