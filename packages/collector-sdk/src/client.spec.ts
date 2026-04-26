import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalEventBuffer } from './buffer.js';
import {
  CollectorClient,
  flushBufferedIngestionBatches,
  publishIngestionBatch,
  publishIngestionBatchWithBuffer,
} from './client.js';
import { loadAimMetricConfig } from './config.js';

const temporaryWorkspaces: string[] = [];
const originalFetch = globalThis.fetch;

afterEach(() => {
  temporaryWorkspaces.splice(0).forEach((workspace) => {
    rmSync(workspace, { recursive: true, force: true });
  });
  globalThis.fetch = originalFetch;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('LocalEventBuffer', () => {
  it('stores and flushes buffered events in FIFO order', () => {
    const buffer = new LocalEventBuffer<{ id: string }>();
    buffer.push({ id: '1' });
    buffer.push({ id: '2' });

    expect(buffer.flush()).toEqual([{ id: '1' }, { id: '2' }]);
  });
});

describe('loadAimMetricConfig', () => {
  it('loads employee onboarding config from a workspace', async () => {
    const workspaceDir = createWorkspaceWithConfig();

    const config = await loadAimMetricConfig({ workspaceDir });

    expect(config.projectKey).toBe('aimetric');
    expect(config.memberId).toBe('alice');
    expect(config.toolProfile).toBe('cursor');
    expect(config.collector.endpoint).toBe('http://127.0.0.1:3000/ingestion');
  });

  it('loads collector auth token environment names without storing token values', async () => {
    const workspaceDir = createWorkspaceWithConfig({
      collector: {
        endpoint: 'http://127.0.0.1:3000/ingestion',
        source: 'cursor',
        authTokenEnv: 'AIMETRIC_COLLECTOR_TOKEN',
      },
    });

    const config = await loadAimMetricConfig({ workspaceDir });

    expect(config.collector.authTokenEnv).toBe('AIMETRIC_COLLECTOR_TOKEN');
    expect(JSON.stringify(config)).not.toContain('secret-token');
  });

  it('rejects invalid onboarding config files', async () => {
    const workspaceDir = createWorkspaceWithConfig({ memberId: undefined });

    await expect(loadAimMetricConfig({ workspaceDir })).rejects.toThrow(
      'Invalid AIMetric config',
    );
  });
});

describe('CollectorClient', () => {
  it('builds session recorded ingestion batches from onboarding config', async () => {
    const workspaceDir = createWorkspaceWithConfig();
    const config = await loadAimMetricConfig({ workspaceDir });
    const client = CollectorClient.fromConfig(config, {
      now: () => '2026-04-23T00:00:00.000Z',
    });

    client.recordSession({
      sessionId: 'sess_1',
      acceptedAiLines: 44,
      commitTotalLines: 55,
    });

    expect(client.flushBatch()).toEqual({
      schemaVersion: 'v1',
      source: 'cursor',
      events: [
        {
          eventType: 'session.recorded',
          occurredAt: '2026-04-23T00:00:00.000Z',
          payload: {
            sessionId: 'sess_1',
            projectKey: 'aimetric',
            repoName: 'AIMetric',
            memberId: 'alice',
            acceptedAiLines: 44,
            commitTotalLines: 55,
            ruleVersion: 'v2',
          },
        },
      ],
    });
  });

  it('preserves non-cursor tool profiles in onboarding config and batch source', async () => {
    const workspaceDir = createWorkspaceWithConfig({
      toolProfile: 'cli',
      collector: {
        endpoint: 'http://127.0.0.1:3000/ingestion',
        source: 'cli',
      },
      mcp: {
        tools: [],
        environment: {
          AIMETRIC_TOOL_PROFILE: 'cli',
        },
      },
    });
    const config = await loadAimMetricConfig({ workspaceDir });
    const client = CollectorClient.fromConfig(config, {
      now: () => '2026-04-23T00:00:00.000Z',
    });

    client.recordSession({
      sessionId: 'sess_cli',
    });

    expect(config.toolProfile).toBe('cli');
    expect(client.flushBatch().source).toBe('cli');
  });

  it('records ingestionKey and metadata in session payloads when provided', async () => {
    const workspaceDir = createWorkspaceWithConfig({
      collector: {
        endpoint: 'http://127.0.0.1:3000/ingestion',
        source: 'cursor-db',
      },
    });
    const config = await loadAimMetricConfig({ workspaceDir });
    const client = CollectorClient.fromConfig(config, {
      now: () => '2026-04-24T00:00:00.000Z',
    });

    client.recordSession({
      sessionId: 'cursor-session-1',
      ingestionKey: 'cursor-db:cursor-session-1:2026-04-24T00:00:00.000Z:abc',
      metadata: {
        collectorType: 'cursor-db',
        conversationTurns: 3,
      },
    });

    expect(client.flushBatch()).toEqual({
      schemaVersion: 'v1',
      source: 'cursor-db',
      events: [
        {
          eventType: 'session.recorded',
          occurredAt: '2026-04-24T00:00:00.000Z',
          payload: {
            sessionId: 'cursor-session-1',
            projectKey: 'aimetric',
            repoName: 'AIMetric',
            memberId: 'alice',
            ruleVersion: 'v2',
            ingestionKey:
              'cursor-db:cursor-session-1:2026-04-24T00:00:00.000Z:abc',
            collectorType: 'cursor-db',
            conversationTurns: 3,
          },
        },
      ],
    });
  });

  it('builds tab accepted ingestion events from onboarding config', async () => {
    const workspaceDir = createWorkspaceWithConfig({
      collector: {
        endpoint: 'http://127.0.0.1:3000/ingestion',
        source: 'cursor-db',
      },
    });
    const config = await loadAimMetricConfig({ workspaceDir });
    const client = CollectorClient.fromConfig(config, {
      now: () => '2026-04-24T00:00:00.000Z',
    });

    client.recordTabAccepted({
      sessionId: 'cursor-session-1',
      acceptedLines: 3,
      filePath: '/repo/src/demo.ts',
      language: 'typescript',
      ingestionKey: 'cursor-tab:cursor-session-1:2026-04-24T00:00:00.000Z:abc',
    });

    expect(client.flushBatch()).toEqual({
      schemaVersion: 'v1',
      source: 'cursor-db',
      events: [
        {
          eventType: 'tab.accepted',
          occurredAt: '2026-04-24T00:00:00.000Z',
          payload: {
            sessionId: 'cursor-session-1',
            projectKey: 'aimetric',
            repoName: 'AIMetric',
            memberId: 'alice',
            ruleVersion: 'v2',
            acceptedLines: 3,
            filePath: '/repo/src/demo.ts',
            language: 'typescript',
            ingestionKey:
              'cursor-tab:cursor-session-1:2026-04-24T00:00:00.000Z:abc',
          },
        },
      ],
    });
  });

  it('publishes ingestion batches with bearer auth from the configured environment', async () => {
    const requests: Array<{ url: string; authorization?: string }> = [];
    const workspaceDir = createWorkspaceWithConfig({
      collector: {
        endpoint: 'http://127.0.0.1:3000/ingestion',
        source: 'cursor',
        authTokenEnv: 'AIMETRIC_COLLECTOR_TOKEN',
      },
    });
    const config = await loadAimMetricConfig({ workspaceDir });
    globalThis.fetch = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        requests.push({
          url: String(input),
          authorization: headers.get('authorization') ?? undefined,
        });

        return new Response(JSON.stringify({ accepted: 1 }), { status: 200 });
      },
    ) as typeof fetch;

    await publishIngestionBatch(
      config.collector,
      {
        schemaVersion: 'v1',
        source: 'cursor',
        events: [],
      },
      {
        environment: {
          AIMETRIC_COLLECTOR_TOKEN: 'secret-token',
        },
      },
    );

    expect(requests).toEqual([
      {
        url: 'http://127.0.0.1:3000/ingestion',
        authorization: 'Bearer secret-token',
      },
    ]);
  });

  it('buffers ingestion batches to disk when publishing fails', async () => {
    const workspaceDir = createWorkspaceWithConfig();
    const config = await loadAimMetricConfig({ workspaceDir });
    globalThis.fetch = vi.fn(async () => new Response('', { status: 503 })) as typeof fetch;

    const result = await publishIngestionBatchWithBuffer(
      config.collector,
      createBatch(),
      {
        workspaceDir,
      },
    );

    const outboxDir = join(workspaceDir, '.aimetric', 'outbox');
    expect(result).toMatchObject({
      published: false,
      buffered: true,
      bufferedDepth: 1,
    });
    expect(readdirSync(outboxDir)).toHaveLength(1);
  });

  it('flushes buffered ingestion batches in FIFO order and removes successful files', async () => {
    const workspaceDir = createWorkspaceWithConfig();
    const config = await loadAimMetricConfig({ workspaceDir });
    const publishedSessionIds: string[] = [];
    globalThis.fetch = vi.fn(async () => new Response('', { status: 503 })) as typeof fetch;

    await publishIngestionBatchWithBuffer(
      config.collector,
      createBatch('sess_1'),
      { workspaceDir },
    );
    await publishIngestionBatchWithBuffer(
      config.collector,
      createBatch('sess_2'),
      { workspaceDir },
    );

    globalThis.fetch = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit) => {
        const batch = JSON.parse(String(init?.body));
        publishedSessionIds.push(batch.events[0].payload.sessionId);

        return new Response(JSON.stringify({ accepted: 1 }), { status: 200 });
      },
    ) as typeof fetch;

    const result = await flushBufferedIngestionBatches(config.collector, {
      workspaceDir,
    });

    expect(result).toEqual({
      attempted: 2,
      published: 2,
      failed: 0,
      remainingDepth: 0,
    });
    expect(publishedSessionIds).toEqual(['sess_1', 'sess_2']);
    expect(existsSync(join(workspaceDir, '.aimetric', 'outbox'))).toBe(true);
    expect(readdirSync(join(workspaceDir, '.aimetric', 'outbox'))).toHaveLength(0);
  });

  it('preserves FIFO order for buffered batches written in the same millisecond', async () => {
    const workspaceDir = createWorkspaceWithConfig();
    const config = await loadAimMetricConfig({ workspaceDir });
    const publishedSessionIds: string[] = [];
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-26T05:20:00.000Z'));
    globalThis.fetch = vi.fn(async () => new Response('', { status: 503 })) as typeof fetch;

    await publishIngestionBatchWithBuffer(
      config.collector,
      createBatch('sess_1'),
      { workspaceDir },
    );
    await publishIngestionBatchWithBuffer(
      config.collector,
      createBatch('sess_2'),
      { workspaceDir },
    );

    vi.useRealTimers();
    globalThis.fetch = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit) => {
        const batch = JSON.parse(String(init?.body));
        publishedSessionIds.push(batch.events[0].payload.sessionId);

        return new Response(JSON.stringify({ accepted: 1 }), { status: 200 });
      },
    ) as typeof fetch;

    await flushBufferedIngestionBatches(config.collector, {
      workspaceDir,
    });

    expect(publishedSessionIds).toEqual(['sess_1', 'sess_2']);
  });
});

const createWorkspaceWithConfig = (
  overrides: Record<string, unknown> = {},
): string => {
  const workspaceDir = mkdtempSync(join(tmpdir(), 'aimetric-sdk-config-'));
  const aimetricDir = join(workspaceDir, '.aimetric');
  temporaryWorkspaces.push(workspaceDir);
  mkdirSync(aimetricDir, { recursive: true });
  writeFileSync(
    join(aimetricDir, 'config.json'),
    JSON.stringify(
      withoutUndefined({
        projectKey: 'aimetric',
        memberId: 'alice',
        repoName: 'AIMetric',
        toolProfile: 'cursor',
        collector: {
          endpoint: 'http://127.0.0.1:3000/ingestion',
          source: 'cursor',
        },
        metricPlatform: {
          endpoint: 'http://127.0.0.1:3001',
        },
        rules: {
          version: 'v2',
          must: [],
          should: [],
          onDemand: [],
          knowledgeRefs: [],
        },
        mcp: {
          tools: [],
          environment: {},
        },
        ...overrides,
      }),
    ),
    'utf8',
  );

  return workspaceDir;
};

const withoutUndefined = (input: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );

const createBatch = (sessionId = 'sess_1') => ({
  schemaVersion: 'v1' as const,
  source: 'cursor',
  events: [
    {
      eventType: 'session.recorded',
      occurredAt: '2026-04-24T00:00:00.000Z',
      payload: {
        sessionId,
        projectKey: 'aimetric',
        repoName: 'AIMetric',
      },
    },
  ],
});
