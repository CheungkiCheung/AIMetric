import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  discoverCursorStateDatabases,
  matchCursorStateDatabases,
} from './state-database.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => {
    rmSync(directory, { recursive: true, force: true });
  });
});

describe('discoverCursorStateDatabases', () => {
  it('finds workspace and global state.vscdb files', async () => {
    const root = mkdtempSync(join(tmpdir(), 'aimetric-cursor-state-'));
    const workspaceDbDirectory = join(root, 'workspaceStorage', 'workspace-1');
    const globalDbDirectory = join(root, 'globalStorage');
    const workspaceDbPath = join(workspaceDbDirectory, 'state.vscdb');
    const globalDbPath = join(globalDbDirectory, 'state.vscdb');
    temporaryDirectories.push(root);

    mkdirSync(workspaceDbDirectory, { recursive: true });
    mkdirSync(globalDbDirectory, { recursive: true });
    writeFileSync(workspaceDbPath, 'workspace-db', 'utf8');
    writeFileSync(globalDbPath, 'global-db', 'utf8');
    utimesSync(workspaceDbPath, new Date('2026-04-24T00:00:00.000Z'), new Date('2026-04-24T00:10:00.000Z'));
    utimesSync(globalDbPath, new Date('2026-04-24T00:00:00.000Z'), new Date('2026-04-24T00:12:00.000Z'));

    const records = await discoverCursorStateDatabases({
      workspaceStorageDir: join(root, 'workspaceStorage'),
      globalStorageDir: join(root, 'globalStorage'),
    });

    expect(records).toEqual([
      expect.objectContaining({
        scope: 'workspace',
        workspaceId: 'workspace-1',
        databasePath: workspaceDbPath,
        updatedAt: '2026-04-24T00:10:00.000Z',
      }),
      expect.objectContaining({
        scope: 'global',
        databasePath: globalDbPath,
        updatedAt: '2026-04-24T00:12:00.000Z',
      }),
    ]);
  });
});

describe('matchCursorStateDatabases', () => {
  it('matches a session with workspace and global state database evidence', () => {
    const evidence = matchCursorStateDatabases(
      {
        sessionId: 'cursor-session-1',
        workspaceId: 'workspace-1',
        projectFingerprint: 'project-fingerprint',
        transcriptPath: '/tmp/transcript.jsonl',
        transcriptPathHash: 'transcript-hash',
        firstMessageAt: '2026-04-24T00:00:00.000Z',
        lastMessageAt: '2026-04-24T00:05:00.000Z',
        userMessageCount: 1,
        assistantMessageCount: 1,
        conversationTurns: 1,
        estimatedActiveMinutes: 5,
      },
      [
        {
          scope: 'workspace',
          workspaceId: 'workspace-1',
          databasePath: '/tmp/workspace/state.vscdb',
          databasePathHash: 'workspace-db-hash',
          updatedAt: '2026-04-24T00:06:00.000Z',
          sizeBytes: 128,
        },
        {
          scope: 'global',
          databasePath: '/tmp/global/state.vscdb',
          databasePathHash: 'global-db-hash',
          updatedAt: '2026-04-24T00:07:00.000Z',
          sizeBytes: 256,
        },
      ],
    );

    expect(evidence).toEqual({
      workspaceStorageStateDbPathHash: 'workspace-db-hash',
      workspaceStorageStateDbUpdatedAt: '2026-04-24T00:06:00.000Z',
      globalStorageStateDbPathHash: 'global-db-hash',
      globalStorageStateDbUpdatedAt: '2026-04-24T00:07:00.000Z',
    });
  });
});
