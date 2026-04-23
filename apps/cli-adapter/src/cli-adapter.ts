import type { IngestionBatch } from '@aimetric/event-schema';
import {
  CollectorClient,
  loadAimMetricConfig,
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

  await publishBatch(config.collector.endpoint, batch);

  return {
    batch,
    published: true,
  };
}

const publishBatch = async (
  endpoint: string,
  batch: IngestionBatch,
): Promise<void> => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(batch),
  });

  if (!response.ok) {
    throw new Error(`Failed to publish CLI session batch: ${response.status}`);
  }
};

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
