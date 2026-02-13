-- Migration: Add workspaces table for bot personalization
-- Created: 2026-02-13

-- Create workspaces table
CREATE TABLE IF NOT EXISTS "workspaces" (
  "id" text PRIMARY KEY,
  "slack_team_id" text UNIQUE,
  "discord_guild_id" text UNIQUE,
  "platform_type" text NOT NULL,
  "bot_name" text NOT NULL DEFAULT 'DevBot',
  "bot_mention" text,
  "onboarding_completed" boolean NOT NULL DEFAULT false,
  "onboarding_completed_at" timestamp,
  "settings" jsonb,
  "created_at" timestamp NOT NULL DEFAULT NOW(),
  "updated_at" timestamp NOT NULL DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS "idx_workspaces_slack_team" ON "workspaces" ("slack_team_id");
CREATE INDEX IF NOT EXISTS "idx_workspaces_discord_guild" ON "workspaces" ("discord_guild_id");
CREATE INDEX IF NOT EXISTS "idx_workspaces_platform" ON "workspaces" ("platform_type");
