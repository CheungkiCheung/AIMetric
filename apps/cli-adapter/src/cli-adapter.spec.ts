import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cliAdapterManifest,
  getCliAdapterHealthReport,
  parseCliRecordArgs,
  recordCliSession,
} from './cli-adapter.js';

const temporaryWorkspaces: string[] = [];
const originalFetch = globalThis.fetch;

afterEach(() => {
  temporaryWorkspaces.splice(0).forEach((workspace) => {
    rmSync(workspace, { recursive: true, force: true });
  });
  globalThis.fetch = originalFetch;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('recordCliSession', () => {
  it('declares the CLI adapter capability manifest', () => {
    expect(cliAdapterManifest).toMatchObject({
      toolKey: 'generic-cli',
      displayName: 'Generic CLI Agent',
      adapterKey: 'cli-standard',
      supportedEventTypes: ['session.recorded'],
      collectionMode: 'cli',
      privacyLevel: 'metadata-only',
      latencyProfile: 'async',
      failurePolicy: {
        onOffline: 'buffer',
        onPermissionDenied: 'degrade',
        onSchemaMismatch: 'skip-event',
        maxRetryCount: 3,
      },
      privacyPolicy: {
        collectsPromptText: true,
        collectsCompletionText: true,
        collectsDiff: false,
        collectsFilePath: false,
        collectsFileContent: false,
        redaction: 'none',
      },
    });
  });

  it('reports CLI adapter health from workspace config availability', async () => {
    const workspaceDir = createWorkspaceWithConfig();

    await expect(
      getCliAdapterHealthReport({
        workspaceDir,
        checkedAt: '2026-04-25T00:00:00.000Z',
      }),
    ).resolves.toMatchObject({
      toolKey: 'generic-cli',
      adapterKey: 'cli-standard',
      status: 'healthy',
      checks: [
        {
          key: 'config',
          status: 'pass',
          message: 'AIMetric config loaded',
        },
      ],
    });
  });

  it('builds a standard ingestion batch from CLI session input', async () => {
    const workspaceDir = createWorkspaceWithConfig();

    const result = await recordCliSession({
      workspaceDir,
      sessionId: 'cli_sess_1',
      acceptedAiLines: 12,
      commitTotalLines: 20,
      userMessage: 'implement the CLI adapter',
      assistantMessage: 'adapter implemented',
      dryRun: true,
      now: () => '2026-04-24T00:00:00.000Z',
    });

    expect(result.published).toBe(false);
    expect(result.batch).toEqual({
      schemaVersion: 'v1',
      source: 'cli',
      events: [
        {
          eventType: 'session.recorded',
          occurredAt: '2026-04-24T00:00:00.000Z',
          payload: {
            sessionId: 'cli_sess_1',
            projectKey: 'aimetric',
            repoName: 'AIMetric',
            memberId: 'alice',
            acceptedAiLines: 12,
            commitTotalLines: 20,
            userMessage: 'implement the CLI adapter',
            assistantMessage: 'adapter implemented',
            ruleVersion: 'v2',
          },
        },
      ],
    });
  });

  it('publishes the batch to collector-gateway when dryRun is disabled', async () => {
    const workspaceDir = createWorkspaceWithConfig();
    const requests: Array<{
      url: string;
      body: string;
      authorization?: string;
    }> = [];
    vi.stubEnv('AIMETRIC_COLLECTOR_TOKEN', 'secret-token');

    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      requests.push({
        url: String(input),
        body: typeof init?.body === 'string' ? init.body : '',
        authorization: headers.get('authorization') ?? undefined,
      });

      return new Response(JSON.stringify({ accepted: 1 }), { status: 200 });
    }) as typeof fetch;

    const result = await recordCliSession({
      workspaceDir,
      sessionId: 'cli_sess_1',
      dryRun: false,
      now: () => '2026-04-24T00:00:00.000Z',
    });

    expect(result.published).toBe(true);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe('http://127.0.0.1:3000/ingestion');
    expect(requests[0]?.authorization).toBe('Bearer secret-token');
    expect(JSON.parse(requests[0]?.body ?? '{}')).toMatchObject({
      source: 'cli',
      events: [
        {
          eventType: 'session.recorded',
          payload: {
            sessionId: 'cli_sess_1',
            memberId: 'alice',
          },
        },
      ],
    });
  });

  it('buffers the batch when collector-gateway publishing fails', async () => {
    const workspaceDir = createWorkspaceWithConfig();
    globalThis.fetch = vi.fn(async () => new Response('', { status: 503 })) as typeof fetch;

    const result = await recordCliSession({
      workspaceDir,
      sessionId: 'cli_sess_1',
      dryRun: false,
      now: () => '2026-04-24T00:00:00.000Z',
    });

    expect(result).toMatchObject({
      published: false,
      buffered: true,
      bufferedDepth: 1,
    });
    expect(readdirSync(join(workspaceDir, '.aimetric', 'outbox'))).toHaveLength(1);
  });
});

describe('parseCliRecordArgs', () => {
  it('parses CLI flags into a recordCliSession input', () => {
    expect(
      parseCliRecordArgs([
        '--workspaceDir=/repo',
        '--sessionId=cli_sess_1',
        '--acceptedAiLines=12',
        '--commitTotalLines=20',
        '--userMessage=hello',
        '--assistantMessage=done',
        '--publish',
      ]),
    ).toEqual({
      workspaceDir: '/repo',
      sessionId: 'cli_sess_1',
      acceptedAiLines: 12,
      commitTotalLines: 20,
      userMessage: 'hello',
      assistantMessage: 'done',
      dryRun: false,
    });
  });
});

const createWorkspaceWithConfig = (): string => {
  const workspaceDir = mkdtempSync(join(tmpdir(), 'aimetric-cli-adapter-'));
  const aimetricDir = join(workspaceDir, '.aimetric');
  temporaryWorkspaces.push(workspaceDir);
  mkdirSync(aimetricDir, { recursive: true });
  writeFileSync(
    join(aimetricDir, 'config.json'),
    JSON.stringify({
      projectKey: 'aimetric',
      memberId: 'alice',
      repoName: 'AIMetric',
      toolProfile: 'cli',
      collector: {
        endpoint: 'http://127.0.0.1:3000/ingestion',
        source: 'cli',
        authTokenEnv: 'AIMETRIC_COLLECTOR_TOKEN',
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
        environment: {
          AIMETRIC_TOOL_PROFILE: 'cli',
        },
      },
    }),
    'utf8',
  );

  return workspaceDir;
};
