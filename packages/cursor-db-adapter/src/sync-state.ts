import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { CursorSessionRecord } from './transcript.js';

export interface CursorSyncState {
  version: 1;
  lastScanCompletedAt?: string;
  sessions: Record<
    string,
    {
      lastMessageAt: string;
      transcriptPathHash: string;
    }
  >;
}

export const emptyCursorSyncState = (): CursorSyncState => ({
  version: 1,
  sessions: {},
});

export async function readCursorSyncState(path: string): Promise<CursorSyncState> {
  try {
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as Partial<CursorSyncState>;

    return {
      version: 1,
      ...(parsed.lastScanCompletedAt
        ? { lastScanCompletedAt: parsed.lastScanCompletedAt }
        : {}),
      sessions: parsed.sessions ?? {},
    };
  } catch {
    return emptyCursorSyncState();
  }
}

export async function writeCursorSyncState(
  path: string,
  state: CursorSyncState,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export function filterExportableSessions(
  state: CursorSyncState,
  sessions: CursorSessionRecord[],
): CursorSessionRecord[] {
  return sessions.filter((session) => {
    const previousSession = state.sessions[session.sessionId];

    return (
      !previousSession ||
      previousSession.lastMessageAt !== session.lastMessageAt ||
      previousSession.transcriptPathHash !== session.transcriptPathHash
    );
  });
}

export function buildNextCursorSyncState(
  previousState: CursorSyncState,
  sessions: CursorSessionRecord[],
  completedAt: string,
): CursorSyncState {
  const nextSessions = sessions.reduce<CursorSyncState['sessions']>(
    (stateSessions, session) => ({
      ...stateSessions,
      [session.sessionId]: {
        lastMessageAt: session.lastMessageAt,
        transcriptPathHash: session.transcriptPathHash,
      },
    }),
    previousState.sessions,
  );

  return {
    version: 1,
    lastScanCompletedAt: completedAt,
    sessions: nextSessions,
  };
}
