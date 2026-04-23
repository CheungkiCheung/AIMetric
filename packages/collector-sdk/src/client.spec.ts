import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LocalEventBuffer } from './buffer.js';
import { CollectorClient } from './client.js';
import { loadAimMetricConfig } from './config.js';

const temporaryWorkspaces: string[] = [];

afterEach(() => {
  temporaryWorkspaces.splice(0).forEach((workspace) => {
    rmSync(workspace, { recursive: true, force: true });
  });
});

describe('LocalEventBuffer', () => {
  it('stores and flushes buffered events in FIFO order', () => {
    const buffer = new LocalEventBuffer<{ id: string }>();
    buffer.push({ id: '1' });
    buffer.push({ id: '2' });

    expect(buffer.flush()).toEqual([{ id: '1' }, { id: '2' }]);
  });
});

describe('loadAimMetricConfig', () => {
  it('loads employee onboarding config from a workspace', async () => {
    const workspaceDir = createWorkspaceWithConfig();

    const config = await loadAimMetricConfig({ workspaceDir });

    expect(config.projectKey).toBe('aimetric');
    expect(config.memberId).toBe('alice');
    expect(config.collector.endpoint).toBe('http://127.0.0.1:3000/ingestion');
  });

  it('rejects invalid onboarding config files', async () => {
    const workspaceDir = createWorkspaceWithConfig({ memberId: undefined });

    await expect(loadAimMetricConfig({ workspaceDir })).rejects.toThrow(
      'Invalid AIMetric config',
    );
  });
});

describe('CollectorClient', () => {
  it('builds session recorded ingestion batches from onboarding config', async () => {
    const workspaceDir = createWorkspaceWithConfig();
    const config = await loadAimMetricConfig({ workspaceDir });
    const client = CollectorClient.fromConfig(config, {
      now: () => '2026-04-23T00:00:00.000Z',
    });

    client.recordSession({
      sessionId: 'sess_1',
      acceptedAiLines: 44,
      commitTotalLines: 55,
    });

    expect(client.flushBatch()).toEqual({
      schemaVersion: 'v1',
      source: 'cursor',
      events: [
        {
          eventType: 'session.recorded',
          occurredAt: '2026-04-23T00:00:00.000Z',
          payload: {
            sessionId: 'sess_1',
            projectKey: 'aimetric',
            repoName: 'AIMetric',
            memberId: 'alice',
            acceptedAiLines: 44,
            commitTotalLines: 55,
            ruleVersion: 'v2',
          },
        },
      ],
    });
  });
});

const createWorkspaceWithConfig = (
  overrides: Record<string, unknown> = {},
): string => {
  const workspaceDir = mkdtempSync(join(tmpdir(), 'aimetric-sdk-config-'));
  const aimetricDir = join(workspaceDir, '.aimetric');
  temporaryWorkspaces.push(workspaceDir);
  mkdirSync(aimetricDir, { recursive: true });
  writeFileSync(
    join(aimetricDir, 'config.json'),
    JSON.stringify(
      withoutUndefined({
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
        ...overrides,
      }),
    ),
    'utf8',
  );

  return workspaceDir;
};

const withoutUndefined = (input: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );
