import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
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

export interface PublishIngestionBatchWithBufferOptions
  extends PublishIngestionBatchOptions {
  workspaceDir: string;
}

export interface BufferedPublishResult {
  published: boolean;
  buffered: boolean;
  bufferedDepth: number;
}

export interface FlushBufferedIngestionOptions
  extends PublishIngestionBatchOptions {
  workspaceDir: string;
  limit?: number;
}

export interface FlushBufferedIngestionResult {
  attempted: number;
  published: number;
  failed: number;
  remainingDepth: number;
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

let outboxSequence = 0;

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

export async function publishIngestionBatchWithBuffer(
  collector: AimMetricConfig['collector'],
  batch: IngestionBatch,
  options: PublishIngestionBatchWithBufferOptions,
): Promise<BufferedPublishResult> {
  try {
    await publishIngestionBatch(collector, batch, options);

    return {
      published: true,
      buffered: false,
      bufferedDepth: await readOutboxDepth(options.workspaceDir),
    };
  } catch {
    await writeOutboxBatch(options.workspaceDir, batch);

    return {
      published: false,
      buffered: true,
      bufferedDepth: await readOutboxDepth(options.workspaceDir),
    };
  }
}

export async function flushBufferedIngestionBatches(
  collector: AimMetricConfig['collector'],
  options: FlushBufferedIngestionOptions,
): Promise<FlushBufferedIngestionResult> {
  const files = await readOutboxFiles(options.workspaceDir);
  const selectedFiles = files.slice(0, options.limit ?? files.length);
  let attempted = 0;
  let published = 0;
  let failed = 0;

  for (const file of selectedFiles) {
    attempted += 1;

    try {
      const batch = JSON.parse(await readFile(file, 'utf8')) as IngestionBatch;
      await publishIngestionBatch(collector, batch, options);
      await rm(file);
      published += 1;
    } catch {
      failed += 1;
      break;
    }
  }

  return {
    attempted,
    published,
    failed,
    remainingDepth: await readOutboxDepth(options.workspaceDir),
  };
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

const writeOutboxBatch = async (
  workspaceDir: string,
  batch: IngestionBatch,
): Promise<void> => {
  const outboxDir = getOutboxDir(workspaceDir);
  await mkdir(outboxDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sequence = String(outboxSequence).padStart(8, '0');
  outboxSequence = (outboxSequence + 1) % Number.MAX_SAFE_INTEGER;
  const filename = `${timestamp}-${sequence}-${randomUUID()}.json`;

  await writeFile(join(outboxDir, filename), JSON.stringify(batch), 'utf8');
};

const readOutboxDepth = async (workspaceDir: string): Promise<number> =>
  (await readOutboxFiles(workspaceDir)).length;

const readOutboxFiles = async (workspaceDir: string): Promise<string[]> => {
  const outboxDir = getOutboxDir(workspaceDir);

  try {
    const files = await readdir(outboxDir);

    return files
      .filter((file) => file.endsWith('.json'))
      .sort()
      .map((file) => join(outboxDir, file));
  } catch {
    return [];
  }
};

const getOutboxDir = (workspaceDir: string): string =>
  join(workspaceDir, '.aimetric', 'outbox');
