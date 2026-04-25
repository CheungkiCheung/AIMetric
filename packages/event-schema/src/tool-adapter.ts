import { z } from 'zod';
import type { IngestionEventSchema } from './events.js';

export const ToolAdapterEventTypeSchema = z.enum([
  'session.recorded',
  'edit.span.recorded',
  'tab.accepted',
  'mcp.tool.called',
  'ai.tool.used',
  'ai.pr.touched',
  'delivery.item.linked',
  'survey.response.recorded',
]);

export const ToolAdapterPlatformSchema = z.enum([
  'darwin',
  'linux',
  'win32',
  'web',
]);

export const ToolAdapterManifestSchema = z.object({
  toolKey: z.string().min(1),
  displayName: z.string().min(1),
  adapterKey: z.string().min(1),
  adapterVersion: z.string().min(1),
  supportedPlatforms: z.array(ToolAdapterPlatformSchema).min(1),
  supportedEventTypes: z.array(ToolAdapterEventTypeSchema).min(1),
  collectionMode: z.enum(['mcp', 'cli', 'local-db', 'extension', 'hybrid']),
  privacyLevel: z.enum([
    'metadata-only',
    'metadata-and-paths',
    'metadata-and-diff',
    'content-aware',
  ]),
  latencyProfile: z.enum(['sync-hot-path', 'async', 'scheduled']),
  requiredPermissions: z.array(z.string().min(1)),
  healthChecks: z.array(z.string().min(1)),
  versionCompatibility: z.object({
    minToolVersion: z.string().optional(),
    testedToolVersions: z.array(z.string().min(1)),
  }),
  failurePolicy: z.object({
    onOffline: z.enum(['buffer', 'drop', 'fail']),
    onPermissionDenied: z.enum(['degrade', 'fail', 'skip-event']),
    onSchemaMismatch: z.enum(['skip-event', 'fail', 'quarantine']),
    maxRetryCount: z.number().int().min(0),
  }),
  privacyPolicy: z.object({
    collectsPromptText: z.boolean(),
    collectsCompletionText: z.boolean(),
    collectsDiff: z.boolean(),
    collectsFilePath: z.boolean(),
    collectsFileContent: z.boolean(),
    redaction: z.enum(['none', 'hash-sensitive-paths', 'mask-content']),
  }),
});

export const AdapterHealthCheckResultSchema = z.object({
  key: z.string().min(1),
  status: z.enum(['pass', 'warn', 'fail']),
  message: z.string().min(1),
});

export const AdapterHealthReportSchema = z.object({
  toolKey: z.string().min(1),
  adapterKey: z.string().min(1),
  adapterVersion: z.string().min(1),
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  checkedAt: z.string().datetime(),
  checks: z.array(AdapterHealthCheckResultSchema),
});

export type ToolAdapterEventType = z.infer<typeof ToolAdapterEventTypeSchema>;
export type ToolAdapterManifest = z.infer<typeof ToolAdapterManifestSchema>;
export type AdapterHealthCheckResult = z.infer<
  typeof AdapterHealthCheckResultSchema
>;
export type AdapterHealthReport = z.infer<typeof AdapterHealthReportSchema>;
export type NormalizedToolAdapterEvent = z.infer<typeof IngestionEventSchema>;

export interface NormalizeToolAdapterEventInput {
  manifest: ToolAdapterManifest;
  occurredAt: string;
  eventType: ToolAdapterEventType;
  payload: {
    sessionId: string;
    projectKey: string;
    repoName: string;
    [key: string]: unknown;
  };
}

export interface CreateAdapterHealthReportInput {
  manifest: ToolAdapterManifest;
  checkedAt: string;
  checks: AdapterHealthCheckResult[];
}

export const normalizeToolAdapterEvent = ({
  manifest,
  occurredAt,
  eventType,
  payload,
}: NormalizeToolAdapterEventInput): NormalizedToolAdapterEvent => {
  const parsedManifest = ToolAdapterManifestSchema.parse(manifest);

  if (!parsedManifest.supportedEventTypes.includes(eventType)) {
    throw new Error(
      `Adapter ${parsedManifest.adapterKey} does not support event type: ${eventType}`,
    );
  }

  return {
    eventType,
    occurredAt,
    payload: {
      ...payload,
      toolKey: parsedManifest.toolKey,
      adapterKey: parsedManifest.adapterKey,
      adapterVersion: parsedManifest.adapterVersion,
      collectionMode: parsedManifest.collectionMode,
      privacyLevel: parsedManifest.privacyLevel,
    },
  };
};

export const createAdapterHealthReport = ({
  manifest,
  checkedAt,
  checks,
}: CreateAdapterHealthReportInput): AdapterHealthReport => {
  const parsedManifest = ToolAdapterManifestSchema.parse(manifest);
  const parsedChecks = checks.map((check) =>
    AdapterHealthCheckResultSchema.parse(check),
  );

  const status = parsedChecks.some((check) => check.status === 'fail')
    ? 'unhealthy'
    : parsedChecks.some((check) => check.status === 'warn')
      ? 'degraded'
      : 'healthy';

  return AdapterHealthReportSchema.parse({
    toolKey: parsedManifest.toolKey,
    adapterKey: parsedManifest.adapterKey,
    adapterVersion: parsedManifest.adapterVersion,
    status,
    checkedAt,
    checks: parsedChecks,
  });
};
