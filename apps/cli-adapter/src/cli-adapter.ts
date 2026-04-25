import {
  createAdapterHealthReport,
  type AdapterHealthReport,
  type IngestionBatch,
  type ToolAdapterManifest,
} from '@aimetric/event-schema';
import {
  CollectorClient,
  loadAimMetricConfig,
  publishIngestionBatch,
  type CollectorClientOptions,
  type SessionRecordedInput,
} from '@aimetric/collector-sdk';

export interface RecordCliSessionInput
  extends SessionRecordedInput,
    CollectorClientOptions {
  workspaceDir?: string;
  configPath?: string;
  dryRun?: boolean;
}

export interface RecordCliSessionResult {
  batch: IngestionBatch;
  published: boolean;
}

export interface GetCliAdapterHealthReportInput {
  workspaceDir?: string;
  configPath?: string;
  checkedAt?: string;
}

export const cliAdapterManifest: ToolAdapterManifest = {
  toolKey: 'generic-cli',
  displayName: 'Generic CLI Agent',
  adapterKey: 'cli-standard',
  adapterVersion: '1.0.0',
  supportedPlatforms: ['darwin', 'linux', 'win32'],
  supportedEventTypes: ['session.recorded'],
  collectionMode: 'cli',
  privacyLevel: 'metadata-only',
  latencyProfile: 'async',
  requiredPermissions: ['read-aimetric-config'],
  healthChecks: ['config'],
  versionCompatibility: {
    testedToolVersions: ['generic-cli'],
  },
  failurePolicy: {
    onOffline: 'buffer',
    onPermissionDenied: 'degrade',
    onSchemaMismatch: 'skip-event',
    maxRetryCount: 3,
  },
  privacyPolicy: {
    collectsPromptText: true,
    collectsCompletionText: true,
    collectsDiff: false,
    collectsFilePath: false,
    collectsFileContent: false,
    redaction: 'none',
  },
};

export async function getCliAdapterHealthReport({
  workspaceDir,
  configPath,
  checkedAt = new Date().toISOString(),
}: GetCliAdapterHealthReportInput = {}): Promise<AdapterHealthReport> {
  try {
    await loadAimMetricConfig({
      workspaceDir,
      configPath,
    });

    return createAdapterHealthReport({
      manifest: cliAdapterManifest,
      checkedAt,
      checks: [
        {
          key: 'config',
          status: 'pass',
          message: 'AIMetric config loaded',
        },
      ],
    });
  } catch (error) {
    return createAdapterHealthReport({
      manifest: cliAdapterManifest,
      checkedAt,
      checks: [
        {
          key: 'config',
          status: 'fail',
          message:
            error instanceof Error
              ? error.message
              : 'AIMetric config failed to load',
        },
      ],
    });
  }
}

export function parseCliRecordArgs(args: string[]): RecordCliSessionInput {
  const parsedEntries = args.reduce<Record<string, string | boolean>>(
    (entries, arg) => {
      if (arg === '--publish') {
        return {
          ...entries,
          publish: true,
        };
      }

      if (arg === '--dryRun') {
        return {
          ...entries,
          dryRun: true,
        };
      }

      const normalizedArg = arg.startsWith('--') ? arg.slice(2) : arg;
      const [key, ...valueParts] = normalizedArg.split('=');
      const value = valueParts.join('=');

      if (!key) {
        return entries;
      }

      return {
        ...entries,
        [key]: value,
      };
    },
    {},
  );

  const sessionId = readRequiredString(parsedEntries.sessionId, '--sessionId');

  return {
    sessionId,
    dryRun: parsedEntries.publish === true ? false : true,
    ...readOptionalStringField(parsedEntries.workspaceDir, 'workspaceDir'),
    ...readOptionalStringField(parsedEntries.configPath, 'configPath'),
    ...readOptionalNumberField(parsedEntries.acceptedAiLines, 'acceptedAiLines'),
    ...readOptionalNumberField(parsedEntries.commitTotalLines, 'commitTotalLines'),
    ...readOptionalStringField(parsedEntries.userMessage, 'userMessage'),
    ...readOptionalStringField(parsedEntries.assistantMessage, 'assistantMessage'),
  };
}

export async function recordCliSession(
  input: RecordCliSessionInput,
): Promise<RecordCliSessionResult> {
  const config = await loadAimMetricConfig({
    workspaceDir: input.workspaceDir,
    configPath: input.configPath,
  });
  const client = CollectorClient.fromConfig(config, {
    now: input.now,
  });

  client.recordSession({
    sessionId: input.sessionId,
    acceptedAiLines: input.acceptedAiLines,
    commitTotalLines: input.commitTotalLines,
    userMessage: input.userMessage,
    assistantMessage: input.assistantMessage,
  });

  const batch = client.flushBatch();

  if (input.dryRun ?? true) {
    return {
      batch,
      published: false,
    };
  }

  await publishIngestionBatch(config.collector, batch);

  return {
    batch,
    published: true,
  };
}

const readRequiredString = (
  value: string | boolean | undefined,
  flagName: string,
): string => {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  throw new Error(`Missing required argument: ${flagName}`);
};

const readOptionalStringField = (
  value: string | boolean | undefined,
  fieldName: keyof Pick<
    RecordCliSessionInput,
    'workspaceDir' | 'configPath' | 'userMessage' | 'assistantMessage'
  >,
): Partial<RecordCliSessionInput> => {
  if (typeof value === 'string' && value.length > 0) {
    return {
      [fieldName]: value,
    };
  }

  return {};
};

const readOptionalNumberField = (
  value: string | boolean | undefined,
  fieldName: keyof Pick<
    RecordCliSessionInput,
    'acceptedAiLines' | 'commitTotalLines'
  >,
): Partial<RecordCliSessionInput> => {
  if (typeof value !== 'string' || value.length === 0) {
    return {};
  }

  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) {
    throw new Error(`Invalid number for argument: --${fieldName}`);
  }

  return {
    [fieldName]: numberValue,
  };
};
