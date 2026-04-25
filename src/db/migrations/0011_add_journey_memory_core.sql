ALTER TABLE workspaces
  ALTER COLUMN settings TYPE jsonb USING coalesce(settings, '{}'::jsonb);

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS memory_disclosure_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS memory_policy_updated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS journey_snapshots (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  snapshot_type TEXT NOT NULL,
  stage TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence INTEGER,
  source TEXT NOT NULL DEFAULT 'system',
  actor_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journey_snapshots_workspace_id
  ON journey_snapshots (workspace_id);

CREATE INDEX IF NOT EXISTS idx_journey_snapshots_task_id
  ON journey_snapshots (task_id);

CREATE INDEX IF NOT EXISTS idx_journey_snapshots_stage
  ON journey_snapshots (stage);

CREATE INDEX IF NOT EXISTS idx_journey_snapshots_created_at
  ON journey_snapshots (created_at);

CREATE TABLE IF NOT EXISTS memory_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  journey_snapshot_id TEXT REFERENCES journey_snapshots(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  importance INTEGER NOT NULL DEFAULT 50,
  content TEXT NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'system',
  actor_id TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memory_events_workspace_id
  ON memory_events (workspace_id);

CREATE INDEX IF NOT EXISTS idx_memory_events_task_id
  ON memory_events (task_id);

CREATE INDEX IF NOT EXISTS idx_memory_events_event_type
  ON memory_events (event_type);

CREATE INDEX IF NOT EXISTS idx_memory_events_recorded_at
  ON memory_events (recorded_at);
