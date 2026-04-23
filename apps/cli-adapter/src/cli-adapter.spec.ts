import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseCliRecordArgs, recordCliSession } from './cli-adapter.js';

const temporaryWorkspaces: string[] = [];
const originalFetch = globalThis.fetch;

afterEach(() => {
  temporaryWorkspaces.splice(0).forEach((workspace) => {
    rmSync(workspace, { recursive: true, force: true });
  });
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('recordCliSession', () => {
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
    const requests: Array<{ url: string; body: string }> = [];

    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({
        url: String(input),
        body: typeof init?.body === 'string' ? init.body : '',
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
