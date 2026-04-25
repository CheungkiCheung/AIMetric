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

  it('queues a valid batch without blocking on metric-platform in queue mode', async () => {
    globalThis.fetch = vi.fn() as typeof fetch;
    const service = new IngestionService({ deliveryMode: 'queue' });

    const result = await service.ingest(createIngestionBatch());

    expect(result).toMatchObject({
      accepted: 1,
      schemaVersion: 'v1',
      forwarded: false,
      queued: true,
      queueDepth: 1,
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(service.getHealth()).toMatchObject({
      deliveryMode: 'queue',
      queueDepth: 1,
      deadLetterDepth: 0,
      enqueuedTotal: 1,
    });
  });

  it('flushes queued batches when metric-platform recovers', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ imported: 1, schemaVersion: 'v1' }), {
        status: 200,
      }),
    ) as typeof fetch;
    const service = new IngestionService({ deliveryMode: 'queue' });

    await service.ingest(createIngestionBatch());
    const result = await service.flushQueuedBatches();

    expect(result).toEqual({
      attempted: 1,
      forwarded: 1,
      failed: 0,
      remainingDepth: 0,
      deadLetterDepth: 0,
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(service.getHealth()).toMatchObject({
      queueDepth: 0,
      deadLetterDepth: 0,
      forwardedTotal: 1,
    });
  });

  it('moves repeatedly failing queued batches to the dead letter queue', async () => {
    globalThis.fetch = vi.fn(async () => new Response('', { status: 503 })) as typeof fetch;
    const service = new IngestionService({
      deliveryMode: 'queue',
      maxDeliveryAttempts: 2,
    });

    await service.ingest(createIngestionBatch());
    await service.flushQueuedBatches();
    const result = await service.flushQueuedBatches();

    expect(result).toEqual({
      attempted: 1,
      forwarded: 0,
      failed: 1,
      remainingDepth: 0,
      deadLetterDepth: 1,
    });
    expect(service.getHealth()).toMatchObject({
      queueDepth: 0,
      deadLetterDepth: 1,
      failedForwardTotal: 2,
    });
  });
});

const createIngestionBatch = () => ({
  schemaVersion: 'v1',
  source: 'cursor',
  events: [
    {
      eventType: 'session.started',
      occurredAt: '2026-04-22T00:00:00.000Z',
      payload: {
        sessionId: 'sess_1',
        projectKey: 'proj',
        repoName: 'repo',
      },
    },
  ],
});
