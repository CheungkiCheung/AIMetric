import type { IngestionBatch } from '@aimetric/event-schema';
import { LocalEventBuffer } from './buffer.js';
import type { AimMetricConfig } from './config.js';

export interface CollectorClientOptions {
  now?: () => string;
}

export interface PublishIngestionBatchOptions {
  environment?: Record<string, string | undefined>;
  fetchImplementation?: typeof fetch;
}

export interface SessionRecordedInput {
  sessionId: string;
  occurredAt?: string;
  acceptedAiLines?: number;
  commitTotalLines?: number;
  userMessage?: string;
  assistantMessage?: string;
  ingestionKey?: string;
  metadata?: Record<string, unknown>;
}

export interface TabAcceptedInput {
  sessionId: string;
  occurredAt?: string;
  acceptedLines: number;
  filePath?: string;
  language?: string;
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
      occurredAt: input.occurredAt ?? this.now(),
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

  recordTabAccepted(input: TabAcceptedInput) {
    const event: CollectorEvent = {
      eventType: 'tab.accepted',
      occurredAt: input.occurredAt ?? this.now(),
      payload: {
        sessionId: input.sessionId,
        projectKey: this.config.projectKey,
        repoName: this.config.repoName,
        memberId: this.config.memberId,
        acceptedLines: input.acceptedLines,
        ...(input.filePath !== undefined ? { filePath: input.filePath } : {}),
        ...(input.language !== undefined ? { language: input.language } : {}),
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

export async function publishIngestionBatch(
  collector: AimMetricConfig['collector'],
  batch: IngestionBatch,
  options: PublishIngestionBatchOptions = {},
): Promise<void> {
  const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  const authToken = resolveCollectorAuthToken(
    collector,
    options.environment ?? process.env,
  );
  const response = await fetchImplementation(collector.endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify(batch),
  });

  if (!response.ok) {
    throw new Error(`Failed to publish ingestion batch: ${response.status}`);
  }
}

const resolveCollectorAuthToken = (
  collector: AimMetricConfig['collector'],
  environment: Record<string, string | undefined>,
): string | undefined => {
  if (!collector.authTokenEnv) {
    return undefined;
  }

  const token = environment[collector.authTokenEnv];
  return token && token.length > 0 ? token : undefined;
};
