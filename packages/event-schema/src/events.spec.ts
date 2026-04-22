import { describe, expect, it } from 'vitest';
import { IngestionBatchSchema } from './events';

describe('IngestionBatchSchema', () => {
  it('accepts a minimal valid ingestion batch', () => {
    const parsed = IngestionBatchSchema.parse({
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

    expect(parsed.events).toHaveLength(1);
  });
});
