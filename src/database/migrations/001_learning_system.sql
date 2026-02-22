-- Migration: Add Learning System Tables
-- Created: 2026-02-22
-- Description: Adds tables for meta-learning capabilities

-- ───────────────────────────────────────────────────────────────
-- learned_patterns — Store detected patterns from historical analysis
-- ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS learned_patterns (
  id TEXT PRIMARY KEY,
  pattern_type TEXT NOT NULL, -- 'sequence', 'success', 'failure', 'agent_selection', 'time', 'dependency'
  
  -- Pattern details (JSONB for flexibility)
  pattern_data JSONB NOT NULL,
  
  -- Metadata
  frequency INTEGER NOT NULL DEFAULT 0,
  confidence DECIMAL(3,2) NOT NULL DEFAULT 0.5, -- 0.00 to 1.00
  sample_size INTEGER NOT NULL DEFAULT 0,
  
  -- Context
  repository TEXT,
  applicable_roles TEXT[], -- Array of AgentRole values
  task_types TEXT[],
  
  -- Timestamps
  first_detected_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_learned_patterns_type ON learned_patterns(pattern_type);
CREATE INDEX idx_learned_patterns_repo ON learned_patterns(repository);
CREATE INDEX idx_learned_patterns_confidence ON learned_patterns(confidence DESC);
CREATE INDEX idx_learned_patterns_last_seen ON learned_patterns(last_seen_at DESC);

-- ───────────────────────────────────────────────────────────────
-- strategy_experiments — Track A/B testing of orchestration strategies
-- ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS strategy_experiments (
  id TEXT PRIMARY KEY,
  
  -- Strategies being tested
  strategy_a_id TEXT NOT NULL,
  strategy_a_name TEXT NOT NULL,
  strategy_a_config JSONB NOT NULL,
  
  strategy_b_id TEXT NOT NULL,
  strategy_b_name TEXT NOT NULL,
  strategy_b_config JSONB NOT NULL,
  
  -- Experiment status
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'completed', 'cancelled'
  
  -- Results
  strategy_a_results JSONB NOT NULL DEFAULT '{}',
  strategy_b_results JSONB NOT NULL DEFAULT '{}',
  
  winner TEXT, -- 'A', 'B', 'tie', or NULL
  confidence DECIMAL(3,2), -- Statistical confidence 0.00 to 1.00
  sample_size INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_strategy_experiments_status ON strategy_experiments(status);
CREATE INDEX idx_strategy_experiments_started ON strategy_experiments(started_at DESC);

-- ───────────────────────────────────────────────────────────────
-- knowledge_entries — Persistent learning store
-- ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS knowledge_entries (
  id TEXT PRIMARY KEY,
  
  -- Entry classification
  entry_type TEXT NOT NULL, -- 'error_solution', 'best_practice', 'anti_pattern', 'codebase_pattern', 'optimization', 'recommendation'
  
  -- Content
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  
  -- Context (JSONB for flexible querying)
  context JSONB NOT NULL DEFAULT '{}',
  
  -- Metadata
  confidence TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'very_high'
  applicable_roles TEXT[] NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  
  -- Examples (JSONB array)
  examples JSONB NOT NULL DEFAULT '[]',
  
  -- Usage tracking
  usage_count INTEGER NOT NULL DEFAULT 0,
  validated_count INTEGER NOT NULL DEFAULT 0, -- Times knowledge proved helpful
  invalidated_count INTEGER NOT NULL DEFAULT 0, -- Times knowledge failed
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_knowledge_entries_type ON knowledge_entries(entry_type);
CREATE INDEX idx_knowledge_entries_confidence ON knowledge_entries(confidence);
CREATE INDEX idx_knowledge_entries_usage ON knowledge_entries(usage_count DESC);
CREATE INDEX idx_knowledge_entries_tags ON knowledge_entries USING GIN(tags);
CREATE INDEX idx_knowledge_entries_roles ON knowledge_entries USING GIN(applicable_roles);
CREATE INDEX idx_knowledge_entries_context ON knowledge_entries USING GIN(context);

-- ───────────────────────────────────────────────────────────────
-- agent_performance_history — Track individual agent performance for bandit
-- ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_performance_history (
  id TEXT PRIMARY KEY,
  
  -- Agent identification
  agent_role TEXT NOT NULL,
  
  -- Performance metrics (for bandit algorithm)
  successes INTEGER NOT NULL DEFAULT 1, -- Prior: 1 success
  failures INTEGER NOT NULL DEFAULT 1, -- Prior: 1 failure
  alpha DECIMAL(10,2) NOT NULL DEFAULT 1.0, -- Beta distribution parameter
  beta DECIMAL(10,2) NOT NULL DEFAULT 1.0, -- Beta distribution parameter
  estimated_success_rate DECIMAL(5,4) NOT NULL DEFAULT 0.5000,
  
  -- Context
  task_type TEXT,
  repository TEXT,
  
  -- Timestamps
  last_success_at TIMESTAMP,
  last_failure_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_performance_role ON agent_performance_history(agent_role);
CREATE INDEX idx_agent_performance_task_type ON agent_performance_history(task_type);
CREATE INDEX idx_agent_performance_repo ON agent_performance_history(repository);
CREATE INDEX idx_agent_performance_success_rate ON agent_performance_history(estimated_success_rate DESC);

-- ───────────────────────────────────────────────────────────────
-- Learning metadata and versioning
-- ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS learning_metadata (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Track schema version
INSERT INTO learning_metadata (key, value) VALUES 
  ('schema_version', '"1.0.0"'),
  ('last_pattern_analysis', 'null'),
  ('active_strategy_id', 'null'),
  ('total_patterns_learned', '0')
ON CONFLICT (key) DO NOTHING;

-- Grant permissions (adjust based on your user)
-- GRANT ALL ON learned_patterns TO devbot_user;
-- GRANT ALL ON strategy_experiments TO devbot_user;
-- GRANT ALL ON knowledge_entries TO devbot_user;
-- GRANT ALL ON agent_performance_history TO devbot_user;
-- GRANT ALL ON learning_metadata TO devbot_user;
