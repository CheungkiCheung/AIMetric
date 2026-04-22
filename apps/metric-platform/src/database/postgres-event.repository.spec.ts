import { afterEach, describe, expect, it } from 'vitest';
import { PostgresMetricEventRepository } from './postgres-event.repository.js';

const describeIfDatabase =
  process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

describeIfDatabase('PostgresMetricEventRepository', () => {
  const services: PostgresMetricEventRepository[] = [];

  afterEach(async () => {
    await Promise.all(services.map((service) => service.disconnect()));
    services.length = 0;
  });

  it('persists recorded metric events across service instances', async () => {
    const uniqueMemberId = `member-${Date.now()}`;
    const writer = new PostgresMetricEventRepository();
    services.push(writer);

    await writer.saveIngestionBatch({
      schemaVersion: 'v1',
      source: 'cursor',
      events: [
        {
          eventType: 'session.recorded',
          occurredAt: '2026-04-23T00:00:00.000Z',
          payload: {
            sessionId: 'sess-db-1',
            projectKey: 'proj',
            repoName: 'repo',
            memberId: uniqueMemberId,
            acceptedAiLines: 52,
            commitTotalLines: 70,
          },
        },
      ],
    });

    const reader = new PostgresMetricEventRepository();
    services.push(reader);

    const recordedMetricEvents = await reader.listRecordedMetricEvents();

    expect(recordedMetricEvents).toContainEqual({
      memberId: uniqueMemberId,
      acceptedAiLines: 52,
      commitTotalLines: 70,
      sessionCount: 1,
    });
  });

  it('filters recorded metric events by project, member, and time range', async () => {
    const uniqueProjectKey = `project-${Date.now()}`;
    const repository = new PostgresMetricEventRepository();
    services.push(repository);

    await repository.saveIngestionBatch({
      schemaVersion: 'v1',
      source: 'cursor',
      events: [
        {
          eventType: 'session.recorded',
          occurredAt: '2026-04-23T00:00:00.000Z',
          payload: {
            sessionId: 'sess-filter-1',
            projectKey: uniqueProjectKey,
            repoName: 'repo',
            memberId: 'alice',
            acceptedAiLines: 30,
            commitTotalLines: 60,
          },
        },
        {
          eventType: 'session.recorded',
          occurredAt: '2026-04-24T00:00:00.000Z',
          payload: {
            sessionId: 'sess-filter-2',
            projectKey: uniqueProjectKey,
            repoName: 'repo',
            memberId: 'bob',
            acceptedAiLines: 50,
            commitTotalLines: 100,
          },
        },
      ],
    });

    const recordedMetricEvents = await repository.listRecordedMetricEvents({
      projectKey: uniqueProjectKey,
      memberId: 'alice',
      from: '2026-04-22T00:00:00.000Z',
      to: '2026-04-23T23:59:59.999Z',
    });

    expect(recordedMetricEvents).toEqual([
      {
        memberId: 'alice',
        acceptedAiLines: 30,
        commitTotalLines: 60,
        sessionCount: 1,
      },
    ]);
  });
});
