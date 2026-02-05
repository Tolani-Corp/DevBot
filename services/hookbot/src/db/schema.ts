import { pgTable, text, timestamp, jsonb, boolean, integer, uuid } from 'drizzle-orm/pg-core';

/**
 * Workflows table
 * Stores workflow definitions
 */
export const workflows = pgTable('workflows', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  enabled: boolean('enabled').default(true),
  trigger: jsonb('trigger').notNull(), // { service: string, event: string }
  steps: jsonb('steps').notNull(), // Step[]
  config: jsonb('config'), // Additional configuration
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * Workflow executions table
 * Tracks workflow execution history
 */
export const executions = pgTable('executions', {
  id: uuid('id').primaryKey().defaultRandom(),
  workflowId: uuid('workflow_id').references(() => workflows.id),
  status: text('status').notNull(), // 'pending' | 'running' | 'success' | 'error'
  input: jsonb('input'),
  output: jsonb('output'),
  error: jsonb('error'),
  startedAt: timestamp('started_at').defaultNow(),
  finishedAt: timestamp('finished_at'),
  duration: integer('duration'), // milliseconds
});

/**
 * Webhooks table
 * Stores incoming webhooks
 */
export const webhooks = pgTable('webhooks', {
  id: uuid('id').primaryKey().defaultRandom(),
  service: text('service').notNull(), // 'jira', 'salesforce', etc.
  event: text('event').notNull(), // 'issue_created', 'case_updated', etc.
  payload: jsonb('payload').notNull(),
  headers: jsonb('headers'),
  verified: boolean('verified').default(false),
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

/**
 * Adapters table
 * Stores adapter configurations
 */
export const adapters = pgTable('adapters', {
  id: uuid('id').primaryKey().defaultRandom(),
  service: text('service').notNull().unique(), // 'jira', 'salesforce', etc.
  enabled: boolean('enabled').default(true),
  config: jsonb('config').notNull(), // Service-specific configuration
  credentials: jsonb('credentials'), // Encrypted credentials
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type Workflow = typeof workflows.$inferSelect;
export type NewWorkflow = typeof workflows.$inferInsert;

export type Execution = typeof executions.$inferSelect;
export type NewExecution = typeof executions.$inferInsert;

export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;

export type Adapter = typeof adapters.$inferSelect;
export type NewAdapter = typeof adapters.$inferInsert;

// ==========================================
// OUTREACH MODULE TABLES
// ==========================================

/**
 * Campaigns
 * The container for an outreach effort (e.g. "Cold Outreach Q1")
 */
export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  status: text('status').notNull().default('draft'), // 'draft', 'active', 'paused', 'completed'
  stats: jsonb('stats').default({ sent: 0, replied: 0, revenue: 0 }),
  config: jsonb('config').notNull().default({}), // dailyLimit, schedule, etc.
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * Sequences
 * Ordered list of steps (Email, Delay, Task)
 */
export const sequences = pgTable('sequences', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id').references(() => campaigns.id).notNull(),
  order: integer('order').notNull(), // 0, 1, 2...
  type: text('type').notNull(), // 'email', 'delay', 'task'
  config: jsonb('config').default({}), // For delay: { days: 2 } or for task: { type: 'manual_call' }
  createdAt: timestamp('created_at').defaultNow(),
});

/**
 * Variants (A/Z Testing)
 * The specific content versions for a sequence step.
 * Only applicable if sequence.type === 'email'
 */
export const variants = pgTable('variants', {
  id: uuid('id').primaryKey().defaultRandom(),
  sequenceId: uuid('sequence_id').references(() => sequences.id).notNull(),
  name: text('name').notNull(), // "Subject A", "Funny Intro"
  content: jsonb('content').notNull(), // { subject: "...", body: "..." }
  weight: integer('weight').notNull().default(100), // 0-100 probability
  status: text('status').notNull().default('active'), // 'active', 'paused' (auto-optimized)
  isControl: boolean('is_control').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

/**
 * Contacts
 * The targets of the campaign
 */
export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id').references(() => campaigns.id).notNull(),
  email: text('email').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  context: jsonb('context').default({}), // Variables for template replacement
  status: text('status').notNull().default('pending'), // 'pending', 'active', 'completed', 'bounced', 'replied'
  currentStep: integer('current_step').default(0),
  nextActionAt: timestamp('next_action_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * Analytics
 * Aggregated stats for optimization (Bandit Algorithm data)
 */
export const analytics = pgTable('analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  variantId: uuid('variant_id').references(() => variants.id).notNull(),
  sends: integer('sends').default(0),
  opens: integer('opens').default(0),
  clicks: integer('clicks').default(0),
  replies: integer('replies').default(0),
  bounces: integer('bounces').default(0),
  lastUpdated: timestamp('last_updated').defaultNow(),
});

// Type exports
export type Campaign = typeof campaigns.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Variant = typeof variants.$inferSelect;
export type Sequence = typeof sequences.$inferSelect;
export type Analytics = typeof analytics.$inferSelect;

