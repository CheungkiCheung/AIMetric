import { createInterface } from 'node:readline/promises';
import { stdin as defaultInput, stdout as defaultOutput } from 'node:process';
import {
  createMcpRuntime,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type McpRuntime,
} from './mcp-runtime.js';

export async function handleJsonRpcLine(
  line: string,
  runtime: McpRuntime,
): Promise<string | undefined> {
  try {
    const parsed = JSON.parse(line) as JsonRpcRequest;
    const response = await runtime.handleRequest(parsed);

    return response ? JSON.stringify(response) : undefined;
  } catch {
    return JSON.stringify(parseErrorResponse());
  }
}

export async function runStdioMcpServer(input = defaultInput, output = defaultOutput) {
  const runtime = createMcpRuntime();
  const lines = createInterface({
    input,
    crlfDelay: Infinity,
    terminal: false,
  });

  for await (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    const responseLine = await handleJsonRpcLine(line, runtime);

    if (responseLine) {
      output.write(`${responseLine}\n`);
    }
  }
}

const parseErrorResponse = (): JsonRpcResponse => ({
  jsonrpc: '2.0',
  id: null,
  error: {
    code: -32700,
    message: 'Parse error',
  },
});
