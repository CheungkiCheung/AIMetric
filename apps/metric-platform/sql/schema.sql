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

CREATE TABLE IF NOT EXISTS github_pull_requests (
  id BIGSERIAL PRIMARY KEY,
  project_key TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  pr_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  author_member_id TEXT,
  state TEXT NOT NULL,
  ai_touched BOOLEAN NOT NULL DEFAULT FALSE,
  review_decision TEXT,
  requirement_keys TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL,
  merged_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (project_key, repo_name, pr_number)
);

CREATE TABLE IF NOT EXISTS delivery_requirements (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  project_key TEXT NOT NULL,
  requirement_key TEXT NOT NULL,
  title TEXT NOT NULL,
  owner_member_id TEXT,
  priority TEXT,
  status TEXT NOT NULL,
  ai_touched BOOLEAN NOT NULL DEFAULT FALSE,
  first_pr_created_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (provider, project_key, requirement_key)
);

CREATE TABLE IF NOT EXISTS ci_runs (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  project_key TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  run_id BIGINT NOT NULL,
  workflow_name TEXT NOT NULL,
  status TEXT NOT NULL,
  conclusion TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (provider, project_key, repo_name, run_id)
);

CREATE TABLE IF NOT EXISTS deployment_runs (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  project_key TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  deployment_id TEXT NOT NULL,
  environment TEXT NOT NULL,
  status TEXT NOT NULL,
  ai_touched BOOLEAN NOT NULL DEFAULT FALSE,
  rolled_back BOOLEAN NOT NULL DEFAULT FALSE,
  incident_key TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (provider, project_key, repo_name, deployment_id)
);

CREATE TABLE IF NOT EXISTS incident_records (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  project_key TEXT NOT NULL,
  incident_key TEXT NOT NULL,
  title TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL,
  linked_deployment_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (provider, project_key, incident_key)
);

CREATE TABLE IF NOT EXISTS defect_records (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  project_key TEXT NOT NULL,
  defect_key TEXT NOT NULL,
  title TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL,
  found_in_phase TEXT NOT NULL,
  linked_requirement_keys TEXT[] NOT NULL DEFAULT '{}',
  linked_pull_request_numbers BIGINT[] NOT NULL DEFAULT '{}',
  linked_deployment_ids TEXT[] NOT NULL DEFAULT '{}',
  linked_incident_keys TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (provider, project_key, defect_key)
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

CREATE TABLE IF NOT EXISTS governance_collector_identities (
  id BIGSERIAL PRIMARY KEY,
  identity_key TEXT NOT NULL UNIQUE,
  member_id TEXT NOT NULL REFERENCES governance_members (member_id),
  project_key TEXT NOT NULL REFERENCES governance_projects (project_key),
  repo_name TEXT NOT NULL,
  tool_profile TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS governance_viewer_scope_assignments (
  id BIGSERIAL PRIMARY KEY,
  viewer_id TEXT NOT NULL UNIQUE REFERENCES governance_members (member_id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS governance_viewer_scope_team_grants (
  id BIGSERIAL PRIMARY KEY,
  viewer_id TEXT NOT NULL REFERENCES governance_viewer_scope_assignments (viewer_id),
  team_key TEXT NOT NULL REFERENCES governance_teams (team_key),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (viewer_id, team_key)
);

CREATE TABLE IF NOT EXISTS governance_viewer_scope_project_grants (
  id BIGSERIAL PRIMARY KEY,
  viewer_id TEXT NOT NULL REFERENCES governance_viewer_scope_assignments (viewer_id),
  project_key TEXT NOT NULL REFERENCES governance_projects (project_key),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (viewer_id, project_key)
);
