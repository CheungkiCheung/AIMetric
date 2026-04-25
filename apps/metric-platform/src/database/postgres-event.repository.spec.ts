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

  it('persists recalculated enterprise metric snapshots', async () => {
    const uniqueProjectKey = `enterprise-snapshot-project-${Date.now()}`;
    const repository = new PostgresMetricEventRepository();
    services.push(repository);

    await repository.saveEnterpriseMetricSnapshots([
      {
        metricKey: 'ai_session_count',
        value: 2,
        unit: 'count',
        confidence: 'high',
        scope: 'team',
        projectKey: uniqueProjectKey,
        periodStart: '2026-04-23T00:00:00.000Z',
        periodEnd: '2026-04-24T00:00:00.000Z',
        calculatedAt: '2026-04-24T01:00:00.000Z',
        definitionVersion: 1,
        dataRequirements: ['recorded-metric-events'],
        definition: {
          key: 'ai_session_count',
          name: 'AI 会话数',
          dimension: 'adoption',
          question: '团队在哪些项目和场景中持续使用 AI。',
          formula: '周期内有效 AI 会话总数',
          dataSources: ['mcp-events', 'tool-adapter-events'],
          automationLevel: 'high',
          updateFrequency: 'near-real-time',
          dashboardPlacement: 'effectiveness-management',
          assessmentUsage: 'observe-only',
          antiGamingNote: '会话数必须与会话深度、编辑证据和采纳结果交叉分析。',
        },
      },
    ]);

    const snapshots = await repository.listEnterpriseMetricSnapshots({
      projectKey: uniqueProjectKey,
      metricKeys: ['ai_session_count'],
    });

    expect(snapshots).toContainEqual(
      expect.objectContaining({
        metricKey: 'ai_session_count',
        value: 2,
        unit: 'count',
        confidence: 'high',
        scope: 'team',
        projectKey: uniqueProjectKey,
        definitionVersion: 1,
        dataRequirements: ['recorded-metric-events'],
        definition: expect.objectContaining({
          key: 'ai_session_count',
          name: 'AI 会话数',
        }),
      }),
    );
  });
});

describe('PostgresMetricEventRepository query mapping', () => {
  it('upserts and lists enterprise metric snapshots', async () => {
    const queries: Array<{ text: string; values?: unknown[] }> = [];
    const repository = new PostgresMetricEventRepository({
      async query<T extends QueryResultRow = QueryResultRow>(
        text: string,
        values?: unknown[],
      ) {
        queries.push({ text, values });

        if (
          text.includes('CREATE TABLE') ||
          text.includes('CREATE UNIQUE INDEX') ||
          text.includes('INSERT INTO enterprise_metric_snapshots')
        ) {
          return {
            command: '',
            rowCount: 0,
            oid: 0,
            fields: [],
            rows: [] as T[],
          };
        }

        return {
          command: '',
          rowCount: 1,
          oid: 0,
          fields: [],
          rows: ([
            {
              metric_key: 'ai_session_count',
              value: 2,
              unit: 'count',
              confidence: 'high',
              scope: 'team',
              project_key: 'navigation',
              member_id: '',
              team_key: '',
              period_start: new Date('2026-04-23T00:00:00.000Z'),
              period_end: new Date('2026-04-24T00:00:00.000Z'),
              calculated_at: new Date('2026-04-24T01:00:00.000Z'),
              definition_version: 1,
              data_requirements: ['recorded-metric-events'],
              definition: {
                key: 'ai_session_count',
                name: 'AI 会话数',
                dimension: 'adoption',
                question: '团队在哪些项目和场景中持续使用 AI。',
                formula: '周期内有效 AI 会话总数',
                dataSources: ['mcp-events', 'tool-adapter-events'],
                automationLevel: 'high',
                updateFrequency: 'near-real-time',
                dashboardPlacement: 'effectiveness-management',
                assessmentUsage: 'observe-only',
                antiGamingNote: '会话数必须与会话深度、编辑证据和采纳结果交叉分析。',
              },
            },
          ] as unknown) as T[],
        };
      },
    });

    await repository.saveEnterpriseMetricSnapshots([
      {
        metricKey: 'ai_session_count',
        value: 2,
        unit: 'count',
        confidence: 'high',
        scope: 'team',
        projectKey: 'navigation',
        periodStart: '2026-04-23T00:00:00.000Z',
        periodEnd: '2026-04-24T00:00:00.000Z',
        calculatedAt: '2026-04-24T01:00:00.000Z',
        definitionVersion: 1,
        dataRequirements: ['recorded-metric-events'],
        definition: {
          key: 'ai_session_count',
          name: 'AI 会话数',
          dimension: 'adoption',
          question: '团队在哪些项目和场景中持续使用 AI。',
          formula: '周期内有效 AI 会话总数',
          dataSources: ['mcp-events', 'tool-adapter-events'],
          automationLevel: 'high',
          updateFrequency: 'near-real-time',
          dashboardPlacement: 'effectiveness-management',
          assessmentUsage: 'observe-only',
          antiGamingNote: '会话数必须与会话深度、编辑证据和采纳结果交叉分析。',
        },
      },
    ]);

    const snapshots = await repository.listEnterpriseMetricSnapshots({
      projectKey: 'navigation',
      metricKeys: ['ai_session_count'],
    });

    const insertQuery = queries.find((query) =>
      query.text.includes('INSERT INTO enterprise_metric_snapshots'),
    );
    expect(insertQuery?.text).toContain('ON CONFLICT');
    expect(insertQuery?.values?.[0]).toBe('ai_session_count');
    expect(snapshots).toEqual([
      expect.objectContaining({
        metricKey: 'ai_session_count',
        value: 2,
        projectKey: 'navigation',
        definitionVersion: 1,
      }),
    ]);
    expect(queries.at(-1)?.text).toContain('metric_key = ANY');
    expect(queries.at(-1)?.values).toEqual([
      'navigation',
      ['ai_session_count'],
    ]);
  });

  it('seeds and maps the governance directory from PostgreSQL tables', async () => {
    const queries: Array<{ text: string; values?: unknown[] }> = [];
    const repository = new PostgresMetricEventRepository({
      async query<T extends QueryResultRow = QueryResultRow>(
        text: string,
        values?: unknown[],
      ) {
        queries.push({ text, values });

        if (text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX')) {
          return {
            command: '',
            rowCount: 0,
            oid: 0,
            fields: [],
            rows: [] as T[],
          };
        }

        if (text.includes('SELECT COUNT(*) AS organization_count')) {
          return {
            command: '',
            rowCount: 1,
            oid: 0,
            fields: [],
            rows: ([{ organization_count: '0' }] as unknown) as T[],
          };
        }

        if (text.includes('INSERT INTO governance_')) {
          return {
            command: '',
            rowCount: 1,
            oid: 0,
            fields: [],
            rows: [] as T[],
          };
        }

        if (text.includes('FROM governance_organizations')) {
          return {
            command: '',
            rowCount: 1,
            oid: 0,
            fields: [],
            rows: ([
              {
                organization_key: 'aimetric-enterprise',
                name: 'AIMetric Enterprise',
              },
            ] as unknown) as T[],
          };
        }

        if (text.includes('FROM governance_teams')) {
          return {
            command: '',
            rowCount: 1,
            oid: 0,
            fields: [],
            rows: ([
              {
                team_key: 'platform-engineering',
                organization_key: 'aimetric-enterprise',
                name: '平台工程团队',
              },
            ] as unknown) as T[],
          };
        }

        if (text.includes('FROM governance_projects')) {
          return {
            command: '',
            rowCount: 1,
            oid: 0,
            fields: [],
            rows: ([
              {
                project_key: 'aimetric',
                team_key: 'platform-engineering',
                name: 'AIMetric',
              },
            ] as unknown) as T[],
          };
        }

        return {
          command: '',
          rowCount: 1,
          oid: 0,
          fields: [],
          rows: ([
            {
              member_id: 'alice',
              display_name: 'Alice',
              team_key: 'platform-engineering',
              role: 'developer',
            },
          ] as unknown) as T[],
        };
      },
    });

    const directory = await repository.getGovernanceDirectory();

    expect(directory).toEqual({
      organization: {
        key: 'aimetric-enterprise',
        name: 'AIMetric Enterprise',
      },
      teams: [
        {
          key: 'platform-engineering',
          name: '平台工程团队',
          organizationKey: 'aimetric-enterprise',
        },
      ],
      projects: [
        {
          key: 'aimetric',
          name: 'AIMetric',
          teamKey: 'platform-engineering',
        },
      ],
      members: [
        {
          memberId: 'alice',
          displayName: 'Alice',
          teamKey: 'platform-engineering',
          role: 'developer',
        },
      ],
    });
    expect(
      queries.some((query) =>
        query.text.includes('INSERT INTO governance_team_memberships'),
      ),
    ).toBe(true);
    expect(queries.at(-1)?.values).toEqual(['aimetric-enterprise']);
  });

  it('registers and resolves collector identities through query mapping', async () => {
    const queries: Array<{ text: string; values?: unknown[] }> = [];
    const repository = new PostgresMetricEventRepository({
      async query<T extends QueryResultRow = QueryResultRow>(
        text: string,
        values?: unknown[],
      ) {
        queries.push({ text, values });

        if (text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX')) {
          return {
            command: '',
            rowCount: 0,
            oid: 0,
            fields: [],
            rows: [] as T[],
          };
        }

        if (text.includes('SELECT COUNT(*) AS organization_count')) {
          return {
            command: '',
            rowCount: 1,
            oid: 0,
            fields: [],
            rows: ([{ organization_count: '1' }] as unknown) as T[],
          };
        }

        if (text.includes('FROM governance_team_memberships memberships')) {
          return {
            command: '',
            rowCount: 1,
            oid: 0,
            fields: [],
            rows: ([{ member_id: 'alice' }] as unknown) as T[],
          };
        }

        if (text.includes('INSERT INTO governance_collector_identities')) {
          return {
            command: '',
            rowCount: 1,
            oid: 0,
            fields: [],
            rows: ([
              {
                identity_key: 'aimetric:alice:cursor:aimetric',
                member_id: 'alice',
                project_key: 'aimetric',
                repo_name: 'AIMetric',
                tool_profile: 'cursor',
                status: 'active',
                registered_at: new Date('2026-04-25T00:00:00.000Z'),
                updated_at: new Date('2026-04-25T00:00:00.000Z'),
              },
            ] as unknown) as T[],
          };
        }

        return {
          command: '',
          rowCount: 1,
          oid: 0,
          fields: [],
          rows: ([
            {
              identity_key: 'aimetric:alice:cursor:aimetric',
              member_id: 'alice',
              project_key: 'aimetric',
              repo_name: 'AIMetric',
              tool_profile: 'cursor',
              status: 'active',
              registered_at: new Date('2026-04-25T00:00:00.000Z'),
              updated_at: new Date('2026-04-25T00:00:00.000Z'),
            },
          ] as unknown) as T[],
        };
      },
    });

    const registered = await repository.registerCollectorIdentity({
      identityKey: 'aimetric:alice:cursor:aimetric',
      memberId: 'alice',
      projectKey: 'aimetric',
      repoName: 'AIMetric',
      toolProfile: 'cursor',
    });
    const resolved = await repository.getCollectorIdentity(
      'aimetric:alice:cursor:aimetric',
    );

    expect(registered).toMatchObject({
      identityKey: 'aimetric:alice:cursor:aimetric',
      memberId: 'alice',
      status: 'active',
    });
    expect(resolved).toMatchObject({
      projectKey: 'aimetric',
      toolProfile: 'cursor',
    });
    expect(
      queries.some((query) =>
        query.text.includes('INSERT INTO governance_collector_identities'),
      ),
    ).toBe(true);
  });

  it('prefers explicit viewer scope assignments over default team scope', async () => {
    const queries: Array<{ text: string; values?: unknown[] }> = [];
    const repository = new PostgresMetricEventRepository({
      async query<T extends QueryResultRow = QueryResultRow>(
        text: string,
        values?: unknown[],
      ) {
        queries.push({ text, values });

        if (text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX')) {
          return {
            command: '',
            rowCount: 0,
            oid: 0,
            fields: [],
            rows: [] as T[],
          };
        }

        if (text.includes('SELECT COUNT(*) AS organization_count')) {
          return {
            command: '',
            rowCount: 1,
            oid: 0,
            fields: [],
            rows: ([{ organization_count: '1' }] as unknown) as T[],
          };
        }

        if (text.includes('FROM governance_organizations')) {
          return {
            command: '',
            rowCount: 1,
            oid: 0,
            fields: [],
            rows: ([{ organization_key: 'enterprise-a', name: 'Enterprise A' }] as unknown) as T[],
          };
        }

        if (text.includes('FROM governance_teams')) {
          return {
            command: '',
            rowCount: 2,
            oid: 0,
            fields: [],
            rows: ([
              { team_key: 'team-a', organization_key: 'enterprise-a', name: 'Team A' },
              { team_key: 'team-b', organization_key: 'enterprise-a', name: 'Team B' },
            ] as unknown) as T[],
          };
        }

        if (text.includes('FROM governance_projects projects')) {
          return {
            command: '',
            rowCount: 2,
            oid: 0,
            fields: [],
            rows: ([
              { project_key: 'project-a', team_key: 'team-a', name: 'Project A' },
              { project_key: 'project-b', team_key: 'team-b', name: 'Project B' },
            ] as unknown) as T[],
          };
        }

        if (text.includes('memberships.is_primary = TRUE')) {
          return {
            command: '',
            rowCount: 2,
            oid: 0,
            fields: [],
            rows: ([
              {
                member_id: 'manager-1',
                display_name: 'Manager 1',
                team_key: 'team-a',
                role: 'engineering-manager',
              },
              {
                member_id: 'developer-2',
                display_name: 'Developer 2',
                team_key: 'team-b',
                role: 'developer',
              },
            ] as unknown) as T[],
          };
        }

        if (text.includes('FROM governance_viewer_scope_assignments')) {
          return {
            command: '',
            rowCount: 1,
            oid: 0,
            fields: [],
            rows: ([
              {
                viewer_id: 'manager-1',
                updated_at: new Date('2026-04-25T00:00:00.000Z'),
              },
            ] as unknown) as T[],
          };
        }

        if (text.includes('FROM governance_viewer_scope_team_grants')) {
          return {
            command: '',
            rowCount: 0,
            oid: 0,
            fields: [],
            rows: [] as T[],
          };
        }

        return {
          command: '',
          rowCount: 1,
          oid: 0,
          fields: [],
          rows: ([{ project_key: 'project-b' }] as unknown) as T[],
        };
      },
    });

    const scope = await repository.getGovernanceViewerScope('manager-1');

    expect(scope).toMatchObject({
      viewerId: 'manager-1',
      teamKeys: ['team-b'],
      projectKeys: ['project-b'],
      memberIds: ['developer-2'],
    });
    expect(
      queries.some((query) =>
        query.text.includes('FROM governance_viewer_scope_project_grants'),
      ),
    ).toBe(true);
  });

  it('imports and summarizes github pull requests through query mapping', async () => {
    const queries: Array<{ text: string; values?: unknown[] }> = [];
    const repository = new PostgresMetricEventRepository({
      async query<T extends QueryResultRow = QueryResultRow>(
        text: string,
        values?: unknown[],
      ) {
        queries.push({ text, values });

        if (text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX')) {
          return {
            command: '',
            rowCount: 0,
            oid: 0,
            fields: [],
            rows: [] as T[],
          };
        }

        if (text.includes('SELECT COUNT(*) AS organization_count')) {
          return {
            command: '',
            rowCount: 1,
            oid: 0,
            fields: [],
            rows: ([{ organization_count: '1' }] as unknown) as T[],
          };
        }

        if (text.includes('INSERT INTO github_pull_requests')) {
          return {
            command: '',
            rowCount: 1,
            oid: 0,
            fields: [],
            rows: [] as T[],
          };
        }

        return {
          command: '',
          rowCount: 2,
          oid: 0,
          fields: [],
          rows: ([
            {
              project_key: 'aimetric',
              repo_name: 'AIMetric',
              pr_number: 101,
              title: 'Add PR provider integration',
              author_member_id: 'alice',
              state: 'merged',
              ai_touched: true,
              review_decision: 'approved',
              created_at: new Date('2026-04-25T00:00:00.000Z'),
              merged_at: new Date('2026-04-25T12:00:00.000Z'),
              updated_at: new Date('2026-04-25T12:00:00.000Z'),
            },
            {
              project_key: 'aimetric',
              repo_name: 'AIMetric',
              pr_number: 102,
              title: 'Add delivery summary',
              author_member_id: 'bob',
              state: 'open',
              ai_touched: false,
              review_decision: null,
              created_at: new Date('2026-04-26T00:00:00.000Z'),
              merged_at: null,
              updated_at: new Date('2026-04-26T04:00:00.000Z'),
            },
          ] as unknown) as T[],
        };
      },
    });

    await repository.importPullRequests([
      {
        provider: 'github',
        projectKey: 'aimetric',
        repoName: 'AIMetric',
        prNumber: 101,
        title: 'Add PR provider integration',
        authorMemberId: 'alice',
        state: 'merged',
        aiTouched: true,
        createdAt: '2026-04-25T00:00:00.000Z',
        mergedAt: '2026-04-25T12:00:00.000Z',
        updatedAt: '2026-04-25T12:00:00.000Z',
      },
    ]);
    const pullRequests = await repository.listPullRequests({
      projectKey: 'aimetric',
    });
    const summary = await repository.buildPullRequestSummary({
      projectKey: 'aimetric',
    });

    expect(pullRequests).toEqual([
      expect.objectContaining({
        prNumber: 101,
        cycleTimeHours: 12,
      }),
      expect.objectContaining({
        prNumber: 102,
        aiTouched: false,
      }),
    ]);
    expect(summary).toEqual({
      totalPrCount: 2,
      aiTouchedPrCount: 1,
      aiTouchedPrRatio: 0.5,
      mergedPrCount: 1,
      averageCycleTimeHours: 12,
    });
    expect(
      queries.some((query) => query.text.includes('INSERT INTO github_pull_requests')),
    ).toBe(true);
  });

  it('imports and summarizes requirements through query mapping', async () => {
    const queries: Array<{ text: string; values?: unknown[] }> = [];
    const repository = new PostgresMetricEventRepository({
      async query<T extends QueryResultRow = QueryResultRow>(
        text: string,
        values?: unknown[],
      ) {
        queries.push({ text, values });

        if (text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX')) {
          return {
            command: '',
            rowCount: 0,
            oid: 0,
            fields: [],
            rows: [] as T[],
          };
        }

        if (text.includes('SELECT COUNT(*) AS organization_count')) {
          return {
            command: '',
            rowCount: 1,
            oid: 0,
            fields: [],
            rows: ([{ organization_count: '1' }] as unknown) as T[],
          };
        }

        if (text.includes('INSERT INTO delivery_requirements')) {
          return {
            command: '',
            rowCount: 1,
            oid: 0,
            fields: [],
            rows: [] as T[],
          };
        }

        return {
          command: '',
          rowCount: 2,
          oid: 0,
          fields: [],
          rows: ([
            {
              provider: 'jira',
              project_key: 'aimetric',
              requirement_key: 'AIM-101',
              title: 'Build management dashboard',
              owner_member_id: 'alice',
              status: 'done',
              ai_touched: true,
              first_pr_created_at: new Date('2026-04-25T06:00:00.000Z'),
              completed_at: new Date('2026-04-26T00:00:00.000Z'),
              created_at: new Date('2026-04-25T00:00:00.000Z'),
              updated_at: new Date('2026-04-26T00:00:00.000Z'),
            },
            {
              provider: 'tapd',
              project_key: 'aimetric',
              requirement_key: 'TAPD-7',
              title: 'Integrate requirement feed',
              owner_member_id: 'bob',
              status: 'in-progress',
              ai_touched: false,
              first_pr_created_at: new Date('2026-04-26T08:00:00.000Z'),
              completed_at: null,
              created_at: new Date('2026-04-26T00:00:00.000Z'),
              updated_at: new Date('2026-04-26T08:00:00.000Z'),
            },
          ] as unknown) as T[],
        };
      },
    });

    await repository.importRequirements([
      {
        provider: 'jira',
        projectKey: 'aimetric',
        requirementKey: 'AIM-101',
        title: 'Build management dashboard',
        ownerMemberId: 'alice',
        status: 'done',
        aiTouched: true,
        firstPrCreatedAt: '2026-04-25T06:00:00.000Z',
        completedAt: '2026-04-26T00:00:00.000Z',
        createdAt: '2026-04-25T00:00:00.000Z',
        updatedAt: '2026-04-26T00:00:00.000Z',
      },
    ]);
    const requirements = await repository.listRequirements({
      projectKey: 'aimetric',
    });
    const summary = await repository.buildRequirementSummary({
      projectKey: 'aimetric',
    });

    expect(requirements).toEqual([
      expect.objectContaining({
        requirementKey: 'AIM-101',
        leadTimeHours: 24,
        leadTimeToFirstPrHours: 6,
      }),
      expect.objectContaining({
        requirementKey: 'TAPD-7',
        aiTouched: false,
        leadTimeToFirstPrHours: 8,
      }),
    ]);
    expect(summary).toEqual({
      totalRequirementCount: 2,
      aiTouchedRequirementCount: 1,
      aiTouchedRequirementRatio: 0.5,
      completedRequirementCount: 1,
      averageLeadTimeHours: 24,
      averageLeadTimeToFirstPrHours: 7,
    });
    expect(
      queries.some((query) => query.text.includes('INSERT INTO delivery_requirements')),
    ).toBe(true);
  });

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
