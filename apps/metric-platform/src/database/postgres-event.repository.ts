import { Pool, type QueryResult, type QueryResultRow } from 'pg';
import type { IngestionBatch } from '@aimetric/event-schema';

export interface RecordedMetricEvent {
  memberId: string;
  acceptedAiLines: number;
  commitTotalLines: number;
  sessionCount: number;
}

export interface MetricEventRepository {
  saveIngestionBatch(batch: IngestionBatch): Promise<void>;
  listRecordedMetricEvents(): Promise<RecordedMetricEvent[]>;
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
      `).then(() => undefined);
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

  async listRecordedMetricEvents(): Promise<RecordedMetricEvent[]> {
    await this.ensureSchema();

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
      WHERE event_type = 'session.recorded'
      ORDER BY occurred_at ASC, id ASC
    `);

    return metricEvents.rows.map((event) => ({
      memberId: event.member_id ?? event.session_id,
      acceptedAiLines: event.accepted_ai_lines ?? 0,
      commitTotalLines: event.commit_total_lines ?? 0,
      sessionCount: 1,
    }));
  }

  async disconnect(): Promise<void> {
    await this.database.end?.();
  }
}
