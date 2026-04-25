import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootstrap } from './main.js';
import type {
  AnalysisSummaryRecord,
  EditSpanEvidenceRecord,
  MetricEventRepository,
  OutputAnalysisRow,
  RecordedMetricEvent,
  SessionAnalysisRow,
  TabAcceptedEventRecord,
} from './database/postgres-event.repository.js';

describe('bootstrap', () => {
  const servers: Array<{ close: () => Promise<void> }> = [];
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(servers.map((server) => server.close()));
    servers.length = 0;
    temporaryDirectories.splice(0).forEach((directory) => {
      rmSync(directory, { recursive: true, force: true });
    });
    vi.useRealTimers();
  });

  it('serves personal and team metric snapshots over HTTP', async () => {
    const recordedMetricEvents: RecordedMetricEvent[] = [];
    const metricEventRepository: MetricEventRepository = {
      async saveIngestionBatch(batch) {
        recordedMetricEvents.push(
          ...batch.events
            .filter((event) => event.eventType === 'session.recorded')
            .map((event) => ({
              memberId:
                typeof event.payload.memberId === 'string'
                  ? event.payload.memberId
                  : event.payload.sessionId,
              acceptedAiLines:
                typeof event.payload.acceptedAiLines === 'number'
                  ? event.payload.acceptedAiLines
                  : 0,
              commitTotalLines:
                typeof event.payload.commitTotalLines === 'number'
                  ? event.payload.commitTotalLines
                  : 0,
              sessionCount: 1,
            })),
        );
      },
      async listRecordedMetricEvents() {
        return [...recordedMetricEvents];
      },
      async saveMetricSnapshots() {
        return undefined;
      },
      async listMetricSnapshots() {
        return [];
      },
      async buildMcpAuditMetrics() {
        return emptyMcpAuditMetrics();
      },
      async listEditSpanEvidence() {
        return [];
      },
      async listTabAcceptedEvents() {
        return [];
      },
      async disconnect() {
        return undefined;
      },
    };

    const app = await bootstrap({ port: 0, metricEventRepository });
    servers.push(app);

    const importResponse = await fetch(`${app.baseUrl}/events/import`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        schemaVersion: 'v1',
        source: 'cursor',
        events: [
          {
            eventType: 'session.recorded',
            occurredAt: '2026-04-23T00:00:00.000Z',
            payload: {
              sessionId: 'sess_1',
              projectKey: 'proj',
              repoName: 'repo',
              memberId: 'alice',
              acceptedAiLines: 44,
              commitTotalLines: 55,
            },
          },
          {
            eventType: 'session.recorded',
            occurredAt: '2026-04-23T00:05:00.000Z',
            payload: {
              sessionId: 'sess_2',
              projectKey: 'proj',
              repoName: 'repo',
              memberId: 'bob',
              acceptedAiLines: 46,
              commitTotalLines: 65,
            },
          },
        ],
      }),
    });
    const personalResponse = await fetch(`${app.baseUrl}/metrics/personal`);
    const teamResponse = await fetch(`${app.baseUrl}/metrics/team`);

    expect(importResponse.status).toBe(200);
    expect(personalResponse.status).toBe(200);
    expect(teamResponse.status).toBe(200);

    const personalSnapshot = await personalResponse.json();
    const teamSnapshot = await teamResponse.json();

    expect(personalSnapshot.acceptedAiLines).toBe(44);
    expect(personalSnapshot.aiOutputRate).toBe(0.8);
    expect(teamSnapshot.totalAcceptedAiLines).toBe(90);
    expect(teamSnapshot.totalCommitLines).toBe(120);
    expect(teamSnapshot.aiOutputRate).toBe(0.75);
    expect(teamSnapshot.memberCount).toBe(2);
  });

  it('serves the enterprise metric catalog over HTTP', async () => {
    const app = await bootstrap({
      port: 0,
      metricEventRepository: createEmptyRepository(),
    });
    servers.push(app);

    const response = await fetch(`${app.baseUrl}/enterprise-metrics/catalog`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      dimensions: [
        expect.objectContaining({
          key: 'adoption',
          name: '使用渗透',
        }),
        expect.objectContaining({
          key: 'effective-output',
          name: '有效产出',
        }),
        expect.objectContaining({
          key: 'delivery-efficiency',
          name: '交付效率',
        }),
        expect.objectContaining({
          key: 'quality-risk',
          name: '质量与风险',
        }),
        expect.objectContaining({
          key: 'experience-capability',
          name: '体验与能力',
        }),
        expect.objectContaining({
          key: 'business-value',
          name: '业务与经济价值',
        }),
      ],
      metrics: expect.arrayContaining([
        expect.objectContaining({
          key: 'ai_ide_user_ratio',
          dashboardPlacement: 'effectiveness-management',
        }),
        expect.objectContaining({
          key: 'lead_time_ai_vs_non_ai',
          dashboardPlacement: 'engineering-management',
        }),
      ]),
    });
  });

  it('serves the organization governance directory over HTTP', async () => {
    const app = await bootstrap({
      port: 0,
      metricEventRepository: createEmptyRepository(),
    });
    servers.push(app);

    const response = await fetch(`${app.baseUrl}/governance/directory`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      organization: {
        key: 'aimetric-enterprise',
      },
      teams: [
        expect.objectContaining({
          key: 'platform-engineering',
        }),
      ],
      projects: [
        expect.objectContaining({
          key: 'aimetric',
        }),
      ],
      members: [
        expect.objectContaining({
          memberId: 'alice',
        }),
      ],
    });
  });

  it('serves the persisted governance directory over HTTP when the repository provides it', async () => {
    const metricEventRepository: MetricEventRepository = {
      ...createEmptyRepository(),
      async getGovernanceDirectory() {
        return {
          organization: {
            key: 'enterprise-a',
            name: 'Enterprise A',
          },
          teams: [
            {
              key: 'team-a',
              name: 'Team A',
              organizationKey: 'enterprise-a',
            },
          ],
          projects: [
            {
              key: 'project-a',
              name: 'Project A',
              teamKey: 'team-a',
            },
          ],
          members: [
            {
              memberId: 'manager-1',
              displayName: 'Manager 1',
              teamKey: 'team-a',
              role: 'engineering-manager',
            },
          ],
        };
      },
    };
    const app = await bootstrap({
      port: 0,
      metricEventRepository,
    });
    servers.push(app);

    const response = await fetch(`${app.baseUrl}/governance/directory`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      organization: {
        key: 'enterprise-a',
      },
      teams: [
        expect.objectContaining({
          key: 'team-a',
        }),
      ],
      members: [
        expect.objectContaining({
          role: 'engineering-manager',
        }),
      ],
    });
  });

  it('filters the governance directory by viewer scope over HTTP', async () => {
    const metricEventRepository: MetricEventRepository = {
      ...createEmptyRepository(),
      async getGovernanceDirectory() {
        return {
          organization: {
            key: 'enterprise-a',
            name: 'Enterprise A',
          },
          teams: [
            {
              key: 'team-a',
              name: 'Team A',
              organizationKey: 'enterprise-a',
            },
            {
              key: 'team-b',
              name: 'Team B',
              organizationKey: 'enterprise-a',
            },
          ],
          projects: [
            {
              key: 'project-a',
              name: 'Project A',
              teamKey: 'team-a',
            },
            {
              key: 'project-b',
              name: 'Project B',
              teamKey: 'team-b',
            },
          ],
          members: [
            {
              memberId: 'manager-1',
              displayName: 'Manager 1',
              teamKey: 'team-a',
              role: 'engineering-manager',
            },
            {
              memberId: 'developer-2',
              displayName: 'Developer 2',
              teamKey: 'team-b',
              role: 'developer',
            },
          ],
        };
      },
      async getGovernanceViewerScope(viewerId) {
        if (viewerId !== 'manager-1') {
          return undefined;
        }

        return {
          viewerId: 'manager-1',
          role: 'engineering-manager',
          organizationKey: 'enterprise-a',
          teamKeys: ['team-a'],
          projectKeys: ['project-a'],
          memberIds: ['manager-1'],
        };
      },
    };
    const app = await bootstrap({
      port: 0,
      metricEventRepository,
    });
    servers.push(app);

    const response = await fetch(`${app.baseUrl}/governance/directory`, {
      headers: {
        'x-aimetric-viewer-id': 'manager-1',
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      organization: {
        key: 'enterprise-a',
        name: 'Enterprise A',
      },
      teams: [
        {
          key: 'team-a',
          name: 'Team A',
          organizationKey: 'enterprise-a',
        },
      ],
      projects: [
        {
          key: 'project-a',
          name: 'Project A',
          teamKey: 'team-a',
        },
      ],
      members: [
        {
          memberId: 'manager-1',
          displayName: 'Manager 1',
          teamKey: 'team-a',
          role: 'engineering-manager',
        },
      ],
    });
  });

  it('rejects metric requests outside the viewer scope over HTTP', async () => {
    const listCalls: unknown[] = [];
    const metricEventRepository: MetricEventRepository = {
      ...createEmptyRepository(),
      async listRecordedMetricEvents(filters?: unknown) {
        listCalls.push(filters);
        return [];
      },
      async getGovernanceViewerScope(viewerId) {
        if (viewerId !== 'manager-1') {
          return undefined;
        }

        return {
          viewerId: 'manager-1',
          role: 'engineering-manager',
          organizationKey: 'enterprise-a',
          teamKeys: ['team-a'],
          projectKeys: ['project-a'],
          memberIds: ['manager-1'],
        };
      },
    };
    const app = await bootstrap({
      port: 0,
      metricEventRepository,
    });
    servers.push(app);

    const deniedResponse = await fetch(
      `${app.baseUrl}/metrics/team?projectKey=project-b`,
      {
        headers: {
          'x-aimetric-viewer-id': 'manager-1',
        },
      },
    );

    expect(deniedResponse.status).toBe(403);
    expect(listCalls).toHaveLength(0);

    const allowedResponse = await fetch(`${app.baseUrl}/metrics/team`, {
      headers: {
        'x-aimetric-viewer-id': 'manager-1',
      },
    });

    expect(allowedResponse.status).toBe(200);
    expect(listCalls[0]).toEqual({
      projectKeys: ['project-a'],
    });
  });

  it('registers and resolves collector identities over HTTP', async () => {
    const metricEventRepository: MetricEventRepository = {
      ...createEmptyRepository(),
      async registerCollectorIdentity(input) {
        return {
          ...input,
          status: 'active',
          registeredAt: '2026-04-25T00:00:00.000Z',
          updatedAt: '2026-04-25T00:00:00.000Z',
        };
      },
      async getCollectorIdentity(identityKey) {
        if (identityKey !== 'aimetric:alice:cursor:aimetric') {
          return undefined;
        }

        return {
          identityKey,
          memberId: 'alice',
          projectKey: 'aimetric',
          repoName: 'AIMetric',
          toolProfile: 'cursor',
          status: 'active',
          registeredAt: '2026-04-25T00:00:00.000Z',
          updatedAt: '2026-04-25T00:00:00.000Z',
        };
      },
    };
    const app = await bootstrap({
      port: 0,
      metricEventRepository,
    });
    servers.push(app);

    const registerResponse = await fetch(
      `${app.baseUrl}/governance/collector-identities/register`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          identityKey: 'aimetric:alice:cursor:aimetric',
          memberId: 'alice',
          projectKey: 'aimetric',
          repoName: 'AIMetric',
          toolProfile: 'cursor',
        }),
      },
    );
    const resolveResponse = await fetch(
      `${app.baseUrl}/governance/collector-identities/resolve?identityKey=aimetric%3Aalice%3Acursor%3Aaimetric`,
    );

    expect(registerResponse.status).toBe(200);
    await expect(registerResponse.json()).resolves.toMatchObject({
      identityKey: 'aimetric:alice:cursor:aimetric',
      status: 'active',
    });
    expect(resolveResponse.status).toBe(200);
    await expect(resolveResponse.json()).resolves.toMatchObject({
      memberId: 'alice',
      projectKey: 'aimetric',
    });
  });

  it('updates and reads viewer scope assignments over admin HTTP APIs', async () => {
    const metricEventRepository: MetricEventRepository = {
      ...createEmptyRepository(),
      async replaceViewerScopeAssignment(input) {
        return {
          ...input,
          updatedAt: '2026-04-25T00:00:00.000Z',
        };
      },
      async getViewerScopeAssignment(viewerId) {
        if (viewerId !== 'manager-1') {
          return undefined;
        }

        return {
          viewerId,
          teamKeys: ['team-a'],
          projectKeys: ['project-b'],
          updatedAt: '2026-04-25T00:00:00.000Z',
        };
      },
    };
    const app = await bootstrap({
      port: 0,
      adminToken: 'admin-secret',
      metricEventRepository,
    });
    servers.push(app);

    const updateResponse = await fetch(`${app.baseUrl}/governance/viewer-scopes`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer admin-secret',
        'content-type': 'application/json',
        'x-aimetric-actor': 'platform-admin',
      },
      body: JSON.stringify({
        viewerId: 'manager-1',
        teamKeys: ['team-a'],
        projectKeys: ['project-b'],
      }),
    });
    const readResponse = await fetch(
      `${app.baseUrl}/governance/viewer-scopes?viewerId=manager-1`,
      {
        headers: {
          authorization: 'Bearer admin-secret',
        },
      },
    );
    const auditResponse = await fetch(`${app.baseUrl}/admin/audit`, {
      headers: {
        authorization: 'Bearer admin-secret',
      },
    });

    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({
      viewerId: 'manager-1',
      teamKeys: ['team-a'],
      projectKeys: ['project-b'],
    });
    expect(readResponse.status).toBe(200);
    await expect(readResponse.json()).resolves.toMatchObject({
      viewerId: 'manager-1',
      projectKeys: ['project-b'],
    });
    await expect(auditResponse.json()).resolves.toEqual([
      expect.objectContaining({
        action: 'governance.viewer-scopes.update',
        actor: 'platform-admin',
      }),
    ]);
  });

  it('imports and serves GitHub pull request data over HTTP', async () => {
    const importedPullRequests: unknown[] = [];
    const metricEventRepository: MetricEventRepository = {
      ...createEmptyRepository(),
      async importPullRequests(pullRequests) {
        importedPullRequests.push(...pullRequests);
      },
      async listPullRequests(filters) {
        expect(filters).toEqual({ projectKey: 'aimetric' });

        return [
          {
            provider: 'github' as const,
            projectKey: 'aimetric',
            repoName: 'AIMetric',
            prNumber: 101,
            title: 'Add PR provider integration',
            authorMemberId: 'alice',
            state: 'merged' as const,
            aiTouched: true,
            reviewDecision: 'approved' as const,
            createdAt: '2026-04-25T00:00:00.000Z',
            mergedAt: '2026-04-25T12:00:00.000Z',
            cycleTimeHours: 12,
            updatedAt: '2026-04-25T12:00:00.000Z',
          },
          {
            provider: 'github' as const,
            projectKey: 'aimetric',
            repoName: 'AIMetric',
            prNumber: 102,
            title: 'Add delivery summary',
            authorMemberId: 'bob',
            state: 'open' as const,
            aiTouched: false,
            createdAt: '2026-04-26T00:00:00.000Z',
            updatedAt: '2026-04-26T04:00:00.000Z',
          },
        ];
      },
      async buildPullRequestSummary() {
        return {
          totalPrCount: 2,
          aiTouchedPrCount: 1,
          aiTouchedPrRatio: 0.5,
          mergedPrCount: 1,
          averageCycleTimeHours: 12,
        };
      },
    };
    const app = await bootstrap({
      port: 0,
      adminToken: 'admin-secret',
      metricEventRepository,
    });
    servers.push(app);

    const importResponse = await fetch(
      `${app.baseUrl}/integrations/github/pull-requests/import`,
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer admin-secret',
          'content-type': 'application/json',
          'x-aimetric-actor': 'platform-admin',
        },
        body: JSON.stringify({
          pullRequests: [
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
          ],
        }),
      },
    );
    const listResponse = await fetch(
      `${app.baseUrl}/integrations/github/pull-requests?projectKey=aimetric`,
    );
    const summaryResponse = await fetch(
      `${app.baseUrl}/integrations/github/pull-requests/summary?projectKey=aimetric`,
    );
    const auditResponse = await fetch(`${app.baseUrl}/admin/audit`, {
      headers: {
        authorization: 'Bearer admin-secret',
      },
    });

    expect(importResponse.status).toBe(200);
    await expect(importResponse.json()).resolves.toEqual({
      importedPullRequests: 1,
    });
    expect(importedPullRequests).toHaveLength(1);
    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toEqual([
      expect.objectContaining({
        prNumber: 101,
        aiTouched: true,
      }),
      expect.objectContaining({
        prNumber: 102,
        aiTouched: false,
      }),
    ]);
    expect(summaryResponse.status).toBe(200);
    await expect(summaryResponse.json()).resolves.toEqual({
      totalPrCount: 2,
      aiTouchedPrCount: 1,
      aiTouchedPrRatio: 0.5,
      mergedPrCount: 1,
      averageCycleTimeHours: 12,
    });
    await expect(auditResponse.json()).resolves.toEqual([
      expect.objectContaining({
        action: 'github.pull-requests.import',
        actor: 'platform-admin',
      }),
    ]);
  });

  it('imports and serves requirement data over HTTP', async () => {
    const importedRequirements: unknown[] = [];
    const metricEventRepository: MetricEventRepository = {
      ...createEmptyRepository(),
      async importRequirements(requirements) {
        importedRequirements.push(...requirements);
      },
      async listRequirements(filters) {
        expect(filters).toEqual({ projectKey: 'aimetric' });

        return [
          {
            provider: 'jira' as const,
            projectKey: 'aimetric',
            requirementKey: 'AIM-101',
            title: 'Build management dashboard',
            ownerMemberId: 'alice',
            status: 'done' as const,
            aiTouched: true,
            firstPrCreatedAt: '2026-04-25T06:00:00.000Z',
            completedAt: '2026-04-26T00:00:00.000Z',
            leadTimeHours: 24,
            leadTimeToFirstPrHours: 6,
            createdAt: '2026-04-25T00:00:00.000Z',
            updatedAt: '2026-04-26T00:00:00.000Z',
          },
          {
            provider: 'tapd' as const,
            projectKey: 'aimetric',
            requirementKey: 'TAPD-7',
            title: 'Integrate requirement feed',
            ownerMemberId: 'bob',
            status: 'in-progress' as const,
            aiTouched: false,
            firstPrCreatedAt: '2026-04-26T08:00:00.000Z',
            leadTimeToFirstPrHours: 8,
            createdAt: '2026-04-26T00:00:00.000Z',
            updatedAt: '2026-04-26T08:00:00.000Z',
          },
        ];
      },
      async buildRequirementSummary() {
        return {
          totalRequirementCount: 2,
          aiTouchedRequirementCount: 1,
          aiTouchedRequirementRatio: 0.5,
          completedRequirementCount: 1,
          averageLeadTimeHours: 24,
          averageLeadTimeToFirstPrHours: 7,
        };
      },
    };
    const app = await bootstrap({
      port: 0,
      adminToken: 'admin-secret',
      metricEventRepository,
    });
    servers.push(app);

    const importResponse = await fetch(
      `${app.baseUrl}/integrations/requirements/import`,
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer admin-secret',
          'content-type': 'application/json',
          'x-aimetric-actor': 'platform-admin',
        },
        body: JSON.stringify({
          requirements: [
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
          ],
        }),
      },
    );
    const listResponse = await fetch(
      `${app.baseUrl}/integrations/requirements?projectKey=aimetric`,
    );
    const summaryResponse = await fetch(
      `${app.baseUrl}/integrations/requirements/summary?projectKey=aimetric`,
    );
    const auditResponse = await fetch(`${app.baseUrl}/admin/audit`, {
      headers: {
        authorization: 'Bearer admin-secret',
      },
    });

    expect(importResponse.status).toBe(200);
    await expect(importResponse.json()).resolves.toEqual({
      importedRequirements: 1,
    });
    expect(importedRequirements).toHaveLength(1);
    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toEqual([
      expect.objectContaining({
        requirementKey: 'AIM-101',
        aiTouched: true,
      }),
      expect.objectContaining({
        requirementKey: 'TAPD-7',
        aiTouched: false,
      }),
    ]);
    expect(summaryResponse.status).toBe(200);
    await expect(summaryResponse.json()).resolves.toEqual({
      totalRequirementCount: 2,
      aiTouchedRequirementCount: 1,
      aiTouchedRequirementRatio: 0.5,
      completedRequirementCount: 1,
      averageLeadTimeHours: 24,
      averageLeadTimeToFirstPrHours: 7,
    });
    await expect(auditResponse.json()).resolves.toEqual([
      expect.objectContaining({
        action: 'requirements.import',
        actor: 'platform-admin',
      }),
    ]);
  });

  it('serves enterprise metrics filtered by dimension over HTTP', async () => {
    const app = await bootstrap({
      port: 0,
      metricEventRepository: createEmptyRepository(),
    });
    servers.push(app);

    const response = await fetch(
      `${app.baseUrl}/enterprise-metrics?dimension=quality-risk`,
    );
    const metrics = await response.json();

    expect(response.status).toBe(200);
    expect(metrics.length).toBeGreaterThan(0);
    expect(
      metrics.every(
        (metric: { dimension: string }) => metric.dimension === 'quality-risk',
      ),
    ).toBe(true);
    expect(metrics).toContainEqual(
      expect.objectContaining({ key: 'change_failure_rate' }),
    );
  });

  it('serves calculated enterprise metric values over HTTP', async () => {
    const metricEventRepository: MetricEventRepository = {
      ...createEmptyRepository(),
      async listRecordedMetricEvents() {
        return [
          {
            memberId: 'alice',
            acceptedAiLines: 30,
            commitTotalLines: 60,
            sessionCount: 2,
          },
          {
            memberId: 'bob',
            acceptedAiLines: 45,
            commitTotalLines: 90,
            sessionCount: 3,
          },
        ];
      },
      async buildAnalysisSummary() {
        return {
          sessionCount: 5,
          editSpanCount: 4,
          tabAcceptedCount: 6,
          tabAcceptedLines: 18,
        };
      },
      async buildMcpAuditMetrics() {
        return {
          totalToolCalls: 10,
          successfulToolCalls: 8,
          failedToolCalls: 2,
          successRate: 0.8,
          failureRate: 0.2,
          averageDurationMs: 24,
        };
      },
    };
    const app = await bootstrap({ port: 0, metricEventRepository });
    servers.push(app);

    const response = await fetch(
      `${app.baseUrl}/enterprise-metrics/values?projectKey=navigation&from=2026-04-23T00%3A00%3A00.000Z&to=2026-04-24T00%3A00%3A00.000Z`,
    );
    const values = await response.json();

    expect(response.status).toBe(200);
    expect(values).toEqual([
      expect.objectContaining({
        metricKey: 'ai_output_rate',
        value: 0.5,
        projectKey: 'navigation',
        periodStart: '2026-04-23T00:00:00.000Z',
        periodEnd: '2026-04-24T00:00:00.000Z',
        definitionVersion: 1,
        dataRequirements: ['recorded-metric-events'],
      }),
      expect.objectContaining({
        metricKey: 'ai_session_count',
        value: 5,
      }),
      expect.objectContaining({
        metricKey: 'tab_accepted_lines',
        value: 18,
      }),
      expect.objectContaining({
        metricKey: 'mcp_tool_success_rate',
        value: 0.8,
      }),
    ]);
  });

  it('serves selected enterprise metric values over HTTP', async () => {
    const metricEventRepository: MetricEventRepository = {
      ...createEmptyRepository(),
      async listRecordedMetricEvents() {
        return [
          {
            memberId: 'alice',
            acceptedAiLines: 30,
            commitTotalLines: 60,
            sessionCount: 2,
          },
        ];
      },
    };
    const app = await bootstrap({ port: 0, metricEventRepository });
    servers.push(app);

    const response = await fetch(
      `${app.baseUrl}/enterprise-metrics/values?metricKey=ai_session_count`,
    );
    const values = await response.json();

    expect(response.status).toBe(200);
    expect(values).toHaveLength(1);
    expect(values[0]).toMatchObject({
      metricKey: 'ai_session_count',
      value: 2,
    });
  });

  it('recalculates selected enterprise metric snapshots over HTTP', async () => {
    const savedSnapshots: unknown[] = [];
    const metricEventRepository: MetricEventRepository = {
      ...createEmptyRepository(),
      async listRecordedMetricEvents() {
        return [
          {
            memberId: 'alice',
            acceptedAiLines: 30,
            commitTotalLines: 60,
            sessionCount: 2,
          },
        ];
      },
      async saveEnterpriseMetricSnapshots(snapshots) {
        savedSnapshots.push(...snapshots);
      },
    };
    const app = await bootstrap({ port: 0, metricEventRepository });
    servers.push(app);

    const response = await fetch(
      `${app.baseUrl}/enterprise-metrics/recalculate`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          projectKey: 'navigation',
          from: '2026-04-23T00:00:00.000Z',
          to: '2026-04-24T00:00:00.000Z',
          metricKeys: ['ai_session_count'],
        }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      upsertedSnapshots: 1,
      snapshots: [
        expect.objectContaining({
          metricKey: 'ai_session_count',
          value: 2,
          projectKey: 'navigation',
        }),
      ],
    });
    expect(savedSnapshots).toEqual([
      expect.objectContaining({
        metricKey: 'ai_session_count',
        value: 2,
        definitionVersion: 1,
      }),
    ]);
  });

  it('serves persisted enterprise metric snapshots over HTTP', async () => {
    const metricEventRepository: MetricEventRepository = {
      ...createEmptyRepository(),
      async listEnterpriseMetricSnapshots(filters) {
        expect(filters).toEqual({
          projectKey: 'navigation',
          metricKeys: ['ai_session_count'],
        });

        return [
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
        ];
      },
    };
    const app = await bootstrap({ port: 0, metricEventRepository });
    servers.push(app);

    const response = await fetch(
      `${app.baseUrl}/enterprise-metrics/snapshots?projectKey=navigation&metricKey=ai_session_count`,
    );
    const snapshots = await response.json();

    expect(response.status).toBe(200);
    expect(snapshots).toEqual([
      expect.objectContaining({
        metricKey: 'ai_session_count',
        value: 2,
      }),
    ]);
  });

  it('passes metric query parameters from HTTP requests to the repository', async () => {
    const listCalls: unknown[] = [];
    const metricEventRepository: MetricEventRepository = {
      async saveIngestionBatch() {
        return undefined;
      },
      async listRecordedMetricEvents(filters?: unknown) {
        listCalls.push(filters);
        return [
          {
            memberId: 'alice',
            acceptedAiLines: 30,
            commitTotalLines: 60,
            sessionCount: 1,
          },
        ];
      },
      async saveMetricSnapshots() {
        return undefined;
      },
      async listMetricSnapshots() {
        return [];
      },
      async buildMcpAuditMetrics() {
        return emptyMcpAuditMetrics();
      },
      async listEditSpanEvidence() {
        return [];
      },
      async listTabAcceptedEvents() {
        return [];
      },
      async disconnect() {
        return undefined;
      },
    };

    const app = await bootstrap({ port: 0, metricEventRepository });
    servers.push(app);

    const personalResponse = await fetch(
      `${app.baseUrl}/metrics/personal?projectKey=navigation&memberId=alice&from=2026-04-23T00%3A00%3A00.000Z&to=2026-04-24T00%3A00%3A00.000Z`,
    );

    expect(personalResponse.status).toBe(200);
    expect(listCalls[0]).toEqual({
      projectKey: 'navigation',
      memberId: 'alice',
      from: '2026-04-23T00:00:00.000Z',
      to: '2026-04-24T00:00:00.000Z',
    });
  });

  it('recalculates and persists metric snapshots over HTTP', async () => {
    const savedSnapshots: unknown[] = [];
    const metricEventRepository: MetricEventRepository = {
      async saveIngestionBatch() {
        return undefined;
      },
      async listRecordedMetricEvents() {
        return [
          {
            memberId: 'alice',
            acceptedAiLines: 30,
            commitTotalLines: 60,
            sessionCount: 1,
          },
        ];
      },
      async saveMetricSnapshots(snapshots) {
        savedSnapshots.push(...snapshots);
      },
      async listMetricSnapshots() {
        return [];
      },
      async buildMcpAuditMetrics() {
        return emptyMcpAuditMetrics();
      },
      async listEditSpanEvidence() {
        return [];
      },
      async listTabAcceptedEvents() {
        return [];
      },
      async disconnect() {
        return undefined;
      },
    };

    const app = await bootstrap({ port: 0, metricEventRepository });
    servers.push(app);

    const response = await fetch(`${app.baseUrl}/metrics/recalculate`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        projectKey: 'navigation',
        from: '2026-04-23T00:00:00.000Z',
        to: '2026-04-24T00:00:00.000Z',
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      upsertedSnapshots: 2,
    });
    expect(savedSnapshots).toContainEqual(
      expect.objectContaining({
        scope: 'team',
        projectKey: 'navigation',
        acceptedAiLines: 30,
        commitTotalLines: 60,
      }),
    );
  });

  it('requires admin bearer auth for management writes and exposes audit events', async () => {
    const metricEventRepository: MetricEventRepository = createEmptyRepository();
    const app = await bootstrap({
      port: 0,
      adminToken: 'admin-secret',
      metricEventRepository,
    });
    servers.push(app);

    const unauthorizedResponse = await fetch(`${app.baseUrl}/metrics/recalculate`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ projectKey: 'navigation' }),
    });
    const authorizedResponse = await fetch(`${app.baseUrl}/metrics/recalculate`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer admin-secret',
        'content-type': 'application/json',
        'x-aimetric-actor': 'platform-admin',
      },
      body: JSON.stringify({ projectKey: 'navigation' }),
    });
    const auditResponse = await fetch(`${app.baseUrl}/admin/audit`, {
      headers: {
        authorization: 'Bearer admin-secret',
      },
    });

    expect(unauthorizedResponse.status).toBe(401);
    await expect(unauthorizedResponse.json()).resolves.toEqual({
      message: 'Unauthorized admin request',
    });
    expect(authorizedResponse.status).toBe(200);
    expect(auditResponse.status).toBe(200);
    await expect(auditResponse.json()).resolves.toEqual([
      expect.objectContaining({
        action: 'metrics.recalculate',
        actor: 'platform-admin',
        status: 'success',
      }),
    ]);
  });

  it('serves readiness and prometheus metrics endpoints', async () => {
    const metricEventRepository: MetricEventRepository = createEmptyRepository();
    const app = await bootstrap({ port: 0, metricEventRepository });
    servers.push(app);

    const readyResponse = await fetch(`${app.baseUrl}/ready`);
    const metricsResponse = await fetch(`${app.baseUrl}/metrics`);

    expect(readyResponse.status).toBe(200);
    await expect(readyResponse.json()).resolves.toEqual({
      status: 'ready',
      service: 'metric-platform',
    });
    expect(metricsResponse.status).toBe(200);
    expect(metricsResponse.headers.get('content-type')).toContain('text/plain');
    await expect(metricsResponse.text()).resolves.toContain(
      'aimetric_metric_platform_uptime_seconds',
    );
  });

  it('can run snapshot recalculation on a configured interval', async () => {
    vi.useFakeTimers();
    const savedSnapshots: unknown[] = [];
    const metricEventRepository: MetricEventRepository = {
      async saveIngestionBatch() {
        return undefined;
      },
      async listRecordedMetricEvents() {
        return [
          {
            memberId: 'alice',
            acceptedAiLines: 30,
            commitTotalLines: 60,
            sessionCount: 1,
          },
        ];
      },
      async saveMetricSnapshots(snapshots) {
        savedSnapshots.push(...snapshots);
      },
      async listMetricSnapshots() {
        return [];
      },
      async buildMcpAuditMetrics() {
        return emptyMcpAuditMetrics();
      },
      async listEditSpanEvidence() {
        return [];
      },
      async listTabAcceptedEvents() {
        return [];
      },
      async disconnect() {
        return undefined;
      },
    };

    const app = await bootstrap({
      port: 0,
      metricEventRepository,
      snapshotRecalculationIntervalMs: 1_000,
      snapshotRecalculationFilters: {
        projectKey: 'navigation',
      },
    });
    servers.push(app);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(savedSnapshots).toContainEqual(
      expect.objectContaining({
        scope: 'team',
        projectKey: 'navigation',
      }),
    );

    await app.close();
    servers.length = 0;
    savedSnapshots.length = 0;
    await vi.advanceTimersByTimeAsync(1_000);

    expect(savedSnapshots).toEqual([]);
  });

  it('serves persisted metric snapshots over HTTP', async () => {
    const listCalls: unknown[] = [];
    const metricEventRepository: MetricEventRepository = {
      async saveIngestionBatch() {
        return undefined;
      },
      async listRecordedMetricEvents() {
        return [];
      },
      async saveMetricSnapshots() {
        return undefined;
      },
      async listMetricSnapshots(filters) {
        listCalls.push(filters);
        return [
          {
            scope: 'team',
            projectKey: 'navigation',
            periodStart: '2026-04-23T00:00:00.000Z',
            periodEnd: '2026-04-24T00:00:00.000Z',
            acceptedAiLines: 50,
            commitTotalLines: 100,
            aiOutputRate: 0.5,
            sessionCount: 2,
            memberCount: 2,
          },
        ];
      },
      async buildMcpAuditMetrics() {
        return emptyMcpAuditMetrics();
      },
      async listEditSpanEvidence() {
        return [];
      },
      async listTabAcceptedEvents() {
        return [];
      },
      async disconnect() {
        return undefined;
      },
    };

    const app = await bootstrap({ port: 0, metricEventRepository });
    servers.push(app);

    const response = await fetch(
      `${app.baseUrl}/metrics/snapshots?projectKey=navigation`,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      expect.objectContaining({
        scope: 'team',
        projectKey: 'navigation',
      }),
    ]);
    expect(listCalls[0]).toEqual({ projectKey: 'navigation' });
  });

  it('serves MCP audit quality metrics over HTTP', async () => {
    const auditMetricCalls: unknown[] = [];
    const metricEventRepository: MetricEventRepository = {
      async saveIngestionBatch() {
        return undefined;
      },
      async listRecordedMetricEvents() {
        return [];
      },
      async saveMetricSnapshots() {
        return undefined;
      },
      async listMetricSnapshots() {
        return [];
      },
      async buildMcpAuditMetrics(filters) {
        auditMetricCalls.push(filters);
        return {
          totalToolCalls: 3,
          successfulToolCalls: 2,
          failedToolCalls: 1,
          successRate: 2 / 3,
          failureRate: 1 / 3,
          averageDurationMs: 15,
        };
      },
      async listEditSpanEvidence() {
        return [];
      },
      async listTabAcceptedEvents() {
        return [];
      },
      async disconnect() {
        return undefined;
      },
    };

    const app = await bootstrap({ port: 0, metricEventRepository });
    servers.push(app);

    const response = await fetch(
      `${app.baseUrl}/metrics/mcp-audit?projectKey=aimetric&memberId=alice`,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      totalToolCalls: 3,
      successfulToolCalls: 2,
      failedToolCalls: 1,
      successRate: 2 / 3,
      failureRate: 1 / 3,
      averageDurationMs: 15,
    });
    expect(auditMetricCalls[0]).toEqual({
      projectKey: 'aimetric',
      memberId: 'alice',
    });
  });

  it('serves edit span evidence over HTTP', async () => {
    const evidenceCalls: unknown[] = [];
    const editEvidence: EditSpanEvidenceRecord[] = [
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
    ];
    const metricEventRepository: MetricEventRepository = {
      async saveIngestionBatch() {
        return undefined;
      },
      async listRecordedMetricEvents() {
        return [];
      },
      async saveMetricSnapshots() {
        return undefined;
      },
      async listMetricSnapshots() {
        return [];
      },
      async buildMcpAuditMetrics() {
        return emptyMcpAuditMetrics();
      },
      async listEditSpanEvidence(filters) {
        evidenceCalls.push(filters);
        return editEvidence;
      },
      async listTabAcceptedEvents() {
        return [];
      },
      async disconnect() {
        return undefined;
      },
    };

    const app = await bootstrap({ port: 0, metricEventRepository });
    servers.push(app);

    const response = await fetch(
      `${app.baseUrl}/evidence/edits?projectKey=aimetric&sessionId=sess_1&filePath=%2Frepo%2Fsrc%2Fdemo.ts`,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(editEvidence);
    expect(evidenceCalls[0]).toEqual({
      projectKey: 'aimetric',
      sessionId: 'sess_1',
      filePath: '/repo/src/demo.ts',
    });
  });

  it('serves tab accepted events over HTTP', async () => {
    const eventCalls: unknown[] = [];
    const tabEvents: TabAcceptedEventRecord[] = [
      {
        sessionId: 'sess_1',
        occurredAt: '2026-04-24T00:03:00.000Z',
        acceptedLines: 2,
        filePath: '/repo/src/demo.ts',
        language: 'typescript',
        ingestionKey: 'cursor-tab:sess_1:2026-04-24T00:03:00.000Z:abc',
      },
    ];
    const metricEventRepository: MetricEventRepository = {
      async saveIngestionBatch() {
        return undefined;
      },
      async listRecordedMetricEvents() {
        return [];
      },
      async saveMetricSnapshots() {
        return undefined;
      },
      async listMetricSnapshots() {
        return [];
      },
      async buildMcpAuditMetrics() {
        return emptyMcpAuditMetrics();
      },
      async listEditSpanEvidence() {
        return [];
      },
      async listTabAcceptedEvents(filters) {
        eventCalls.push(filters);
        return tabEvents;
      },
      async disconnect() {
        return undefined;
      },
    };

    const app = await bootstrap({ port: 0, metricEventRepository });
    servers.push(app);

    const response = await fetch(
      `${app.baseUrl}/evidence/tab-completions?projectKey=aimetric&sessionId=sess_1&filePath=%2Frepo%2Fsrc%2Fdemo.ts`,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(tabEvents);
    expect(eventCalls[0]).toEqual({
      projectKey: 'aimetric',
      sessionId: 'sess_1',
      filePath: '/repo/src/demo.ts',
    });
  });

  it('serves analysis summary over HTTP', async () => {
    const summaryCalls: unknown[] = [];
    const summary: AnalysisSummaryRecord = {
      sessionCount: 2,
      editSpanCount: 3,
      tabAcceptedCount: 4,
      tabAcceptedLines: 9,
    };
    const metricEventRepository: MetricEventRepository = {
      async saveIngestionBatch() {
        return undefined;
      },
      async listRecordedMetricEvents() {
        return [];
      },
      async saveMetricSnapshots() {
        return undefined;
      },
      async listMetricSnapshots() {
        return [];
      },
      async buildMcpAuditMetrics() {
        return emptyMcpAuditMetrics();
      },
      async listEditSpanEvidence() {
        return [];
      },
      async listTabAcceptedEvents() {
        return [];
      },
      async buildAnalysisSummary(filters) {
        summaryCalls.push(filters);
        return summary;
      },
      async listSessionAnalysisRows() {
        return [];
      },
      async listOutputAnalysisRows() {
        return [];
      },
      async disconnect() {
        return undefined;
      },
    };

    const app = await bootstrap({ port: 0, metricEventRepository });
    servers.push(app);

    const response = await fetch(
      `${app.baseUrl}/analysis/summary?projectKey=aimetric&memberId=alice`,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(summary);
    expect(summaryCalls[0]).toEqual({
      projectKey: 'aimetric',
      memberId: 'alice',
    });
  });

  it('serves session and output analysis rows over HTTP', async () => {
    const sessionCalls: unknown[] = [];
    const outputCalls: unknown[] = [];
    const sessionRows: SessionAnalysisRow[] = [
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
    ];
    const outputRows: OutputAnalysisRow[] = [
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
    ];
    const metricEventRepository: MetricEventRepository = {
      async saveIngestionBatch() {
        return undefined;
      },
      async listRecordedMetricEvents() {
        return [];
      },
      async saveMetricSnapshots() {
        return undefined;
      },
      async listMetricSnapshots() {
        return [];
      },
      async buildMcpAuditMetrics() {
        return emptyMcpAuditMetrics();
      },
      async listEditSpanEvidence() {
        return [];
      },
      async listTabAcceptedEvents() {
        return [];
      },
      async buildAnalysisSummary() {
        return emptyAnalysisSummary();
      },
      async listSessionAnalysisRows(filters) {
        sessionCalls.push(filters);
        return sessionRows;
      },
      async listOutputAnalysisRows(filters) {
        outputCalls.push(filters);
        return outputRows;
      },
      async disconnect() {
        return undefined;
      },
    };

    const app = await bootstrap({ port: 0, metricEventRepository });
    servers.push(app);

    const sessionResponse = await fetch(
      `${app.baseUrl}/analysis/sessions?projectKey=aimetric`,
    );
    const outputResponse = await fetch(
      `${app.baseUrl}/analysis/output?projectKey=aimetric`,
    );

    expect(sessionResponse.status).toBe(200);
    expect(outputResponse.status).toBe(200);
    await expect(sessionResponse.json()).resolves.toEqual(sessionRows);
    await expect(outputResponse.json()).resolves.toEqual(outputRows);
    expect(sessionCalls[0]).toEqual({ projectKey: 'aimetric' });
    expect(outputCalls[0]).toEqual({ projectKey: 'aimetric' });
  });

  it('serves rule center APIs over HTTP', async () => {
    const catalogRoot = createTemporaryRuleCatalogRoot();
    const app = await bootstrap({ port: 0, ruleCatalogRoot: catalogRoot });
    servers.push(app);

    const versionsResponse = await fetch(
      `${app.baseUrl}/rules/versions?projectKey=aimetric`,
    );
    const templateResponse = await fetch(
      `${app.baseUrl}/rules/template?projectKey=aimetric&version=v2`,
    );
    const validationResponse = await fetch(
      `${app.baseUrl}/rules/validate?projectKey=aimetric&version=v2`,
    );
    const activeResponse = await fetch(`${app.baseUrl}/rules/active`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        projectKey: 'aimetric',
        version: 'v1',
      }),
    });
    const defaultRolloutResponse = await fetch(
      `${app.baseUrl}/rules/rollout?projectKey=aimetric`,
    );
    const rolloutUpdateResponse = await fetch(`${app.baseUrl}/rules/rollout`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        projectKey: 'aimetric',
        enabled: true,
        candidateVersion: 'v1',
        percentage: 25,
        includedMembers: ['alice'],
      }),
    });
    const persistedRolloutResponse = await fetch(
      `${app.baseUrl}/rules/rollout?projectKey=aimetric`,
    );
    const rolloutEvaluationResponse = await fetch(
      `${app.baseUrl}/rules/rollout/evaluate?projectKey=aimetric&memberId=alice`,
    );

    expect(versionsResponse.status).toBe(200);
    expect(templateResponse.status).toBe(200);
    expect(validationResponse.status).toBe(200);
    expect(activeResponse.status).toBe(200);
    expect(defaultRolloutResponse.status).toBe(200);
    expect(rolloutUpdateResponse.status).toBe(200);
    expect(persistedRolloutResponse.status).toBe(200);
    expect(rolloutEvaluationResponse.status).toBe(200);
    await expect(versionsResponse.json()).resolves.toMatchObject({
      projectKey: 'aimetric',
      activeVersion: 'v2',
    });
    await expect(templateResponse.json()).resolves.toMatchObject({
      projectKey: 'aimetric',
      version: 'v2',
    });
    await expect(validationResponse.json()).resolves.toMatchObject({
      valid: true,
      activeVersion: 'v2',
    });
    await expect(activeResponse.json()).resolves.toEqual({
      projectKey: 'aimetric',
      previousVersion: 'v2',
      activeVersion: 'v1',
    });
    await expect(defaultRolloutResponse.json()).resolves.toMatchObject({
      projectKey: 'aimetric',
      enabled: false,
      percentage: 0,
      includedMembers: [],
    });
    await expect(rolloutUpdateResponse.json()).resolves.toMatchObject({
      projectKey: 'aimetric',
      enabled: true,
      candidateVersion: 'v1',
      percentage: 25,
      includedMembers: ['alice'],
    });
    await expect(persistedRolloutResponse.json()).resolves.toMatchObject({
      projectKey: 'aimetric',
      enabled: true,
      candidateVersion: 'v1',
      percentage: 25,
      includedMembers: ['alice'],
    });
    await expect(rolloutEvaluationResponse.json()).resolves.toMatchObject({
      projectKey: 'aimetric',
      memberId: 'alice',
      activeVersion: 'v1',
      selectedVersion: 'v1',
      matched: true,
      reason: 'included-member',
    });
  });

  it('serves knowledge search over HTTP', async () => {
    const app = await bootstrap({ port: 0 });
    servers.push(app);

    const response = await fetch(
      `${app.baseUrl}/knowledge/search?query=${encodeURIComponent('规则分层')}&limit=2`,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      query: '规则分层',
      matches: [expect.objectContaining({ filePath: expect.any(String) })],
    });
  });

  const createTemporaryRuleCatalogRoot = (): string => {
    const catalogRoot = mkdtempSync(join(tmpdir(), 'aimetric-rule-center-'));
    temporaryDirectories.push(catalogRoot);

    cpSync(
      join(
        '/Users/zhangqixiang/0_1WORK/zhongxing/AIMetric',
        'packages/rule-engine/src/templates',
      ),
      catalogRoot,
      { recursive: true },
    );

    return catalogRoot;
  };
});

const emptyMcpAuditMetrics = () => ({
  totalToolCalls: 0,
  successfulToolCalls: 0,
  failedToolCalls: 0,
  successRate: 0,
  failureRate: 0,
  averageDurationMs: 0,
});

const emptyAnalysisSummary = (): AnalysisSummaryRecord => ({
  sessionCount: 0,
  editSpanCount: 0,
  tabAcceptedCount: 0,
  tabAcceptedLines: 0,
});

const createEmptyRepository = (): MetricEventRepository => ({
  async saveIngestionBatch() {
    return undefined;
  },
  async listRecordedMetricEvents() {
    return [];
  },
  async saveMetricSnapshots() {
    return undefined;
  },
  async listMetricSnapshots() {
    return [];
  },
  async saveEnterpriseMetricSnapshots() {
    return undefined;
  },
  async listEnterpriseMetricSnapshots() {
    return [];
  },
  async buildMcpAuditMetrics() {
    return emptyMcpAuditMetrics();
  },
  async listEditSpanEvidence() {
    return [];
  },
  async listTabAcceptedEvents() {
    return [];
  },
  async buildAnalysisSummary() {
    return emptyAnalysisSummary();
  },
  async listSessionAnalysisRows() {
    return [];
  },
  async listOutputAnalysisRows() {
    return [];
  },
  async disconnect() {
    return undefined;
  },
});
