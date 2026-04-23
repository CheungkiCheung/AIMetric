import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootstrap } from './main.js';
import type {
  MetricEventRepository,
  RecordedMetricEvent,
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

    expect(versionsResponse.status).toBe(200);
    expect(templateResponse.status).toBe(200);
    expect(validationResponse.status).toBe(200);
    expect(activeResponse.status).toBe(200);
    expect(defaultRolloutResponse.status).toBe(200);
    expect(rolloutUpdateResponse.status).toBe(200);
    expect(persistedRolloutResponse.status).toBe(200);
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
