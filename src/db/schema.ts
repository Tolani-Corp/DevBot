import { pgTable, text, timestamp, jsonb, boolean, integer } from "drizzle-orm/pg-core";
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
