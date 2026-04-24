import { describe, expect, it } from 'vitest';
import { parseCursorTabAcceptedEvents, parseCursorTranscript } from './transcript.js';

describe('parseCursorTranscript', () => {
  it('builds a CursorSessionRecord from transcript jsonl lines', async () => {
    const session = await parseCursorTranscript(
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
          timestamp: '2026-04-24T00:05:00.000Z',
          role: 'assistant',
          text: 'Collector implemented',
        }),
      ],
      '/tmp/transcript.jsonl',
    );

    expect(session).toMatchObject({
      sessionId: 'cursor-session-1',
      workspaceId: 'workspace-1',
      workspacePath: '/repo',
      firstMessageAt: '2026-04-24T00:00:00.000Z',
      lastMessageAt: '2026-04-24T00:05:00.000Z',
      userMessageCount: 1,
      assistantMessageCount: 1,
      conversationTurns: 1,
      firstUserMessage: 'Implement the collector',
      lastAssistantMessage: 'Collector implemented',
    });
  });

  it('ignores invalid transcript lines when a valid session remains', async () => {
    const session = await parseCursorTranscript(
      [
        'not-json',
        JSON.stringify({
          sessionId: 'cursor-session-2',
          timestamp: '2026-04-24T00:10:00.000Z',
          role: 'user',
          text: 'hello',
        }),
      ],
      '/tmp/transcript-2.jsonl',
    );

    expect(session.sessionId).toBe('cursor-session-2');
    expect(session.userMessageCount).toBe(1);
  });

  it('extracts tab accepted events from transcript jsonl lines', async () => {
    const events = await parseCursorTabAcceptedEvents(
      [
        JSON.stringify({
          sessionId: 'cursor-session-1',
          timestamp: '2026-04-24T00:03:00.000Z',
          eventType: 'tab.accepted',
          acceptedLines: 2,
          filePath: '/repo/src/demo.ts',
          language: 'typescript',
        }),
      ],
      '/tmp/transcript.jsonl',
    );

    expect(events).toEqual([
      expect.objectContaining({
        sessionId: 'cursor-session-1',
        occurredAt: '2026-04-24T00:03:00.000Z',
        acceptedLines: 2,
        filePath: '/repo/src/demo.ts',
        language: 'typescript',
        ingestionKey: expect.stringContaining('cursor-tab:cursor-session-1'),
      }),
    ]);
  });
});
