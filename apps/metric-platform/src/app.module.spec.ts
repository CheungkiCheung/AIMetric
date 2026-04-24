import { describe, expect, it, vi } from 'vitest';
import type { IngestionBatch } from '@aimetric/event-schema';
import { AppModule } from './app.module.js';

describe('AppModule', () => {
  it('exposes the enterprise metric catalog for management analysis', () => {
    const appModule = new AppModule(createEmptyRepository());
    const catalog = appModule.getEnterpriseMetricCatalog();

    expect(catalog.dimensions.map((dimension) => dimension.key)).toEqual([
      'adoption',
      'effective-output',
      'delivery-efficiency',
      'quality-risk',
      'experience-capability',
      'business-value',
    ]);
    expect(catalog.metrics).toContainEqual(
      expect.objectContaining({
        key: 'ai_ide_user_ratio',
        dashboardPlacement: 'effectiveness-management',
        assessmentUsage: 'observe-only',
      }),
    );
  });

  it('filters enterprise metrics by dimension', () => {
    const appModule = new AppModule(createEmptyRepository());
    const metrics = appModule.listEnterpriseMetricsByDimension('quality-risk');

    expect(metrics.length).toBeGreaterThan(0);
    expect(metrics.every((metric) => metric.dimension === 'quality-risk')).toBe(true);
    expect(metrics.map((metric) => metric.key)).toContain('change_failure_rate');
  });

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
      listEditSpanEvidence: vi.fn(async () => []),
      listTabAcceptedEvents: vi.fn(async () => []),
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
      listEditSpanEvidence: vi.fn(async () => []),
      listTabAcceptedEvents: vi.fn(async () => []),
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
      listEditSpanEvidence: vi.fn(async () => []),
      listTabAcceptedEvents: vi.fn(async () => []),
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
      listEditSpanEvidence: vi.fn(async () => []),
      listTabAcceptedEvents: vi.fn(async () => []),
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
      buildMcpAuditMetrics: vi.fn(async () => emptyMcpAuditMetrics()),
      listEditSpanEvidence: vi.fn(async () => []),
      listTabAcceptedEvents: vi.fn(async () => []),
      disconnect: vi.fn(async () => undefined),
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
      listEditSpanEvidence: vi.fn(async () => []),
      listTabAcceptedEvents: vi.fn(async () => []),
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

  it('lists edit span evidence through the repository', async () => {
    const repository = {
      saveIngestionBatch: vi.fn(async () => undefined),
      listRecordedMetricEvents: vi.fn(async () => []),
      saveMetricSnapshots: vi.fn(async () => undefined),
      listMetricSnapshots: vi.fn(async () => []),
      buildMcpAuditMetrics: vi.fn(async () => emptyMcpAuditMetrics()),
      listEditSpanEvidence: vi.fn(async () => [
        {
          editSpanId: 'edit-span-1',
          sessionId: 'sess_1',
          filePath: '/repo/src/demo.ts',
          occurredAt: '2026-04-24T00:00:00.000Z',
          diff: '--- /repo/src/demo.ts',
          beforeSnapshotHash: 'before-hash',
          afterSnapshotHash: 'after-hash',
          toolProfile: 'cursor',
        },
      ]),
      listTabAcceptedEvents: vi.fn(async () => []),
      disconnect: vi.fn(async () => undefined),
    };
    const filters = {
      projectKey: 'aimetric',
      sessionId: 'sess_1',
    };

    const appModule = new AppModule(repository);
    const evidence = await appModule.listEditSpanEvidence(filters);

    expect(repository.listEditSpanEvidence).toHaveBeenCalledWith(filters);
    expect(evidence).toEqual([
      expect.objectContaining({
        editSpanId: 'edit-span-1',
        sessionId: 'sess_1',
      }),
    ]);
  });

  it('lists tab accepted events through the repository', async () => {
    const repository = {
      saveIngestionBatch: vi.fn(async () => undefined),
      listRecordedMetricEvents: vi.fn(async () => []),
      saveMetricSnapshots: vi.fn(async () => undefined),
      listMetricSnapshots: vi.fn(async () => []),
      buildMcpAuditMetrics: vi.fn(async () => emptyMcpAuditMetrics()),
      listEditSpanEvidence: vi.fn(async () => []),
      listTabAcceptedEvents: vi.fn(async () => [
        {
          sessionId: 'sess_1',
          occurredAt: '2026-04-24T00:03:00.000Z',
          acceptedLines: 2,
          filePath: '/repo/src/demo.ts',
          language: 'typescript',
          ingestionKey: 'cursor-tab:sess_1:2026-04-24T00:03:00.000Z:abc',
        },
      ]),
      disconnect: vi.fn(async () => undefined),
    };
    const filters = {
      projectKey: 'aimetric',
      sessionId: 'sess_1',
    };

    const appModule = new AppModule(repository);
    const events = await appModule.listTabAcceptedEvents(filters);

    expect(repository.listTabAcceptedEvents).toHaveBeenCalledWith(filters);
    expect(events).toEqual([
      expect.objectContaining({
        sessionId: 'sess_1',
        acceptedLines: 2,
      }),
    ]);
  });

  it('builds analysis summary through the repository', async () => {
    const repository = {
      saveIngestionBatch: vi.fn(async () => undefined),
      listRecordedMetricEvents: vi.fn(async () => []),
      saveMetricSnapshots: vi.fn(async () => undefined),
      listMetricSnapshots: vi.fn(async () => []),
      buildMcpAuditMetrics: vi.fn(async () => emptyMcpAuditMetrics()),
      listEditSpanEvidence: vi.fn(async () => []),
      listTabAcceptedEvents: vi.fn(async () => []),
      buildAnalysisSummary: vi.fn(async () => ({
        sessionCount: 2,
        editSpanCount: 3,
        tabAcceptedCount: 4,
        tabAcceptedLines: 9,
      })),
      listSessionAnalysisRows: vi.fn(async () => []),
      listOutputAnalysisRows: vi.fn(async () => []),
      disconnect: vi.fn(async () => undefined),
    };
    const filters = { projectKey: 'aimetric' };

    const appModule = new AppModule(repository);
    const summary = await appModule.buildAnalysisSummary(filters);

    expect(repository.buildAnalysisSummary).toHaveBeenCalledWith(filters);
    expect(summary).toEqual({
      sessionCount: 2,
      editSpanCount: 3,
      tabAcceptedCount: 4,
      tabAcceptedLines: 9,
    });
  });

  it('lists session and output analysis rows through the repository', async () => {
    const repository = {
      saveIngestionBatch: vi.fn(async () => undefined),
      listRecordedMetricEvents: vi.fn(async () => []),
      saveMetricSnapshots: vi.fn(async () => undefined),
      listMetricSnapshots: vi.fn(async () => []),
      buildMcpAuditMetrics: vi.fn(async () => emptyMcpAuditMetrics()),
      listEditSpanEvidence: vi.fn(async () => []),
      listTabAcceptedEvents: vi.fn(async () => []),
      buildAnalysisSummary: vi.fn(async () => ({
        sessionCount: 0,
        editSpanCount: 0,
        tabAcceptedCount: 0,
        tabAcceptedLines: 0,
      })),
      listSessionAnalysisRows: vi.fn(async () => [
        {
          sessionId: 'sess_1',
          projectKey: 'aimetric',
          occurredAt: '2026-04-24T00:05:00.000Z',
          editSpanCount: 2,
          tabAcceptedCount: 2,
          tabAcceptedLines: 5,
        },
      ]),
      listOutputAnalysisRows: vi.fn(async () => [
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
      disconnect: vi.fn(async () => undefined),
    };
    const filters = { projectKey: 'aimetric' };

    const appModule = new AppModule(repository);
    const sessionRows = await appModule.listSessionAnalysisRows(filters);
    const outputRows = await appModule.listOutputAnalysisRows(filters);

    expect(repository.listSessionAnalysisRows).toHaveBeenCalledWith(filters);
    expect(repository.listOutputAnalysisRows).toHaveBeenCalledWith(filters);
    expect(sessionRows).toHaveLength(1);
    expect(outputRows).toHaveLength(1);
  });

  it('exposes rule center operations from the application module', () => {
    const repository = createEmptyRepository();
    const appModule = new AppModule(repository);

    expect(appModule.listRuleVersions('aimetric')).toMatchObject({
      projectKey: 'aimetric',
      activeVersion: 'v2',
    });
    expect(
      appModule.getRuleTemplate({
        projectKey: 'aimetric',
        version: 'v2',
      }),
    ).toMatchObject({
      projectKey: 'aimetric',
      version: 'v2',
    });
    expect(
      appModule.validateRuleTemplate({
        projectKey: 'aimetric',
        version: 'v2',
      }),
    ).toMatchObject({
      valid: true,
    });
  });
});

const createEmptyRepository = () => ({
  saveIngestionBatch: vi.fn(async () => undefined),
  listRecordedMetricEvents: vi.fn(async () => []),
  saveMetricSnapshots: vi.fn(async () => undefined),
  listMetricSnapshots: vi.fn(async () => []),
  buildMcpAuditMetrics: vi.fn(async () => emptyMcpAuditMetrics()),
  listEditSpanEvidence: vi.fn(async () => []),
  listTabAcceptedEvents: vi.fn(async () => []),
  buildAnalysisSummary: vi.fn(async () => ({
    sessionCount: 0,
    editSpanCount: 0,
    tabAcceptedCount: 0,
    tabAcceptedLines: 0,
  })),
  listSessionAnalysisRows: vi.fn(async () => []),
  listOutputAnalysisRows: vi.fn(async () => []),
  disconnect: vi.fn(async () => undefined),
});

const emptyMcpAuditMetrics = () => ({
  totalToolCalls: 0,
  successfulToolCalls: 0,
  failedToolCalls: 0,
  successRate: 0,
  failureRate: 0,
  averageDurationMs: 0,
});
