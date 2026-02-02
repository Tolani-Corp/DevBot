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
