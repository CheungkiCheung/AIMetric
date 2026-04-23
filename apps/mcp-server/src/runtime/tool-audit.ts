import type { JsonRpcId } from './mcp-runtime.js';

export type ToolAuditStatus = 'success' | 'failure';

export interface ToolAuditEvent {
  toolName: string;
  requestId: JsonRpcId;
  status: ToolAuditStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  errorMessage?: string;
}

export interface ToolAuditRecorderOptions {
  now?: () => Date;
}

export class ToolAuditRecorder {
  private readonly now: () => Date;
  private events: ToolAuditEvent[] = [];

  constructor(options: ToolAuditRecorderOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  record(input: {
    toolName: string;
    requestId: JsonRpcId;
    status: ToolAuditStatus;
    startedAt: Date;
    errorMessage?: string;
  }) {
    const finishedAt = this.now();
    const event: ToolAuditEvent = {
      toolName: input.toolName,
      requestId: input.requestId,
      status: input.status,
      startedAt: input.startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: Math.max(0, finishedAt.getTime() - input.startedAt.getTime()),
      errorMessage: input.errorMessage,
    };

    this.events = [...this.events, event];
  }

  list(): ToolAuditEvent[] {
    return this.events.map((event) => ({ ...event }));
  }
}
