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
      saveMetricSnapshots: vi.fn(async () => undefined),
      listMetricSnapshots: vi.fn(async () => []),
      buildMcpAuditMetrics: vi.fn(async () => ({
        totalToolCalls: 3,
        successfulToolCalls: 2,
        failedToolCalls: 1,
        successRate: 2 / 3,
        failureRate: 1 / 3,
        averageDurationMs: 15,
      })),
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
      saveMetricSnapshots: vi.fn(async () => undefined),
      listMetricSnapshots: vi.fn(async () => []),
      buildMcpAuditMetrics: vi.fn(async () => emptyMcpAuditMetrics()),
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

  it('passes metric filters to the repository when building snapshots', async () => {
    const repository = {
      saveIngestionBatch: vi.fn(async () => undefined),
      listRecordedMetricEvents: vi.fn(async () => []),
      saveMetricSnapshots: vi.fn(async () => undefined),
      listMetricSnapshots: vi.fn(async () => []),
      buildMcpAuditMetrics: vi.fn(async () => emptyMcpAuditMetrics()),
      disconnect: vi.fn(async () => undefined),
    };
    const filters = {
      projectKey: 'navigation',
      memberId: 'alice',
      from: '2026-04-23T00:00:00.000Z',
      to: '2026-04-24T00:00:00.000Z',
    };

    const appModule = new AppModule(repository);

    await appModule.buildPersonalSnapshot(filters);
    await appModule.buildTeamSnapshot(filters);

    expect(repository.listRecordedMetricEvents).toHaveBeenNthCalledWith(1, filters);
    expect(repository.listRecordedMetricEvents).toHaveBeenNthCalledWith(2, filters);
  });

  it('recalculates personal and team snapshots into the repository', async () => {
    const repository = {
      saveIngestionBatch: vi.fn(async () => undefined),
      listRecordedMetricEvents: vi.fn(async () => [
        {
          memberId: 'alice',
          acceptedAiLines: 30,
          commitTotalLines: 60,
          sessionCount: 1,
        },
        {
          memberId: 'bob',
          acceptedAiLines: 20,
          commitTotalLines: 40,
          sessionCount: 1,
        },
      ]),
      saveMetricSnapshots: vi.fn(async () => undefined),
      listMetricSnapshots: vi.fn(async () => []),
      buildMcpAuditMetrics: vi.fn(async () => emptyMcpAuditMetrics()),
      disconnect: vi.fn(async () => undefined),
    };
    const filters = {
      projectKey: 'navigation',
      from: '2026-04-23T00:00:00.000Z',
      to: '2026-04-24T00:00:00.000Z',
    };

    const appModule = new AppModule(repository);
    const result = await appModule.recalculateMetricSnapshots(filters);

    expect(repository.listRecordedMetricEvents).toHaveBeenCalledWith(filters);
    expect(repository.saveMetricSnapshots).toHaveBeenCalledWith([
      {
        scope: 'personal',
        projectKey: 'navigation',
        memberId: 'alice',
        periodStart: '2026-04-23T00:00:00.000Z',
        periodEnd: '2026-04-24T00:00:00.000Z',
        acceptedAiLines: 30,
        commitTotalLines: 60,
        aiOutputRate: 0.5,
        sessionCount: 1,
        memberCount: 1,
      },
      {
        scope: 'personal',
        projectKey: 'navigation',
        memberId: 'bob',
        periodStart: '2026-04-23T00:00:00.000Z',
        periodEnd: '2026-04-24T00:00:00.000Z',
        acceptedAiLines: 20,
        commitTotalLines: 40,
        aiOutputRate: 0.5,
        sessionCount: 1,
        memberCount: 1,
      },
      {
        scope: 'team',
        projectKey: 'navigation',
        periodStart: '2026-04-23T00:00:00.000Z',
        periodEnd: '2026-04-24T00:00:00.000Z',
        acceptedAiLines: 50,
        commitTotalLines: 100,
        aiOutputRate: 0.5,
        sessionCount: 2,
        memberCount: 2,
      },
    ]);
    expect(result.upsertedSnapshots).toBe(3);
  });

  it('lists persisted metric snapshots through the repository', async () => {
    const repository = {
      saveIngestionBatch: vi.fn(async () => undefined),
      listRecordedMetricEvents: vi.fn(async () => []),
      saveMetricSnapshots: vi.fn(async () => undefined),
      listMetricSnapshots: vi.fn(async () => [
        {
          scope: 'team' as const,
          projectKey: 'navigation',
          periodStart: '2026-04-23T00:00:00.000Z',
          periodEnd: '2026-04-24T00:00:00.000Z',
          acceptedAiLines: 50,
          commitTotalLines: 100,
          aiOutputRate: 0.5,
          sessionCount: 2,
          memberCount: 2,
        },
      ]),
      disconnect: vi.fn(async () => undefined),
      buildMcpAuditMetrics: vi.fn(async () => emptyMcpAuditMetrics()),
    };
    const filters = {
      projectKey: 'navigation',
    };

    const appModule = new AppModule(repository);
    const snapshots = await appModule.listMetricSnapshots(filters);

    expect(repository.listMetricSnapshots).toHaveBeenCalledWith(filters);
    expect(snapshots).toHaveLength(1);
  });

  it('builds MCP audit metrics through the repository', async () => {
    const repository = {
      saveIngestionBatch: vi.fn(async () => undefined),
      listRecordedMetricEvents: vi.fn(async () => []),
      saveMetricSnapshots: vi.fn(async () => undefined),
      listMetricSnapshots: vi.fn(async () => []),
      buildMcpAuditMetrics: vi.fn(async () => ({
        totalToolCalls: 3,
        successfulToolCalls: 2,
        failedToolCalls: 1,
        successRate: 2 / 3,
        failureRate: 1 / 3,
        averageDurationMs: 15,
      })),
      disconnect: vi.fn(async () => undefined),
    };
    const filters = {
      projectKey: 'aimetric',
    };

    const appModule = new AppModule(repository);
    const metrics = await appModule.buildMcpAuditMetrics(filters);

    expect(repository.buildMcpAuditMetrics).toHaveBeenCalledWith(filters);
    expect(metrics).toEqual({
      totalToolCalls: 3,
      successfulToolCalls: 2,
      failedToolCalls: 1,
      successRate: 2 / 3,
      failureRate: 1 / 3,
      averageDurationMs: 15,
    });
  });
});

const emptyMcpAuditMetrics = () => ({
  totalToolCalls: 0,
  successfulToolCalls: 0,
  failedToolCalls: 0,
  successRate: 0,
  failureRate: 0,
  averageDurationMs: 0,
});
