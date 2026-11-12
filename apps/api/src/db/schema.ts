import {
  pgTable,
  text,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql, relations } from 'drizzle-orm';

// --- Users (Accounts supporting both Client & Freelancer project memberships) ---
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  avatar: text('avatar'),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  passwordHash: text('password_hash'),
  displayName: text('display_name'),
  company: text('company'),
  avatarColor: text('avatar_color').default('#337D70').notNull(),
  lastWorkspace: text('last_workspace').default('client').notNull(), // 'client' | 'freelancer'
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  isDemo: boolean('is_demo').default(false).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  payoutPaypalEmail: text('payout_paypal_email'),
  payoutEmailChangedAt: timestamp('payout_email_changed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- Sessions (Opaque server-side sessions, hashed token) ---
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipHash: text('ip_hash'),
  userAgentSummary: text('user_agent_summary'),
  slot: text('slot'), // null or 'client' | 'freelancer' when DEMO_MODE=true
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

// --- Email Verification & Password Reset Tokens (Hashed, single-use) ---
export const emailTokens = pgTable('email_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type: text('type').notNull(), // 'verify' | 'reset'
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- Auth Events (Security audit trail) ---
export const authEvents = pgTable('auth_events', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  type: text('type').notNull(),
  at: timestamp('at', { withTimezone: true }).defaultNow().notNull(),
  ipHash: text('ip_hash'),
  meta: jsonb('meta'),
});

// --- Notifications ---
export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type: text('type').notNull(),
  projectId: text('project_id'),
  milestoneId: text('milestone_id'),
  payload: jsonb('payload').notNull(),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- Notification Preferences ---
export const notificationPrefs = pgTable('notification_prefs', {
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .primaryKey(),
  emailInviteAccepted: boolean('email_invite_accepted').default(true).notNull(),
  emailFunded: boolean('email_funded').default(true).notNull(),
  emailSubmitted: boolean('email_submitted').default(true).notNull(),
  emailReviewed: boolean('email_reviewed').default(true).notNull(),
  emailReleasePending: boolean('email_release_pending').default(true).notNull(),
  emailChangesRequested: boolean('email_changes_requested').default(true).notNull(),
  emailPaid: boolean('email_paid').default(true).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- Email Outbox ---
export const emailOutbox = pgTable('email_outbox', {
  id: text('id').primaryKey(),
  toAddress: text('to_address').notNull(),
  recipientUserId: text('recipient_user_id'),
  template: text('template').notNull(),
  subject: text('subject').notNull(),
  bodyText: text('body_text').notNull(),
  bodyHtml: text('body_html').notNull(),
  status: text('status').notNull(),
  providerId: text('provider_id'),
  deliveredVia: text('delivered_via').notNull(), // 'outbox' | 'resend' | 'smtp'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- OAuth Identities (Optional Google OAuth) ---
export const oauthIdentities = pgTable(
  'oauth_identities',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    provider: text('provider').notNull(), // 'google'
    subject: text('subject').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    providerSubjectUnique: uniqueIndex('oauth_identities_provider_subject_uidx').on(
      table.provider,
      table.subject
    ),
  })
);

// --- Projects ---
export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  brief: text('brief').notNull(),
  currency: text('currency').default('USD').notNull(),
  totalCents: integer('total_cents').default(0).notNull(),
  status: text('status').default('draft').notNull(), // 'draft' | 'planned' | 'funded' | 'active' | 'closed' | 'cancelled'
  autonomyMode: text('autonomy_mode').default('assisted').notNull(), // 'manual' | 'assisted' | 'auto'
  releaseWindowSeconds: integer('release_window_seconds').default(20).notNull(),
  clientId: text('client_id').references(() => users.id).notNull(),
  freelancerId: text('freelancer_id').references(() => users.id),
  freelancerPaypalEmail: text('freelancer_paypal_email'),
  isDemo: boolean('is_demo').default(false).notNull(),
  planJson: jsonb('plan_json'),
  planPromptVersion: text('plan_prompt_version'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  version: integer('version').default(1).notNull(),
});

// --- Tasks ---
export const tasks = pgTable('tasks', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  parentId: text('parent_id'),
  name: text('name').notNull(),
  startDate: text('start_date').notNull(),
  durationDays: real('duration_days').default(1).notNull(),
  percentDone: integer('percent_done').default(0).notNull(),
  milestoneId: text('milestone_id'),
  sortOrder: integer('sort_order').default(0).notNull(),
  bryntumExt: jsonb('bryntum_ext'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  version: integer('version').default(1).notNull(),
});

// --- Dependencies ---
export const dependencies = pgTable('dependencies', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  fromTaskId: text('from_task_id').references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
  toTaskId: text('to_task_id').references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
  type: integer('type').default(2).notNull(), // Bryntum DependencyType (2 = Finish-to-Start)
  lag: integer('lag').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- Milestones ---
export const milestones = pgTable('milestones', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  taskId: text('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  amountCents: integer('amount_cents').notNull(),
  percent: integer('percent').notNull(),
  criteria: jsonb('criteria').notNull(), // Array<{ id: string, description: string, passed?: boolean, evidence?: string }>
  deliverableType: text('deliverable_type').default('document').notNull(), // 'text' | 'repo' | 'url' | 'image' | 'document' | 'figma'
  status: text('status').default('unfunded').notNull(), // MilestoneStatuses
  releaseAt: timestamp('release_at', { withTimezone: true }),
  approvedBy: text('approved_by'), // 'ai' | 'client'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  version: integer('version').default(1).notNull(),
});

// --- Deliverables ---
export const deliverables = pgTable('deliverables', {
  id: text('id').primaryKey(),
  milestoneId: text('milestone_id').references(() => milestones.id, { onDelete: 'cascade' }).notNull(),
  kind: text('kind').notNull(), // 'text' | 'repo' | 'url' | 'image' | 'document' | 'figma'
  payload: jsonb('payload').notNull(),
  submittedBy: text('submitted_by').references(() => users.id).notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- Reviews ---
export const reviews = pgTable('reviews', {
  id: text('id').primaryKey(),
  milestoneId: text('milestone_id').references(() => milestones.id, { onDelete: 'cascade' }).notNull(),
  deliverableId: text('deliverable_id').references(() => deliverables.id, { onDelete: 'cascade' }).notNull(),
  kind: text('kind').default('initial').notNull(), // 'initial' | 'appeal'
  model: text('model').notNull(),
  promptVersion: text('prompt_version').notNull(),
  trace: jsonb('trace'),
  criteriaResults: jsonb('criteria_results'),
  verdict: text('verdict').notNull(), // 'release' | 'request_changes' | 'escalate_to_human'
  minConfidence: real('min_confidence').notNull(),
  injectionSuspected: boolean('injection_suspected').default(false).notNull(),
  latencyMs: integer('latency_ms'),
  tokens: jsonb('tokens'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- Ledger Entries ---
export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
    milestoneId: text('milestone_id').references(() => milestones.id, { onDelete: 'set null' }),
    type: text('type').notNull(), // 'funded' | 'release_pending' | 'released' | 'release_failed' | 'refunded'
    amountCents: integer('amount_cents').notNull(),
    paypalRef: text('paypal_ref'),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    meta: jsonb('meta'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // Partial unique index enforcing invariant 2: At most one 'released' entry per milestone
    oneReleasedPerMilestone: uniqueIndex('one_released_per_milestone')
      .on(table.milestoneId)
      .where(sql`type = 'released'`),
  })
);

// --- Payout Batches ---
export const payoutBatches = pgTable('payout_batches', {
  id: text('id').primaryKey(),
  milestoneId: text('milestone_id').references(() => milestones.id, { onDelete: 'cascade' }).notNull(),
  senderBatchId: text('sender_batch_id').notNull().unique(),
  paypalBatchId: text('paypal_batch_id'),
  status: text('status').notNull(),
  raw: jsonb('raw'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- PayPal Events ---
export const paypalEvents = pgTable('paypal_events', {
  id: text('id').primaryKey(),
  paypalEventId: text('paypal_event_id').notNull().unique(),
  type: text('type').notNull(),
  payload: jsonb('payload').notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- Activity Log ---
export const activity = pgTable('activity', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  actor: text('actor').notNull(), // 'client' | 'freelancer' | 'ai' | 'system'
  kind: text('kind').notNull(),
  text: text('text').notNull(),
  meta: jsonb('meta'),
  ts: timestamp('ts', { withTimezone: true }).defaultNow().notNull(),
});

// --- Invites ---
export const invites = pgTable('invites', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  invitedEmail: text('invited_email'),
  tokenHash: text('token_hash').notNull(),
  codeHash: text('code_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  maxUses: integer('max_uses').default(1).notNull(),
  usedCount: integer('used_count').default(0).notNull(),
  acceptedBy: text('accepted_by').references(() => users.id, { onDelete: 'set null' }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- Receipt Shares ---
export const receiptShares = pgTable('receipt_shares', {
  id: text('id').primaryKey(),
  milestoneId: text('milestone_id').references(() => milestones.id, { onDelete: 'cascade' }).notNull(),
  shareIdHash: text('share_id_hash').notNull(),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- External Calls (Instrumentation) ---
export const externalCalls = pgTable('external_calls', {
  id: text('id').primaryKey(),
  at: timestamp('at', { withTimezone: true }).defaultNow().notNull(),
  service: text('service').notNull(), // 'paypal' | 'llm' | 'github'
  method: text('method').notNull(),
  endpointTemplate: text('endpoint_template').notNull(),
  status: integer('status'),
  durationMs: integer('duration_ms').notNull(),
  requestId: text('request_id'),
  providerDebugId: text('provider_debug_id'),
  projectId: text('project_id'),
  milestoneId: text('milestone_id'),
  ok: boolean('ok').notNull(),
  errorCode: text('error_code'),
  meta: jsonb('meta'), // { model, inputTokens, outputTokens } - NEVER bodies or secrets
});

// --- Relations ---
export const projectsRelations = relations(projects, ({ one, many }) => ({
  client: one(users, { fields: [projects.clientId], references: [users.id] }),
  freelancer: one(users, { fields: [projects.freelancerId], references: [users.id] }),
  tasks: many(tasks),
  dependencies: many(dependencies),
  milestones: many(milestones),
  ledgerEntries: many(ledgerEntries),
  activity: many(activity),
  invites: many(invites),
}));

export const invitesRelations = relations(invites, ({ one }) => ({
  project: one(projects, { fields: [invites.projectId], references: [projects.id] }),
  creator: one(users, { fields: [invites.createdBy], references: [users.id] }),
  acceptor: one(users, { fields: [invites.acceptedBy], references: [users.id] }),
}));

export const receiptSharesRelations = relations(receiptShares, ({ one }) => ({
  milestone: one(milestones, { fields: [receiptShares.milestoneId], references: [milestones.id] }),
  creator: one(users, { fields: [receiptShares.createdBy], references: [users.id] }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  fromDependencies: many(dependencies, { relationName: 'fromTask' }),
  toDependencies: many(dependencies, { relationName: 'toTask' }),
}));

export const dependenciesRelations = relations(dependencies, ({ one }) => ({
  project: one(projects, { fields: [dependencies.projectId], references: [projects.id] }),
  fromTask: one(tasks, { fields: [dependencies.fromTaskId], references: [tasks.id], relationName: 'fromTask' }),
  toTask: one(tasks, { fields: [dependencies.toTaskId], references: [tasks.id], relationName: 'toTask' }),
}));

export const milestonesRelations = relations(milestones, ({ one, many }) => ({
  project: one(projects, { fields: [milestones.projectId], references: [projects.id] }),
  task: one(tasks, { fields: [milestones.taskId], references: [tasks.id] }),
  deliverables: many(deliverables),
  reviews: many(reviews),
  ledgerEntries: many(ledgerEntries),
  receiptShares: many(receiptShares),
}));

