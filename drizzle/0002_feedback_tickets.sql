-- Migration: Add feedback_tickets table for persistent feedback loops
-- Created: 2026-03-04

CREATE TABLE IF NOT EXISTS "feedback_tickets" (
  "id" text PRIMARY KEY,
  "platform_type" text NOT NULL,
  "slack_team_id" text,
  "discord_guild_id" text,
  "channel_id" text,
  "thread_ts" text,
  "reporter_id" text,
  "topic" text NOT NULL DEFAULT 'general',
  "request_text" text NOT NULL,
  "status" text NOT NULL DEFAULT 'triaged',
  "next_step" text,
  "resolution_note" text,
  "metadata" jsonb,
  "created_at" timestamp NOT NULL DEFAULT NOW(),
  "updated_at" timestamp NOT NULL DEFAULT NOW(),
  "resolved_at" timestamp
);

CREATE INDEX IF NOT EXISTS "idx_feedback_tickets_status" ON "feedback_tickets" ("status");
CREATE INDEX IF NOT EXISTS "idx_feedback_tickets_platform" ON "feedback_tickets" ("platform_type");
CREATE INDEX IF NOT EXISTS "idx_feedback_tickets_created" ON "feedback_tickets" ("created_at");
