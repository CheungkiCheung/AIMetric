import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDashboardClient } from './client.js';

describe('createDashboardClient', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('uses live metric-platform responses when the backend is reachable', async () => {
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.endsWith('/metrics/personal')) {
        return new Response(
          JSON.stringify({
            acceptedAiLines: 44,
            commitTotalLines: 55,
            aiOutputRate: 0.8,
            sessionCount: 5,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/metrics/mcp-audit')) {
        return new Response(
          JSON.stringify({
            totalToolCalls: 12,
            successfulToolCalls: 10,
            failedToolCalls: 2,
            successRate: 10 / 12,
            failureRate: 2 / 12,
            averageDurationMs: 24,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/rules/versions')) {
        return new Response(
          JSON.stringify({
            projectKey: 'aimetric',
            activeVersion: 'v2',
            versions: [
              {
                version: 'v2',
                status: 'active',
                updatedAt: '2026-04-24',
                summary: '文件化模板与版本切换基础版',
              },
            ],
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/rules/rollout')) {
        return new Response(
          JSON.stringify({
            projectKey: 'aimetric',
            enabled: true,
            candidateVersion: 'v1',
            percentage: 25,
            includedMembers: ['alice'],
            updatedAt: '2026-04-24T00:00:00.000Z',
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/rules/rollout/evaluate')) {
        return new Response(
          JSON.stringify({
            projectKey: 'aimetric',
            memberId: 'alice',
            enabled: true,
            activeVersion: 'v2',
            selectedVersion: 'v1',
            candidateVersion: 'v1',
            percentage: 25,
            bucket: 7,
            matched: true,
            reason: 'included-member',
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/enterprise-metrics/catalog')) {
        return new Response(
          JSON.stringify({
            dimensions: [
              {
                key: 'adoption',
                name: '使用渗透',
                question: 'AI 有没有真正被用起来',
                primaryAudience: ['effectiveness-manager', 'engineering-manager'],
              },
            ],
            metrics: [
              {
                key: 'ai_ide_user_ratio',
                name: 'AI-IDE 使用人数比例',
                dimension: 'adoption',
                question: 'AI 有没有真正被用起来',
                formula: 'AI-IDE 活跃使用人数 / 目标开发者人数',
                dataSources: [
                  'mcp-events',
                  'tool-adapter-events',
                  'organization-directory',
                ],
                automationLevel: 'high',
                updateFrequency: 'daily',
                dashboardPlacement: 'effectiveness-management',
                assessmentUsage: 'observe-only',
                antiGamingNote: '结合有效产出判断，避免刷打开次数。',
              },
            ],
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/enterprise-metrics/values')) {
        return new Response(
          JSON.stringify([
            {
              metricKey: 'ai_output_rate',
              value: 0.7,
              unit: 'ratio',
              confidence: 'high',
              scope: 'team',
              projectKey: 'aimetric',
              periodStart: '1970-01-01T00:00:00.000Z',
              periodEnd: '2026-04-24T00:00:00.000Z',
              calculatedAt: '2026-04-24T01:00:00.000Z',
              definitionVersion: 1,
              dataRequirements: ['recorded-metric-events'],
              definition: {
                key: 'ai_output_rate',
                name: 'AI 出码率',
                dimension: 'effective-output',
              },
            },
          ]),
          { status: 200 },
        );
      }

      if (url.endsWith('/ingestion/health')) {
        return new Response(
          JSON.stringify({
            deliveryMode: 'queue',
            queueBackend: 'file',
            queueDepth: 3,
            deadLetterDepth: 1,
            enqueuedTotal: 10,
            forwardedTotal: 7,
            failedForwardTotal: 2,
          }),
          { status: 200 },
        );
      }

      return new Response(
        JSON.stringify({
          memberCount: 3,
          totalAcceptedAiLines: 90,
          totalCommitLines: 120,
          totalSessionCount: 9,
          aiOutputRate: 0.75,
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const client = createDashboardClient('http://127.0.0.1:3001');

    await expect(client.getPersonalSnapshot()).resolves.toMatchObject({
      aiOutputRate: 0.8,
      sessionCount: 5,
    });
    await expect(client.getTeamSnapshot()).resolves.toMatchObject({
      aiOutputRate: 0.75,
      memberCount: 3,
    });
    await expect(client.getMcpAuditMetrics()).resolves.toMatchObject({
      totalToolCalls: 12,
      successfulToolCalls: 10,
      failedToolCalls: 2,
      averageDurationMs: 24,
    });
    await expect(client.getRuleVersions()).resolves.toMatchObject({
      projectKey: 'aimetric',
      activeVersion: 'v2',
    });
    await expect(client.getRuleRollout()).resolves.toMatchObject({
      projectKey: 'aimetric',
      enabled: true,
      candidateVersion: 'v1',
      percentage: 25,
    });
    await expect(client.getRuleRolloutEvaluation()).resolves.toMatchObject({
      selectedVersion: 'v1',
      matched: true,
      reason: 'included-member',
    });
    await expect(client.getEnterpriseMetricCatalog()).resolves.toMatchObject({
      dimensions: expect.arrayContaining([
        expect.objectContaining({
          key: 'adoption',
          name: '使用渗透',
        }),
      ]),
      metrics: expect.arrayContaining([
        expect.objectContaining({
          key: 'ai_ide_user_ratio',
          dashboardPlacement: 'effectiveness-management',
        }),
      ]),
    });
    await expect(client.getEnterpriseMetricValues()).resolves.toEqual([
      expect.objectContaining({
        metricKey: 'ai_output_rate',
        value: 0.7,
        definition: expect.objectContaining({
          name: 'AI 出码率',
        }),
      }),
    ]);
    await expect(client.getCollectorIngestionHealth()).resolves.toMatchObject({
      deliveryMode: 'queue',
      queueBackend: 'file',
      queueDepth: 3,
      deadLetterDepth: 1,
      failedForwardTotal: 2,
    });
    await expect(
      client.updateRuleRollout({
        projectKey: 'aimetric',
        enabled: true,
        candidateVersion: 'v1',
        percentage: 40,
        includedMembers: ['alice', 'bob'],
      }),
    ).resolves.toMatchObject({
      projectKey: 'aimetric',
      enabled: true,
      candidateVersion: 'v1',
      percentage: 25,
    });
  });

  it('passes dashboard filters as metric query parameters', async () => {
    const requestedUrls: string[] = [];

    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      requestedUrls.push(String(input));
      return new Response(
        JSON.stringify({
          acceptedAiLines: 1,
          commitTotalLines: 2,
          aiOutputRate: 0.5,
          sessionCount: 1,
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const client = createDashboardClient('http://127.0.0.1:3001');

    const filters = {
      projectKey: 'navigation',
      memberId: 'alice',
      from: '2026-04-23T00:00:00.000Z',
      to: '2026-04-24T00:00:00.000Z',
    };

    await client.getPersonalSnapshot(filters);
    await client.getMcpAuditMetrics(filters);
    await client.getRuleVersions('navigation');
    await client.getRuleRollout('navigation');
    await client.getRuleRolloutEvaluation('navigation', 'alice');
    await client.getEnterpriseMetricCatalog();
    await client.getEnterpriseMetricValues(filters, ['ai_session_count']);

    expect(requestedUrls[0]).toBe(
      'http://127.0.0.1:3001/metrics/personal?projectKey=navigation&memberId=alice&from=2026-04-23T00%3A00%3A00.000Z&to=2026-04-24T00%3A00%3A00.000Z',
    );
    expect(requestedUrls[1]).toBe(
      'http://127.0.0.1:3001/metrics/mcp-audit?projectKey=navigation&memberId=alice&from=2026-04-23T00%3A00%3A00.000Z&to=2026-04-24T00%3A00%3A00.000Z',
    );
    expect(requestedUrls[2]).toBe(
      'http://127.0.0.1:3001/rules/versions?projectKey=navigation',
    );
    expect(requestedUrls[3]).toBe(
      'http://127.0.0.1:3001/rules/rollout?projectKey=navigation',
    );
    expect(requestedUrls[4]).toBe(
      'http://127.0.0.1:3001/rules/rollout/evaluate?projectKey=navigation&memberId=alice',
    );
    expect(requestedUrls[5]).toBe(
      'http://127.0.0.1:3001/enterprise-metrics/catalog',
    );
    expect(requestedUrls[6]).toBe(
      'http://127.0.0.1:3001/enterprise-metrics/values?projectKey=navigation&memberId=alice&from=2026-04-23T00%3A00%3A00.000Z&to=2026-04-24T00%3A00%3A00.000Z&metricKey=ai_session_count',
    );
  });

  it('can use a separate collector-gateway base url for ingestion health', async () => {
    const requestedUrls: string[] = [];
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      requestedUrls.push(String(input));
      return new Response(
        JSON.stringify({
          deliveryMode: 'sync',
          queueBackend: 'memory',
          queueDepth: 0,
          deadLetterDepth: 0,
          enqueuedTotal: 0,
          forwardedTotal: 4,
          failedForwardTotal: 0,
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const client = createDashboardClient(
      'http://127.0.0.1:3001',
      'http://127.0.0.1:3000',
    );

    await expect(client.getCollectorIngestionHealth()).resolves.toMatchObject({
      deliveryMode: 'sync',
      queueBackend: 'memory',
      forwardedTotal: 4,
    });
    expect(requestedUrls).toEqual([
      'http://127.0.0.1:3000/ingestion/health',
    ]);
  });

  it('falls back to a safe collector health snapshot when gateway is unavailable', async () => {
    globalThis.fetch = vi.fn(async () => new Response('', { status: 503 })) as typeof fetch;

    const client = createDashboardClient('http://127.0.0.1:3001');

    await expect(client.getCollectorIngestionHealth()).resolves.toEqual({
      deliveryMode: 'sync',
      queueBackend: 'memory',
      queueDepth: 0,
      deadLetterDepth: 0,
      enqueuedTotal: 0,
      forwardedTotal: 0,
      failedForwardTotal: 0,
    });
  });

  it('falls back to the bundled enterprise metric catalog when backend is unavailable', async () => {
    globalThis.fetch = vi.fn(async () => new Response('', { status: 503 })) as typeof fetch;

    const client = createDashboardClient('http://127.0.0.1:3001');
    const catalog = await client.getEnterpriseMetricCatalog();

    expect(catalog.dimensions.map((dimension) => dimension.key)).toEqual([
      'adoption',
      'effective-output',
      'delivery-efficiency',
      'quality-risk',
      'experience-capability',
      'business-value',
    ]);
    expect(catalog.metrics).toContainEqual(
      expect.objectContaining({
        key: 'lead_time_ai_vs_non_ai',
        dimension: 'delivery-efficiency',
      }),
    );
  });

  it('posts rollout updates to the metric platform', async () => {
    const requests: Array<{
      url: string;
      method: string;
      body: string;
    }> = [];

    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({
        url: String(input),
        method: init?.method ?? 'GET',
        body: typeof init?.body === 'string' ? init.body : '',
      });
      return new Response(
        JSON.stringify({
          projectKey: 'aimetric',
          enabled: true,
          candidateVersion: 'v1',
          percentage: 40,
          includedMembers: ['alice', 'bob'],
          updatedAt: '2026-04-24T00:00:00.000Z',
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const client = createDashboardClient('http://127.0.0.1:3001');

    await client.updateRuleRollout({
      projectKey: 'aimetric',
      enabled: true,
      candidateVersion: 'v1',
      percentage: 40,
      includedMembers: ['alice', 'bob'],
    });

    expect(requests[0]).toEqual({
      url: 'http://127.0.0.1:3001/rules/rollout',
      method: 'POST',
      body: JSON.stringify({
        projectKey: 'aimetric',
        enabled: true,
        candidateVersion: 'v1',
        percentage: 40,
        includedMembers: ['alice', 'bob'],
      }),
    });
  });

  it('fetches analysis APIs through the dashboard client', async () => {
    const requestedUrls: string[] = [];

    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      requestedUrls.push(url);

      if (url.includes('/analysis/summary')) {
        return new Response(
          JSON.stringify({
            sessionCount: 2,
            editSpanCount: 3,
            tabAcceptedCount: 4,
            tabAcceptedLines: 9,
          }),
          { status: 200 },
        );
      }

      if (url.includes('/analysis/sessions')) {
        return new Response(
          JSON.stringify([
            {
              sessionId: 'sess_1',
              projectKey: 'aimetric',
              occurredAt: '2026-04-24T00:05:00.000Z',
              editSpanCount: 2,
              tabAcceptedCount: 2,
              tabAcceptedLines: 5,
            },
          ]),
          { status: 200 },
        );
      }

      return new Response(
        JSON.stringify([
          {
            sessionId: 'sess_1',
            projectKey: 'aimetric',
            filePath: '/repo/src/demo.ts',
            editSpanCount: 2,
            latestEditAt: '2026-04-24T00:05:00.000Z',
            tabAcceptedCount: 2,
            tabAcceptedLines: 5,
            latestDiffSummary: '--- /repo/src/demo.ts',
          },
        ]),
        { status: 200 },
      );
    }) as typeof fetch;

    const client = createDashboardClient('http://127.0.0.1:3001');
    const filters = { projectKey: 'aimetric', memberId: 'alice' };

    await expect(client.getAnalysisSummary(filters)).resolves.toEqual({
      sessionCount: 2,
      editSpanCount: 3,
      tabAcceptedCount: 4,
      tabAcceptedLines: 9,
    });
    await expect(client.getSessionAnalysisRows(filters)).resolves.toHaveLength(1);
    await expect(client.getOutputAnalysisRows(filters)).resolves.toHaveLength(1);
    expect(requestedUrls).toEqual([
      'http://127.0.0.1:3001/analysis/summary?projectKey=aimetric&memberId=alice',
      'http://127.0.0.1:3001/analysis/sessions?projectKey=aimetric&memberId=alice',
      'http://127.0.0.1:3001/analysis/output?projectKey=aimetric&memberId=alice',
    ]);
  });
});
