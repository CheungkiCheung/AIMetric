import type { IngestionBatch } from '@aimetric/event-schema';

export class PrismaService {
  private readonly ingestionBatches: IngestionBatch[] = [];

  appendBatch(batch: IngestionBatch) {
    this.ingestionBatches.push(batch);
  }

  listBatches(): IngestionBatch[] {
    return [...this.ingestionBatches];
  }
}
