import { pgTable, text, timestamp, jsonb, boolean, integer, vector, index, uniqueIndex } from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";

export const tasks = pgTable("tasks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  slackThreadTs: text("slack_thread_ts").notNull(),
  slackChannelId: text("slack_channel_id").notNull(),
  slackUserId: text("slack_user_id").notNull(),

  taskType: text("task_type").notNull(), // "bug_fix", "feature", "question", "review"
  description: text("description").notNull(),
  repository: text("repository"),

  status: text("status").notNull().default("pending"), // pending, analyzing, working, completed, failed
  progress: integer("progress").notNull().default(0), // 0-100

  aiResponse: text("ai_response"),
  filesChanged: jsonb("files_changed").$type<string[]>(),
  prUrl: text("pr_url"),
  commitSha: text("commit_sha"),

  // ClickUp integration — links DevBot tasks to ClickUp for bidirectional sync
  clickUpTaskId: text("clickup_task_id"),

  error: text("error"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const conversations = pgTable("conversations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  slackThreadTs: text("slack_thread_ts").notNull().unique(),
  slackChannelId: text("slack_channel_id").notNull(),

  context: jsonb("context").$type<{
    repository?: string;
    branch?: string;
    files?: string[];
    previousMessages?: Array<{ role: string; content: string }>;
  }>(),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  taskId: text("task_id").references(() => tasks.id),

  action: text("action").notNull(), // "file_read", "file_write", "git_commit", "pr_created"
  details: jsonb("details").$type<Record<string, unknown>>(),

  slackUserId: text("slack_user_id"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;

export const documents = pgTable("documents", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  repository: text("repository").notNull(),
  filePath: text("file_path").notNull(),
  content: text("content").notNull(),
  lastHash: text("last_hash").notNull(), // to detect changes
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  repoFileIdx: uniqueIndex("idx_documents_repo_file").on(t.repository, t.filePath),
}));

export const documentEmbeddings = pgTable("document_embeddings", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  documentId: text("document_id")
    .references(() => documents.id, { onDelete: "cascade" })
    .notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(), // the chunk text
  embedding: vector("embedding", { dimensions: 1536 }),
}, (t) => ({
  embeddingIdx: index("idx_embeddings_vec").using("hnsw", t.embedding.op("vector_cosine_ops")),
}));

export type Document = typeof documents.$inferSelect;
export type DocumentEmbedding = typeof documentEmbeddings.$inferSelect;

// Workspace preferences for customization
export const workspaces = pgTable("workspaces", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  
  // Platform identifiers
  slackTeamId: text("slack_team_id").unique(),
  discordGuildId: text("discord_guild_id").unique(),
  platformType: text("platform_type").notNull(), // "slack", "discord", "vscode", etc.
  
  // Customization
  botName: text("bot_name").notNull().default("Debo"), // Custom name for the bot
  botMention: text("bot_mention"), // Custom mention handle like "@Debo"
  
  // Onboarding
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  onboardingCompletedAt: timestamp("onboarding_completed_at"),
  
  // ── Billing / Tier ─────────────────────────────────────────────────────────
  tier: text("tier").$type<"free" | "pro" | "team" | "enterprise">().notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  stripePriceId: text("stripe_price_id"),
  billingStatus: text("billing_status").$type<"active" | "past_due" | "canceled" | "trialing">().default("active"),
  currentPeriodEnd: timestamp("current_period_end"),
  // Monthly usage counter — reset by billing period, not calendar month
  tasksUsedThisMonth: integer("tasks_used_this_month").notNull().default(0),
  usageResetAt: timestamp("usage_reset_at"),

  // Settings
  settings: jsonb("settings").$type<{
    autoRespond?: boolean;
    notificationPreferences?: string[];
    defaultRepository?: string;
    theme?: string;
  }>(),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;

// Reasoning traces — captures agent decision-making steps for transparency
export const reasoningTraces = pgTable("reasoning_traces", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  taskId: text("task_id")
    .references(() => tasks.id, { onDelete: "cascade" })
    .notNull(),
  agentRole: text("agent_role"), // "frontend", "backend", "orchestrator", etc.
  
  steps: jsonb("steps").$type<Array<{
    id: string;
    type: "thought" | "action" | "observation" | "reflection";
    timestamp: string;
    content: string;
    confidence?: number;
    alternatives?: string[];
    metadata?: Record<string, unknown>;
    parentStepId?: string;
  }>>().notNull(),
  
  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),
  totalSteps: integer("total_steps").notNull().default(0),
  
  success: boolean("success").notNull().default(false),
  finalDecision: text("final_decision"),
  
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  taskIdIdx: index("idx_reasoning_traces_task_id").on(t.taskId),
  agentRoleIdx: index("idx_reasoning_traces_agent_role").on(t.agentRole),
}));

export type ReasoningTrace = typeof reasoningTraces.$inferSelect;
export type NewReasoningTrace = typeof reasoningTraces.$inferInsert;

// ═══════════════════════════════════════════════════════════════
// Learning System Tables — Meta-learning capabilities
// ═══════════════════════════════════════════════════════════════

export const learnedPatterns = pgTable("learned_patterns", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  patternType: text("pattern_type").notNull(), // 'sequence', 'success', 'failure', 'agent_selection', 'time', 'dependency'
  patternData: jsonb("pattern_data").notNull().$type<Record<string, unknown>>(),
  
  frequency: integer("frequency").notNull().default(0),
  confidence: integer("confidence").notNull().default(50), // 0-100
  sampleSize: integer("sample_size").notNull().default(0),
  
  repository: text("repository"),
  applicableRoles: text("applicable_roles").array(),
  taskTypes: text("task_types").array(),
  
  firstDetectedAt: timestamp("first_detected_at").notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  typeIdx: index("idx_learned_patterns_type").on(t.patternType),
  repoIdx: index("idx_learned_patterns_repo").on(t.repository),
  confidenceIdx: index("idx_learned_patterns_confidence").on(t.confidence),
}));

export type LearnedPattern = typeof learnedPatterns.$inferSelect;
export type NewLearnedPattern = typeof learnedPatterns.$inferInsert;

export const strategyExperiments = pgTable("strategy_experiments", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  
  strategyAId: text("strategy_a_id").notNull(),
  strategyAName: text("strategy_a_name").notNull(),
  strategyAConfig: jsonb("strategy_a_config").notNull().$type<Record<string, unknown>>(),
  
  strategyBId: text("strategy_b_id").notNull(),
  strategyBName: text("strategy_b_name").notNull(),
  strategyBConfig: jsonb("strategy_b_config").notNull().$type<Record<string, unknown>>(),
  
  status: text("status").notNull().default("running"), // 'running', 'completed', 'cancelled'
  
  strategyAResults: jsonb("strategy_a_results").notNull().default({}).$type<Record<string, unknown>>(),
  strategyBResults: jsonb("strategy_b_results").notNull().default({}).$type<Record<string, unknown>>(),
  
  winner: text("winner"), // 'A', 'B', 'tie', or null
  confidence: integer("confidence"), // 0-100
  sampleSize: integer("sample_size").notNull().default(0),
  
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  statusIdx: index("idx_strategy_experiments_status").on(t.status),
  startedIdx: index("idx_strategy_experiments_started").on(t.startedAt),
}));

export type StrategyExperiment = typeof strategyExperiments.$inferSelect;
export type NewStrategyExperiment = typeof strategyExperiments.$inferInsert;

export const knowledgeEntries = pgTable("knowledge_entries", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  
  entryType: text("entry_type").notNull(), // 'error_solution', 'best_practice', 'anti_pattern', etc.
  
  title: text("title").notNull(),
  description: text("description").notNull(),
  
  context: jsonb("context").notNull().default({}).$type<Record<string, unknown>>(),
  
  confidence: text("confidence").notNull().default("medium"), // 'low', 'medium', 'high', 'very_high'
  applicableRoles: text("applicable_roles").array().notNull().default([]),
  tags: text("tags").array().notNull().default([]),
  
  examples: jsonb("examples").notNull().default([]).$type<Array<Record<string, unknown>>>(),
  
  usageCount: integer("usage_count").notNull().default(0),
  validatedCount: integer("validated_count").notNull().default(0),
  invalidatedCount: integer("invalidated_count").notNull().default(0),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  typeIdx: index("idx_knowledge_entries_type").on(t.entryType),
  confidenceIdx: index("idx_knowledge_entries_confidence").on(t.confidence),
  usageIdx: index("idx_knowledge_entries_usage").on(t.usageCount),
}));

export type KnowledgeEntry = typeof knowledgeEntries.$inferSelect;
export type NewKnowledgeEntry = typeof knowledgeEntries.$inferInsert;

export const agentPerformanceHistory = pgTable("agent_performance_history", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  
  agentRole: text("agent_role").notNull(),
  
  successes: integer("successes").notNull().default(1),
  failures: integer("failures").notNull().default(1),
  alpha: integer("alpha").notNull().default(1), // Store as integer (multiply by 100)
  beta: integer("beta").notNull().default(1),
  estimatedSuccessRate: integer("estimated_success_rate").notNull().default(50), // 0-100
  
  taskType: text("task_type"),
  repository: text("repository"),
  
  lastSuccessAt: timestamp("last_success_at"),
  lastFailureAt: timestamp("last_failure_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  roleIdx: index("idx_agent_performance_role").on(t.agentRole),
  taskTypeIdx: index("idx_agent_performance_task_type").on(t.taskType),
  repoIdx: index("idx_agent_performance_repo").on(t.repository),
}));

export type AgentPerformance = typeof agentPerformanceHistory.$inferSelect;
export type NewAgentPerformance = typeof agentPerformanceHistory.$inferInsert;
