import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  JsonlToolAuditStore,
  ToolAuditRecorder,
  buildToolAuditIngestionBatch,
  type ToolAuditEvent,
} from './tool-audit.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => {
    rmSync(directory, { recursive: true, force: true });
  });
});

describe('ToolAuditRecorder', () => {
  it('persists audit events to JSONL without mutating returned events', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'aimetric-tool-audit-'));
    temporaryDirectories.push(directory);
    const storePath = join(directory, 'audit-events.jsonl');
    const recorder = new ToolAuditRecorder({
      store: new JsonlToolAuditStore(storePath),
      now: () => new Date('2026-04-23T00:00:00.012Z'),
    });

    await recorder.record({
      toolName: 'recordSession',
      requestId: 'call_1',
      status: 'success',
      startedAt: new Date('2026-04-23T00:00:00.000Z'),
    });

    const events = recorder.list();
    events[0]!.status = 'failure';

    expect(recorder.list()).toEqual([
      {
        toolName: 'recordSession',
        requestId: 'call_1',
        status: 'success',
        startedAt: '2026-04-23T00:00:00.000Z',
        finishedAt: '2026-04-23T00:00:00.012Z',
        durationMs: 12,
        errorMessage: undefined,
      },
    ]);
    expect(readFileSync(storePath, 'utf8').trim()).toBe(
      JSON.stringify(recorder.list()[0]),
    );
  });

  it('publishes audit events without failing the MCP tool call when publish fails', async () => {
    const publisher = {
      publish: vi.fn(async () => {
        throw new Error('collector unavailable');
      }),
    };
    const recorder = new ToolAuditRecorder({
      publisher,
      now: () => new Date('2026-04-23T00:00:00.012Z'),
    });

    await expect(
      recorder.record({
        toolName: 'recordSession',
        requestId: 'call_1',
        status: 'success',
        startedAt: new Date('2026-04-23T00:00:00.000Z'),
      }),
    ).resolves.toBeUndefined();

    expect(publisher.publish).toHaveBeenCalledOnce();
    expect(recorder.list()).toHaveLength(1);
  });
});

describe('buildToolAuditIngestionBatch', () => {
  it('maps audit events into collector ingestion batches', () => {
    const event: ToolAuditEvent = {
      toolName: 'recordSession',
      requestId: 'call_1',
      status: 'success',
      startedAt: '2026-04-23T00:00:00.000Z',
      finishedAt: '2026-04-23T00:00:00.012Z',
      durationMs: 12,
      errorMessage: undefined,
    };

    expect(
      buildToolAuditIngestionBatch({
        config: {
          projectKey: 'aimetric',
          memberId: 'alice',
          repoName: 'AIMetric',
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
        events: [event],
      }),
    ).toEqual({
      schemaVersion: 'v1',
      source: 'mcp-server',
      events: [
        {
          eventType: 'mcp.tool.called',
          occurredAt: '2026-04-23T00:00:00.012Z',
          payload: {
            sessionId: 'mcp:call_1',
            projectKey: 'aimetric',
            repoName: 'AIMetric',
            memberId: 'alice',
            ruleVersion: 'v2',
            toolName: 'recordSession',
            requestId: 'call_1',
            status: 'success',
            startedAt: '2026-04-23T00:00:00.000Z',
            finishedAt: '2026-04-23T00:00:00.012Z',
            durationMs: 12,
          },
        },
      ],
    });
  });
});
