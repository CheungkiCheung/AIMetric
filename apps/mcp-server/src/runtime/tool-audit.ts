import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  loadAimMetricConfig,
  publishIngestionBatch,
  type AimMetricConfig,
} from '@aimetric/collector-sdk';
import type { IngestionBatch } from '@aimetric/event-schema';
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
  publisher?: ToolAuditPublisher;
  store?: ToolAuditStore;
}

export interface ToolAuditPublisher {
  publish(event: ToolAuditEvent): Promise<void> | void;
}

export interface ToolAuditStore {
  append(event: ToolAuditEvent): Promise<void> | void;
}

export interface ToolAuditEnvironment {
  AIMETRIC_AUDIT_LOG_PATH?: string;
  AIMETRIC_CONFIG_PATH?: string;
  AIMETRIC_WORKSPACE_DIR?: string;
}

export class ToolAuditRecorder {
  private readonly now: () => Date;
  private readonly publisher?: ToolAuditPublisher;
  private readonly store?: ToolAuditStore;
  private events: ToolAuditEvent[] = [];

  constructor(options: ToolAuditRecorderOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.publisher = options.publisher;
    this.store = options.store;
  }

  async record(input: {
    toolName: string;
    requestId: JsonRpcId;
    status: ToolAuditStatus;
    startedAt: Date;
    errorMessage?: string;
  }): Promise<void> {
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
    await Promise.allSettled([
      this.store?.append(event),
      this.publisher?.publish(event),
    ]);
  }

  list(): ToolAuditEvent[] {
    return this.events.map((event) => ({ ...event }));
  }
}

export class JsonlToolAuditStore implements ToolAuditStore {
  constructor(private readonly filePath: string) {}

  async append(event: ToolAuditEvent): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await appendFile(this.filePath, `${JSON.stringify(event)}\n`, 'utf8');
  }
}

export class HttpToolAuditPublisher implements ToolAuditPublisher {
  private readonly configLoader: () => Promise<AimMetricConfig>;
  private readonly fetchImplementation: typeof fetch;

  constructor(input: {
    configLoader: () => Promise<AimMetricConfig>;
    fetchImplementation?: typeof fetch;
  }) {
    this.configLoader = input.configLoader;
    this.fetchImplementation = input.fetchImplementation ?? globalThis.fetch;
  }

  async publish(event: ToolAuditEvent): Promise<void> {
    const config = await this.configLoader();
    const batch = buildToolAuditIngestionBatch({
      config,
      events: [event],
    });

    await publishIngestionBatch(config.collector, batch, {
      fetchImplementation: this.fetchImplementation,
    });
  }
}

export function createJsonlToolAuditStoreFromEnvironment(
  environment: ToolAuditEnvironment,
): ToolAuditStore | undefined {
  if (environment.AIMETRIC_AUDIT_LOG_PATH) {
    return new JsonlToolAuditStore(environment.AIMETRIC_AUDIT_LOG_PATH);
  }

  if (!environment.AIMETRIC_WORKSPACE_DIR) {
    return undefined;
  }

  return new JsonlToolAuditStore(
    join(environment.AIMETRIC_WORKSPACE_DIR, '.aimetric', 'audit-events.jsonl'),
  );
}

export function createHttpToolAuditPublisherFromEnvironment(
  environment: ToolAuditEnvironment,
): ToolAuditPublisher | undefined {
  if (!environment.AIMETRIC_WORKSPACE_DIR && !environment.AIMETRIC_CONFIG_PATH) {
    return undefined;
  }

  return new HttpToolAuditPublisher({
    configLoader: () =>
      loadAimMetricConfig({
        workspaceDir: environment.AIMETRIC_WORKSPACE_DIR,
        configPath: environment.AIMETRIC_CONFIG_PATH,
      }),
  });
}

export function buildToolAuditIngestionBatch(input: {
  config: AimMetricConfig;
  events: ToolAuditEvent[];
}): IngestionBatch {
  return {
    schemaVersion: 'v1',
    source: 'mcp-server',
    events: input.events.map((event) => ({
      eventType: 'mcp.tool.called',
      occurredAt: event.finishedAt,
      payload: {
        sessionId: `mcp:${String(event.requestId ?? 'notification')}`,
        projectKey: input.config.projectKey,
        repoName: input.config.repoName,
        memberId: input.config.memberId,
        ruleVersion: input.config.rules.version,
        toolName: event.toolName,
        requestId: event.requestId,
        status: event.status,
        startedAt: event.startedAt,
        finishedAt: event.finishedAt,
        durationMs: event.durationMs,
        ...(event.errorMessage ? { errorMessage: event.errorMessage } : {}),
      },
    })),
  };
}
