import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootstrap } from './main.js';
import type {
  AnalysisSummaryRecord,
  EditSpanEvidenceRecord,
  MetricEventRepository,
  OutputAnalysisRow,
  RecordedMetricEvent,
  SessionAnalysisRow,
  TabAcceptedEventRecord,
} from './database/postgres-event.repository.js';

describe('bootstrap', () => {
  const servers: Array<{ close: () => Promise<void> }> = [];
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(servers.map((server) => server.close()));
    servers.length = 0;
    temporaryDirectories.splice(0).forEach((directory) => {
      rmSync(directory, { recursive: true, force: true });
    });
    vi.useRealTimers();
  });

  it('serves personal and team metric snapshots over HTTP', async () => {
    const recordedMetricEvents: RecordedMetricEvent[] = [];
    const metricEventRepository: MetricEventRepository = {
      async saveIngestionBatch(batch) {
        recordedMetricEvents.push(
          ...batch.events
            .filter((event) => event.eventType === 'session.recorded')
            .map((event) => ({
              memberId:
                typeof event.payload.memberId === 'string'
                  ? event.payload.memberId
                  : event.payload.sessionId,
              acceptedAiLines:
                typeof event.payload.acceptedAiLines === 'number'
                  ? event.payload.acceptedAiLines
                  : 0,
              commitTotalLines:
                typeof event.payload.commitTotalLines === 'number'
                  ? event.payload.commitTotalLines
                  : 0,
              sessionCount: 1,
            })),
        );
      },
      async listRecordedMetricEvents() {
        return [...recordedMetricEvents];
      },
      async saveMetricSnapshots() {
        return undefined;
      },
      async listMetricSnapshots() {
        return [];
      },
      async buildMcpAuditMetrics() {
        return emptyMcpAuditMetrics();
      },
      async listEditSpanEvidence() {
        return [];
      },
      async listTabAcceptedEvents() {
        return [];
      },
      async disconnect() {
        return undefined;
      },
    };

    const app = await bootstrap({ port: 0, metricEventRepository });
    servers.push(app);

    const importResponse = await fetch(`${app.baseUrl}/events/import`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
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
          {
            eventType: 'session.recorded',
            occurredAt: '2026-04-23T00:05:00.000Z',
            payload: {
              sessionId: 'sess_2',
              projectKey: 'proj',
              repoName: 'repo',
              memberId: 'bob',
              acceptedAiLines: 46,
              commitTotalLines: 65,
            },
          },
        ],
      }),
    });
    const personalResponse = await fetch(`${app.baseUrl}/metrics/personal`);
    const teamResponse = await fetch(`${app.baseUrl}/metrics/team`);

    expect(importResponse.status).toBe(200);
    expect(personalResponse.status).toBe(200);
    expect(teamResponse.status).toBe(200);

    const personalSnapshot = await personalResponse.json();
    const teamSnapshot = await teamResponse.json();

    expect(personalSnapshot.acceptedAiLines).toBe(44);
    expect(personalSnapshot.aiOutputRate).toBe(0.8);
    expect(teamSnapshot.totalAcceptedAiLines).toBe(90);
    expect(teamSnapshot.totalCommitLines).toBe(120);
    expect(teamSnapshot.aiOutputRate).toBe(0.75);
    expect(teamSnapshot.memberCount).toBe(2);
  });

  it('passes metric query parameters from HTTP requests to the repository', async () => {
    const listCalls: unknown[] = [];
    const metricEventRepository: MetricEventRepository = {
      async saveIngestionBatch() {
        return undefined;
      },
      async listRecordedMetricEvents(filters?: unknown) {
        listCalls.push(filters);
        return [
          {
            memberId: 'alice',
            acceptedAiLines: 30,
            commitTotalLines: 60,
            sessionCount: 1,
          },
        ];
      },
      async saveMetricSnapshots() {
        return undefined;
      },
      async listMetricSnapshots() {
        return [];
      },
      async buildMcpAuditMetrics() {
        return emptyMcpAuditMetrics();
      },
      async listEditSpanEvidence() {
        return [];
      },
      async listTabAcceptedEvents() {
        return [];
      },
      async disconnect() {
        return undefined;
      },
    };

    const app = await bootstrap({ port: 0, metricEventRepository });
    servers.push(app);

    const personalResponse = await fetch(
      `${app.baseUrl}/metrics/personal?projectKey=navigation&memberId=alice&from=2026-04-23T00%3A00%3A00.000Z&to=2026-04-24T00%3A00%3A00.000Z`,
    );

    expect(personalResponse.status).toBe(200);
    expect(listCalls[0]).toEqual({
      projectKey: 'navigation',
      memberId: 'alice',
      from: '2026-04-23T00:00:00.000Z',
      to: '2026-04-24T00:00:00.000Z',
    });
  });

  it('recalculates and persists metric snapshots over HTTP', async () => {
    const savedSnapshots: unknown[] = [];
    const metricEventRepository: MetricEventRepository = {
      async saveIngestionBatch() {
        return undefined;
      },
      async listRecordedMetricEvents() {
        return [
          {
            memberId: 'alice',
            acceptedAiLines: 30,
            commitTotalLines: 60,
            sessionCount: 1,
          },
        ];
      },
      async saveMetricSnapshots(snapshots) {
        savedSnapshots.push(...snapshots);
      },
      async listMetricSnapshots() {
        return [];
      },
      async buildMcpAuditMetrics() {
        return emptyMcpAuditMetrics();
      },
      async listEditSpanEvidence() {
        return [];
      },
      async listTabAcceptedEvents() {
        return [];
      },
      async disconnect() {
        return undefined;
      },
    };

    const app = await bootstrap({ port: 0, metricEventRepository });
    servers.push(app);

    const response = await fetch(`${app.baseUrl}/metrics/recalculate`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        projectKey: 'navigation',
        from: '2026-04-23T00:00:00.000Z',
        to: '2026-04-24T00:00:00.000Z',
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      upsertedSnapshots: 2,
    });
    expect(savedSnapshots).toContainEqual(
      expect.objectContaining({
        scope: 'team',
        projectKey: 'navigation',
        acceptedAiLines: 30,
        commitTotalLines: 60,
      }),
    );
  });

  it('requires admin bearer auth for management writes and exposes audit events', async () => {
    const metricEventRepository: MetricEventRepository = createEmptyRepository();
    const app = await bootstrap({
      port: 0,
      adminToken: 'admin-secret',
      metricEventRepository,
    });
    servers.push(app);

    const unauthorizedResponse = await fetch(`${app.baseUrl}/metrics/recalculate`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ projectKey: 'navigation' }),
    });
    const authorizedResponse = await fetch(`${app.baseUrl}/metrics/recalculate`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer admin-secret',
        'content-type': 'application/json',
        'x-aimetric-actor': 'platform-admin',
      },
      body: JSON.stringify({ projectKey: 'navigation' }),
    });
    const auditResponse = await fetch(`${app.baseUrl}/admin/audit`, {
      headers: {
        authorization: 'Bearer admin-secret',
      },
    });

    expect(unauthorizedResponse.status).toBe(401);
    await expect(unauthorizedResponse.json()).resolves.toEqual({
      message: 'Unauthorized admin request',
    });
    expect(authorizedResponse.status).toBe(200);
    expect(auditResponse.status).toBe(200);
    await expect(auditResponse.json()).resolves.toEqual([
      expect.objectContaining({
        action: 'metrics.recalculate',
        actor: 'platform-admin',
        status: 'success',
      }),
    ]);
  });

  it('serves readiness and prometheus metrics endpoints', async () => {
    const metricEventRepository: MetricEventRepository = createEmptyRepository();
    const app = await bootstrap({ port: 0, metricEventRepository });
    servers.push(app);

    const readyResponse = await fetch(`${app.baseUrl}/ready`);
    const metricsResponse = await fetch(`${app.baseUrl}/metrics`);

    expect(readyResponse.status).toBe(200);
    await expect(readyResponse.json()).resolves.toEqual({
      status: 'ready',
      service: 'metric-platform',
    });
    expect(metricsResponse.status).toBe(200);
    expect(metricsResponse.headers.get('content-type')).toContain('text/plain');
    await expect(metricsResponse.text()).resolves.toContain(
      'aimetric_metric_platform_uptime_seconds',
    );
  });

  it('can run snapshot recalculation on a configured interval', async () => {
    vi.useFakeTimers();
    const savedSnapshots: unknown[] = [];
    const metricEventRepository: MetricEventRepository = {
      async saveIngestionBatch() {
        return undefined;
      },
      async listRecordedMetricEvents() {
        return [
          {
            memberId: 'alice',
            acceptedAiLines: 30,
            commitTotalLines: 60,
            sessionCount: 1,
          },
        ];
      },
      async saveMetricSnapshots(snapshots) {
        savedSnapshots.push(...snapshots);
      },
      async listMetricSnapshots() {
        return [];
      },
      async buildMcpAuditMetrics() {
        return emptyMcpAuditMetrics();
      },
      async listEditSpanEvidence() {
        return [];
      },
      async listTabAcceptedEvents() {
        return [];
      },
      async disconnect() {
        return undefined;
      },
    };

    const app = await bootstrap({
      port: 0,
      metricEventRepository,
      snapshotRecalculationIntervalMs: 1_000,
      snapshotRecalculationFilters: {
        projectKey: 'navigation',
      },
    });
    servers.push(app);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(savedSnapshots).toContainEqual(
      expect.objectContaining({
        scope: 'team',
        projectKey: 'navigation',
      }),
    );

    await app.close();
    servers.length = 0;
    savedSnapshots.length = 0;
    await vi.advanceTimersByTimeAsync(1_000);

    expect(savedSnapshots).toEqual([]);
  });

  it('serves persisted metric snapshots over HTTP', async () => {
    const listCalls: unknown[] = [];
    const metricEventRepository: MetricEventRepository = {
      async saveIngestionBatch() {
        return undefined;
      },
      async listRecordedMetricEvents() {
        return [];
      },
      async saveMetricSnapshots() {
        return undefined;
      },
      async listMetricSnapshots(filters) {
        listCalls.push(filters);
        return [
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
        ];
      },
      async buildMcpAuditMetrics() {
        return emptyMcpAuditMetrics();
      },
      async listEditSpanEvidence() {
        return [];
      },
      async listTabAcceptedEvents() {
        return [];
      },
      async disconnect() {
        return undefined;
      },
    };

    const app = await bootstrap({ port: 0, metricEventRepository });
    servers.push(app);

    const response = await fetch(
      `${app.baseUrl}/metrics/snapshots?projectKey=navigation`,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      expect.objectContaining({
        scope: 'team',
        projectKey: 'navigation',
      }),
    ]);
    expect(listCalls[0]).toEqual({ projectKey: 'navigation' });
  });

  it('serves MCP audit quality metrics over HTTP', async () => {
    const auditMetricCalls: unknown[] = [];
    const metricEventRepository: MetricEventRepository = {
      async saveIngestionBatch() {
        return undefined;
      },
      async listRecordedMetricEvents() {
        return [];
      },
      async saveMetricSnapshots() {
        return undefined;
      },
      async listMetricSnapshots() {
        return [];
      },
      async buildMcpAuditMetrics(filters) {
        auditMetricCalls.push(filters);
        return {
          totalToolCalls: 3,
          successfulToolCalls: 2,
          failedToolCalls: 1,
          successRate: 2 / 3,
          failureRate: 1 / 3,
          averageDurationMs: 15,
        };
      },
      async listEditSpanEvidence() {
        return [];
      },
      async listTabAcceptedEvents() {
        return [];
      },
      async disconnect() {
        return undefined;
      },
    };

    const app = await bootstrap({ port: 0, metricEventRepository });
    servers.push(app);

    const response = await fetch(
      `${app.baseUrl}/metrics/mcp-audit?projectKey=aimetric&memberId=alice`,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      totalToolCalls: 3,
      successfulToolCalls: 2,
      failedToolCalls: 1,
      successRate: 2 / 3,
      failureRate: 1 / 3,
      averageDurationMs: 15,
    });
    expect(auditMetricCalls[0]).toEqual({
      projectKey: 'aimetric',
      memberId: 'alice',
    });
  });

  it('serves edit span evidence over HTTP', async () => {
    const evidenceCalls: unknown[] = [];
    const editEvidence: EditSpanEvidenceRecord[] = [
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
    ];
    const metricEventRepository: MetricEventRepository = {
      async saveIngestionBatch() {
        return undefined;
      },
      async listRecordedMetricEvents() {
        return [];
      },
      async saveMetricSnapshots() {
        return undefined;
      },
      async listMetricSnapshots() {
        return [];
      },
      async buildMcpAuditMetrics() {
        return emptyMcpAuditMetrics();
      },
      async listEditSpanEvidence(filters) {
        evidenceCalls.push(filters);
        return editEvidence;
      },
      async listTabAcceptedEvents() {
        return [];
      },
      async disconnect() {
        return undefined;
      },
    };

    const app = await bootstrap({ port: 0, metricEventRepository });
    servers.push(app);

    const response = await fetch(
      `${app.baseUrl}/evidence/edits?projectKey=aimetric&sessionId=sess_1&filePath=%2Frepo%2Fsrc%2Fdemo.ts`,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(editEvidence);
    expect(evidenceCalls[0]).toEqual({
      projectKey: 'aimetric',
      sessionId: 'sess_1',
      filePath: '/repo/src/demo.ts',
    });
  });

  it('serves tab accepted events over HTTP', async () => {
    const eventCalls: unknown[] = [];
    const tabEvents: TabAcceptedEventRecord[] = [
      {
        sessionId: 'sess_1',
        occurredAt: '2026-04-24T00:03:00.000Z',
        acceptedLines: 2,
        filePath: '/repo/src/demo.ts',
        language: 'typescript',
        ingestionKey: 'cursor-tab:sess_1:2026-04-24T00:03:00.000Z:abc',
      },
    ];
    const metricEventRepository: MetricEventRepository = {
      async saveIngestionBatch() {
        return undefined;
      },
      async listRecordedMetricEvents() {
        return [];
      },
      async saveMetricSnapshots() {
        return undefined;
      },
      async listMetricSnapshots() {
        return [];
      },
      async buildMcpAuditMetrics() {
        return emptyMcpAuditMetrics();
      },
      async listEditSpanEvidence() {
        return [];
      },
      async listTabAcceptedEvents(filters) {
        eventCalls.push(filters);
        return tabEvents;
      },
      async disconnect() {
        return undefined;
      },
    };

    const app = await bootstrap({ port: 0, metricEventRepository });
    servers.push(app);

    const response = await fetch(
      `${app.baseUrl}/evidence/tab-completions?projectKey=aimetric&sessionId=sess_1&filePath=%2Frepo%2Fsrc%2Fdemo.ts`,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(tabEvents);
    expect(eventCalls[0]).toEqual({
      projectKey: 'aimetric',
      sessionId: 'sess_1',
      filePath: '/repo/src/demo.ts',
    });
  });

  it('serves analysis summary over HTTP', async () => {
    const summaryCalls: unknown[] = [];
    const summary: AnalysisSummaryRecord = {
      sessionCount: 2,
      editSpanCount: 3,
      tabAcceptedCount: 4,
      tabAcceptedLines: 9,
    };
    const metricEventRepository: MetricEventRepository = {
      async saveIngestionBatch() {
        return undefined;
      },
      async listRecordedMetricEvents() {
        return [];
      },
      async saveMetricSnapshots() {
        return undefined;
      },
      async listMetricSnapshots() {
        return [];
      },
      async buildMcpAuditMetrics() {
        return emptyMcpAuditMetrics();
      },
      async listEditSpanEvidence() {
        return [];
      },
      async listTabAcceptedEvents() {
        return [];
      },
      async buildAnalysisSummary(filters) {
        summaryCalls.push(filters);
        return summary;
      },
      async listSessionAnalysisRows() {
        return [];
      },
      async listOutputAnalysisRows() {
        return [];
      },
      async disconnect() {
        return undefined;
      },
    };

    const app = await bootstrap({ port: 0, metricEventRepository });
    servers.push(app);

    const response = await fetch(
      `${app.baseUrl}/analysis/summary?projectKey=aimetric&memberId=alice`,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(summary);
    expect(summaryCalls[0]).toEqual({
      projectKey: 'aimetric',
      memberId: 'alice',
    });
  });

  it('serves session and output analysis rows over HTTP', async () => {
    const sessionCalls: unknown[] = [];
    const outputCalls: unknown[] = [];
    const sessionRows: SessionAnalysisRow[] = [
      {
        sessionId: 'sess_1',
        memberId: 'alice',
        projectKey: 'aimetric',
        occurredAt: '2026-04-24T00:05:00.000Z',
        conversationTurns: 3,
        userMessageCount: 3,
        assistantMessageCount: 3,
        firstMessageAt: '2026-04-24T00:00:00.000Z',
        lastMessageAt: '2026-04-24T00:05:00.000Z',
        workspaceId: 'workspace-1',
        workspacePath: '/repo',
        projectFingerprint: 'fingerprint-1',
        editSpanCount: 2,
        tabAcceptedCount: 2,
        tabAcceptedLines: 5,
      },
    ];
    const outputRows: OutputAnalysisRow[] = [
      {
        sessionId: 'sess_1',
        memberId: 'alice',
        projectKey: 'aimetric',
        filePath: '/repo/src/demo.ts',
        editSpanCount: 2,
        latestEditAt: '2026-04-24T00:05:00.000Z',
        tabAcceptedCount: 2,
        tabAcceptedLines: 5,
        latestDiffSummary: '--- /repo/src/demo.ts',
      },
    ];
    const metricEventRepository: MetricEventRepository = {
      async saveIngestionBatch() {
        return undefined;
      },
      async listRecordedMetricEvents() {
        return [];
      },
      async saveMetricSnapshots() {
        return undefined;
      },
      async listMetricSnapshots() {
        return [];
      },
      async buildMcpAuditMetrics() {
        return emptyMcpAuditMetrics();
      },
      async listEditSpanEvidence() {
        return [];
      },
      async listTabAcceptedEvents() {
        return [];
      },
      async buildAnalysisSummary() {
        return emptyAnalysisSummary();
      },
      async listSessionAnalysisRows(filters) {
        sessionCalls.push(filters);
        return sessionRows;
      },
      async listOutputAnalysisRows(filters) {
        outputCalls.push(filters);
        return outputRows;
      },
      async disconnect() {
        return undefined;
      },
    };

    const app = await bootstrap({ port: 0, metricEventRepository });
    servers.push(app);

    const sessionResponse = await fetch(
      `${app.baseUrl}/analysis/sessions?projectKey=aimetric`,
    );
    const outputResponse = await fetch(
      `${app.baseUrl}/analysis/output?projectKey=aimetric`,
    );

    expect(sessionResponse.status).toBe(200);
    expect(outputResponse.status).toBe(200);
    await expect(sessionResponse.json()).resolves.toEqual(sessionRows);
    await expect(outputResponse.json()).resolves.toEqual(outputRows);
    expect(sessionCalls[0]).toEqual({ projectKey: 'aimetric' });
    expect(outputCalls[0]).toEqual({ projectKey: 'aimetric' });
  });

  it('serves rule center APIs over HTTP', async () => {
    const catalogRoot = createTemporaryRuleCatalogRoot();
    const app = await bootstrap({ port: 0, ruleCatalogRoot: catalogRoot });
    servers.push(app);

    const versionsResponse = await fetch(
      `${app.baseUrl}/rules/versions?projectKey=aimetric`,
    );
    const templateResponse = await fetch(
      `${app.baseUrl}/rules/template?projectKey=aimetric&version=v2`,
    );
    const validationResponse = await fetch(
      `${app.baseUrl}/rules/validate?projectKey=aimetric&version=v2`,
    );
    const activeResponse = await fetch(`${app.baseUrl}/rules/active`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        projectKey: 'aimetric',
        version: 'v1',
      }),
    });
    const defaultRolloutResponse = await fetch(
      `${app.baseUrl}/rules/rollout?projectKey=aimetric`,
    );
    const rolloutUpdateResponse = await fetch(`${app.baseUrl}/rules/rollout`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        projectKey: 'aimetric',
        enabled: true,
        candidateVersion: 'v1',
        percentage: 25,
        includedMembers: ['alice'],
      }),
    });
    const persistedRolloutResponse = await fetch(
      `${app.baseUrl}/rules/rollout?projectKey=aimetric`,
    );
    const rolloutEvaluationResponse = await fetch(
      `${app.baseUrl}/rules/rollout/evaluate?projectKey=aimetric&memberId=alice`,
    );

    expect(versionsResponse.status).toBe(200);
    expect(templateResponse.status).toBe(200);
    expect(validationResponse.status).toBe(200);
    expect(activeResponse.status).toBe(200);
    expect(defaultRolloutResponse.status).toBe(200);
    expect(rolloutUpdateResponse.status).toBe(200);
    expect(persistedRolloutResponse.status).toBe(200);
    expect(rolloutEvaluationResponse.status).toBe(200);
    await expect(versionsResponse.json()).resolves.toMatchObject({
      projectKey: 'aimetric',
      activeVersion: 'v2',
    });
    await expect(templateResponse.json()).resolves.toMatchObject({
      projectKey: 'aimetric',
      version: 'v2',
    });
    await expect(validationResponse.json()).resolves.toMatchObject({
      valid: true,
      activeVersion: 'v2',
    });
    await expect(activeResponse.json()).resolves.toEqual({
      projectKey: 'aimetric',
      previousVersion: 'v2',
      activeVersion: 'v1',
    });
    await expect(defaultRolloutResponse.json()).resolves.toMatchObject({
      projectKey: 'aimetric',
      enabled: false,
      percentage: 0,
      includedMembers: [],
    });
    await expect(rolloutUpdateResponse.json()).resolves.toMatchObject({
      projectKey: 'aimetric',
      enabled: true,
      candidateVersion: 'v1',
      percentage: 25,
      includedMembers: ['alice'],
    });
    await expect(persistedRolloutResponse.json()).resolves.toMatchObject({
      projectKey: 'aimetric',
      enabled: true,
      candidateVersion: 'v1',
      percentage: 25,
      includedMembers: ['alice'],
    });
    await expect(rolloutEvaluationResponse.json()).resolves.toMatchObject({
      projectKey: 'aimetric',
      memberId: 'alice',
      activeVersion: 'v1',
      selectedVersion: 'v1',
      matched: true,
      reason: 'included-member',
    });
  });

  it('serves knowledge search over HTTP', async () => {
    const app = await bootstrap({ port: 0 });
    servers.push(app);

    const response = await fetch(
      `${app.baseUrl}/knowledge/search?query=${encodeURIComponent('规则分层')}&limit=2`,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      query: '规则分层',
      matches: [expect.objectContaining({ filePath: expect.any(String) })],
    });
  });

  const createTemporaryRuleCatalogRoot = (): string => {
    const catalogRoot = mkdtempSync(join(tmpdir(), 'aimetric-rule-center-'));
    temporaryDirectories.push(catalogRoot);

    cpSync(
      join(
        '/Users/zhangqixiang/0_1WORK/zhongxing/AIMetric',
        'packages/rule-engine/src/templates',
      ),
      catalogRoot,
      { recursive: true },
    );

    return catalogRoot;
  };
});

const emptyMcpAuditMetrics = () => ({
  totalToolCalls: 0,
  successfulToolCalls: 0,
  failedToolCalls: 0,
  successRate: 0,
  failureRate: 0,
  averageDurationMs: 0,
});

const emptyAnalysisSummary = (): AnalysisSummaryRecord => ({
  sessionCount: 0,
  editSpanCount: 0,
  tabAcceptedCount: 0,
  tabAcceptedLines: 0,
});

const createEmptyRepository = (): MetricEventRepository => ({
  async saveIngestionBatch() {
    return undefined;
  },
  async listRecordedMetricEvents() {
    return [];
  },
  async saveMetricSnapshots() {
    return undefined;
  },
  async listMetricSnapshots() {
    return [];
  },
  async buildMcpAuditMetrics() {
    return emptyMcpAuditMetrics();
  },
  async listEditSpanEvidence() {
    return [];
  },
  async listTabAcceptedEvents() {
    return [];
  },
  async buildAnalysisSummary() {
    return emptyAnalysisSummary();
  },
  async listSessionAnalysisRows() {
    return [];
  },
  async listOutputAnalysisRows() {
    return [];
  },
  async disconnect() {
    return undefined;
  },
});
