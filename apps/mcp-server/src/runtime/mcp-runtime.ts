import { createToolRegistry, type McpTool } from './tool-registry.js';

type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: string;
  params?: unknown;
}

export type JsonRpcResponse =
  | {
      jsonrpc: '2.0';
      id: JsonRpcId;
      result: unknown;
    }
  | {
      jsonrpc: '2.0';
      id: JsonRpcId;
      error: {
        code: number;
        message: string;
      };
    };

export interface McpRuntime {
  handleRequest: (
    request: JsonRpcRequest,
  ) => Promise<JsonRpcResponse | undefined>;
}

export interface McpRuntimeOptions {
  toolRegistry?: Map<string, McpTool>;
  environment?: Record<string, string | undefined>;
}

const defaultProtocolVersion = '2025-11-25';

export const createMcpRuntime = (
  options: McpRuntimeOptions = {},
): McpRuntime => {
  const toolRegistry =
    options.toolRegistry ??
    createToolRegistry({
      environment: options.environment,
    });

  return {
    async handleRequest(request) {
      if (request.id === undefined) {
        return undefined;
      }

      switch (request.method) {
        case 'initialize':
          return result(request.id, {
            protocolVersion: getClientProtocolVersion(request.params),
            capabilities: {
              tools: {
                listChanged: false,
              },
            },
            serverInfo: {
              name: 'aimetric-mcp-server',
              version: '0.0.1',
            },
          });

        case 'tools/list':
          return result(request.id, {
            tools: Array.from(toolRegistry.values()).map((tool) => ({
              name: tool.name,
              description: tool.description,
              inputSchema: tool.inputSchema,
            })),
          });

        case 'tools/call':
          return callTool(request.id, request.params, toolRegistry);

        default:
          return error(
            request.id,
            -32601,
            `Unsupported MCP method: ${request.method}`,
          );
      }
    },
  };
};

const callTool = async (
  id: JsonRpcId,
  params: unknown,
  toolRegistry: Map<string, McpTool>,
): Promise<JsonRpcResponse> => {
  if (!isObject(params) || typeof params.name !== 'string') {
    return error(id, -32602, 'MCP tools/call requires a tool name.');
  }

  const tool = toolRegistry.get(params.name);

  if (!tool) {
    return error(id, -32602, `Unknown MCP tool: ${params.name}`);
  }

  const toolArguments = isObject(params.arguments) ? params.arguments : {};
  const toolResult = await tool.invoke(toolArguments);

  return result(id, {
    content: [
      {
        type: 'text',
        text: JSON.stringify(toolResult, null, 2),
      },
    ],
    structuredContent: toolResult,
    isError: false,
  });
};

const getClientProtocolVersion = (params: unknown): string => {
  if (!isObject(params) || typeof params.protocolVersion !== 'string') {
    return defaultProtocolVersion;
  }

  return params.protocolVersion;
};

const result = (id: JsonRpcId, value: unknown): JsonRpcResponse => ({
  jsonrpc: '2.0',
  id,
  result: value,
});

const error = (
  id: JsonRpcId,
  code: number,
  message: string,
): JsonRpcResponse => ({
  jsonrpc: '2.0',
  id,
  error: {
    code,
    message,
  },
});

const isObject = (input: unknown): input is Record<string, unknown> =>
  typeof input === 'object' && input !== null && !Array.isArray(input);
