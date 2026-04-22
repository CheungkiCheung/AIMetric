import { describe, expect, it } from 'vitest';
import { IngestionService } from './ingestion.service.js';

describe('IngestionService', () => {
  it('accepts a valid batch and returns accepted event count', async () => {
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
  });
});
