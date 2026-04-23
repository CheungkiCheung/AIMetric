import { describe, expect, it } from 'vitest';
import type { CursorSessionRecord } from './transcript.js';
import {
  buildNextCursorSyncState,
  filterExportableSessions,
  type CursorSyncState,
} from './sync-state.js';

describe('filterExportableSessions', () => {
  it('marks a session as exportable when lastMessageAt changed', () => {
    const state: CursorSyncState = {
      version: 1,
      lastScanCompletedAt: '2026-04-24T00:00:00.000Z',
      sessions: {
        'cursor-session-1': {
          lastMessageAt: '2026-04-24T00:05:00.000Z',
          transcriptPathHash: 'hash-a',
        },
      },
    };

    expect(
      filterExportableSessions(state, [
        createSessionRecord({
          sessionId: 'cursor-session-1',
          lastMessageAt: '2026-04-24T00:06:00.000Z',
        }),
      ]),
    ).toHaveLength(1);
  });
});

describe('buildNextCursorSyncState', () => {
  it('stores the latest lastMessageAt and hash for exported sessions', () => {
    const nextState = buildNextCursorSyncState(
      {
        version: 1,
        lastScanCompletedAt: '2026-04-24T00:00:00.000Z',
        sessions: {},
      },
      [
        createSessionRecord({
          sessionId: 'cursor-session-1',
          lastMessageAt: '2026-04-24T00:06:00.000Z',
        }),
      ],
      '2026-04-24T00:10:00.000Z',
    );

    expect(nextState).toEqual({
      version: 1,
      lastScanCompletedAt: '2026-04-24T00:10:00.000Z',
      sessions: {
        'cursor-session-1': {
          lastMessageAt: '2026-04-24T00:06:00.000Z',
          transcriptPathHash: 'hash-a',
        },
      },
    });
  });
});

const createSessionRecord = (
  overrides: Partial<CursorSessionRecord>,
): CursorSessionRecord => ({
  sessionId: 'cursor-session-1',
  projectFingerprint: 'fingerprint-a',
  transcriptPath: '/tmp/transcript.jsonl',
  transcriptPathHash: 'hash-a',
  firstMessageAt: '2026-04-24T00:00:00.000Z',
  lastMessageAt: '2026-04-24T00:05:00.000Z',
  userMessageCount: 1,
  assistantMessageCount: 1,
  conversationTurns: 1,
  ...overrides,
});
