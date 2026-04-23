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

    expect(requestedUrls[0]).toBe(
      'http://127.0.0.1:3001/metrics/personal?projectKey=navigation&memberId=alice&from=2026-04-23T00%3A00%3A00.000Z&to=2026-04-24T00%3A00%3A00.000Z',
    );
    expect(requestedUrls[1]).toBe(
      'http://127.0.0.1:3001/metrics/mcp-audit?projectKey=navigation&memberId=alice&from=2026-04-23T00%3A00%3A00.000Z&to=2026-04-24T00%3A00%3A00.000Z',
    );
  });
});
