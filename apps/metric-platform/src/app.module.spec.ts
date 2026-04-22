import { describe, expect, it, vi } from 'vitest';
import type { IngestionBatch } from '@aimetric/event-schema';
import { AppModule } from './app.module.js';

describe('AppModule', () => {
  it('persists imported batches through the repository abstraction', async () => {
    const batch: IngestionBatch = {
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
      ],
    };

    const repository = {
      saveIngestionBatch: vi.fn(async () => undefined),
      listRecordedMetricEvents: vi.fn(async () => []),
      disconnect: vi.fn(async () => undefined),
    };

    const appModule = new AppModule(repository);
    const result = await appModule.importEvents(batch);

    expect(repository.saveIngestionBatch).toHaveBeenCalledWith(batch);
    expect(result).toEqual({
      imported: 1,
      schemaVersion: 'v1',
    });
  });

  it('builds snapshots from persisted metric events', async () => {
    const repository = {
      saveIngestionBatch: vi.fn(async () => undefined),
      listRecordedMetricEvents: vi.fn(async () => [
        {
          memberId: 'alice',
          acceptedAiLines: 44,
          commitTotalLines: 55,
          sessionCount: 1,
        },
        {
          memberId: 'bob',
          acceptedAiLines: 46,
          commitTotalLines: 65,
          sessionCount: 1,
        },
      ]),
      disconnect: vi.fn(async () => undefined),
    };

    const appModule = new AppModule(repository);
    const personalSnapshot = await appModule.buildPersonalSnapshot();
    const teamSnapshot = await appModule.buildTeamSnapshot();

    expect(personalSnapshot.aiOutputRate).toBe(0.8);
    expect(teamSnapshot.totalAcceptedAiLines).toBe(90);
    expect(teamSnapshot.totalCommitLines).toBe(120);
    expect(teamSnapshot.aiOutputRate).toBe(0.75);
  });
});
