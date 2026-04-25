import { IngestionController } from './ingestion/ingestion.controller.js';
import {
  IngestionService,
  type IngestionServiceOptions,
} from './ingestion/ingestion.service.js';

export class AppModule {
  readonly ingestionController: IngestionController;

  constructor(options: IngestionServiceOptions = {}) {
    const ingestionService = new IngestionService(options);
    this.ingestionController = new IngestionController(ingestionService);
  }
}
