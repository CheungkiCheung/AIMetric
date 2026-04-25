import { readdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  createAdapterHealthReport,
  type AdapterHealthCheckResult,
  type AdapterHealthReport,
  type IngestionBatch,
  type ToolAdapterManifest,
} from '@aimetric/event-schema';
import {
  CollectorClient,
  loadAimMetricConfig,
  publishIngestionBatch,
  type CollectorClientOptions,
} from '@aimetric/collector-sdk';
import {
  buildNextCursorSyncState,
  discoverCursorStateDatabases,
  filterExportableSessions,
  matchCursorStateDatabases,
  parseCursorTabAcceptedEvents,
  parseCursorTranscript,
  readCursorSyncState,
  resolveCursorDataRoots,
  writeCursorSyncState,
  type CursorSessionRecord,
} from '@aimetric/cursor-db-adapter';

export interface CursorSyncInput extends CollectorClientOptions {
  workspaceDir?: string;
  configPath?: string;
  dryRun?: boolean;
  limit?: number;
  cursorProjectsDir?: string;
  cursorWorkspaceStorageDir?: string;
  cursorGlobalStorageDir?: string;
  homeDir?: string;
  appDataDir?: string;
  platform?: NodeJS.Platform;
}

export interface CursorSyncResult {
  published: boolean;
  discoveredSessions: number;
  exportedSessions: number;
  skippedSessions: number;
  source: 'cursor-db';
  batch?: IngestionBatch;
}

export interface GetCursorAdapterHealthReportInput {
  workspaceDir?: string;
  configPath?: string;
  checkedAt?: string;
  cursorProjectsDir?: string;
  cursorWorkspaceStorageDir?: string;
  cursorGlobalStorageDir?: string;
  homeDir?: string;
  appDataDir?: string;
  platform?: NodeJS.Platform;
}

export const cursorAdapterManifest: ToolAdapterManifest = {
  toolKey: 'cursor',
  displayName: 'Cursor',
  adapterKey: 'cursor-db',
  adapterVersion: '1.0.0',
  supportedPlatforms: ['darwin', 'linux', 'win32'],
  supportedEventTypes: ['session.recorded', 'tab.accepted'],
  collectionMode: 'hybrid',
  privacyLevel: 'metadata-and-diff',
  latencyProfile: 'scheduled',
  requiredPermissions: [
    'read-aimetric-config',
    'read-cursor-transcripts',
    'read-cursor-state-db',
  ],
  healthChecks: ['config', 'cursor-transcripts', 'cursor-state-db'],
  versionCompatibility: {
    testedToolVersions: ['0.50.x'],
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
    collectsFilePath: true,
    collectsFileContent: false,
    redaction: 'hash-sensitive-paths',
  },
};

export async function getCursorAdapterHealthReport({
  workspaceDir,
  configPath,
  checkedAt = new Date().toISOString(),
  cursorProjectsDir,
  cursorWorkspaceStorageDir,
  cursorGlobalStorageDir,
  homeDir,
  appDataDir,
  platform,
}: GetCursorAdapterHealthReportInput = {}): Promise<AdapterHealthReport> {
  const checks: AdapterHealthCheckResult[] = [];

  try {
    await loadAimMetricConfig({
      workspaceDir,
      configPath,
    });
    checks.push({
      key: 'config',
      status: 'pass' as const,
      message: 'AIMetric config loaded',
    });
  } catch (error) {
    checks.push({
      key: 'config',
      status: 'fail' as const,
      message:
        error instanceof Error
          ? error.message
          : 'AIMetric config failed to load',
    });
  }

  const roots = resolveCursorDataRoots({
    platform: platform ?? process.platform,
    homeDir: homeDir ?? homedir(),
    appDataDir,
    overrides: {
      cursorProjectsDir,
      cursorWorkspaceStorageDir,
      cursorGlobalStorageDir,
    },
  });
  checks.push(await checkReadableDirectory('cursor-transcripts', roots.cursorProjectsDir));
  const stateDatabases = await discoverCursorStateDatabases({
    workspaceStorageDir: roots.workspaceStorageDir,
    globalStorageDir: roots.globalStorageDir,
  });

  checks.push({
    key: 'cursor-state-db',
    status: stateDatabases.length > 0 ? 'pass' : 'warn',
    message:
      stateDatabases.length > 0
        ? 'Cursor state DB discovered'
        : 'Cursor state DB not discovered; transcript-only sync can continue',
  });

  return createAdapterHealthReport({
    manifest: cursorAdapterManifest,
    checkedAt,
    checks,
  });
}

export function parseCursorSyncArgs(args: string[]): CursorSyncInput {
  const parsedEntries = args.reduce<Record<string, string | boolean>>(
    (entries, arg) => {
      if (arg === '--publish') {
        return { ...entries, publish: true };
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

  return {
    ...(typeof parsedEntries.workspaceDir === 'string'
      ? { workspaceDir: parsedEntries.workspaceDir }
      : {}),
    ...(typeof parsedEntries.configPath === 'string'
      ? { configPath: parsedEntries.configPath }
      : {}),
    ...(typeof parsedEntries.cursorProjectsDir === 'string'
      ? { cursorProjectsDir: parsedEntries.cursorProjectsDir }
      : {}),
    ...(typeof parsedEntries.cursorWorkspaceStorageDir === 'string'
      ? { cursorWorkspaceStorageDir: parsedEntries.cursorWorkspaceStorageDir }
      : {}),
    ...(typeof parsedEntries.cursorGlobalStorageDir === 'string'
      ? { cursorGlobalStorageDir: parsedEntries.cursorGlobalStorageDir }
      : {}),
    ...(typeof parsedEntries.limit === 'string'
      ? { limit: Number(parsedEntries.limit) }
      : {}),
    dryRun: parsedEntries.publish === true ? false : true,
  };
}

export async function syncCursorSessions(
  input: CursorSyncInput,
): Promise<CursorSyncResult> {
  const config = await loadAimMetricConfig({
    workspaceDir: input.workspaceDir,
    configPath: input.configPath,
  });
  const roots = resolveCursorDataRoots({
    platform: input.platform ?? process.platform,
    homeDir: input.homeDir ?? homedir(),
    appDataDir: input.appDataDir,
    overrides: {
      cursorProjectsDir: input.cursorProjectsDir,
      cursorWorkspaceStorageDir: input.cursorWorkspaceStorageDir,
      cursorGlobalStorageDir: input.cursorGlobalStorageDir,
    },
  });
  const transcriptPaths = await collectTranscriptPaths(roots.cursorProjectsDir);
  const discoveredSessions = await Promise.all(
    transcriptPaths.map(async (transcriptPath) =>
      parseCursorTranscript(
        (await readFile(transcriptPath, 'utf8'))
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0),
        transcriptPath,
      ),
    ),
  );
  const stateDatabases = await discoverCursorStateDatabases({
    workspaceStorageDir: roots.workspaceStorageDir,
    globalStorageDir: roots.globalStorageDir,
  });
  const discoveredTabAcceptedEvents = (
    await Promise.all(
      transcriptPaths.map(async (transcriptPath) =>
        parseCursorTabAcceptedEvents(
          (await readFile(transcriptPath, 'utf8'))
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0),
          transcriptPath,
        ),
      ),
    )
  ).flat();
  const statePath = join(
    input.workspaceDir ?? process.cwd(),
    '.aimetric',
    'cursor-sync-state.json',
  );
  const previousState = await readCursorSyncState(statePath);
  const limitedSessions = applyLimit(discoveredSessions, input.limit);
  const exportableSessions = filterExportableSessions(previousState, limitedSessions);
  const client = CollectorClient.fromConfig(
    {
      ...config,
      collector: {
        ...config.collector,
        source: 'cursor-db',
      },
    },
    {
      now: input.now,
    },
  );

  exportableSessions.forEach((session) => {
    client.recordSession({
      sessionId: session.sessionId,
      occurredAt: session.lastMessageAt,
      userMessage: session.firstUserMessage,
      assistantMessage: session.lastAssistantMessage,
      ingestionKey: buildIngestionKey(session),
      metadata: {
        collectorType: 'cursor-db',
        sourceSessionKind: 'cursor-transcript',
        firstMessageAt: session.firstMessageAt,
        lastMessageAt: session.lastMessageAt,
        estimatedActiveMinutes: session.estimatedActiveMinutes,
        userMessageCount: session.userMessageCount,
        assistantMessageCount: session.assistantMessageCount,
        conversationTurns: session.conversationTurns,
        ...(session.workspaceId ? { workspaceId: session.workspaceId } : {}),
        ...(session.workspacePath ? { workspacePath: session.workspacePath } : {}),
        projectFingerprint: session.projectFingerprint,
        transcriptPathHash: session.transcriptPathHash,
        ...matchCursorStateDatabases(session, stateDatabases),
      },
    });
  });
  discoveredTabAcceptedEvents.forEach((event) => {
    client.recordTabAccepted({
      sessionId: event.sessionId,
      occurredAt: event.occurredAt,
      acceptedLines: event.acceptedLines,
      ...(event.filePath ? { filePath: event.filePath } : {}),
      ...(event.language ? { language: event.language } : {}),
      ingestionKey: event.ingestionKey,
      metadata: {
        collectorType: 'cursor-db',
        sourceSessionKind: 'cursor-tab-accept',
      },
    });
  });

  const batch = exportableSessions.length > 0 ? client.flushBatch() : undefined;

  if ((input.dryRun ?? true) || !batch) {
    return {
      published: false,
      discoveredSessions: discoveredSessions.length,
      exportedSessions: exportableSessions.length,
      skippedSessions: discoveredSessions.length - exportableSessions.length,
      source: 'cursor-db',
      ...(batch ? { batch } : {}),
    };
  }

  await publishIngestionBatch(config.collector, batch);
  await writeCursorSyncState(
    statePath,
    buildNextCursorSyncState(
      previousState,
      exportableSessions,
      (input.now ?? (() => new Date().toISOString()))(),
    ),
  );

  return {
    published: true,
    discoveredSessions: discoveredSessions.length,
    exportedSessions: exportableSessions.length,
    skippedSessions: discoveredSessions.length - exportableSessions.length,
    source: 'cursor-db',
    batch,
  };
}

const applyLimit = (
  sessions: CursorSessionRecord[],
  limit?: number,
): CursorSessionRecord[] => {
  if (limit === undefined || Number.isNaN(limit) || limit <= 0) {
    return sessions;
  }

  return sessions.slice(0, limit);
};

const buildIngestionKey = (session: CursorSessionRecord): string =>
  `cursor-db:${session.sessionId}:${session.lastMessageAt}:${session.transcriptPathHash}`;

const checkReadableDirectory = async (
  key: string,
  directory: string,
): Promise<{
  key: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}> => {
  try {
    await readdir(directory);

    return {
      key,
      status: 'pass',
      message: 'Cursor transcript root is readable',
    };
  } catch {
    return {
      key,
      status: 'warn',
      message: `Directory is not readable: ${directory}`,
    };
  }
};

const collectTranscriptPaths = async (rootDirectory: string): Promise<string[]> => {
  try {
    const directoryEntries = await readdir(rootDirectory, { withFileTypes: true });
    const nestedPaths = await Promise.all(
      directoryEntries.map(async (entry) => {
        const entryPath = join(rootDirectory, entry.name);

        if (entry.isDirectory()) {
          return collectTranscriptPaths(entryPath);
        }

        return entry.name.endsWith('.jsonl') ? [entryPath] : [];
      }),
    );

    return nestedPaths.flat();
  } catch {
    return [];
  }
};
