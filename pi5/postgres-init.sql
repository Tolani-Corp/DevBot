-- ─── PostgreSQL 16 init — DevBot Pi 5 ─────────────────────────────────────────
-- Run once on fresh DB init (docker-entrypoint-initdb.d or manually)

-- Enable useful extensions
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";  -- Query performance stats
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";            -- uuid_generate_v4() helper

-- hstore for flexible key-value columns (NATT finding metadata)
CREATE EXTENSION IF NOT EXISTS "hstore";

-- Grant stats access to devbot user
GRANT SELECT ON pg_stat_statements TO devbot;

-- Configure pg_stat_statements for DevBot query profiling
ALTER SYSTEM SET pg_stat_statements.max = 5000;
ALTER SYSTEM SET pg_stat_statements.track = 'all';
