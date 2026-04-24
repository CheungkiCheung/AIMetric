import { afterEach, describe, expect, it } from 'vitest';
import type { QueryResultRow } from 'pg';
import { PostgresMetricEventRepository } from './postgres-event.repository.js';

const describeIfDatabase =
  process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

describeIfDatabase('PostgresMetricEventRepository', () => {
  const services: PostgresMetricEventRepository[] = [];

  afterEach(async () => {
    await Promise.all(services.map((service) => service.disconnect()));
    services.length = 0;
  });

  it('persists recorded metric events across service instances', async () => {
    const uniqueMemberId = `member-${Date.now()}`;
    const writer = new PostgresMetricEventRepository();
    services.push(writer);

    await writer.saveIngestionBatch({
      schemaVersion: 'v1',
      source: 'cursor',
      events: [
        {
          eventType: 'session.recorded',
          occurredAt: '2026-04-23T00:00:00.000Z',
          payload: {
            sessionId: 'sess-db-1',
            projectKey: 'proj',
            repoName: 'repo',
            memberId: uniqueMemberId,
            acceptedAiLines: 52,
            commitTotalLines: 70,
          },
        },
      ],
    });

    const reader = new PostgresMetricEventRepository();
    services.push(reader);

    const recordedMetricEvents = await reader.listRecordedMetricEvents();

    expect(recordedMetricEvents).toContainEqual({
      memberId: uniqueMemberId,
      acceptedAiLines: 52,
      commitTotalLines: 70,
      sessionCount: 1,
    });
  });

  it('filters recorded metric events by project, member, and time range', async () => {
    const uniqueProjectKey = `project-${Date.now()}`;
    const repository = new PostgresMetricEventRepository();
    services.push(repository);

    await repository.saveIngestionBatch({
      schemaVersion: 'v1',
      source: 'cursor',
      events: [
        {
          eventType: 'session.recorded',
          occurredAt: '2026-04-23T00:00:00.000Z',
          payload: {
            sessionId: 'sess-filter-1',
            projectKey: uniqueProjectKey,
            repoName: 'repo',
            memberId: 'alice',
            acceptedAiLines: 30,
            commitTotalLines: 60,
          },
        },
        {
          eventType: 'session.recorded',
          occurredAt: '2026-04-24T00:00:00.000Z',
          payload: {
            sessionId: 'sess-filter-2',
            projectKey: uniqueProjectKey,
            repoName: 'repo',
            memberId: 'bob',
            acceptedAiLines: 50,
            commitTotalLines: 100,
          },
        },
      ],
    });

    const recordedMetricEvents = await repository.listRecordedMetricEvents({
      projectKey: uniqueProjectKey,
      memberId: 'alice',
      from: '2026-04-22T00:00:00.000Z',
      to: '2026-04-23T23:59:59.999Z',
    });

    expect(recordedMetricEvents).toEqual([
      {
        memberId: 'alice',
        acceptedAiLines: 30,
        commitTotalLines: 60,
        sessionCount: 1,
      },
    ]);
  });

  it('persists recalculated metric snapshots', async () => {
    const uniqueProjectKey = `snapshot-project-${Date.now()}`;
    const repository = new PostgresMetricEventRepository();
    services.push(repository);

    await repository.saveMetricSnapshots([
      {
        scope: 'team',
        projectKey: uniqueProjectKey,
        periodStart: '2026-04-23T00:00:00.000Z',
        periodEnd: '2026-04-24T00:00:00.000Z',
        acceptedAiLines: 50,
        commitTotalLines: 100,
        aiOutputRate: 0.5,
        sessionCount: 2,
        memberCount: 2,
      },
    ]);

    const snapshots = await repository.listMetricSnapshots({
      projectKey: uniqueProjectKey,
      from: '2026-04-23T00:00:00.000Z',
      to: '2026-04-24T00:00:00.000Z',
    });

    expect(snapshots).toContainEqual({
      scope: 'team',
      projectKey: uniqueProjectKey,
      periodStart: '2026-04-23T00:00:00.000Z',
      periodEnd: '2026-04-24T00:00:00.000Z',
      acceptedAiLines: 50,
      commitTotalLines: 100,
      aiOutputRate: 0.5,
      sessionCount: 2,
      memberCount: 2,
    });
  });
});

describe('PostgresMetricEventRepository query mapping', () => {
  it('includes ingestion_key in insert statements for deduplicated session events', async () => {
    const queries: Array<{ text: string; values?: unknown[] }> = [];
    const repository = new PostgresMetricEventRepository({
      async query<T extends QueryResultRow = QueryResultRow>(
        text: string,
        values?: unknown[],
      ) {
        queries.push({ text, values });

        return {
          command: '',
          rowCount: 0,
          oid: 0,
          fields: [],
          rows: [] as T[],
        };
      },
    });

    await repository.saveIngestionBatch({
      schemaVersion: 'v1',
      source: 'cursor-db',
      events: [
        {
          eventType: 'session.recorded',
          occurredAt: '2026-04-24T00:00:00.000Z',
          payload: {
            sessionId: 'cursor-session-1',
            projectKey: 'aimetric',
            repoName: 'AIMetric',
            memberId: 'alice',
            ingestionKey:
              'cursor-db:cursor-session-1:2026-04-24T00:00:00.000Z:abc',
          },
        },
      ],
    });

    const insertQuery = queries.find((query) =>
      query.text.includes('INSERT INTO metric_events'),
    );

    expect(insertQuery?.text).toContain('ingestion_key');
    expect(insertQuery?.text).toContain('ON CONFLICT (source, ingestion_key)');
    expect(insertQuery?.values?.[10]).toBe(
      'cursor-db:cursor-session-1:2026-04-24T00:00:00.000Z:abc',
    );
  });

  it('aggregates MCP audit metrics from metric events', async () => {
    const queries: Array<{ text: string; values?: unknown[] }> = [];
    const repository = new PostgresMetricEventRepository({
      async query<T extends QueryResultRow = QueryResultRow>(
        text: string,
        values?: unknown[],
      ) {
        queries.push({ text, values });

        if (text.includes('CREATE TABLE')) {
          return {
            command: '',
            rowCount: 0,
            oid: 0,
            fields: [],
            rows: [],
          };
        }

        return {
          command: '',
          rowCount: 1,
          oid: 0,
          fields: [],
          rows: ([
            {
              total_tool_calls: '3',
              successful_tool_calls: '2',
              failed_tool_calls: '1',
              average_duration_ms: '15',
            },
          ] as unknown) as T[],
        };
      },
    });

    const metrics = await repository.buildMcpAuditMetrics({
      projectKey: 'aimetric',
      memberId: 'alice',
      from: '2026-04-23T00:00:00.000Z',
      to: '2026-04-24T00:00:00.000Z',
    });

    expect(metrics).toEqual({
      totalToolCalls: 3,
      successfulToolCalls: 2,
      failedToolCalls: 1,
      successRate: 2 / 3,
      failureRate: 1 / 3,
      averageDurationMs: 15,
    });
    expect(queries.at(-1)?.text).toContain("event_type = 'mcp.tool.called'");
    expect(queries.at(-1)?.values).toEqual([
      'aimetric',
      'alice',
      '2026-04-23T00:00:00.000Z',
      '2026-04-24T00:00:00.000Z',
    ]);
  });

  it('lists edit span evidence from metric events with filters', async () => {
    const queries: Array<{ text: string; values?: unknown[] }> = [];
    const repository = new PostgresMetricEventRepository({
      async query<T extends QueryResultRow = QueryResultRow>(
        text: string,
        values?: unknown[],
      ) {
        queries.push({ text, values });

        if (text.includes('CREATE TABLE')) {
          return {
            command: '',
            rowCount: 0,
            oid: 0,
            fields: [],
            rows: [],
          };
        }

        return {
          command: '',
          rowCount: 1,
          oid: 0,
          fields: [],
          rows: ([
            {
              edit_span_id: 'edit-span-1',
              session_id: 'sess_1',
              file_path: '/repo/src/demo.ts',
              occurred_at: new Date('2026-04-24T00:00:00.000Z'),
              diff: '--- /repo/src/demo.ts',
              before_snapshot_hash: 'before-hash',
              after_snapshot_hash: 'after-hash',
              tool_profile: 'cursor',
            },
          ] as unknown) as T[],
        };
      },
    });

    const evidence = await repository.listEditSpanEvidence({
      projectKey: 'aimetric',
      sessionId: 'sess_1',
      filePath: '/repo/src/demo.ts',
      from: '2026-04-23T00:00:00.000Z',
      to: '2026-04-24T00:00:00.000Z',
    });

    expect(evidence).toEqual([
      {
        editSpanId: 'edit-span-1',
        sessionId: 'sess_1',
        filePath: '/repo/src/demo.ts',
        occurredAt: '2026-04-24T00:00:00.000Z',
        diff: '--- /repo/src/demo.ts',
        beforeSnapshotHash: 'before-hash',
        afterSnapshotHash: 'after-hash',
        toolProfile: 'cursor',
      },
    ]);
    expect(queries.at(-1)?.text).toContain("event_type = 'edit.span.recorded'");
    expect(queries.at(-1)?.values).toEqual([
      'aimetric',
      'sess_1',
      '/repo/src/demo.ts',
      '2026-04-23T00:00:00.000Z',
      '2026-04-24T00:00:00.000Z',
    ]);
  });

  it('lists tab accepted events from metric events with filters', async () => {
    const queries: Array<{ text: string; values?: unknown[] }> = [];
    const repository = new PostgresMetricEventRepository({
      async query<T extends QueryResultRow = QueryResultRow>(
        text: string,
        values?: unknown[],
      ) {
        queries.push({ text, values });

        if (text.includes('CREATE TABLE')) {
          return {
            command: '',
            rowCount: 0,
            oid: 0,
            fields: [],
            rows: [],
          };
        }

        return {
          command: '',
          rowCount: 1,
          oid: 0,
          fields: [],
          rows: ([
            {
              session_id: 'sess_1',
              occurred_at: new Date('2026-04-24T00:03:00.000Z'),
              accepted_lines: 2,
              file_path: '/repo/src/demo.ts',
              language: 'typescript',
              ingestion_key: 'cursor-tab:sess_1:2026-04-24T00:03:00.000Z:abc',
            },
          ] as unknown) as T[],
        };
      },
    });

    const events = await repository.listTabAcceptedEvents({
      projectKey: 'aimetric',
      sessionId: 'sess_1',
      filePath: '/repo/src/demo.ts',
      from: '2026-04-23T00:00:00.000Z',
      to: '2026-04-24T00:00:00.000Z',
    });

    expect(events).toEqual([
      {
        sessionId: 'sess_1',
        occurredAt: '2026-04-24T00:03:00.000Z',
        acceptedLines: 2,
        filePath: '/repo/src/demo.ts',
        language: 'typescript',
        ingestionKey: 'cursor-tab:sess_1:2026-04-24T00:03:00.000Z:abc',
      },
    ]);
    expect(queries.at(-1)?.text).toContain("event_type = 'tab.accepted'");
    expect(queries.at(-1)?.values).toEqual([
      'aimetric',
      'sess_1',
      '/repo/src/demo.ts',
      '2026-04-23T00:00:00.000Z',
      '2026-04-24T00:00:00.000Z',
    ]);
  });

  it('builds analysis summary aggregates from metric events', async () => {
    const queries: Array<{ text: string; values?: unknown[] }> = [];
    const repository = new PostgresMetricEventRepository({
      async query<T extends QueryResultRow = QueryResultRow>(
        text: string,
        values?: unknown[],
      ) {
        queries.push({ text, values });

        if (text.includes('CREATE TABLE')) {
          return {
            command: '',
            rowCount: 0,
            oid: 0,
            fields: [],
            rows: [],
          };
        }

        return {
          command: '',
          rowCount: 1,
          oid: 0,
          fields: [],
          rows: ([
            {
              session_count: '2',
              edit_span_count: '3',
              tab_accepted_count: '4',
              tab_accepted_lines: '9',
            },
          ] as unknown) as T[],
        };
      },
    });

    const summary = await repository.buildAnalysisSummary({
      projectKey: 'aimetric',
      from: '2026-04-24T00:00:00.000Z',
      to: '2026-04-25T00:00:00.000Z',
    });

    expect(summary).toEqual({
      sessionCount: 2,
      editSpanCount: 3,
      tabAcceptedCount: 4,
      tabAcceptedLines: 9,
    });
    expect(queries.at(-1)?.text).toContain("event_type = 'session.recorded'");
    expect(queries.at(-1)?.text).toContain("event_type = 'edit.span.recorded'");
    expect(queries.at(-1)?.text).toContain("event_type = 'tab.accepted'");
  });

  it('builds session analysis rows with edit and tab aggregates', async () => {
    const queries: Array<{ text: string; values?: unknown[] }> = [];
    const repository = new PostgresMetricEventRepository({
      async query<T extends QueryResultRow = QueryResultRow>(
        text: string,
        values?: unknown[],
      ) {
        queries.push({ text, values });

        if (text.includes('CREATE TABLE')) {
          return {
            command: '',
            rowCount: 0,
            oid: 0,
            fields: [],
            rows: [],
          };
        }

        return {
          command: '',
          rowCount: 1,
          oid: 0,
          fields: [],
          rows: ([
            {
              session_id: 'sess_1',
              member_id: 'alice',
              project_key: 'aimetric',
              occurred_at: new Date('2026-04-24T00:05:00.000Z'),
              conversation_turns: '3',
              user_message_count: '3',
              assistant_message_count: '3',
              first_message_at: '2026-04-24T00:00:00.000Z',
              last_message_at: '2026-04-24T00:05:00.000Z',
              workspace_id: 'workspace-1',
              workspace_path: '/repo',
              project_fingerprint: 'fingerprint-1',
              edit_span_count: '2',
              tab_accepted_count: '2',
              tab_accepted_lines: '5',
            },
          ] as unknown) as T[],
        };
      },
    });

    const rows = await repository.listSessionAnalysisRows({
      projectKey: 'aimetric',
    });

    expect(rows).toEqual([
      {
        sessionId: 'sess_1',
        memberId: 'alice',
        projectKey: 'aimetric',
        occurredAt: '2026-04-24T00:05:00.000Z',
        conversationTurns: 3,
        userMessageCount: 3,
        assistantMessageCount: 3,
        firstMessageAt: '2026-04-24T00:00:00.000Z',
        lastMessageAt: '2026-04-24T00:05:00.000Z',
        workspaceId: 'workspace-1',
        workspacePath: '/repo',
        projectFingerprint: 'fingerprint-1',
        editSpanCount: 2,
        tabAcceptedCount: 2,
        tabAcceptedLines: 5,
      },
    ]);
    expect(queries.at(-1)?.text).toContain("event_type = 'session.recorded'");
  });

  it('builds output analysis rows grouped by session and file path', async () => {
    const queries: Array<{ text: string; values?: unknown[] }> = [];
    const repository = new PostgresMetricEventRepository({
      async query<T extends QueryResultRow = QueryResultRow>(
        text: string,
        values?: unknown[],
      ) {
        queries.push({ text, values });

        if (text.includes('CREATE TABLE')) {
          return {
            command: '',
            rowCount: 0,
            oid: 0,
            fields: [],
            rows: [],
          };
        }

        return {
          command: '',
          rowCount: 1,
          oid: 0,
          fields: [],
          rows: ([
            {
              session_id: 'sess_1',
              member_id: 'alice',
              project_key: 'aimetric',
              file_path: '/repo/src/demo.ts',
              edit_span_count: '2',
              latest_edit_at: new Date('2026-04-24T00:05:00.000Z'),
              tab_accepted_count: '2',
              tab_accepted_lines: '5',
              latest_diff_summary: '--- /repo/src/demo.ts',
            },
          ] as unknown) as T[],
        };
      },
    });

    const rows = await repository.listOutputAnalysisRows({
      projectKey: 'aimetric',
    });

    expect(rows).toEqual([
      {
        sessionId: 'sess_1',
        memberId: 'alice',
        projectKey: 'aimetric',
        filePath: '/repo/src/demo.ts',
        editSpanCount: 2,
        latestEditAt: '2026-04-24T00:05:00.000Z',
        tabAcceptedCount: 2,
        tabAcceptedLines: 5,
        latestDiffSummary: '--- /repo/src/demo.ts',
      },
    ]);
    expect(queries.at(-1)?.text).toContain("event_type = 'edit.span.recorded'");
  });
});
