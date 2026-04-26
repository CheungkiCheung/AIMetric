import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { IngestionBatchSchema, type IngestionBatch } from '@aimetric/event-schema';

export type IngestionDeliveryMode = 'sync' | 'queue';
export type IngestionQueueBackend = 'memory' | 'file';

export interface IngestionServiceOptions {
  deliveryMode?: IngestionDeliveryMode;
  queueBackend?: IngestionQueueBackend;
  queueDir?: string;
  metricPlatformBaseUrl?: string;
  metricPlatformCollectorToken?: string;
  queue?: IngestionQueue;
  maxDeliveryAttempts?: number;
}

export interface IngestionResult {
  accepted: number;
  schemaVersion: string;
  forwarded: boolean;
  queued?: boolean;
  queueDepth?: number;
}

export interface IngestionFlushResult {
  attempted: number;
  forwarded: number;
  failed: number;
  remainingDepth: number;
  deadLetterDepth: number;
}

export interface IngestionHealthSnapshot {
  deliveryMode: IngestionDeliveryMode;
  queueBackend: IngestionQueueBackend;
  queueDepth: number;
  deadLetterDepth: number;
  enqueuedTotal: number;
  forwardedTotal: number;
  failedForwardTotal: number;
}

export interface IngestionDeadLetterSummary {
  id: string;
  attempts: number;
  enqueuedAt: string;
  source: string;
  eventCount: number;
  firstEventType?: string;
}

export interface IngestionDeadLetterReplayResult {
  replayed: number;
  remainingDeadLetterDepth: number;
  queueDepth: number;
}

export interface IngestionQueueItem {
  id: string;
  batch: IngestionBatch;
  attempts: number;
  enqueuedAt: string;
}

export interface IngestionQueueSnapshot {
  backend: IngestionQueueBackend;
  depth: number;
  deadLetterDepth: number;
}

export interface IngestionQueue {
  enqueue: (batch: IngestionBatch) => IngestionQueueItem;
  peek: () => IngestionQueueItem | undefined;
  ack: (itemId: string) => void;
  fail: (itemId: string) => void;
  listDeadLetters: () => IngestionQueueItem[];
  replayDeadLetters: () => number;
  snapshot: () => IngestionQueueSnapshot;
}

export class InMemoryIngestionQueue implements IngestionQueue {
  private readonly items: IngestionQueueItem[] = [];
  private readonly deadLetters: IngestionQueueItem[] = [];
  private sequence = 0;

  constructor(private readonly maxDeliveryAttempts = 3) {}

  enqueue(batch: IngestionBatch): IngestionQueueItem {
    const item = {
      id: `ingestion_${this.sequence}`,
      batch,
      attempts: 0,
      enqueuedAt: new Date().toISOString(),
    };

    this.sequence += 1;
    this.items.push(item);

    return item;
  }

  peek(): IngestionQueueItem | undefined {
    return this.items[0];
  }

  ack(itemId: string): void {
    this.remove(itemId);
  }

  fail(itemId: string): void {
    const item = this.items.find((candidate) => candidate.id === itemId);

    if (!item) {
      return;
    }

    const nextItem = {
      ...item,
      attempts: item.attempts + 1,
    };

    this.remove(itemId);

    if (nextItem.attempts >= this.maxDeliveryAttempts) {
      this.deadLetters.push(nextItem);
      return;
    }

    this.items.push(nextItem);
  }

  snapshot(): IngestionQueueSnapshot {
    return {
      backend: 'memory',
      depth: this.items.length,
      deadLetterDepth: this.deadLetters.length,
    };
  }

  listDeadLetters(): IngestionQueueItem[] {
    return [...this.deadLetters];
  }

  replayDeadLetters(): number {
    const replayed = this.deadLetters.length;
    const replayItems = this.deadLetters.splice(0, this.deadLetters.length).map(
      (item) => ({
        ...item,
        attempts: 0,
      }),
    );

    this.items.push(...replayItems);

    return replayed;
  }

  private remove(itemId: string): void {
    const index = this.items.findIndex((item) => item.id === itemId);

    if (index >= 0) {
      this.items.splice(index, 1);
    }
  }
}

export interface FileBackedIngestionQueueOptions {
  queueDir: string;
  maxDeliveryAttempts?: number;
}

interface FileBackedQueuePayload extends IngestionQueueItem {}

export class FileBackedIngestionQueue implements IngestionQueue {
  private readonly pendingDir: string;
  private readonly deadLetterDir: string;
  private readonly maxDeliveryAttempts: number;

  constructor(options: FileBackedIngestionQueueOptions) {
    this.pendingDir = join(options.queueDir, 'pending');
    this.deadLetterDir = join(options.queueDir, 'dead-letter');
    this.maxDeliveryAttempts = options.maxDeliveryAttempts ?? 3;
    mkdirSync(this.pendingDir, { recursive: true });
    mkdirSync(this.deadLetterDir, { recursive: true });
  }

  enqueue(batch: IngestionBatch): IngestionQueueItem {
    const item: IngestionQueueItem = {
      id: `ingestion_${Date.now()}_${randomUUID()}`,
      batch,
      attempts: 0,
      enqueuedAt: new Date().toISOString(),
    };

    writeFileSync(
      this.getPendingPath(item.id),
      JSON.stringify(item),
      'utf8',
    );

    return item;
  }

  peek(): IngestionQueueItem | undefined {
    const file = this.listPendingFiles()[0];

    if (!file) {
      return undefined;
    }

    return this.readItem(join(this.pendingDir, file));
  }

  ack(itemId: string): void {
    const path = this.getPendingPath(itemId);

    if (existsSync(path)) {
      rmSync(path);
    }
  }

  fail(itemId: string): void {
    const path = this.getPendingPath(itemId);

    if (!existsSync(path)) {
      return;
    }

    const item = this.readItem(path);

    if (!item) {
      rmSync(path, { force: true });
      return;
    }

    const nextItem: IngestionQueueItem = {
      ...item,
      attempts: item.attempts + 1,
    };

    if (nextItem.attempts >= this.maxDeliveryAttempts) {
      writeFileSync(
        this.getDeadLetterPath(nextItem.id),
        JSON.stringify(nextItem),
        'utf8',
      );
      rmSync(path);
      return;
    }

    writeFileSync(path, JSON.stringify(nextItem), 'utf8');
  }

  snapshot(): IngestionQueueSnapshot {
    return {
      backend: 'file',
      depth: this.listPendingFiles().length,
      deadLetterDepth: this.listDeadLetterFiles().length,
    };
  }

  listDeadLetters(): IngestionQueueItem[] {
    return this.listDeadLetterFiles()
      .map((file) => this.readItem(join(this.deadLetterDir, file)))
      .filter((item): item is IngestionQueueItem => item !== undefined);
  }

  replayDeadLetters(): number {
    const items = this.listDeadLetters();

    items.forEach((item) => {
      const replayItem = {
        ...item,
        attempts: 0,
      };

      writeFileSync(
        this.getPendingPath(replayItem.id),
        JSON.stringify(replayItem),
        'utf8',
      );
      rmSync(this.getDeadLetterPath(item.id), { force: true });
    });

    return items.length;
  }


  private readItem(path: string): IngestionQueueItem | undefined {
    try {
      return JSON.parse(readFileSync(path, 'utf8')) as FileBackedQueuePayload;
    } catch {
      return undefined;
    }
  }

  private listPendingFiles(): string[] {
    return listJsonFiles(this.pendingDir);
  }

  private listDeadLetterFiles(): string[] {
    return listJsonFiles(this.deadLetterDir);
  }

  private getPendingPath(itemId: string): string {
    return join(this.pendingDir, `${itemId}.json`);
  }

  private getDeadLetterPath(itemId: string): string {
    return join(this.deadLetterDir, `${itemId}.json`);
  }
}

export class IngestionService {
  private readonly deliveryMode: IngestionDeliveryMode;
  private readonly metricPlatformBaseUrl: string;
  private readonly metricPlatformCollectorToken: string | undefined;
  private readonly queue: IngestionQueue;
  private enqueuedTotal = 0;
  private forwardedTotal = 0;
  private failedForwardTotal = 0;

  constructor(options: IngestionServiceOptions = {}) {
    this.deliveryMode =
      options.deliveryMode ?? readDeliveryModeFromEnvironment();
    this.metricPlatformBaseUrl =
      options.metricPlatformBaseUrl ??
      process.env.METRIC_PLATFORM_URL ??
      'http://127.0.0.1:3001';
    this.metricPlatformCollectorToken =
      options.metricPlatformCollectorToken ??
      process.env.METRIC_PLATFORM_COLLECTOR_TOKEN ??
      process.env.AIMETRIC_COLLECTOR_TOKEN;
    this.queue =
      options.queue ??
      createDefaultQueue({
        queueBackend: options.queueBackend,
        queueDir: options.queueDir,
        maxDeliveryAttempts: options.maxDeliveryAttempts,
      });
  }

  async ingest(input: unknown): Promise<IngestionResult> {
    const parsed = IngestionBatchSchema.parse(input);

    if (this.deliveryMode === 'queue') {
      this.queue.enqueue(parsed);
      this.enqueuedTotal += 1;

      return {
        accepted: parsed.events.length,
        schemaVersion: parsed.schemaVersion,
        forwarded: false,
        queued: true,
        queueDepth: this.queue.snapshot().depth,
      };
    }

    const forwarded = await this.forwardBatch(parsed);

    return {
      accepted: parsed.events.length,
      schemaVersion: parsed.schemaVersion,
      forwarded,
    };
  }

  async flushQueuedBatches(limit = 25): Promise<IngestionFlushResult> {
    let attempted = 0;
    let forwarded = 0;
    let failed = 0;

    while (attempted < limit) {
      const item = this.queue.peek();

      if (!item) {
        break;
      }

      attempted += 1;

      if (await this.forwardBatch(item.batch)) {
        this.queue.ack(item.id);
        forwarded += 1;
        continue;
      }

      this.queue.fail(item.id);
      failed += 1;
      break;
    }

    const snapshot = this.queue.snapshot();

    return {
      attempted,
      forwarded,
      failed,
      remainingDepth: snapshot.depth,
      deadLetterDepth: snapshot.deadLetterDepth,
    };
  }

  getHealth(): IngestionHealthSnapshot {
    const snapshot = this.queue.snapshot();

    return {
      deliveryMode: this.deliveryMode,
      queueBackend: snapshot.backend,
      queueDepth: snapshot.depth,
      deadLetterDepth: snapshot.deadLetterDepth,
      enqueuedTotal: this.enqueuedTotal,
      forwardedTotal: this.forwardedTotal,
      failedForwardTotal: this.failedForwardTotal,
    };
  }

  listDeadLetterBatches(): IngestionDeadLetterSummary[] {
    return this.queue.listDeadLetters().map((item) => ({
      id: item.id,
      attempts: item.attempts,
      enqueuedAt: item.enqueuedAt,
      source: item.batch.source,
      eventCount: item.batch.events.length,
      firstEventType: item.batch.events[0]?.eventType,
    }));
  }

  replayDeadLetterBatches(): IngestionDeadLetterReplayResult {
    const replayed = this.queue.replayDeadLetters();
    const snapshot = this.queue.snapshot();

    return {
      replayed,
      remainingDeadLetterDepth: snapshot.deadLetterDepth,
      queueDepth: snapshot.depth,
    };
  }

  private async forwardBatch(batch: IngestionBatch): Promise<boolean> {
    try {
      const response = await fetch(`${this.metricPlatformBaseUrl}/events/import`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.metricPlatformCollectorToken
            ? { authorization: `Bearer ${this.metricPlatformCollectorToken}` }
            : {}),
        },
        body: JSON.stringify(batch),
      });

      if (response.ok) {
        this.forwardedTotal += 1;
        return true;
      }
    } catch {
      // Metric platform outages should not break ingestion acceptance.
    }

    this.failedForwardTotal += 1;
    return false;
  }
}

const readDeliveryModeFromEnvironment = (): IngestionDeliveryMode =>
  process.env.INGESTION_DELIVERY_MODE === 'queue' ? 'queue' : 'sync';

const readQueueBackendFromEnvironment = (): IngestionQueueBackend =>
  process.env.INGESTION_QUEUE_BACKEND === 'file' ? 'file' : 'memory';

const createDefaultQueue = (options: {
  queueBackend?: IngestionQueueBackend;
  queueDir?: string;
  maxDeliveryAttempts?: number;
}): IngestionQueue => {
  const queueBackend = options.queueBackend ?? readQueueBackendFromEnvironment();

  if (queueBackend === 'file') {
    return new FileBackedIngestionQueue({
      queueDir:
        options.queueDir ??
        process.env.INGESTION_QUEUE_DIR ??
        '.aimetric-ingestion-queue',
      maxDeliveryAttempts: options.maxDeliveryAttempts,
    });
  }

  return new InMemoryIngestionQueue(options.maxDeliveryAttempts ?? 3);
};

const listJsonFiles = (directory: string): string[] => {
  try {
    return readdirSync(directory)
      .filter((file) => file.endsWith('.json'))
      .sort();
  } catch {
    return [];
  }
};
