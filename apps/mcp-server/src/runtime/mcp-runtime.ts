import { createToolRegistry, type McpTool } from './tool-registry.js';
import type { IngestionBatch } from '@aimetric/event-schema';
import {
  ToolAuditRecorder,
  createHttpToolAuditPublisherFromEnvironment,
  createJsonlToolAuditStoreFromEnvironment,
  type ToolAuditEvent,
  type ToolAuditPublisher,
  type ToolAuditStore,
} from './tool-audit.js';

export type JsonRpcId = string | number | null;

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
  getAuditEvents: () => ToolAuditEvent[];
}

export interface McpRuntimeOptions {
  toolRegistry?: Map<string, McpTool>;
  environment?: Record<string, string | undefined>;
  auditRecorder?: ToolAuditRecorder;
  auditPublisher?: ToolAuditPublisher;
  auditStore?: ToolAuditStore;
  eventPublisher?: RuntimeEventPublisher;
  now?: () => Date;
}

export interface RuntimeEventPublisher {
  publish(batch: IngestionBatch): Promise<void> | void;
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
  const environment = options.environment ?? process.env;
  const now = options.now ?? (() => new Date());
  const auditRecorder =
    options.auditRecorder ??
    new ToolAuditRecorder({
      now,
      publisher:
        options.auditPublisher ??
        createHttpToolAuditPublisherFromEnvironment(environment),
      store:
        options.auditStore ??
        createJsonlToolAuditStoreFromEnvironment(environment),
    });
  const eventPublisher = options.eventPublisher;

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
          return callTool({
            id: request.id,
          params: request.params,
          toolRegistry,
          auditRecorder,
          eventPublisher,
          now,
        });

        case 'aimetric/audit/list':
          return result(request.id, {
            events: auditRecorder.list(),
          });

        default:
          return error(
            request.id,
            -32601,
            `Unsupported MCP method: ${request.method}`,
          );
      }
    },
    getAuditEvents() {
      return auditRecorder.list();
    },
  };
};

const callTool = async (input: {
  id: JsonRpcId;
  params: unknown;
  toolRegistry: Map<string, McpTool>;
  auditRecorder: ToolAuditRecorder;
  eventPublisher?: RuntimeEventPublisher;
  now: () => Date;
}): Promise<JsonRpcResponse> => {
  const { id, params, toolRegistry, auditRecorder, eventPublisher, now } = input;
  if (!isObject(params) || typeof params.name !== 'string') {
    return error(id, -32602, 'MCP tools/call requires a tool name.');
  }

  const startedAt = now();
  const tool = toolRegistry.get(params.name);

  if (!tool) {
    await auditRecorder.record({
      toolName: params.name,
      requestId: id,
      status: 'failure',
      startedAt,
      errorMessage: `Unknown MCP tool: ${params.name}`,
    });

    return error(id, -32602, `Unknown MCP tool: ${params.name}`);
  }

  const toolArguments = isObject(params.arguments) ? params.arguments : {};

  try {
    const toolResult = await tool.invoke(toolArguments);
    const toolEvents = readToolResultEvents(toolResult);

    if (toolEvents.length > 0) {
      await eventPublisher?.publish({
        schemaVersion: 'v1',
        source: 'mcp-server',
        events: toolEvents,
      });
    }

    await auditRecorder.record({
      toolName: tool.name,
      requestId: id,
      status: 'success',
      startedAt,
    });

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
  } catch (error_) {
    const errorMessage = toErrorMessage(error_);
    await auditRecorder.record({
      toolName: tool.name,
      requestId: id,
      status: 'failure',
      startedAt,
      errorMessage,
    });

    return result(id, {
      content: [
        {
          type: 'text',
          text: `Tool ${tool.name} failed: ${errorMessage}`,
        },
      ],
      structuredContent: {
        toolName: tool.name,
        errorMessage,
      },
      isError: true,
    });
  }
};

const readToolResultEvents = (value: unknown): IngestionBatch['events'] => {
  if (!isObject(value)) {
    return [];
  }

  const candidateEvent = value.event;

  if (isCollectorEvent(candidateEvent)) {
    return [candidateEvent];
  }

  if (Array.isArray(value.events)) {
    return value.events.filter(isCollectorEvent);
  }

  return [];
};

const isCollectorEvent = (
  value: unknown,
): value is IngestionBatch['events'][number] => {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.eventType === 'string' &&
    typeof value.occurredAt === 'string' &&
    isObject(value.payload) &&
    typeof value.payload.sessionId === 'string' &&
    typeof value.payload.projectKey === 'string' &&
    typeof value.payload.repoName === 'string'
  );
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

const toErrorMessage = (input: unknown): string => {
  if (input instanceof Error) {
    return input.message;
  }

  return String(input);
};
