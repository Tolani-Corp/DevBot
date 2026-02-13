CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text,
	"action" text NOT NULL,
	"details" jsonb,
	"slack_user_id" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"slack_thread_ts" text NOT NULL,
	"slack_channel_id" text NOT NULL,
	"context" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_slack_thread_ts_unique" UNIQUE("slack_thread_ts")
);
--> statement-breakpoint
CREATE TABLE "document_embeddings" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536)
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"repository" text NOT NULL,
	"file_path" text NOT NULL,
	"content" text NOT NULL,
	"last_hash" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"slack_thread_ts" text NOT NULL,
	"slack_channel_id" text NOT NULL,
	"slack_user_id" text NOT NULL,
	"task_type" text NOT NULL,
	"description" text NOT NULL,
	"repository" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"ai_response" text,
	"files_changed" jsonb,
	"pr_url" text,
	"commit_sha" text,
	"error" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"slack_team_id" text,
	"discord_guild_id" text,
	"platform_type" text NOT NULL,
	"bot_name" text DEFAULT 'DevBot' NOT NULL,
	"bot_mention" text,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"onboarding_completed_at" timestamp,
	"settings" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_slack_team_id_unique" UNIQUE("slack_team_id"),
	CONSTRAINT "workspaces_discord_guild_id_unique" UNIQUE("discord_guild_id")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_embeddings" ADD CONSTRAINT "document_embeddings_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_embeddings_vec" ON "document_embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_documents_repo_file" ON "documents" USING btree ("repository","file_path");