import { afterEach, describe, expect, it, vi } from 'vitest';
import { IngestionService } from './ingestion.service.js';

describe('IngestionService', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('accepts a valid batch, forwards it to metric-platform, and returns accepted event count', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          imported: 1,
          schemaVersion: 'v1',
        }),
        { status: 200 },
      ),
    ) as typeof fetch;

    const service = new IngestionService();

    const result = await service.ingest({
      schemaVersion: 'v1',
      source: 'cursor',
      events: [
        {
          eventType: 'session.started',
          occurredAt: '2026-04-22T00:00:00.000Z',
          payload: {
            sessionId: 'sess_1',
            projectKey: 'proj',
            repoName: 'repo'
          }
        }
      ]
    });

    expect(result.accepted).toBe(1);
    expect(result.schemaVersion).toBe('v1');
    expect(result.forwarded).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/events/import',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });
});
