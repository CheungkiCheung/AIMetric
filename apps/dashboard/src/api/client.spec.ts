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
  });
});
