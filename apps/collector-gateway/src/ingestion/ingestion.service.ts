import { IngestionBatchSchema, type IngestionBatch } from '@aimetric/event-schema';

export type IngestionDeliveryMode = 'sync' | 'queue';

export interface IngestionServiceOptions {
  deliveryMode?: IngestionDeliveryMode;
  metricPlatformBaseUrl?: string;
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
  queueDepth: number;
  deadLetterDepth: number;
  enqueuedTotal: number;
  forwardedTotal: number;
  failedForwardTotal: number;
}

export interface IngestionQueueItem {
  id: string;
  batch: IngestionBatch;
  attempts: number;
  enqueuedAt: string;
}

export interface IngestionQueueSnapshot {
  depth: number;
  deadLetterDepth: number;
}

export interface IngestionQueue {
  enqueue: (batch: IngestionBatch) => IngestionQueueItem;
  peek: () => IngestionQueueItem | undefined;
  ack: (itemId: string) => void;
  fail: (itemId: string) => void;
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
      depth: this.items.length,
      deadLetterDepth: this.deadLetters.length,
    };
  }

  private remove(itemId: string): void {
    const index = this.items.findIndex((item) => item.id === itemId);

    if (index >= 0) {
      this.items.splice(index, 1);
    }
  }
}

export class IngestionService {
  private readonly deliveryMode: IngestionDeliveryMode;
  private readonly metricPlatformBaseUrl: string;
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
    this.queue =
      options.queue ??
      new InMemoryIngestionQueue(options.maxDeliveryAttempts ?? 3);
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
      queueDepth: snapshot.depth,
      deadLetterDepth: snapshot.deadLetterDepth,
      enqueuedTotal: this.enqueuedTotal,
      forwardedTotal: this.forwardedTotal,
      failedForwardTotal: this.failedForwardTotal,
    };
  }

  private async forwardBatch(batch: IngestionBatch): Promise<boolean> {
    try {
      const response = await fetch(`${this.metricPlatformBaseUrl}/events/import`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
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
