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
  ingestion_key TEXT,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS metric_events_source_ingestion_key_unique
ON metric_events (source, ingestion_key)
WHERE ingestion_key IS NOT NULL;

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

CREATE TABLE IF NOT EXISTS enterprise_metric_snapshots (
  id BIGSERIAL PRIMARY KEY,
  metric_key TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  unit TEXT NOT NULL,
  confidence TEXT NOT NULL,
  scope TEXT NOT NULL,
  project_key TEXT NOT NULL,
  member_id TEXT NOT NULL DEFAULT '',
  team_key TEXT NOT NULL DEFAULT '',
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL,
  definition_version INTEGER NOT NULL,
  data_requirements TEXT[] NOT NULL,
  definition JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (
    metric_key,
    scope,
    project_key,
    member_id,
    team_key,
    period_start,
    period_end,
    definition_version
  )
);

CREATE TABLE IF NOT EXISTS governance_organizations (
  id BIGSERIAL PRIMARY KEY,
  organization_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS governance_teams (
  id BIGSERIAL PRIMARY KEY,
  team_key TEXT NOT NULL UNIQUE,
  organization_key TEXT NOT NULL REFERENCES governance_organizations (organization_key),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS governance_projects (
  id BIGSERIAL PRIMARY KEY,
  project_key TEXT NOT NULL UNIQUE,
  team_key TEXT NOT NULL REFERENCES governance_teams (team_key),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS governance_members (
  id BIGSERIAL PRIMARY KEY,
  member_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS governance_team_memberships (
  id BIGSERIAL PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES governance_members (member_id),
  team_key TEXT NOT NULL REFERENCES governance_teams (team_key),
  role TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, team_key)
);
