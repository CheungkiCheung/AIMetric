import { Pool, type QueryResult, type QueryResultRow } from 'pg';
import type { IngestionBatch } from '@aimetric/event-schema';

export interface RecordedMetricEvent {
  memberId: string;
  acceptedAiLines: number;
  commitTotalLines: number;
  sessionCount: number;
}

export interface MetricSnapshotFilters {
  projectKey?: string;
  memberId?: string;
  from?: string;
  to?: string;
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

export interface MetricEventRepository {
  saveIngestionBatch(batch: IngestionBatch): Promise<void>;
  listRecordedMetricEvents(
    filters?: MetricSnapshotFilters,
  ): Promise<RecordedMetricEvent[]>;
  saveMetricSnapshots(snapshots: MetricSnapshotRecord[]): Promise<void>;
  listMetricSnapshots(
    filters?: MetricSnapshotFilters,
  ): Promise<MetricSnapshotRecord[]>;
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
          payload JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `).then(async () => {
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
      });
    }

    await this.schemaReady;
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
              payload
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
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

    const values: string[] = [];
    const whereClauses = [`event_type = 'session.recorded'`];

    if (filters.projectKey) {
      values.push(filters.projectKey);
      whereClauses.push(`project_key = $${values.length}`);
    }

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

    const values: string[] = [];
    const whereClauses: string[] = [];

    if (filters.projectKey) {
      values.push(filters.projectKey);
      whereClauses.push(`project_key = $${values.length}`);
    }

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

  async disconnect(): Promise<void> {
    await this.database.end?.();
  }
}

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();
