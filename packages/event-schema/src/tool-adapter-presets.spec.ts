import { describe, expect, it } from 'vitest';
import {
  claudeCodeAdapterManifest,
  codexCliAdapterManifest,
} from './tool-adapter-presets.js';
import { ToolAdapterManifestSchema } from './tool-adapter.js';

describe('tool adapter manifest presets', () => {
  it('declares a Codex CLI adapter example', () => {
    expect(ToolAdapterManifestSchema.parse(codexCliAdapterManifest)).toMatchObject({
      toolKey: 'codex-cli',
      displayName: 'Codex CLI',
      adapterKey: 'codex-cli-standard',
      supportedEventTypes: [
        'session.recorded',
        'edit.span.recorded',
        'mcp.tool.called',
      ],
      collectionMode: 'cli',
      privacyLevel: 'metadata-and-diff',
      latencyProfile: 'async',
    });
  });

  it('declares a Claude Code adapter example', () => {
    expect(ToolAdapterManifestSchema.parse(claudeCodeAdapterManifest)).toMatchObject({
      toolKey: 'claude-code',
      displayName: 'Claude Code',
      adapterKey: 'claude-code-standard',
      supportedEventTypes: [
        'session.recorded',
        'edit.span.recorded',
        'mcp.tool.called',
      ],
      collectionMode: 'hybrid',
      privacyLevel: 'metadata-and-diff',
      latencyProfile: 'async',
    });
  });
});
