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
