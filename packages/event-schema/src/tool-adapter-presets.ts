import type { ToolAdapterManifest } from './tool-adapter.js';

export const codexCliAdapterManifest: ToolAdapterManifest = {
  toolKey: 'codex-cli',
  displayName: 'Codex CLI',
  adapterKey: 'codex-cli-standard',
  adapterVersion: '0.1.0',
  supportedPlatforms: ['darwin', 'linux', 'win32'],
  supportedEventTypes: [
    'session.recorded',
    'edit.span.recorded',
    'mcp.tool.called',
  ],
  collectionMode: 'cli',
  privacyLevel: 'metadata-and-diff',
  latencyProfile: 'async',
  requiredPermissions: ['read-aimetric-config', 'read-cli-session-log'],
  healthChecks: ['config', 'session-log-access'],
  versionCompatibility: {
    testedToolVersions: ['codex-cli'],
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

export const claudeCodeAdapterManifest: ToolAdapterManifest = {
  toolKey: 'claude-code',
  displayName: 'Claude Code',
  adapterKey: 'claude-code-standard',
  adapterVersion: '0.1.0',
  supportedPlatforms: ['darwin', 'linux', 'win32'],
  supportedEventTypes: [
    'session.recorded',
    'edit.span.recorded',
    'mcp.tool.called',
  ],
  collectionMode: 'hybrid',
  privacyLevel: 'metadata-and-diff',
  latencyProfile: 'async',
  requiredPermissions: ['read-aimetric-config', 'read-cli-session-log'],
  healthChecks: ['config', 'session-log-access', 'mcp-config'],
  versionCompatibility: {
    testedToolVersions: ['claude-code'],
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
