CREATE TABLE IF NOT EXISTS metric_events (
  id BIGSERIAL PRIMARY KEY,
  schema_version TEXT NOT NULL,
  source TEXT NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  session_id TEXT NOT NULL,
  project_key TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  member_id TEXT,
  accepted_ai_lines INTEGER,
  commit_total_lines INTEGER,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS metric_snapshots (
  id BIGSERIAL PRIMARY KEY,
  scope TEXT NOT NULL,
  project_key TEXT NOT NULL,
  member_id TEXT NOT NULL DEFAULT '',
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  accepted_ai_lines INTEGER NOT NULL,
  commit_total_lines INTEGER NOT NULL,
  ai_output_rate DOUBLE PRECISION NOT NULL,
  session_count INTEGER NOT NULL,
  member_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scope, project_key, member_id, period_start, period_end)
);
