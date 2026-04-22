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
