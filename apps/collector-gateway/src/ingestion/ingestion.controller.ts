import { IngestionService } from './ingestion.service';

export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  ingest(batch: unknown) {
    return this.ingestionService.ingest(batch);
  }
}
