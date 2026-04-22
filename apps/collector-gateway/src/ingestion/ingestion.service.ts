import { IngestionBatchSchema } from '@aimetric/event-schema';

export class IngestionService {
  async ingest(input: unknown) {
    const parsed = IngestionBatchSchema.parse(input);
    const metricPlatformBaseUrl =
      process.env.METRIC_PLATFORM_URL ?? 'http://127.0.0.1:3001';
    let forwarded = false;

    try {
      const response = await fetch(`${metricPlatformBaseUrl}/events/import`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(parsed),
      });

      forwarded = response.ok;
    } catch {
      forwarded = false;
    }

    return {
      accepted: parsed.events.length,
      schemaVersion: parsed.schemaVersion,
      forwarded,
    };
  }
}
