import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createMcpRuntime,
  type JsonRpcResponse,
} from './mcp-runtime.js';

const temporaryWorkspaces: string[] = [];

afterEach(() => {
  temporaryWorkspaces.splice(0).forEach((workspace) => {
    rmSync(workspace, { recursive: true, force: true });
  });
});

describe('createMcpRuntime', () => {
  it('responds to MCP initialize with tool capabilities', async () => {
    const runtime = createMcpRuntime();

    const response = await runtime.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        clientInfo: {
          name: 'aimetric-test-client',
          version: '0.0.1',
        },
      },
    });

    expect(response).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: {
        protocolVersion: '2025-11-25',
        capabilities: {
          tools: {
            listChanged: false,
          },
        },
        serverInfo: {
          name: 'aimetric-mcp-server',
          version: '0.0.1',
        },
      },
    });
  });

  it('lists registered AIMetric tools for MCP clients', async () => {
    const runtime = createMcpRuntime();

    const response = await runtime.handleRequest({
      jsonrpc: '2.0',
      id: 'tools',
      method: 'tools/list',
    });
    const resultResponse = expectJsonRpcResult(response);
    const result = resultResponse.result as { tools: unknown[] };

    expect(result.tools).toContainEqual(
      expect.objectContaining({
        name: 'recordSession',
        inputSchema: expect.objectContaining({
          type: 'object',
        }),
      }),
    );
    expect(result.tools).toContainEqual(
      expect.objectContaining({
        name: 'searchKnowledge',
      }),
    );
  });

  it('calls registered tools and returns structured MCP content', async () => {
    const runtime = createMcpRuntime();

    const response = await runtime.handleRequest({
      jsonrpc: '2.0',
      id: 'call',
      method: 'tools/call',
      params: {
        name: 'recordSession',
        arguments: {
          sessionId: 'sess_1',
          userMessage: 'change the file',
          assistantMessage: 'file changed',
        },
      },
    });

    expect(response).toEqual({
      jsonrpc: '2.0',
      id: 'call',
      result: {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                sessionId: 'sess_1',
                summary: 'change the file\nfile changed',
              },
              null,
              2,
            ),
          },
        ],
        structuredContent: {
          sessionId: 'sess_1',
          summary: 'change the file\nfile changed',
        },
        isError: false,
      },
    });
    expect(runtime.getAuditEvents()).toContainEqual(
      expect.objectContaining({
        toolName: 'recordSession',
        requestId: 'call',
        status: 'success',
        errorMessage: undefined,
      }),
    );
  });

  it('returns MCP error content and audits failed tool calls', async () => {
    const runtime = createMcpRuntime({
      toolRegistry: new Map([
        [
          'unstableTool',
          {
            name: 'unstableTool',
            description: 'A test tool that fails.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
            invoke: async () => {
              throw new Error('collector gateway unavailable');
            },
          },
        ],
      ]),
    });

    const response = await runtime.handleRequest({
      jsonrpc: '2.0',
      id: 'failed-call',
      method: 'tools/call',
      params: {
        name: 'unstableTool',
        arguments: {},
      },
    });

    expect(response).toEqual({
      jsonrpc: '2.0',
      id: 'failed-call',
      result: {
        content: [
          {
            type: 'text',
            text: 'Tool unstableTool failed: collector gateway unavailable',
          },
        ],
        structuredContent: {
          toolName: 'unstableTool',
          errorMessage: 'collector gateway unavailable',
        },
        isError: true,
      },
    });
    expect(runtime.getAuditEvents()).toContainEqual(
      expect.objectContaining({
        toolName: 'unstableTool',
        requestId: 'failed-call',
        status: 'failure',
        errorMessage: 'collector gateway unavailable',
      }),
    );
  });

  it('returns tool audit events through the AIMetric audit method', async () => {
    const runtime = createMcpRuntime();

    await runtime.handleRequest({
      jsonrpc: '2.0',
      id: 'call',
      method: 'tools/call',
      params: {
        name: 'recordSession',
        arguments: {
          sessionId: 'sess_1',
          userMessage: 'change the file',
          assistantMessage: 'file changed',
        },
      },
    });
    const response = await runtime.handleRequest({
      jsonrpc: '2.0',
      id: 'audit',
      method: 'aimetric/audit/list',
    });

    expect(response).toEqual({
      jsonrpc: '2.0',
      id: 'audit',
      result: {
        events: [
          expect.objectContaining({
            toolName: 'recordSession',
            requestId: 'call',
            status: 'success',
          }),
        ],
      },
    });
  });

  it('uses AIMETRIC_WORKSPACE_DIR as the default recordSession workspace', async () => {
    const workspaceDir = createWorkspaceWithAimMetricConfig();
    const runtime = createMcpRuntime({
      environment: {
        AIMETRIC_WORKSPACE_DIR: workspaceDir,
      },
    });

    const response = await runtime.handleRequest({
      jsonrpc: '2.0',
      id: 'call-with-env',
      method: 'tools/call',
      params: {
        name: 'recordSession',
        arguments: {
          sessionId: 'sess_1',
          userMessage: 'change the file',
          assistantMessage: 'file changed',
        },
      },
    });
    const resultResponse = expectJsonRpcResult(response);
    const result = resultResponse.result as {
      structuredContent: {
        event: unknown;
      };
    };

    expect(result.structuredContent.event).toEqual({
      eventType: 'session.recorded',
      payload: expect.objectContaining({
        projectKey: 'aimetric',
        memberId: 'alice',
        repoName: 'AIMetric',
      }),
    });
  });

  it('returns JSON-RPC errors for unknown tools', async () => {
    const runtime = createMcpRuntime();

    const response = await runtime.handleRequest({
      jsonrpc: '2.0',
      id: 'missing-tool',
      method: 'tools/call',
      params: {
        name: 'missingTool',
        arguments: {},
      },
    });

    expect(response).toEqual({
      jsonrpc: '2.0',
      id: 'missing-tool',
      error: {
        code: -32602,
        message: 'Unknown MCP tool: missingTool',
      },
    });
    expect(runtime.getAuditEvents()).toContainEqual(
      expect.objectContaining({
        toolName: 'missingTool',
        requestId: 'missing-tool',
        status: 'failure',
        errorMessage: 'Unknown MCP tool: missingTool',
      }),
    );
  });

  it('ignores initialized notifications', async () => {
    const runtime = createMcpRuntime();

    await expect(
      runtime.handleRequest({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      }),
    ).resolves.toBeUndefined();
  });
});

const expectJsonRpcResult = (
  response: JsonRpcResponse | undefined,
): Extract<JsonRpcResponse, { result: unknown }> => {
  expect(response).toBeDefined();
  expect(response).toHaveProperty('result');

  return response as Extract<JsonRpcResponse, { result: unknown }>;
};

const createWorkspaceWithAimMetricConfig = (): string => {
  const workspaceDir = mkdtempSync(join(tmpdir(), 'aimetric-runtime-config-'));
  const aimetricDir = join(workspaceDir, '.aimetric');
  temporaryWorkspaces.push(workspaceDir);
  mkdirSync(aimetricDir, { recursive: true });
  writeFileSync(
    join(aimetricDir, 'config.json'),
    JSON.stringify({
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
    }),
    'utf8',
  );

  return workspaceDir;
};
