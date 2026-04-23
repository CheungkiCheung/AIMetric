import { describe, expect, it } from 'vitest';
import { createMcpRuntime } from './mcp-runtime.js';
import { handleJsonRpcLine } from './stdio.js';

describe('handleJsonRpcLine', () => {
  it('serializes JSON-RPC responses for stdio transport', async () => {
    const runtime = createMcpRuntime();

    const line = await handleJsonRpcLine(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      }),
      runtime,
    );

    expect(JSON.parse(line ?? '')).toEqual(
      expect.objectContaining({
        jsonrpc: '2.0',
        id: 1,
        result: expect.objectContaining({
          tools: expect.arrayContaining([
            expect.objectContaining({
              name: 'recordSession',
            }),
          ]),
        }),
      }),
    );
  });

  it('does not write responses for notifications', async () => {
    const runtime = createMcpRuntime();

    const line = await handleJsonRpcLine(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      }),
      runtime,
    );

    expect(line).toBeUndefined();
  });

  it('returns JSON-RPC parse errors for invalid JSON lines', async () => {
    const runtime = createMcpRuntime();

    const line = await handleJsonRpcLine('{not-json', runtime);

    expect(JSON.parse(line ?? '')).toEqual({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: 'Parse error',
      },
    });
  });
});
