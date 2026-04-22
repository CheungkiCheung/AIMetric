import { IngestionBatchSchema } from '@aimetric/event-schema';

export class IngestionService {
  async ingest(input: unknown) {
    const parsed = IngestionBatchSchema.parse(input);

    return {
      accepted: parsed.events.length,
      schemaVersion: parsed.schemaVersion
    };
  }
}
