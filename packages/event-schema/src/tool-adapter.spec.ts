import { describe, expect, it } from 'vitest';
import {
  ToolAdapterManifestSchema,
  createAdapterHealthReport,
  normalizeToolAdapterEvent,
  type ToolAdapterManifest,
} from './tool-adapter.js';

describe('tool adapter protocol', () => {
  const manifest: ToolAdapterManifest = {
    toolKey: 'cursor',
    displayName: 'Cursor',
    adapterKey: 'cursor-db',
    adapterVersion: '1.0.0',
    supportedPlatforms: ['darwin', 'linux', 'win32'],
    supportedEventTypes: ['session.recorded', 'tab.accepted'],
    collectionMode: 'hybrid',
    privacyLevel: 'metadata-and-diff',
    latencyProfile: 'async',
    requiredPermissions: ['read-transcripts', 'read-local-state-db'],
    healthChecks: ['config', 'permissions', 'cursor-state-db'],
    versionCompatibility: {
      minToolVersion: '0.42.0',
      testedToolVersions: ['0.50.x'],
    },
    failurePolicy: {
      onOffline: 'buffer',
      onPermissionDenied: 'degrade',
      onSchemaMismatch: 'skip-event',
      maxRetryCount: 3,
    },
    privacyPolicy: {
      collectsPromptText: true,
      collectsCompletionText: true,
      collectsDiff: true,
      collectsFilePath: true,
      collectsFileContent: false,
      redaction: 'hash-sensitive-paths',
    },
  };

  it('validates a tool adapter manifest', () => {
    expect(ToolAdapterManifestSchema.parse(manifest)).toEqual(manifest);
  });

  it('normalizes adapter events into AIMetric ingestion events', () => {
    const event = normalizeToolAdapterEvent({
      manifest,
      occurredAt: '2026-04-25T00:00:00.000Z',
      eventType: 'session.recorded',
      payload: {
        sessionId: 'cursor-session-1',
        projectKey: 'aimetric',
        repoName: 'AIMetric',
        memberId: 'alice',
      },
    });

    expect(event).toEqual({
      eventType: 'session.recorded',
      occurredAt: '2026-04-25T00:00:00.000Z',
      payload: {
        sessionId: 'cursor-session-1',
        projectKey: 'aimetric',
        repoName: 'AIMetric',
        memberId: 'alice',
        toolKey: 'cursor',
        adapterKey: 'cursor-db',
        adapterVersion: '1.0.0',
        collectionMode: 'hybrid',
        privacyLevel: 'metadata-and-diff',
      },
    });
  });

  it('rejects events unsupported by the manifest', () => {
    expect(() =>
      normalizeToolAdapterEvent({
        manifest,
        occurredAt: '2026-04-25T00:00:00.000Z',
        eventType: 'mcp.tool.called',
        payload: {
          sessionId: 'cursor-session-1',
          projectKey: 'aimetric',
          repoName: 'AIMetric',
        },
      }),
    ).toThrow('Adapter cursor-db does not support event type: mcp.tool.called');
  });

  it('creates a health report with explicit checks and failure reasons', () => {
    expect(
      createAdapterHealthReport({
        manifest,
        checkedAt: '2026-04-25T00:00:00.000Z',
        checks: [
          {
            key: 'config',
            status: 'pass',
            message: 'config loaded',
          },
          {
            key: 'cursor-state-db',
            status: 'warn',
            message: 'global state DB missing',
          },
        ],
      }),
    ).toEqual({
      toolKey: 'cursor',
      adapterKey: 'cursor-db',
      adapterVersion: '1.0.0',
      status: 'degraded',
      checkedAt: '2026-04-25T00:00:00.000Z',
      checks: [
        {
          key: 'config',
          status: 'pass',
          message: 'config loaded',
        },
        {
          key: 'cursor-state-db',
          status: 'warn',
          message: 'global state DB missing',
        },
      ],
    });
  });
});
