import { createHash } from 'node:crypto';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { CursorSessionRecord } from './transcript.js';

export interface CursorStateDatabaseRecord {
  scope: 'workspace' | 'global';
  workspaceId?: string;
  databasePath: string;
  databasePathHash: string;
  updatedAt: string;
  sizeBytes: number;
}

export interface CursorStateDatabaseEvidence {
  workspaceStorageStateDbPathHash?: string;
  workspaceStorageStateDbUpdatedAt?: string;
  globalStorageStateDbPathHash?: string;
  globalStorageStateDbUpdatedAt?: string;
}

export async function discoverCursorStateDatabases(input: {
  workspaceStorageDir: string;
  globalStorageDir: string;
}): Promise<CursorStateDatabaseRecord[]> {
  const workspaceRecords = await discoverWorkspaceStateDatabases(
    input.workspaceStorageDir,
  );
  const globalRecord = await discoverGlobalStateDatabase(input.globalStorageDir);

  return [
    ...workspaceRecords,
    ...(globalRecord ? [globalRecord] : []),
  ];
}

export function matchCursorStateDatabases(
  session: CursorSessionRecord,
  databases: CursorStateDatabaseRecord[],
): CursorStateDatabaseEvidence {
  const workspaceDatabase = databases.find(
    (database) =>
      database.scope === 'workspace' &&
      session.workspaceId !== undefined &&
      database.workspaceId === session.workspaceId,
  );
  const globalDatabase = databases.find((database) => database.scope === 'global');

  return {
    ...(workspaceDatabase
      ? {
          workspaceStorageStateDbPathHash: workspaceDatabase.databasePathHash,
          workspaceStorageStateDbUpdatedAt: workspaceDatabase.updatedAt,
        }
      : {}),
    ...(globalDatabase
      ? {
          globalStorageStateDbPathHash: globalDatabase.databasePathHash,
          globalStorageStateDbUpdatedAt: globalDatabase.updatedAt,
        }
      : {}),
  };
}

const discoverWorkspaceStateDatabases = async (
  workspaceStorageDir: string,
): Promise<CursorStateDatabaseRecord[]> => {
  try {
    const entries = await readdir(workspaceStorageDir, { withFileTypes: true });
    const databases = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const databasePath = join(workspaceStorageDir, entry.name, 'state.vscdb');
          return readStateDatabase('workspace', databasePath, entry.name);
        }),
    );

    return databases.flatMap((database) => (database ? [database] : []));
  } catch {
    return [];
  }
};

const discoverGlobalStateDatabase = async (
  globalStorageDir: string,
): Promise<CursorStateDatabaseRecord | undefined> =>
  readStateDatabase('global', join(globalStorageDir, 'state.vscdb'));

const readStateDatabase = async (
  scope: 'workspace' | 'global',
  databasePath: string,
  workspaceId?: string,
): Promise<CursorStateDatabaseRecord | undefined> => {
  try {
    const databaseStat = await stat(databasePath);

    return {
      scope,
      ...(workspaceId ? { workspaceId } : {}),
      databasePath,
      databasePathHash: buildHash(databasePath),
      updatedAt: databaseStat.mtime.toISOString(),
      sizeBytes: databaseStat.size,
    };
  } catch {
    return undefined;
  }
};

const buildHash = (value: string): string =>
  createHash('sha256').update(value).digest('hex');
