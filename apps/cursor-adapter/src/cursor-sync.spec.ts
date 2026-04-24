import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseCursorSyncArgs, syncCursorSessions } from './cursor-sync.js';

const temporaryDirectories: string[] = [];
const originalFetch = globalThis.fetch;

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => {
    rmSync(directory, { recursive: true, force: true });
  });
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('syncCursorSessions', () => {
  it('builds a dry-run cursor-db batch from exportable sessions', async () => {
    const { workspaceDir, cursorProjectsDir } = createWorkspaceWithCursorTranscript();

    const result = await syncCursorSessions({
      workspaceDir,
      dryRun: true,
      now: () => '2026-04-24T00:10:00.000Z',
      cursorProjectsDir,
      homeDir: workspaceDir,
      platform: 'darwin',
    });

    expect(result).toMatchObject({
      published: false,
      discoveredSessions: 1,
      exportedSessions: 1,
      skippedSessions: 0,
      source: 'cursor-db',
    });
    expect(result.batch?.events[0]).toMatchObject({
      eventType: 'session.recorded',
      occurredAt: '2026-04-24T00:05:00.000Z',
      payload: {
        sessionId: 'cursor-session-1',
        collectorType: 'cursor-db',
        conversationTurns: 1,
        ingestionKey: expect.stringContaining('cursor-db:cursor-session-1'),
      },
    });
    expect(result.batch?.events[1]).toMatchObject({
      eventType: 'tab.accepted',
      occurredAt: '2026-04-24T00:03:00.000Z',
      payload: {
        sessionId: 'cursor-session-1',
        acceptedLines: 2,
        filePath: '/repo/src/demo.ts',
        language: 'typescript',
        ingestionKey: expect.stringContaining('cursor-tab:cursor-session-1'),
      },
    });
  });

  it('posts the cursor-db batch and persists sync state when publish is enabled', async () => {
    const { workspaceDir, cursorProjectsDir } = createWorkspaceWithCursorTranscript();
    const requests: Array<{ url: string; body: string }> = [];

    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({
        url: String(input),
        body: typeof init?.body === 'string' ? init.body : '',
      });

      return new Response(JSON.stringify({ accepted: 1 }), { status: 200 });
    }) as typeof fetch;

    const result = await syncCursorSessions({
      workspaceDir,
      dryRun: false,
      now: () => '2026-04-24T00:10:00.000Z',
      cursorProjectsDir,
      homeDir: workspaceDir,
      platform: 'darwin',
    });

    expect(result.published).toBe(true);
    expect(requests[0]?.url).toBe('http://127.0.0.1:3000/ingestion');
    expect(
      readFileSync(join(workspaceDir, '.aimetric', 'cursor-sync-state.json'), 'utf8'),
    ).toContain('cursor-session-1');
  });
});

describe('parseCursorSyncArgs', () => {
  it('parses CLI flags into sync input', () => {
    expect(
      parseCursorSyncArgs([
        '--workspaceDir=/repo',
        '--cursorProjectsDir=/tmp/projects',
        '--publish',
        '--limit=10',
      ]),
    ).toEqual({
      workspaceDir: '/repo',
      cursorProjectsDir: '/tmp/projects',
      dryRun: false,
      limit: 10,
    });
  });
});

const createWorkspaceWithCursorTranscript = (): {
  workspaceDir: string;
  cursorProjectsDir: string;
} => {
  const workspaceDir = mkdtempSync(join(tmpdir(), 'aimetric-cursor-sync-'));
  const aimetricDir = join(workspaceDir, '.aimetric');
  const cursorProjectsDir = join(workspaceDir, '.cursor', 'projects');
  const transcriptDirectory = join(cursorProjectsDir, 'project-a', 'agent-transcripts');
  temporaryDirectories.push(workspaceDir);

  mkdirSync(aimetricDir, { recursive: true });
  mkdirSync(transcriptDirectory, { recursive: true });
  writeFileSync(
    join(aimetricDir, 'config.json'),
    JSON.stringify(
      {
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
      },
      null,
      2,
    ),
    'utf8',
  );
  writeFileSync(
    join(transcriptDirectory, 'session-1.jsonl'),
    [
      JSON.stringify({
        sessionId: 'cursor-session-1',
        timestamp: '2026-04-24T00:00:00.000Z',
        role: 'user',
        text: 'Implement the collector',
        workspaceId: 'workspace-1',
        workspacePath: '/repo',
      }),
      JSON.stringify({
        sessionId: 'cursor-session-1',
        timestamp: '2026-04-24T00:03:00.000Z',
        eventType: 'tab.accepted',
        acceptedLines: 2,
        filePath: '/repo/src/demo.ts',
        language: 'typescript',
      }),
      JSON.stringify({
        sessionId: 'cursor-session-1',
        timestamp: '2026-04-24T00:05:00.000Z',
        role: 'assistant',
        text: 'Collector implemented',
      }),
    ].join('\n'),
    'utf8',
  );

  return {
    workspaceDir,
    cursorProjectsDir,
  };
};
