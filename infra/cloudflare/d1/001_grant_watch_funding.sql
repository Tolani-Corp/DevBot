CREATE TABLE IF NOT EXISTS grant_watch_runs (
  id TEXT PRIMARY KEY,
  source_truth_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  source_count INTEGER NOT NULL,
  opportunity_count INTEGER NOT NULL,
  review_task_count INTEGER NOT NULL,
  shortfall_count INTEGER NOT NULL,
  alert_count INTEGER NOT NULL,
  r2_snapshot_key TEXT,
  warnings_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS grant_watch_sources (
  run_id TEXT NOT NULL REFERENCES grant_watch_runs(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  url TEXT,
  cadence TEXT,
  priority TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (run_id, source_id)
);

CREATE TABLE IF NOT EXISTS grant_watch_opportunities (
  run_id TEXT NOT NULL REFERENCES grant_watch_runs(id) ON DELETE CASCADE,
  opportunity_id TEXT NOT NULL,
  source_truth_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT,
  fit TEXT NOT NULL,
  fit_score INTEGER NOT NULL,
  deadline TEXT NOT NULL,
  value TEXT NOT NULL,
  owner TEXT NOT NULL,
  risk TEXT NOT NULL,
  next_action TEXT NOT NULL,
  summary TEXT NOT NULL,
  eligibility_notes TEXT NOT NULL,
  restriction_notes TEXT NOT NULL,
  loe_tags_json TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (run_id, opportunity_id)
);

CREATE TABLE IF NOT EXISTS grant_watch_scores (
  run_id TEXT NOT NULL REFERENCES grant_watch_runs(id) ON DELETE CASCADE,
  opportunity_id TEXT NOT NULL,
  fit_score INTEGER NOT NULL,
  confidence INTEGER NOT NULL,
  factors_json TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (run_id, opportunity_id)
);

CREATE TABLE IF NOT EXISTS grant_watch_shortfalls (
  run_id TEXT NOT NULL REFERENCES grant_watch_runs(id) ON DELETE CASCADE,
  shortfall_id TEXT NOT NULL,
  opportunity_id TEXT NOT NULL,
  control_id TEXT NOT NULL,
  title TEXT NOT NULL,
  severity TEXT NOT NULL,
  trigger TEXT NOT NULL,
  mitigation TEXT NOT NULL,
  owner TEXT NOT NULL,
  PRIMARY KEY (run_id, shortfall_id)
);

CREATE TABLE IF NOT EXISTS grant_watch_memos (
  run_id TEXT NOT NULL REFERENCES grant_watch_runs(id) ON DELETE CASCADE,
  memo_id TEXT NOT NULL,
  opportunity_id TEXT NOT NULL,
  source_truth_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  confidence INTEGER NOT NULL,
  rationale_json TEXT NOT NULL DEFAULT '[]',
  required_approvals_json TEXT NOT NULL DEFAULT '[]',
  next_actions_json TEXT NOT NULL DEFAULT '[]',
  generated_at TEXT NOT NULL,
  PRIMARY KEY (run_id, memo_id)
);

CREATE TABLE IF NOT EXISTS grant_watch_review_tasks (
  run_id TEXT NOT NULL REFERENCES grant_watch_runs(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL,
  opportunity_id TEXT NOT NULL,
  source_truth_id TEXT NOT NULL,
  title TEXT NOT NULL,
  owner TEXT NOT NULL,
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  due_date TEXT,
  checklist_json TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (run_id, task_id)
);

CREATE TABLE IF NOT EXISTS grant_watch_deadline_alerts (
  run_id TEXT NOT NULL REFERENCES grant_watch_runs(id) ON DELETE CASCADE,
  alert_id TEXT NOT NULL,
  opportunity_id TEXT NOT NULL,
  alert_at TEXT NOT NULL,
  message TEXT NOT NULL,
  PRIMARY KEY (run_id, alert_id)
);

CREATE INDEX IF NOT EXISTS idx_grant_watch_runs_generated_at
  ON grant_watch_runs (generated_at);

CREATE INDEX IF NOT EXISTS idx_grant_watch_opportunities_score
  ON grant_watch_opportunities (fit_score);

CREATE INDEX IF NOT EXISTS idx_grant_watch_opportunities_risk
  ON grant_watch_opportunities (risk);

CREATE INDEX IF NOT EXISTS idx_grant_watch_shortfalls_severity
  ON grant_watch_shortfalls (severity);

CREATE INDEX IF NOT EXISTS idx_grant_watch_alerts_alert_at
  ON grant_watch_deadline_alerts (alert_at);
