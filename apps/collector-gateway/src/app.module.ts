import { IngestionController } from './ingestion/ingestion.controller.js';
import { IngestionService } from './ingestion/ingestion.service.js';

export class AppModule {
  readonly ingestionController: IngestionController;

  constructor() {
    const ingestionService = new IngestionService();
    this.ingestionController = new IngestionController(ingestionService);
  }
}
