import { IngestionService } from './ingestion.service.js';

export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  ingest(batch: unknown) {
    return this.ingestionService.ingest(batch);
  }

  health() {
    return this.ingestionService.getHealth();
  }

  flushQueuedBatches() {
    return this.ingestionService.flushQueuedBatches();
  }

  listDeadLetterBatches() {
    return this.ingestionService.listDeadLetterBatches();
  }

  replayDeadLetterBatches() {
    return this.ingestionService.replayDeadLetterBatches();
  }
}
