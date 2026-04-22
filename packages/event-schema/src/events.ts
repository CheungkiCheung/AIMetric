import { z } from 'zod';

export const IngestionEventSchema = z.object({
  eventType: z.string(),
  occurredAt: z.string().datetime(),
  payload: z
    .object({
      sessionId: z.string(),
      projectKey: z.string(),
      repoName: z.string()
    })
    .passthrough()
});

export const IngestionBatchSchema = z.object({
  schemaVersion: z.literal('v1'),
  source: z.string(),
  events: z.array(IngestionEventSchema).min(1)
});

export type IngestionBatch = z.infer<typeof IngestionBatchSchema>;
