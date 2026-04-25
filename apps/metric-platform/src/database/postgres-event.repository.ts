import { Pool, type QueryResult, type QueryResultRow } from 'pg';
import type { IngestionBatch } from '@aimetric/event-schema';
import type { MetricCalculationResult } from '@aimetric/metric-core';
import {
  buildGovernanceViewerScope,
  cloneGovernanceDirectory,
  defaultGovernanceDirectory,
  type GovernanceDirectory,
  type GovernanceMember,
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

    return buildGovernanceViewerScope(directory, viewerId);
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
