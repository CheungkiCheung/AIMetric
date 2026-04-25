import { Pool, type QueryResult, type QueryResultRow } from 'pg';
import type { IngestionBatch } from '@aimetric/event-schema';
import type { MetricCalculationResult } from '@aimetric/metric-core';
import {
  buildGovernanceViewerScope,
  buildGovernanceViewerScopeFromAccess,
  cloneGovernanceDirectory,
  defaultGovernanceDirectory,
  type GovernanceDirectory,
  type GovernanceMember,
  type GovernanceViewerScopeAssignment,
  type GovernanceViewerScope,
} from '../governance/governance-directory.service.js';

export interface RecordedMetricEvent {
  memberId: string;
  acceptedAiLines: number;
  commitTotalLines: number;
  sessionCount: number;
}

export interface MetricSnapshotFilters {
  projectKey?: string;
  projectKeys?: string[];
  memberId?: string;
  from?: string;
  to?: string;
  metricKeys?: string[];
}

export interface EditEvidenceFilters extends MetricSnapshotFilters {
  sessionId?: string;
  filePath?: string;
}

export interface McpAuditMetrics {
  totalToolCalls: number;
  successfulToolCalls: number;
  failedToolCalls: number;
  successRate: number;
  failureRate: number;
  averageDurationMs: number;
}

export type MetricSnapshotScope = 'personal' | 'team';

export interface MetricSnapshotRecord {
  scope: MetricSnapshotScope;
  projectKey: string;
  memberId?: string;
  periodStart: string;
  periodEnd: string;
  acceptedAiLines: number;
  commitTotalLines: number;
  aiOutputRate: number;
  sessionCount: number;
  memberCount: number;
}

export type EnterpriseMetricSnapshotRecord = MetricCalculationResult;

export interface EditSpanEvidenceRecord {
  editSpanId: string;
  sessionId: string;
  filePath: string;
  occurredAt: string;
  diff: string;
  beforeSnapshotHash: string;
  afterSnapshotHash: string;
  toolProfile?: string;
}

export interface TabAcceptedEventRecord {
  sessionId: string;
  occurredAt: string;
  acceptedLines: number;
  ingestionKey: string;
  filePath?: string;
  language?: string;
}

export interface AnalysisSummaryRecord {
  sessionCount: number;
  editSpanCount: number;
  tabAcceptedCount: number;
  tabAcceptedLines: number;
}

export interface SessionAnalysisRow {
  sessionId: string;
  memberId?: string;
  projectKey: string;
  occurredAt: string;
  conversationTurns?: number;
  userMessageCount?: number;
  assistantMessageCount?: number;
  firstMessageAt?: string;
  lastMessageAt?: string;
  workspaceId?: string;
  workspacePath?: string;
  projectFingerprint?: string;
  editSpanCount: number;
  tabAcceptedCount: number;
  tabAcceptedLines: number;
}

export interface OutputAnalysisRow {
  sessionId: string;
  memberId?: string;
  projectKey: string;
  filePath: string;
  editSpanCount: number;
  latestEditAt: string;
  tabAcceptedCount: number;
  tabAcceptedLines: number;
  latestDiffSummary: string;
}

export interface PullRequestRecord {
  provider: 'github';
  projectKey: string;
  repoName: string;
  prNumber: number;
  title: string;
  authorMemberId?: string;
  state: 'open' | 'closed' | 'merged';
  aiTouched: boolean;
  reviewDecision?: 'approved' | 'changes-requested' | 'commented';
  linkedRequirementKeys?: string[];
  createdAt: string;
  mergedAt?: string;
  cycleTimeHours?: number;
  updatedAt: string;
}

export interface PullRequestSummary {
  totalPrCount: number;
  aiTouchedPrCount: number;
  aiTouchedPrRatio: number;
  mergedPrCount: number;
  averageCycleTimeHours: number;
}

export interface RequirementRecord {
  provider: 'jira' | 'tapd';
  projectKey: string;
  requirementKey: string;
  title: string;
  ownerMemberId?: string;
  status: 'open' | 'in-progress' | 'done' | 'closed';
  aiTouched: boolean;
  firstPrCreatedAt?: string;
  completedAt?: string;
  linkedPullRequestCount?: number;
  linkedPullRequestNumbers?: number[];
  leadTimeHours?: number;
  leadTimeToFirstPrHours?: number;
  createdAt: string;
  updatedAt: string;
}

export interface RequirementSummary {
  totalRequirementCount: number;
  aiTouchedRequirementCount: number;
  aiTouchedRequirementRatio: number;
  completedRequirementCount: number;
  averageLeadTimeHours: number;
  averageLeadTimeToFirstPrHours: number;
}

export interface CiRunRecord {
  provider: 'github-actions';
  projectKey: string;
  repoName: string;
  runId: number;
  workflowName: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'cancelled' | 'timed_out' | 'skipped';
  createdAt: string;
  completedAt?: string;
  durationMinutes?: number;
  updatedAt: string;
}

export interface CiRunSummary {
  totalRunCount: number;
  completedRunCount: number;
  successfulRunCount: number;
  failedRunCount: number;
  passRate: number;
  averageDurationMinutes: number;
}

export interface DeploymentRecord {
  provider: 'github-actions' | 'argo-cd';
  projectKey: string;
  repoName: string;
  deploymentId: string;
  environment: 'production' | 'staging';
  status: 'success' | 'failed' | 'cancelled';
  aiTouched: boolean;
  rolledBack: boolean;
  incidentKey?: string;
  createdAt: string;
  finishedAt?: string;
  durationMinutes?: number;
  updatedAt: string;
}

export interface DeploymentSummary {
  totalDeploymentCount: number;
  successfulDeploymentCount: number;
  failedDeploymentCount: number;
  rolledBackDeploymentCount: number;
  aiTouchedDeploymentCount: number;
  changeFailureRate: number;
  rollbackRate: number;
  averageDurationMinutes: number;
}

export interface IncidentRecord {
  provider: 'pagerduty' | 'sentry' | 'manual';
  projectKey: string;
  incidentKey: string;
  title: string;
  severity: 'sev1' | 'sev2' | 'sev3' | 'sev4';
  status: 'open' | 'resolved';
  linkedDeploymentIds: string[];
  createdAt: string;
  resolvedAt?: string;
  updatedAt: string;
}

export interface IncidentSummary {
  totalIncidentCount: number;
  openIncidentCount: number;
  resolvedIncidentCount: number;
  linkedDeploymentCount: number;
  averageResolutionHours: number;
}

export interface CollectorIdentityRecord {
  identityKey: string;
  memberId: string;
  projectKey: string;
  repoName: string;
  toolProfile: string;
  status: 'active';
  registeredAt: string;
  updatedAt: string;
}

export interface ViewerScopeAssignmentRecord extends GovernanceViewerScopeAssignment {
  updatedAt: string;
}

export interface MetricEventRepository {
  saveIngestionBatch(batch: IngestionBatch): Promise<void>;
  listRecordedMetricEvents(
    filters?: MetricSnapshotFilters,
  ): Promise<RecordedMetricEvent[]>;
  saveMetricSnapshots(snapshots: MetricSnapshotRecord[]): Promise<void>;
  listMetricSnapshots(
    filters?: MetricSnapshotFilters,
  ): Promise<MetricSnapshotRecord[]>;
  saveEnterpriseMetricSnapshots?(
    snapshots: EnterpriseMetricSnapshotRecord[],
  ): Promise<void>;
  listEnterpriseMetricSnapshots?(
    filters?: MetricSnapshotFilters,
  ): Promise<EnterpriseMetricSnapshotRecord[]>;
  buildMcpAuditMetrics(filters?: MetricSnapshotFilters): Promise<McpAuditMetrics>;
  listEditSpanEvidence(
    filters?: EditEvidenceFilters,
  ): Promise<EditSpanEvidenceRecord[]>;
  listTabAcceptedEvents(
    filters?: EditEvidenceFilters,
  ): Promise<TabAcceptedEventRecord[]>;
  buildAnalysisSummary?(
    filters?: MetricSnapshotFilters,
  ): Promise<AnalysisSummaryRecord>;
  importPullRequests?(pullRequests: PullRequestRecord[]): Promise<void>;
  listPullRequests?(
    filters?: MetricSnapshotFilters,
  ): Promise<PullRequestRecord[]>;
  buildPullRequestSummary?(
    filters?: MetricSnapshotFilters,
  ): Promise<PullRequestSummary>;
  importRequirements?(requirements: RequirementRecord[]): Promise<void>;
  listRequirements?(
    filters?: MetricSnapshotFilters,
  ): Promise<RequirementRecord[]>;
  buildRequirementSummary?(
    filters?: MetricSnapshotFilters,
  ): Promise<RequirementSummary>;
  importCiRuns?(ciRuns: CiRunRecord[]): Promise<void>;
  listCiRuns?(
    filters?: MetricSnapshotFilters,
  ): Promise<CiRunRecord[]>;
  buildCiRunSummary?(
    filters?: MetricSnapshotFilters,
  ): Promise<CiRunSummary>;
  importDeployments?(deployments: DeploymentRecord[]): Promise<void>;
  listDeployments?(
    filters?: MetricSnapshotFilters,
  ): Promise<DeploymentRecord[]>;
  buildDeploymentSummary?(
    filters?: MetricSnapshotFilters,
  ): Promise<DeploymentSummary>;
  importIncidents?(incidents: IncidentRecord[]): Promise<void>;
  listIncidents?(
    filters?: MetricSnapshotFilters,
  ): Promise<IncidentRecord[]>;
  buildIncidentSummary?(
    filters?: MetricSnapshotFilters,
  ): Promise<IncidentSummary>;
  listSessionAnalysisRows?(
    filters?: MetricSnapshotFilters,
  ): Promise<SessionAnalysisRow[]>;
  listOutputAnalysisRows?(
    filters?: MetricSnapshotFilters,
  ): Promise<OutputAnalysisRow[]>;
  getGovernanceDirectory?(): Promise<GovernanceDirectory>;
  getGovernanceViewerScope?(
    viewerId: string,
  ): Promise<GovernanceViewerScope | undefined>;
  replaceViewerScopeAssignment?(
    input: GovernanceViewerScopeAssignment,
  ): Promise<ViewerScopeAssignmentRecord>;
  getViewerScopeAssignment?(
    viewerId: string,
  ): Promise<ViewerScopeAssignmentRecord | undefined>;
  registerCollectorIdentity?(
    input: Omit<CollectorIdentityRecord, 'status' | 'registeredAt' | 'updatedAt'>,
  ): Promise<CollectorIdentityRecord>;
  getCollectorIdentity?(
    identityKey: string,
  ): Promise<CollectorIdentityRecord | undefined>;
  disconnect(): Promise<void>;
}

const defaultDatabaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://aimetric:aimetric@127.0.0.1:5432/aimetric?schema=public';

interface Queryable {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>>;
  end?(): Promise<void>;
}

const appendProjectFilterClauses = (
  values: Array<string | string[]>,
  whereClauses: string[],
  filters: Pick<MetricSnapshotFilters, 'projectKey' | 'projectKeys'>,
  column: string,
) => {
  if (filters.projectKey) {
    values.push(filters.projectKey);
    whereClauses.push(`${column} = $${values.length}`);
    return;
  }

  if (filters.projectKeys && filters.projectKeys.length > 0) {
    values.push(filters.projectKeys);
    whereClauses.push(`${column} = ANY($${values.length})`);
  }
};

export class PostgresMetricEventRepository implements MetricEventRepository {
  private readonly database: Queryable;
  private schemaReady: Promise<void> | null = null;

  constructor(database?: Queryable) {
    this.database = database ?? new Pool({ connectionString: defaultDatabaseUrl });
  }

  private async ensureSchema() {
    if (!this.schemaReady) {
      this.schemaReady = this.database.query(`
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
        )
      `).then(async () => {
        await this.database.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS metric_events_source_ingestion_key_unique
          ON metric_events (source, ingestion_key)
          WHERE ingestion_key IS NOT NULL
        `);
        await this.database.query(`
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
          )
        `);
        await this.database.query(`
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
          )
        `);
        await this.database.query(`
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
          )
        `);
        await this.database.query(`
          CREATE TABLE IF NOT EXISTS delivery_requirements (
            id BIGSERIAL PRIMARY KEY,
            provider TEXT NOT NULL,
            project_key TEXT NOT NULL,
            requirement_key TEXT NOT NULL,
            title TEXT NOT NULL,
            owner_member_id TEXT,
            status TEXT NOT NULL,
            ai_touched BOOLEAN NOT NULL DEFAULT FALSE,
            first_pr_created_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL,
            UNIQUE (provider, project_key, requirement_key)
          )
        `);
        await this.database.query(`
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
          )
        `);
        await this.database.query(`
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
          )
        `);
        await this.database.query(`
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
          )
        `);
        await this.database.query(`
          CREATE TABLE IF NOT EXISTS governance_organizations (
            id BIGSERIAL PRIMARY KEY,
            organization_key TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
        await this.database.query(`
          CREATE TABLE IF NOT EXISTS governance_teams (
            id BIGSERIAL PRIMARY KEY,
            team_key TEXT NOT NULL UNIQUE,
            organization_key TEXT NOT NULL REFERENCES governance_organizations (organization_key),
            name TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
        await this.database.query(`
          CREATE TABLE IF NOT EXISTS governance_projects (
            id BIGSERIAL PRIMARY KEY,
            project_key TEXT NOT NULL UNIQUE,
            team_key TEXT NOT NULL REFERENCES governance_teams (team_key),
            name TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
        await this.database.query(`
          CREATE TABLE IF NOT EXISTS governance_members (
            id BIGSERIAL PRIMARY KEY,
            member_id TEXT NOT NULL UNIQUE,
            display_name TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
        await this.database.query(`
          CREATE TABLE IF NOT EXISTS governance_team_memberships (
            id BIGSERIAL PRIMARY KEY,
            member_id TEXT NOT NULL REFERENCES governance_members (member_id),
            team_key TEXT NOT NULL REFERENCES governance_teams (team_key),
            role TEXT NOT NULL,
            is_primary BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (member_id, team_key)
          )
        `);
        await this.database.query(`
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
          )
        `);
        await this.database.query(`
          CREATE TABLE IF NOT EXISTS governance_viewer_scope_assignments (
            id BIGSERIAL PRIMARY KEY,
            viewer_id TEXT NOT NULL UNIQUE REFERENCES governance_members (member_id),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
        await this.database.query(`
          CREATE TABLE IF NOT EXISTS governance_viewer_scope_team_grants (
            id BIGSERIAL PRIMARY KEY,
            viewer_id TEXT NOT NULL REFERENCES governance_viewer_scope_assignments (viewer_id),
            team_key TEXT NOT NULL REFERENCES governance_teams (team_key),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (viewer_id, team_key)
          )
        `);
        await this.database.query(`
          CREATE TABLE IF NOT EXISTS governance_viewer_scope_project_grants (
            id BIGSERIAL PRIMARY KEY,
            viewer_id TEXT NOT NULL REFERENCES governance_viewer_scope_assignments (viewer_id),
            project_key TEXT NOT NULL REFERENCES governance_projects (project_key),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (viewer_id, project_key)
          )
        `);
        await this.seedDefaultGovernanceDirectory();
      });
    }

    await this.schemaReady;
  }

  private async seedDefaultGovernanceDirectory() {
    const organizationCountResult = await this.database.query<{
      organization_count: string | number;
    }>(`
      SELECT COUNT(*) AS organization_count
      FROM governance_organizations
    `);
    const organizationCount = Number(
      organizationCountResult.rows[0]?.organization_count ?? 0,
    );

    if (organizationCount > 0) {
      return;
    }

    await this.database.query(
      `
        INSERT INTO governance_organizations (organization_key, name)
        VALUES ($1, $2)
        ON CONFLICT (organization_key) DO NOTHING
      `,
      [
        defaultGovernanceDirectory.organization.key,
        defaultGovernanceDirectory.organization.name,
      ],
    );

    await Promise.all(
      defaultGovernanceDirectory.teams.map((team) =>
        this.database.query(
          `
            INSERT INTO governance_teams (team_key, organization_key, name)
            VALUES ($1, $2, $3)
            ON CONFLICT (team_key) DO NOTHING
          `,
          [team.key, team.organizationKey, team.name],
        ),
      ),
    );

    await Promise.all(
      defaultGovernanceDirectory.projects.map((project) =>
        this.database.query(
          `
            INSERT INTO governance_projects (project_key, team_key, name)
            VALUES ($1, $2, $3)
            ON CONFLICT (project_key) DO NOTHING
          `,
          [project.key, project.teamKey, project.name],
        ),
      ),
    );

    await Promise.all(
      defaultGovernanceDirectory.members.map((member) =>
        this.database.query(
          `
            INSERT INTO governance_members (member_id, display_name)
            VALUES ($1, $2)
            ON CONFLICT (member_id)
            DO UPDATE SET
              display_name = EXCLUDED.display_name,
              updated_at = NOW()
          `,
          [member.memberId, member.displayName],
        ),
      ),
    );

    await Promise.all(
      defaultGovernanceDirectory.members.map((member) =>
        this.database.query(
          `
            INSERT INTO governance_team_memberships (
              member_id,
              team_key,
              role,
              is_primary
            )
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (member_id, team_key)
            DO UPDATE SET
              role = EXCLUDED.role,
              is_primary = EXCLUDED.is_primary,
              updated_at = NOW()
          `,
          [member.memberId, member.teamKey, member.role, true],
        ),
      ),
    );
  }

  async saveIngestionBatch(batch: IngestionBatch) {
    await this.ensureSchema();

    await Promise.all(
      batch.events.map((event) =>
        this.database.query(
          `
            INSERT INTO metric_events (
              schema_version,
              source,
              event_type,
              occurred_at,
              session_id,
              project_key,
              repo_name,
              member_id,
              accepted_ai_lines,
              commit_total_lines,
              ingestion_key,
              payload
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
            ON CONFLICT (source, ingestion_key)
            WHERE ingestion_key IS NOT NULL
            DO NOTHING
          `,
          [
            batch.schemaVersion,
            batch.source,
            event.eventType,
            event.occurredAt,
            event.payload.sessionId,
            event.payload.projectKey,
            event.payload.repoName,
            typeof event.payload.memberId === 'string' ? event.payload.memberId : null,
            typeof event.payload.acceptedAiLines === 'number'
              ? event.payload.acceptedAiLines
              : null,
            typeof event.payload.commitTotalLines === 'number'
              ? event.payload.commitTotalLines
              : null,
            typeof event.payload.ingestionKey === 'string'
              ? event.payload.ingestionKey
              : null,
            JSON.stringify(event.payload),
          ],
        ),
      ),
    );
  }

  async listRecordedMetricEvents(
    filters: MetricSnapshotFilters = {},
  ): Promise<RecordedMetricEvent[]> {
    await this.ensureSchema();

    const values: Array<string | string[]> = [];
    const whereClauses = [`event_type = 'session.recorded'`];
    appendProjectFilterClauses(values, whereClauses, filters, 'project_key');

    if (filters.memberId) {
      values.push(filters.memberId);
      whereClauses.push(`member_id = $${values.length}`);
    }

    if (filters.from) {
      values.push(filters.from);
      whereClauses.push(`occurred_at >= $${values.length}`);
    }

    if (filters.to) {
      values.push(filters.to);
      whereClauses.push(`occurred_at <= $${values.length}`);
    }

    const metricEvents = await this.database.query<{
      member_id: string | null;
      session_id: string;
      accepted_ai_lines: number | null;
      commit_total_lines: number | null;
    }>(`
      SELECT
        member_id,
        session_id,
        accepted_ai_lines,
        commit_total_lines
      FROM metric_events
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY occurred_at ASC, id ASC
    `, values);

    return metricEvents.rows.map((event) => ({
      memberId: event.member_id ?? event.session_id,
      acceptedAiLines: event.accepted_ai_lines ?? 0,
      commitTotalLines: event.commit_total_lines ?? 0,
      sessionCount: 1,
    }));
  }

  async buildMcpAuditMetrics(
    filters: MetricSnapshotFilters = {},
  ): Promise<McpAuditMetrics> {
    await this.ensureSchema();

    const values: Array<string | string[]> = [];
    const whereClauses = [`event_type = 'mcp.tool.called'`];
    appendProjectFilterClauses(values, whereClauses, filters, 'project_key');

    if (filters.memberId) {
      values.push(filters.memberId);
      whereClauses.push(`member_id = $${values.length}`);
    }

    if (filters.from) {
      values.push(filters.from);
      whereClauses.push(`occurred_at >= $${values.length}`);
    }

    if (filters.to) {
      values.push(filters.to);
      whereClauses.push(`occurred_at <= $${values.length}`);
    }

    const result = await this.database.query<{
      total_tool_calls: string | number;
      successful_tool_calls: string | number;
      failed_tool_calls: string | number;
      average_duration_ms: string | number | null;
    }>(
      `
        SELECT
          COUNT(*) AS total_tool_calls,
          COUNT(*) FILTER (WHERE payload->>'status' = 'success') AS successful_tool_calls,
          COUNT(*) FILTER (WHERE payload->>'status' = 'failure') AS failed_tool_calls,
          COALESCE(AVG((payload->>'durationMs')::DOUBLE PRECISION), 0) AS average_duration_ms
        FROM metric_events
        WHERE ${whereClauses.join(' AND ')}
      `,
      values,
    );
    const row = result.rows[0];
    const totalToolCalls = Number(row?.total_tool_calls ?? 0);
    const successfulToolCalls = Number(row?.successful_tool_calls ?? 0);
    const failedToolCalls = Number(row?.failed_tool_calls ?? 0);
    const averageDurationMs = Number(row?.average_duration_ms ?? 0);

    return {
      totalToolCalls,
      successfulToolCalls,
      failedToolCalls,
      successRate:
        totalToolCalls === 0 ? 0 : successfulToolCalls / totalToolCalls,
      failureRate: totalToolCalls === 0 ? 0 : failedToolCalls / totalToolCalls,
      averageDurationMs,
    };
  }

  async listEditSpanEvidence(
    filters: EditEvidenceFilters = {},
  ): Promise<EditSpanEvidenceRecord[]> {
    await this.ensureSchema();

    const values: Array<string | string[]> = [];
    const whereClauses = [`event_type = 'edit.span.recorded'`];
    appendProjectFilterClauses(values, whereClauses, filters, 'project_key');

    if (filters.memberId) {
      values.push(filters.memberId);
      whereClauses.push(`member_id = $${values.length}`);
    }

    if (filters.sessionId) {
      values.push(filters.sessionId);
      whereClauses.push(`session_id = $${values.length}`);
    }

    if (filters.filePath) {
      values.push(filters.filePath);
      whereClauses.push(`payload->>'filePath' = $${values.length}`);
    }

    if (filters.from) {
      values.push(filters.from);
      whereClauses.push(`occurred_at >= $${values.length}`);
    }

    if (filters.to) {
      values.push(filters.to);
      whereClauses.push(`occurred_at <= $${values.length}`);
    }

    const metricEvents = await this.database.query<{
      edit_span_id: string;
      session_id: string;
      file_path: string;
      occurred_at: Date | string;
      diff: string;
      before_snapshot_hash: string;
      after_snapshot_hash: string;
      tool_profile: string | null;
    }>(
      `
        SELECT
          payload->>'editSpanId' AS edit_span_id,
          session_id,
          payload->>'filePath' AS file_path,
          occurred_at,
          payload->>'diff' AS diff,
          payload->>'beforeSnapshotHash' AS before_snapshot_hash,
          payload->>'afterSnapshotHash' AS after_snapshot_hash,
          payload->>'toolProfile' AS tool_profile
        FROM metric_events
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY occurred_at ASC, id ASC
      `,
      values,
    );

    return metricEvents.rows.map((event) => ({
      editSpanId: event.edit_span_id,
      sessionId: event.session_id,
      filePath: event.file_path,
      occurredAt: new Date(event.occurred_at).toISOString(),
      diff: event.diff,
      beforeSnapshotHash: event.before_snapshot_hash,
      afterSnapshotHash: event.after_snapshot_hash,
      ...(event.tool_profile ? { toolProfile: event.tool_profile } : {}),
    }));
  }

  async listTabAcceptedEvents(
    filters: EditEvidenceFilters = {},
  ): Promise<TabAcceptedEventRecord[]> {
    await this.ensureSchema();

    const values: Array<string | string[]> = [];
    const whereClauses = [`event_type = 'tab.accepted'`];
    appendProjectFilterClauses(values, whereClauses, filters, 'project_key');

    if (filters.memberId) {
      values.push(filters.memberId);
      whereClauses.push(`member_id = $${values.length}`);
    }

    if (filters.sessionId) {
      values.push(filters.sessionId);
      whereClauses.push(`session_id = $${values.length}`);
    }

    if (filters.filePath) {
      values.push(filters.filePath);
      whereClauses.push(`payload->>'filePath' = $${values.length}`);
    }

    if (filters.from) {
      values.push(filters.from);
      whereClauses.push(`occurred_at >= $${values.length}`);
    }

    if (filters.to) {
      values.push(filters.to);
      whereClauses.push(`occurred_at <= $${values.length}`);
    }

    const metricEvents = await this.database.query<{
      session_id: string;
      occurred_at: Date | string;
      accepted_lines: number | null;
      file_path: string | null;
      language: string | null;
      ingestion_key: string;
    }>(
      `
        SELECT
          session_id,
          occurred_at,
          (payload->>'acceptedLines')::INTEGER AS accepted_lines,
          payload->>'filePath' AS file_path,
          payload->>'language' AS language,
          payload->>'ingestionKey' AS ingestion_key
        FROM metric_events
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY occurred_at ASC, id ASC
      `,
      values,
    );

    return metricEvents.rows.map((event) => ({
      sessionId: event.session_id,
      occurredAt: new Date(event.occurred_at).toISOString(),
      acceptedLines: event.accepted_lines ?? 0,
      ingestionKey: event.ingestion_key,
      ...(event.file_path ? { filePath: event.file_path } : {}),
      ...(event.language ? { language: event.language } : {}),
    }));
  }

  async buildAnalysisSummary(
    filters: MetricSnapshotFilters = {},
  ): Promise<AnalysisSummaryRecord> {
    await this.ensureSchema();

    const values: Array<string | string[]> = [];
    const whereClauses = [
      `event_type IN ('session.recorded', 'edit.span.recorded', 'tab.accepted')`,
    ];
    appendProjectFilterClauses(values, whereClauses, filters, 'project_key');

    if (filters.memberId) {
      values.push(filters.memberId);
      whereClauses.push(`member_id = $${values.length}`);
    }

    if (filters.from) {
      values.push(filters.from);
      whereClauses.push(`occurred_at >= $${values.length}`);
    }

    if (filters.to) {
      values.push(filters.to);
      whereClauses.push(`occurred_at <= $${values.length}`);
    }

    const result = await this.database.query<{
      session_count: string | number;
      edit_span_count: string | number;
      tab_accepted_count: string | number;
      tab_accepted_lines: string | number;
    }>(
      `
        SELECT
          COUNT(*) FILTER (WHERE event_type = 'session.recorded') AS session_count,
          COUNT(*) FILTER (WHERE event_type = 'edit.span.recorded') AS edit_span_count,
          COUNT(*) FILTER (WHERE event_type = 'tab.accepted') AS tab_accepted_count,
          COALESCE(
            SUM(
              CASE
                WHEN event_type = 'tab.accepted'
                  THEN COALESCE((payload->>'acceptedLines')::INTEGER, 0)
                ELSE 0
              END
            ),
            0
          ) AS tab_accepted_lines
        FROM metric_events
        WHERE ${whereClauses.join(' AND ')}
      `,
      values,
    );
    const row = result.rows[0];

    return {
      sessionCount: Number(row?.session_count ?? 0),
      editSpanCount: Number(row?.edit_span_count ?? 0),
      tabAcceptedCount: Number(row?.tab_accepted_count ?? 0),
      tabAcceptedLines: Number(row?.tab_accepted_lines ?? 0),
    };
  }

  async importPullRequests(pullRequests: PullRequestRecord[]): Promise<void> {
    await this.ensureSchema();

    await Promise.all(
      pullRequests.map((pullRequest) =>
        this.database.query(
          `
            INSERT INTO github_pull_requests (
              project_key,
              repo_name,
              pr_number,
              title,
              author_member_id,
              state,
              ai_touched,
              review_decision,
              requirement_keys,
              created_at,
              merged_at,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (project_key, repo_name, pr_number)
            DO UPDATE SET
              title = EXCLUDED.title,
              author_member_id = EXCLUDED.author_member_id,
              state = EXCLUDED.state,
              ai_touched = EXCLUDED.ai_touched,
              review_decision = EXCLUDED.review_decision,
              requirement_keys = EXCLUDED.requirement_keys,
              created_at = EXCLUDED.created_at,
              merged_at = EXCLUDED.merged_at,
              updated_at = EXCLUDED.updated_at
          `,
          [
            pullRequest.projectKey,
            pullRequest.repoName,
            pullRequest.prNumber,
            pullRequest.title,
            pullRequest.authorMemberId ?? null,
            pullRequest.state,
            pullRequest.aiTouched,
            pullRequest.reviewDecision ?? null,
            pullRequest.linkedRequirementKeys ?? extractRequirementKeys(pullRequest.title),
            pullRequest.createdAt,
            pullRequest.mergedAt ?? null,
            pullRequest.updatedAt,
          ],
        ),
      ),
    );
  }

  async listPullRequests(
    filters: MetricSnapshotFilters = {},
  ): Promise<PullRequestRecord[]> {
    await this.ensureSchema();

    const values: Array<string | string[]> = [];
    const whereClauses: string[] = [];

    appendProjectFilterClauses(values, whereClauses, filters, 'project_key');

    if (filters.memberId) {
      values.push(filters.memberId);
      whereClauses.push(`author_member_id = $${values.length}`);
    }

    if (filters.from) {
      values.push(filters.from);
      whereClauses.push(`created_at >= $${values.length}`);
    }

    if (filters.to) {
      values.push(filters.to);
      whereClauses.push(`created_at <= $${values.length}`);
    }

    const result = await this.database.query<{
      project_key: string;
      repo_name: string;
      pr_number: number;
      title: string;
      author_member_id: string | null;
      state: PullRequestRecord['state'];
      ai_touched: boolean;
      review_decision: PullRequestRecord['reviewDecision'] | null;
      requirement_keys: string[];
      created_at: Date | string;
      merged_at: Date | string | null;
      updated_at: Date | string;
    }>(
      `
        SELECT
          project_key,
          repo_name,
          pr_number,
          title,
          author_member_id,
          state,
          ai_touched,
          review_decision,
          requirement_keys,
          created_at,
          merged_at,
          updated_at
        FROM github_pull_requests
        ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''}
        ORDER BY updated_at DESC, pr_number DESC
      `,
      values,
    );

    return result.rows.map((row) => ({
      provider: 'github',
      projectKey: row.project_key,
      repoName: row.repo_name,
      prNumber: row.pr_number,
      title: row.title,
      ...(row.author_member_id ? { authorMemberId: row.author_member_id } : {}),
      state: row.state,
      aiTouched: row.ai_touched,
      ...(row.review_decision ? { reviewDecision: row.review_decision } : {}),
      ...(row.requirement_keys.length > 0
        ? { linkedRequirementKeys: row.requirement_keys }
        : {}),
      createdAt: toIsoString(row.created_at),
      ...(row.merged_at ? { mergedAt: toIsoString(row.merged_at) } : {}),
      ...(row.merged_at
        ? {
            cycleTimeHours: calculateCycleTimeHours(
              toIsoString(row.created_at),
              toIsoString(row.merged_at),
            ),
          }
        : {}),
      updatedAt: toIsoString(row.updated_at),
    }));
  }

  async buildPullRequestSummary(
    filters: MetricSnapshotFilters = {},
  ): Promise<PullRequestSummary> {
    const pullRequests = await this.listPullRequests(filters);
    const mergedPullRequests = pullRequests.filter((pullRequest) => pullRequest.mergedAt);
    const totalCycleTimeHours = mergedPullRequests.reduce(
      (sum, pullRequest) => sum + (pullRequest.cycleTimeHours ?? 0),
      0,
    );
    const aiTouchedPrCount = pullRequests.filter((pullRequest) => pullRequest.aiTouched).length;

    return {
      totalPrCount: pullRequests.length,
      aiTouchedPrCount,
      aiTouchedPrRatio:
        pullRequests.length === 0 ? 0 : aiTouchedPrCount / pullRequests.length,
      mergedPrCount: mergedPullRequests.length,
      averageCycleTimeHours:
        mergedPullRequests.length === 0
          ? 0
          : totalCycleTimeHours / mergedPullRequests.length,
    };
  }

  async importRequirements(requirements: RequirementRecord[]): Promise<void> {
    if (requirements.length === 0) {
      return;
    }

    await this.ensureSchema();

    await Promise.all(
      requirements.map((requirement) =>
        this.database.query(
          `
            INSERT INTO delivery_requirements (
              provider,
              project_key,
              requirement_key,
              title,
              owner_member_id,
              status,
              ai_touched,
              first_pr_created_at,
              completed_at,
              created_at,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (provider, project_key, requirement_key)
            DO UPDATE SET
              title = EXCLUDED.title,
              owner_member_id = EXCLUDED.owner_member_id,
              status = EXCLUDED.status,
              ai_touched = EXCLUDED.ai_touched,
              first_pr_created_at = EXCLUDED.first_pr_created_at,
              completed_at = EXCLUDED.completed_at,
              created_at = EXCLUDED.created_at,
              updated_at = EXCLUDED.updated_at
          `,
          [
            requirement.provider,
            requirement.projectKey,
            requirement.requirementKey,
            requirement.title,
            requirement.ownerMemberId ?? null,
            requirement.status,
            requirement.aiTouched,
            requirement.firstPrCreatedAt ?? null,
            requirement.completedAt ?? null,
            requirement.createdAt,
            requirement.updatedAt,
          ],
        ),
      ),
    );
  }

  async listRequirements(
    filters: MetricSnapshotFilters = {},
  ): Promise<RequirementRecord[]> {
    await this.ensureSchema();

    const values: Array<string | string[]> = [];
    const whereClauses: string[] = [];

    appendProjectFilterClauses(values, whereClauses, filters, 'project_key');

    if (filters.memberId) {
      values.push(filters.memberId);
      whereClauses.push(`owner_member_id = $${values.length}`);
    }

    if (filters.from) {
      values.push(filters.from);
      whereClauses.push(`created_at >= $${values.length}`);
    }

    if (filters.to) {
      values.push(filters.to);
      whereClauses.push(`created_at <= $${values.length}`);
    }

    const result = await this.database.query<{
      provider: RequirementRecord['provider'];
      project_key: string;
      requirement_key: string;
      title: string;
      owner_member_id: string | null;
      status: RequirementRecord['status'];
      ai_touched: boolean;
      first_pr_created_at: Date | string | null;
      derived_first_pr_created_at: Date | string | null;
      completed_at: Date | string | null;
      linked_pull_request_count: number | string;
      linked_pull_request_numbers: number[] | null;
      created_at: Date | string;
      updated_at: Date | string;
    }>(
      `
        SELECT
          requirements.provider,
          requirements.project_key,
          requirements.requirement_key,
          requirements.title,
          requirements.owner_member_id,
          requirements.status,
          requirements.ai_touched,
          requirements.first_pr_created_at,
          linked_prs.first_pr_created_at AS derived_first_pr_created_at,
          requirements.completed_at,
          COALESCE(linked_prs.linked_pull_request_count, 0) AS linked_pull_request_count,
          linked_prs.linked_pull_request_numbers,
          requirements.created_at,
          requirements.updated_at
        FROM delivery_requirements requirements
        LEFT JOIN LATERAL (
          SELECT
            MIN(pull_requests.created_at) AS first_pr_created_at,
            COUNT(*)::INTEGER AS linked_pull_request_count,
            ARRAY_AGG(pull_requests.pr_number ORDER BY pull_requests.created_at ASC) AS linked_pull_request_numbers
          FROM github_pull_requests pull_requests
          WHERE pull_requests.project_key = requirements.project_key
            AND requirements.requirement_key = ANY(pull_requests.requirement_keys)
        ) linked_prs
          ON TRUE
        ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''}
        ORDER BY requirements.updated_at DESC, requirements.requirement_key ASC
      `,
      values,
    );

    return result.rows.map((row) => {
      const effectiveFirstPrCreatedAt =
        row.first_pr_created_at ?? row.derived_first_pr_created_at;

      return {
        provider: row.provider,
        projectKey: row.project_key,
        requirementKey: row.requirement_key,
        title: row.title,
        ...(row.owner_member_id ? { ownerMemberId: row.owner_member_id } : {}),
        status: row.status,
        aiTouched: row.ai_touched,
        ...(effectiveFirstPrCreatedAt
          ? { firstPrCreatedAt: toIsoString(effectiveFirstPrCreatedAt) }
          : {}),
        ...(row.completed_at ? { completedAt: toIsoString(row.completed_at) } : {}),
        ...(Number(row.linked_pull_request_count) > 0
          ? {
              linkedPullRequestCount: Number(row.linked_pull_request_count),
              linkedPullRequestNumbers: row.linked_pull_request_numbers ?? [],
            }
          : {}),
        ...(row.completed_at
          ? {
              leadTimeHours: calculateCycleTimeHours(
                toIsoString(row.created_at),
                toIsoString(row.completed_at),
              ),
            }
          : {}),
        ...(effectiveFirstPrCreatedAt
          ? {
              leadTimeToFirstPrHours: calculateCycleTimeHours(
                toIsoString(row.created_at),
                toIsoString(effectiveFirstPrCreatedAt),
              ),
            }
          : {}),
        createdAt: toIsoString(row.created_at),
        updatedAt: toIsoString(row.updated_at),
      };
    });
  }

  async buildRequirementSummary(
    filters: MetricSnapshotFilters = {},
  ): Promise<RequirementSummary> {
    const requirements = await this.listRequirements(filters);
    const completedRequirements = requirements.filter(
      (requirement) => requirement.status === 'done' || requirement.status === 'closed',
    );
    const aiTouchedRequirementCount = requirements.filter(
      (requirement) => requirement.aiTouched,
    ).length;
    const leadTimeValues = completedRequirements
      .map((requirement) => requirement.leadTimeHours)
      .filter((value): value is number => typeof value === 'number');
    const leadTimeToFirstPrValues = requirements
      .map((requirement) => requirement.leadTimeToFirstPrHours)
      .filter((value): value is number => typeof value === 'number');

    return {
      totalRequirementCount: requirements.length,
      aiTouchedRequirementCount,
      aiTouchedRequirementRatio:
        requirements.length === 0
          ? 0
          : aiTouchedRequirementCount / requirements.length,
      completedRequirementCount: completedRequirements.length,
      averageLeadTimeHours:
        leadTimeValues.length === 0
          ? 0
          : leadTimeValues.reduce((sum, value) => sum + value, 0) /
            leadTimeValues.length,
      averageLeadTimeToFirstPrHours:
        leadTimeToFirstPrValues.length === 0
          ? 0
          : leadTimeToFirstPrValues.reduce((sum, value) => sum + value, 0) /
            leadTimeToFirstPrValues.length,
    };
  }

  async importCiRuns(ciRuns: CiRunRecord[]): Promise<void> {
    if (ciRuns.length === 0) {
      return;
    }

    await this.ensureSchema();

    await Promise.all(
      ciRuns.map((ciRun) =>
        this.database.query(
          `
            INSERT INTO ci_runs (
              provider,
              project_key,
              repo_name,
              run_id,
              workflow_name,
              status,
              conclusion,
              created_at,
              completed_at,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (provider, project_key, repo_name, run_id)
            DO UPDATE SET
              workflow_name = EXCLUDED.workflow_name,
              status = EXCLUDED.status,
              conclusion = EXCLUDED.conclusion,
              created_at = EXCLUDED.created_at,
              completed_at = EXCLUDED.completed_at,
              updated_at = EXCLUDED.updated_at
          `,
          [
            ciRun.provider,
            ciRun.projectKey,
            ciRun.repoName,
            ciRun.runId,
            ciRun.workflowName,
            ciRun.status,
            ciRun.conclusion ?? null,
            ciRun.createdAt,
            ciRun.completedAt ?? null,
            ciRun.updatedAt,
          ],
        ),
      ),
    );
  }

  async listCiRuns(filters: MetricSnapshotFilters = {}): Promise<CiRunRecord[]> {
    await this.ensureSchema();

    const values: Array<string | string[]> = [];
    const whereClauses: string[] = [];

    appendProjectFilterClauses(values, whereClauses, filters, 'project_key');

    if (filters.from) {
      values.push(filters.from);
      whereClauses.push(`created_at >= $${values.length}`);
    }

    if (filters.to) {
      values.push(filters.to);
      whereClauses.push(`created_at <= $${values.length}`);
    }

    const result = await this.database.query<{
      provider: CiRunRecord['provider'];
      project_key: string;
      repo_name: string;
      run_id: number;
      workflow_name: string;
      status: CiRunRecord['status'];
      conclusion: CiRunRecord['conclusion'] | null;
      created_at: Date | string;
      completed_at: Date | string | null;
      updated_at: Date | string;
    }>(
      `
        SELECT
          provider,
          project_key,
          repo_name,
          run_id,
          workflow_name,
          status,
          conclusion,
          created_at,
          completed_at,
          updated_at
        FROM ci_runs
        ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''}
        ORDER BY updated_at DESC, run_id DESC
      `,
      values,
    );

    return result.rows.map((row) => ({
      provider: row.provider,
      projectKey: row.project_key,
      repoName: row.repo_name,
      runId: row.run_id,
      workflowName: row.workflow_name,
      status: row.status,
      ...(row.conclusion ? { conclusion: row.conclusion } : {}),
      createdAt: toIsoString(row.created_at),
      ...(row.completed_at ? { completedAt: toIsoString(row.completed_at) } : {}),
      ...(row.completed_at
        ? {
            durationMinutes:
              calculateCycleTimeHours(
                toIsoString(row.created_at),
                toIsoString(row.completed_at),
              ) * 60,
          }
        : {}),
      updatedAt: toIsoString(row.updated_at),
    }));
  }

  async buildCiRunSummary(
    filters: MetricSnapshotFilters = {},
  ): Promise<CiRunSummary> {
    const ciRuns = await this.listCiRuns(filters);
    const completedRuns = ciRuns.filter((ciRun) => ciRun.status === 'completed');
    const successfulRuns = completedRuns.filter(
      (ciRun) => ciRun.conclusion === 'success',
    );
    const failedRuns = completedRuns.filter(
      (ciRun) => ciRun.conclusion === 'failure' || ciRun.conclusion === 'timed_out',
    );
    const durationValues = completedRuns
      .map((ciRun) => ciRun.durationMinutes)
      .filter((value): value is number => typeof value === 'number');

    return {
      totalRunCount: ciRuns.length,
      completedRunCount: completedRuns.length,
      successfulRunCount: successfulRuns.length,
      failedRunCount: failedRuns.length,
      passRate:
        completedRuns.length === 0 ? 0 : successfulRuns.length / completedRuns.length,
      averageDurationMinutes:
        durationValues.length === 0
          ? 0
          : durationValues.reduce((sum, value) => sum + value, 0) /
            durationValues.length,
    };
  }

  async importDeployments(deployments: DeploymentRecord[]): Promise<void> {
    if (deployments.length === 0) {
      return;
    }

    await this.ensureSchema();

    await Promise.all(
      deployments.map((deployment) =>
        this.database.query(
          `
            INSERT INTO deployment_runs (
              provider,
              project_key,
              repo_name,
              deployment_id,
              environment,
              status,
              ai_touched,
              rolled_back,
              incident_key,
              created_at,
              finished_at,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (provider, project_key, repo_name, deployment_id)
            DO UPDATE SET
              environment = EXCLUDED.environment,
              status = EXCLUDED.status,
              ai_touched = EXCLUDED.ai_touched,
              rolled_back = EXCLUDED.rolled_back,
              incident_key = EXCLUDED.incident_key,
              created_at = EXCLUDED.created_at,
              finished_at = EXCLUDED.finished_at,
              updated_at = EXCLUDED.updated_at
          `,
          [
            deployment.provider,
            deployment.projectKey,
            deployment.repoName,
            deployment.deploymentId,
            deployment.environment,
            deployment.status,
            deployment.aiTouched,
            deployment.rolledBack,
            deployment.incidentKey ?? null,
            deployment.createdAt,
            deployment.finishedAt ?? null,
            deployment.updatedAt,
          ],
        ),
      ),
    );
  }

  async listDeployments(
    filters: MetricSnapshotFilters = {},
  ): Promise<DeploymentRecord[]> {
    await this.ensureSchema();

    const values: Array<string | string[]> = [];
    const whereClauses: string[] = [];

    appendProjectFilterClauses(values, whereClauses, filters, 'project_key');

    if (filters.from) {
      values.push(filters.from);
      whereClauses.push(`created_at >= $${values.length}`);
    }

    if (filters.to) {
      values.push(filters.to);
      whereClauses.push(`created_at <= $${values.length}`);
    }

    const result = await this.database.query<{
      provider: DeploymentRecord['provider'];
      project_key: string;
      repo_name: string;
      deployment_id: string;
      environment: DeploymentRecord['environment'];
      status: DeploymentRecord['status'];
      ai_touched: boolean;
      rolled_back: boolean;
      incident_key: string | null;
      created_at: Date | string;
      finished_at: Date | string | null;
      updated_at: Date | string;
    }>(
      `
        SELECT
          provider,
          project_key,
          repo_name,
          deployment_id,
          environment,
          status,
          ai_touched,
          rolled_back,
          incident_key,
          created_at,
          finished_at,
          updated_at
        FROM deployment_runs
        ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''}
        ORDER BY updated_at DESC, deployment_id DESC
      `,
      values,
    );

    return result.rows.map((row) => ({
      provider: row.provider,
      projectKey: row.project_key,
      repoName: row.repo_name,
      deploymentId: row.deployment_id,
      environment: row.environment,
      status: row.status,
      aiTouched: row.ai_touched,
      rolledBack: row.rolled_back,
      ...(row.incident_key ? { incidentKey: row.incident_key } : {}),
      createdAt: toIsoString(row.created_at),
      ...(row.finished_at ? { finishedAt: toIsoString(row.finished_at) } : {}),
      ...(row.finished_at
        ? {
            durationMinutes:
              calculateCycleTimeHours(
                toIsoString(row.created_at),
                toIsoString(row.finished_at),
              ) * 60,
          }
        : {}),
      updatedAt: toIsoString(row.updated_at),
    }));
  }

  async buildDeploymentSummary(
    filters: MetricSnapshotFilters = {},
  ): Promise<DeploymentSummary> {
    const deployments = await this.listDeployments(filters);
    const incidents = await this.listIncidents(filters);
    const incidentDeploymentIds = new Set(
      incidents.flatMap((incident) => incident.linkedDeploymentIds),
    );
    const successfulDeployments = deployments.filter(
      (deployment) => deployment.status === 'success',
    );
    const failedDeployments = deployments.filter(
      (deployment) =>
        deployment.status === 'failed' ||
        deployment.rolledBack ||
        typeof deployment.incidentKey === 'string' ||
        incidentDeploymentIds.has(deployment.deploymentId),
    );
    const rolledBackDeployments = deployments.filter(
      (deployment) => deployment.rolledBack,
    );
    const aiTouchedDeployments = deployments.filter(
      (deployment) => deployment.aiTouched,
    );
    const durationValues = deployments
      .map((deployment) => deployment.durationMinutes)
      .filter((value): value is number => typeof value === 'number');

    return {
      totalDeploymentCount: deployments.length,
      successfulDeploymentCount: successfulDeployments.length,
      failedDeploymentCount: failedDeployments.length,
      rolledBackDeploymentCount: rolledBackDeployments.length,
      aiTouchedDeploymentCount: aiTouchedDeployments.length,
      changeFailureRate:
        deployments.length === 0 ? 0 : failedDeployments.length / deployments.length,
      rollbackRate:
        deployments.length === 0
          ? 0
          : rolledBackDeployments.length / deployments.length,
      averageDurationMinutes:
        durationValues.length === 0
          ? 0
          : durationValues.reduce((sum, value) => sum + value, 0) /
            durationValues.length,
    };
  }

  async importIncidents(incidents: IncidentRecord[]): Promise<void> {
    if (incidents.length === 0) {
      return;
    }

    await this.ensureSchema();

    await Promise.all(
      incidents.map((incident) =>
        this.database.query(
          `
            INSERT INTO incident_records (
              provider,
              project_key,
              incident_key,
              title,
              severity,
              status,
              linked_deployment_ids,
              created_at,
              resolved_at,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (provider, project_key, incident_key)
            DO UPDATE SET
              title = EXCLUDED.title,
              severity = EXCLUDED.severity,
              status = EXCLUDED.status,
              linked_deployment_ids = EXCLUDED.linked_deployment_ids,
              created_at = EXCLUDED.created_at,
              resolved_at = EXCLUDED.resolved_at,
              updated_at = EXCLUDED.updated_at
          `,
          [
            incident.provider,
            incident.projectKey,
            incident.incidentKey,
            incident.title,
            incident.severity,
            incident.status,
            incident.linkedDeploymentIds,
            incident.createdAt,
            incident.resolvedAt ?? null,
            incident.updatedAt,
          ],
        ),
      ),
    );
  }

  async listIncidents(
    filters: MetricSnapshotFilters = {},
  ): Promise<IncidentRecord[]> {
    await this.ensureSchema();

    const values: Array<string | string[]> = [];
    const whereClauses: string[] = [];

    appendProjectFilterClauses(values, whereClauses, filters, 'project_key');

    if (filters.from) {
      values.push(filters.from);
      whereClauses.push(`created_at >= $${values.length}`);
    }

    if (filters.to) {
      values.push(filters.to);
      whereClauses.push(`created_at <= $${values.length}`);
    }

    const result = await this.database.query<{
      provider: IncidentRecord['provider'];
      project_key: string;
      incident_key: string;
      title: string;
      severity: IncidentRecord['severity'];
      status: IncidentRecord['status'];
      linked_deployment_ids: string[] | null;
      created_at: Date | string;
      resolved_at: Date | string | null;
      updated_at: Date | string;
    }>(
      `
        SELECT
          provider,
          project_key,
          incident_key,
          title,
          severity,
          status,
          linked_deployment_ids,
          created_at,
          resolved_at,
          updated_at
        FROM incident_records
        ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''}
        ORDER BY updated_at DESC, incident_key DESC
      `,
      values,
    );

    return result.rows.map((row) => ({
      provider: row.provider,
      projectKey: row.project_key,
      incidentKey: row.incident_key,
      title: row.title,
      severity: row.severity,
      status: row.status,
      linkedDeploymentIds: row.linked_deployment_ids ?? [],
      createdAt: toIsoString(row.created_at),
      ...(row.resolved_at ? { resolvedAt: toIsoString(row.resolved_at) } : {}),
      updatedAt: toIsoString(row.updated_at),
    }));
  }

  async buildIncidentSummary(
    filters: MetricSnapshotFilters = {},
  ): Promise<IncidentSummary> {
    const incidents = await this.listIncidents(filters);
    const openIncidents = incidents.filter((incident) => incident.status === 'open');
    const resolvedIncidents = incidents.filter(
      (incident) => incident.status === 'resolved',
    );
    const resolutionHours = resolvedIncidents
      .filter((incident) => incident.resolvedAt)
      .map((incident) =>
        calculateCycleTimeHours(incident.createdAt, incident.resolvedAt as string),
      );
    const linkedDeploymentCount = new Set(
      incidents.flatMap((incident) => incident.linkedDeploymentIds),
    ).size;

    return {
      totalIncidentCount: incidents.length,
      openIncidentCount: openIncidents.length,
      resolvedIncidentCount: resolvedIncidents.length,
      linkedDeploymentCount,
      averageResolutionHours:
        resolutionHours.length === 0
          ? 0
          : resolutionHours.reduce((sum, value) => sum + value, 0) /
            resolutionHours.length,
    };
  }

  async listSessionAnalysisRows(
    filters: MetricSnapshotFilters = {},
  ): Promise<SessionAnalysisRow[]> {
    await this.ensureSchema();

    const values: Array<string | string[]> = [];
    const whereClauses = [`sessions.event_type = 'session.recorded'`];
    appendProjectFilterClauses(values, whereClauses, filters, 'sessions.project_key');

    if (filters.memberId) {
      values.push(filters.memberId);
      whereClauses.push(`sessions.member_id = $${values.length}`);
    }

    if (filters.from) {
      values.push(filters.from);
      whereClauses.push(`sessions.occurred_at >= $${values.length}`);
    }

    if (filters.to) {
      values.push(filters.to);
      whereClauses.push(`sessions.occurred_at <= $${values.length}`);
    }

    const rows = await this.database.query<{
      session_id: string;
      member_id: string | null;
      project_key: string;
      occurred_at: Date | string;
      conversation_turns: string | null;
      user_message_count: string | null;
      assistant_message_count: string | null;
      first_message_at: string | null;
      last_message_at: string | null;
      workspace_id: string | null;
      workspace_path: string | null;
      project_fingerprint: string | null;
      edit_span_count: string | number;
      tab_accepted_count: string | number;
      tab_accepted_lines: string | number;
    }>(
      `
        SELECT
          sessions.session_id,
          sessions.member_id,
          sessions.project_key,
          sessions.occurred_at,
          sessions.payload->>'conversationTurns' AS conversation_turns,
          sessions.payload->>'userMessageCount' AS user_message_count,
          sessions.payload->>'assistantMessageCount' AS assistant_message_count,
          sessions.payload->>'firstMessageAt' AS first_message_at,
          sessions.payload->>'lastMessageAt' AS last_message_at,
          sessions.payload->>'workspaceId' AS workspace_id,
          sessions.payload->>'workspacePath' AS workspace_path,
          sessions.payload->>'projectFingerprint' AS project_fingerprint,
          (
            SELECT COUNT(*)
            FROM metric_events edits
            WHERE edits.event_type = 'edit.span.recorded'
              AND edits.session_id = sessions.session_id
          ) AS edit_span_count,
          (
            SELECT COUNT(*)
            FROM metric_events tabs
            WHERE tabs.event_type = 'tab.accepted'
              AND tabs.session_id = sessions.session_id
          ) AS tab_accepted_count,
          (
            SELECT COALESCE(SUM((tabs.payload->>'acceptedLines')::INTEGER), 0)
            FROM metric_events tabs
            WHERE tabs.event_type = 'tab.accepted'
              AND tabs.session_id = sessions.session_id
          ) AS tab_accepted_lines
        FROM metric_events sessions
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY COALESCE((sessions.payload->>'lastMessageAt')::TIMESTAMPTZ, sessions.occurred_at) DESC, sessions.id DESC
      `,
      values,
    );

    return rows.rows.map((row) => ({
      sessionId: row.session_id,
      ...(row.member_id ? { memberId: row.member_id } : {}),
      projectKey: row.project_key,
      occurredAt: new Date(row.occurred_at).toISOString(),
      ...(row.conversation_turns
        ? { conversationTurns: Number(row.conversation_turns) }
        : {}),
      ...(row.user_message_count
        ? { userMessageCount: Number(row.user_message_count) }
        : {}),
      ...(row.assistant_message_count
        ? { assistantMessageCount: Number(row.assistant_message_count) }
        : {}),
      ...(row.first_message_at ? { firstMessageAt: row.first_message_at } : {}),
      ...(row.last_message_at ? { lastMessageAt: row.last_message_at } : {}),
      ...(row.workspace_id ? { workspaceId: row.workspace_id } : {}),
      ...(row.workspace_path ? { workspacePath: row.workspace_path } : {}),
      ...(row.project_fingerprint
        ? { projectFingerprint: row.project_fingerprint }
        : {}),
      editSpanCount: Number(row.edit_span_count ?? 0),
      tabAcceptedCount: Number(row.tab_accepted_count ?? 0),
      tabAcceptedLines: Number(row.tab_accepted_lines ?? 0),
    }));
  }

  async listOutputAnalysisRows(
    filters: MetricSnapshotFilters = {},
  ): Promise<OutputAnalysisRow[]> {
    await this.ensureSchema();

    const values: Array<string | string[]> = [];
    const whereClauses = [`edits.event_type = 'edit.span.recorded'`];
    appendProjectFilterClauses(values, whereClauses, filters, 'edits.project_key');

    if (filters.memberId) {
      values.push(filters.memberId);
      whereClauses.push(`edits.member_id = $${values.length}`);
    }

    if (filters.from) {
      values.push(filters.from);
      whereClauses.push(`edits.occurred_at >= $${values.length}`);
    }

    if (filters.to) {
      values.push(filters.to);
      whereClauses.push(`edits.occurred_at <= $${values.length}`);
    }

    const rows = await this.database.query<{
      session_id: string;
      member_id: string | null;
      project_key: string;
      file_path: string;
      edit_span_count: string | number;
      latest_edit_at: Date | string;
      tab_accepted_count: string | number;
      tab_accepted_lines: string | number;
      latest_diff_summary: string | null;
    }>(
      `
        SELECT
          edits.session_id,
          edits.member_id,
          edits.project_key,
          edits.payload->>'filePath' AS file_path,
          COUNT(*) AS edit_span_count,
          MAX(edits.occurred_at) AS latest_edit_at,
          (
            SELECT COUNT(*)
            FROM metric_events tabs
            WHERE tabs.event_type = 'tab.accepted'
              AND tabs.session_id = edits.session_id
              AND tabs.payload->>'filePath' = edits.payload->>'filePath'
          ) AS tab_accepted_count,
          (
            SELECT COALESCE(SUM((tabs.payload->>'acceptedLines')::INTEGER), 0)
            FROM metric_events tabs
            WHERE tabs.event_type = 'tab.accepted'
              AND tabs.session_id = edits.session_id
              AND tabs.payload->>'filePath' = edits.payload->>'filePath'
          ) AS tab_accepted_lines,
          (
            SELECT LEFT(REGEXP_REPLACE(diff.payload->>'diff', '\\s+', ' ', 'g'), 240)
            FROM metric_events diff
            WHERE diff.event_type = 'edit.span.recorded'
              AND diff.session_id = edits.session_id
              AND diff.payload->>'filePath' = edits.payload->>'filePath'
            ORDER BY diff.occurred_at DESC, diff.id DESC
            LIMIT 1
          ) AS latest_diff_summary
        FROM metric_events edits
        WHERE ${whereClauses.join(' AND ')}
        GROUP BY edits.session_id, edits.member_id, edits.project_key, edits.payload->>'filePath'
        ORDER BY latest_edit_at DESC
      `,
      values,
    );

    return rows.rows.map((row) => ({
      sessionId: row.session_id,
      ...(row.member_id ? { memberId: row.member_id } : {}),
      projectKey: row.project_key,
      filePath: row.file_path,
      editSpanCount: Number(row.edit_span_count ?? 0),
      latestEditAt: new Date(row.latest_edit_at).toISOString(),
      tabAcceptedCount: Number(row.tab_accepted_count ?? 0),
      tabAcceptedLines: Number(row.tab_accepted_lines ?? 0),
      latestDiffSummary: row.latest_diff_summary ?? '',
    }));
  }

  async saveMetricSnapshots(snapshots: MetricSnapshotRecord[]): Promise<void> {
    await this.ensureSchema();

    await Promise.all(
      snapshots.map((snapshot) =>
        this.database.query(
          `
            INSERT INTO metric_snapshots (
              scope,
              project_key,
              member_id,
              period_start,
              period_end,
              accepted_ai_lines,
              commit_total_lines,
              ai_output_rate,
              session_count,
              member_count
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (scope, project_key, member_id, period_start, period_end)
            DO UPDATE SET
              accepted_ai_lines = EXCLUDED.accepted_ai_lines,
              commit_total_lines = EXCLUDED.commit_total_lines,
              ai_output_rate = EXCLUDED.ai_output_rate,
              session_count = EXCLUDED.session_count,
              member_count = EXCLUDED.member_count,
              updated_at = NOW()
          `,
          [
            snapshot.scope,
            snapshot.projectKey,
            snapshot.memberId ?? '',
            snapshot.periodStart,
            snapshot.periodEnd,
            snapshot.acceptedAiLines,
            snapshot.commitTotalLines,
            snapshot.aiOutputRate,
            snapshot.sessionCount,
            snapshot.memberCount,
          ],
        ),
      ),
    );
  }

  async listMetricSnapshots(
    filters: MetricSnapshotFilters = {},
  ): Promise<MetricSnapshotRecord[]> {
    await this.ensureSchema();

    const values: Array<string | string[]> = [];
    const whereClauses: string[] = [];
    appendProjectFilterClauses(values, whereClauses, filters, 'project_key');

    if (filters.memberId) {
      values.push(filters.memberId);
      whereClauses.push(`member_id = $${values.length}`);
    }

    if (filters.from) {
      values.push(filters.from);
      whereClauses.push(`period_start >= $${values.length}`);
    }

    if (filters.to) {
      values.push(filters.to);
      whereClauses.push(`period_end <= $${values.length}`);
    }

    const metricSnapshots = await this.database.query<{
      scope: MetricSnapshotScope;
      project_key: string;
      member_id: string;
      period_start: Date | string;
      period_end: Date | string;
      accepted_ai_lines: number;
      commit_total_lines: number;
      ai_output_rate: number;
      session_count: number;
      member_count: number;
    }>(
      `
        SELECT
          scope,
          project_key,
          member_id,
          period_start,
          period_end,
          accepted_ai_lines,
          commit_total_lines,
          ai_output_rate,
          session_count,
          member_count
        FROM metric_snapshots
        ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''}
        ORDER BY period_start ASC, scope ASC, member_id ASC
      `,
      values,
    );

    return metricSnapshots.rows.map((snapshot) => ({
      scope: snapshot.scope,
      projectKey: snapshot.project_key,
      ...(snapshot.member_id ? { memberId: snapshot.member_id } : {}),
      periodStart: toIsoString(snapshot.period_start),
      periodEnd: toIsoString(snapshot.period_end),
      acceptedAiLines: snapshot.accepted_ai_lines,
      commitTotalLines: snapshot.commit_total_lines,
      aiOutputRate: snapshot.ai_output_rate,
      sessionCount: snapshot.session_count,
      memberCount: snapshot.member_count,
    }));
  }

  async saveEnterpriseMetricSnapshots(
    snapshots: EnterpriseMetricSnapshotRecord[],
  ): Promise<void> {
    await this.ensureSchema();

    await Promise.all(
      snapshots.map((snapshot) =>
        this.database.query(
          `
            INSERT INTO enterprise_metric_snapshots (
              metric_key,
              value,
              unit,
              confidence,
              scope,
              project_key,
              member_id,
              team_key,
              period_start,
              period_end,
              calculated_at,
              definition_version,
              data_requirements,
              definition
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (
              metric_key,
              scope,
              project_key,
              member_id,
              team_key,
              period_start,
              period_end,
              definition_version
            )
            DO UPDATE SET
              value = EXCLUDED.value,
              unit = EXCLUDED.unit,
              confidence = EXCLUDED.confidence,
              calculated_at = EXCLUDED.calculated_at,
              data_requirements = EXCLUDED.data_requirements,
              definition = EXCLUDED.definition,
              updated_at = NOW()
          `,
          [
            snapshot.metricKey,
            snapshot.value,
            snapshot.unit,
            snapshot.confidence,
            snapshot.scope,
            snapshot.projectKey,
            snapshot.memberId ?? '',
            snapshot.teamKey ?? '',
            snapshot.periodStart,
            snapshot.periodEnd,
            snapshot.calculatedAt,
            snapshot.definitionVersion,
            snapshot.dataRequirements,
            snapshot.definition,
          ],
        ),
      ),
    );
  }

  async listEnterpriseMetricSnapshots(
    filters: MetricSnapshotFilters = {},
  ): Promise<EnterpriseMetricSnapshotRecord[]> {
    await this.ensureSchema();

    const values: Array<string | string[]> = [];
    const whereClauses: string[] = [];

    appendProjectFilterClauses(values, whereClauses, filters, 'project_key');

    if (filters.memberId) {
      values.push(filters.memberId);
      whereClauses.push(`member_id = $${values.length}`);
    }

    if (filters.from) {
      values.push(filters.from);
      whereClauses.push(`period_start >= $${values.length}`);
    }

    if (filters.to) {
      values.push(filters.to);
      whereClauses.push(`period_end <= $${values.length}`);
    }

    if (filters.metricKeys && filters.metricKeys.length > 0) {
      values.push(filters.metricKeys);
      whereClauses.push(`metric_key = ANY($${values.length})`);
    }

    const snapshots = await this.database.query<{
      metric_key: string;
      value: number;
      unit: EnterpriseMetricSnapshotRecord['unit'];
      confidence: EnterpriseMetricSnapshotRecord['confidence'];
      scope: EnterpriseMetricSnapshotRecord['scope'];
      project_key: string;
      member_id: string;
      team_key: string;
      period_start: Date | string;
      period_end: Date | string;
      calculated_at: Date | string;
      definition_version: number;
      data_requirements: EnterpriseMetricSnapshotRecord['dataRequirements'];
      definition: EnterpriseMetricSnapshotRecord['definition'];
    }>(
      `
        SELECT
          metric_key,
          value,
          unit,
          confidence,
          scope,
          project_key,
          member_id,
          team_key,
          period_start,
          period_end,
          calculated_at,
          definition_version,
          data_requirements,
          definition
        FROM enterprise_metric_snapshots
        ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''}
        ORDER BY period_start ASC, metric_key ASC, scope ASC, member_id ASC
      `,
      values,
    );

    return snapshots.rows.map((snapshot) => ({
      metricKey: snapshot.metric_key,
      value: Number(snapshot.value),
      unit: snapshot.unit,
      confidence: snapshot.confidence,
      scope: snapshot.scope,
      projectKey: snapshot.project_key,
      ...(snapshot.member_id ? { memberId: snapshot.member_id } : {}),
      ...(snapshot.team_key ? { teamKey: snapshot.team_key } : {}),
      periodStart: toIsoString(snapshot.period_start),
      periodEnd: toIsoString(snapshot.period_end),
      calculatedAt: toIsoString(snapshot.calculated_at),
      definitionVersion: snapshot.definition_version,
      dataRequirements: snapshot.data_requirements,
      definition: snapshot.definition,
    }));
  }

  async getGovernanceDirectory(): Promise<GovernanceDirectory> {
    await this.ensureSchema();

    const organizationResult = await this.database.query<{
      organization_key: string;
      name: string;
    }>(`
      SELECT organization_key, name
      FROM governance_organizations
      ORDER BY organization_key ASC
      LIMIT 1
    `);
    const organization = organizationResult.rows[0];

    if (!organization) {
      return cloneGovernanceDirectory(defaultGovernanceDirectory);
    }

    const teamsResult = await this.database.query<{
      team_key: string;
      organization_key: string;
      name: string;
    }>(
      `
        SELECT team_key, organization_key, name
        FROM governance_teams
        WHERE organization_key = $1
        ORDER BY team_key ASC
      `,
      [organization.organization_key],
    );

    const projectsResult = await this.database.query<{
      project_key: string;
      team_key: string;
      name: string;
    }>(
      `
        SELECT projects.project_key, projects.team_key, projects.name
        FROM governance_projects projects
        INNER JOIN governance_teams teams
          ON teams.team_key = projects.team_key
        WHERE teams.organization_key = $1
        ORDER BY projects.project_key ASC
      `,
      [organization.organization_key],
    );

    const membersResult = await this.database.query<{
      member_id: string;
      display_name: string;
      team_key: string;
      role: GovernanceMember['role'];
    }>(
      `
        SELECT
          members.member_id,
          members.display_name,
          memberships.team_key,
          memberships.role
        FROM governance_members members
        INNER JOIN governance_team_memberships memberships
          ON memberships.member_id = members.member_id
        INNER JOIN governance_teams teams
          ON teams.team_key = memberships.team_key
        WHERE teams.organization_key = $1
          AND memberships.is_primary = TRUE
        ORDER BY members.member_id ASC
      `,
      [organization.organization_key],
    );

    return {
      organization: {
        key: organization.organization_key,
        name: organization.name,
      },
      teams: teamsResult.rows.map((team) => ({
        key: team.team_key,
        name: team.name,
        organizationKey: team.organization_key,
      })),
      projects: projectsResult.rows.map((project) => ({
        key: project.project_key,
        name: project.name,
        teamKey: project.team_key,
      })),
      members: membersResult.rows.map((member) => ({
        memberId: member.member_id,
        displayName: member.display_name,
        teamKey: member.team_key,
        role: member.role,
      })),
    };
  }

  async getGovernanceViewerScope(
    viewerId: string,
  ): Promise<GovernanceViewerScope | undefined> {
    const directory = await this.getGovernanceDirectory();
    const assignment = await this.getViewerScopeAssignment(viewerId);
    const viewer = directory.members.find((member) => member.memberId === viewerId);

    if (!viewer) {
      return undefined;
    }

    if (assignment) {
      return buildGovernanceViewerScopeFromAccess(directory, {
        viewerId,
        role: viewer.role,
        teamKeys: assignment.teamKeys,
        projectKeys: assignment.projectKeys,
      });
    }

    return buildGovernanceViewerScope(directory, viewerId);
  }

  async replaceViewerScopeAssignment(
    input: GovernanceViewerScopeAssignment,
  ): Promise<ViewerScopeAssignmentRecord> {
    await this.ensureSchema();

    await this.database.query(
      `
        INSERT INTO governance_viewer_scope_assignments (viewer_id)
        VALUES ($1)
        ON CONFLICT (viewer_id)
        DO UPDATE SET
          updated_at = NOW()
      `,
      [input.viewerId],
    );
    await this.database.query(
      `
        DELETE FROM governance_viewer_scope_team_grants
        WHERE viewer_id = $1
      `,
      [input.viewerId],
    );
    await this.database.query(
      `
        DELETE FROM governance_viewer_scope_project_grants
        WHERE viewer_id = $1
      `,
      [input.viewerId],
    );

    await Promise.all(
      input.teamKeys.map((teamKey) =>
        this.database.query(
          `
            INSERT INTO governance_viewer_scope_team_grants (viewer_id, team_key)
            VALUES ($1, $2)
            ON CONFLICT (viewer_id, team_key) DO NOTHING
          `,
          [input.viewerId, teamKey],
        ),
      ),
    );
    await Promise.all(
      input.projectKeys.map((projectKey) =>
        this.database.query(
          `
            INSERT INTO governance_viewer_scope_project_grants (viewer_id, project_key)
            VALUES ($1, $2)
            ON CONFLICT (viewer_id, project_key) DO NOTHING
          `,
          [input.viewerId, projectKey],
        ),
      ),
    );

    return (await this.getViewerScopeAssignment(input.viewerId)) ?? {
      viewerId: input.viewerId,
      teamKeys: [...input.teamKeys],
      projectKeys: [...input.projectKeys],
      updatedAt: new Date().toISOString(),
    };
  }

  async getViewerScopeAssignment(
    viewerId: string,
  ): Promise<ViewerScopeAssignmentRecord | undefined> {
    await this.ensureSchema();

    const assignmentResult = await this.database.query<{
      viewer_id: string;
      updated_at: Date | string;
    }>(
      `
        SELECT viewer_id, updated_at
        FROM governance_viewer_scope_assignments
        WHERE viewer_id = $1
        LIMIT 1
      `,
      [viewerId],
    );
    const assignment = assignmentResult.rows[0];

    if (!assignment) {
      return undefined;
    }

    const [teamGrantResult, projectGrantResult] = await Promise.all([
      this.database.query<{ team_key: string }>(
        `
          SELECT team_key
          FROM governance_viewer_scope_team_grants
          WHERE viewer_id = $1
          ORDER BY team_key ASC
        `,
        [viewerId],
      ),
      this.database.query<{ project_key: string }>(
        `
          SELECT project_key
          FROM governance_viewer_scope_project_grants
          WHERE viewer_id = $1
          ORDER BY project_key ASC
        `,
        [viewerId],
      ),
    ]);

    return {
      viewerId: assignment.viewer_id,
      teamKeys: teamGrantResult.rows.map((row) => row.team_key),
      projectKeys: projectGrantResult.rows.map((row) => row.project_key),
      updatedAt: toIsoString(assignment.updated_at),
    };
  }

  async registerCollectorIdentity(
    input: Omit<CollectorIdentityRecord, 'status' | 'registeredAt' | 'updatedAt'>,
  ): Promise<CollectorIdentityRecord> {
    await this.ensureSchema();

    const membership = await this.database.query<{
      member_id: string;
    }>(
      `
        SELECT memberships.member_id
        FROM governance_team_memberships memberships
        INNER JOIN governance_projects projects
          ON projects.team_key = memberships.team_key
        WHERE memberships.member_id = $1
          AND projects.project_key = $2
          AND memberships.is_primary = TRUE
        LIMIT 1
      `,
      [input.memberId, input.projectKey],
    );

    if (membership.rows.length === 0) {
      throw new Error('Collector identity member/project mapping is not allowed');
    }

    const result = await this.database.query<{
      identity_key: string;
      member_id: string;
      project_key: string;
      repo_name: string;
      tool_profile: string;
      status: 'active';
      registered_at: Date | string;
      updated_at: Date | string;
    }>(
      `
        INSERT INTO governance_collector_identities (
          identity_key,
          member_id,
          project_key,
          repo_name,
          tool_profile
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (identity_key)
        DO UPDATE SET
          member_id = EXCLUDED.member_id,
          project_key = EXCLUDED.project_key,
          repo_name = EXCLUDED.repo_name,
          tool_profile = EXCLUDED.tool_profile,
          status = 'active',
          updated_at = NOW()
        RETURNING
          identity_key,
          member_id,
          project_key,
          repo_name,
          tool_profile,
          status,
          registered_at,
          updated_at
      `,
      [
        input.identityKey,
        input.memberId,
        input.projectKey,
        input.repoName,
        input.toolProfile,
      ],
    );

    const row = result.rows[0];

    return {
      identityKey: row.identity_key,
      memberId: row.member_id,
      projectKey: row.project_key,
      repoName: row.repo_name,
      toolProfile: row.tool_profile,
      status: row.status,
      registeredAt: toIsoString(row.registered_at),
      updatedAt: toIsoString(row.updated_at),
    };
  }

  async getCollectorIdentity(
    identityKey: string,
  ): Promise<CollectorIdentityRecord | undefined> {
    await this.ensureSchema();

    const result = await this.database.query<{
      identity_key: string;
      member_id: string;
      project_key: string;
      repo_name: string;
      tool_profile: string;
      status: 'active';
      registered_at: Date | string;
      updated_at: Date | string;
    }>(
      `
        SELECT
          identity_key,
          member_id,
          project_key,
          repo_name,
          tool_profile,
          status,
          registered_at,
          updated_at
        FROM governance_collector_identities
        WHERE identity_key = $1
        LIMIT 1
      `,
      [identityKey],
    );

    const row = result.rows[0];

    if (!row) {
      return undefined;
    }

    return {
      identityKey: row.identity_key,
      memberId: row.member_id,
      projectKey: row.project_key,
      repoName: row.repo_name,
      toolProfile: row.tool_profile,
      status: row.status,
      registeredAt: toIsoString(row.registered_at),
      updatedAt: toIsoString(row.updated_at),
    };
  }

  async disconnect(): Promise<void> {
    await this.database.end?.();
  }
}

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const extractRequirementKeys = (text: string): string[] => [
  ...new Set(
    Array.from(text.matchAll(/\b([A-Z][A-Z0-9]+-\d+)\b/g)).map(
      (match) => match[1],
    ),
  ),
];

const calculateCycleTimeHours = (
  createdAt: string,
  mergedAt: string,
): number =>
  Math.max(0, new Date(mergedAt).getTime() - new Date(createdAt).getTime()) /
  (1000 * 60 * 60);
