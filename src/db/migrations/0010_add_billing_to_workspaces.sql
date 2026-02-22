-- Migration: add billing columns to workspaces table
-- Generated: 2026-02-22
-- Run: node dist/db/migrate.js (or psql -f this file)
--
-- Safe to run multiple times (all changes are additive).

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS tier                TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS stripe_customer_id  TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_price_id     TEXT,
  ADD COLUMN IF NOT EXISTS billing_status      TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS current_period_end  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tasks_used_this_month INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usage_reset_at      TIMESTAMPTZ;

-- Update default bot name from DevBot → Debo for any un-customised workspaces
UPDATE workspaces
  SET bot_name = 'Debo'
  WHERE bot_name = 'DevBot';

-- Index for fast Stripe customer lookups
CREATE INDEX IF NOT EXISTS idx_workspaces_stripe_customer
  ON workspaces (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Index for fast subscription lookups (webhook processing)
CREATE INDEX IF NOT EXISTS idx_workspaces_stripe_subscription
  ON workspaces (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
