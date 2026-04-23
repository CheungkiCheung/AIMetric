import { describe, expect, it } from 'vitest';
import { IngestionBatchSchema } from './events.js';

describe('IngestionBatchSchema', () => {
  it('accepts a minimal valid ingestion batch', () => {
    const parsed = IngestionBatchSchema.parse({
      schemaVersion: 'v1',
      source: 'cursor',
      events: [
        {
          eventType: 'session.started',
          occurredAt: '2026-04-22T00:00:00.000Z',
          payload: {
            sessionId: 'sess_1',
            projectKey: 'proj',
            repoName: 'repo'
          }
        }
      ]
    });

    expect(parsed.events).toHaveLength(1);
  });

  it('accepts MCP tool call audit events', () => {
    const parsed = IngestionBatchSchema.parse({
      schemaVersion: 'v1',
      source: 'mcp-server',
      events: [
        {
          eventType: 'mcp.tool.called',
          occurredAt: '2026-04-23T00:00:00.000Z',
          payload: {
            sessionId: 'mcp:call_1',
            projectKey: 'aimetric',
            repoName: 'AIMetric',
            memberId: 'alice',
            toolName: 'recordSession',
            requestId: 'call_1',
            status: 'success',
            durationMs: 12,
            startedAt: '2026-04-23T00:00:00.000Z',
            finishedAt: '2026-04-23T00:00:00.012Z',
          },
        },
      ],
    });

    expect(parsed.events[0]?.eventType).toBe('mcp.tool.called');
  });
});
