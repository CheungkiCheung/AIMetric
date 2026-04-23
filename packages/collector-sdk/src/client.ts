import type { IngestionBatch } from '@aimetric/event-schema';
import { LocalEventBuffer } from './buffer.js';
import type { AimMetricConfig } from './config.js';

export interface CollectorClientOptions {
  now?: () => string;
}

export interface SessionRecordedInput {
  sessionId: string;
  acceptedAiLines?: number;
  commitTotalLines?: number;
  userMessage?: string;
  assistantMessage?: string;
  ingestionKey?: string;
  metadata?: Record<string, unknown>;
}

export type CollectorEvent = IngestionBatch['events'][number];

export class CollectorClient<T = unknown> {
  constructor(private readonly buffer = new LocalEventBuffer<T>()) {}

  static fromConfig(
    config: AimMetricConfig,
    options: CollectorClientOptions = {},
  ) {
    return new ConfiguredCollectorClient(config, options);
  }

  enqueue(event: T) {
    this.buffer.push(event);
  }

  flush() {
    return this.buffer.flush();
  }
}

export class ConfiguredCollectorClient {
  private readonly buffer = new LocalEventBuffer<CollectorEvent>();
  private readonly now: () => string;

  constructor(
    private readonly config: AimMetricConfig,
    options: CollectorClientOptions = {},
  ) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  recordSession(input: SessionRecordedInput) {
    const event: CollectorEvent = {
      eventType: 'session.recorded',
      occurredAt: this.now(),
      payload: {
        sessionId: input.sessionId,
        projectKey: this.config.projectKey,
        repoName: this.config.repoName,
        memberId: this.config.memberId,
        ...(input.acceptedAiLines !== undefined
          ? { acceptedAiLines: input.acceptedAiLines }
          : {}),
        ...(input.commitTotalLines !== undefined
          ? { commitTotalLines: input.commitTotalLines }
          : {}),
        ...(input.userMessage !== undefined ? { userMessage: input.userMessage } : {}),
        ...(input.assistantMessage !== undefined
          ? { assistantMessage: input.assistantMessage }
          : {}),
        ...(input.ingestionKey !== undefined
          ? { ingestionKey: input.ingestionKey }
          : {}),
        ...(input.metadata ?? {}),
        ruleVersion: this.config.rules.version,
      },
    };

    this.buffer.push(event);

    return event;
  }

  flushBatch(): IngestionBatch {
    return {
      schemaVersion: 'v1',
      source: this.config.collector.source,
      events: this.buffer.flush(),
    };
  }
}
