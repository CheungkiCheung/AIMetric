import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  flushBufferedIngestionBatches,
  loadAimMetricConfig,
  type FlushBufferedIngestionResult,
} from '@aimetric/collector-sdk';
import { getProjectRulePack, getRuleTemplate } from '@aimetric/rule-engine';

export type EmployeeToolProfile =
  | 'cursor'
  | 'cli'
  | 'vscode'
  | 'codex'
  | 'claude-code'
  | 'jetbrains';

export interface EmployeeOnboardingInput {
  workspaceDir?: string;
  projectKey: string;
  memberId: string;
  repoName: string;
  toolProfile?: EmployeeToolProfile;
  collectorEndpoint?: string;
  collectorAuthTokenEnv?: string;
  metricPlatformEndpoint?: string;
}

export interface EmployeeOnboardingConfig {
  projectKey: string;
  memberId: string;
  repoName: string;
  toolProfile: EmployeeToolProfile;
  identity: {
    identityKey: string;
  };
  collector: {
    endpoint: string;
    source: string;
    authTokenEnv: string;
  };
  metricPlatform: {
    endpoint: string;
  };
  rules: {
    version: string;
    must: string[];
    should: string[];
    onDemand: string[];
    knowledgeRefs: string[];
  };
  mcp: {
    tools: string[];
    environment: Record<string, string>;
  };
}

export interface EmployeeOnboardingWriteResult {
  configPath: string;
  mcpConfigPath: string;
  adapterPaths: string[];
  nextSteps: string[];
}

export interface EmployeeOnboardingStatus {
  onboarded: boolean;
  configPath: string;
  mcpConfigPath: string;
  identityKey?: string;
  collectorIdentityRegistered?: boolean;
  projectKey?: string;
  memberId?: string;
  repoName?: string;
  toolProfile?: EmployeeToolProfile;
  collectorEndpoint?: string;
  metricPlatformEndpoint?: string;
  outboxDepth: number;
}

export interface EmployeeOnboardingDoctorCheck {
  key: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

export interface EmployeeOnboardingDoctorReport {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: EmployeeOnboardingDoctorCheck[];
  nextActions: string[];
}

export interface CollectorIdentityRegistration {
  identityKey: string;
  memberId: string;
  projectKey: string;
  repoName: string;
  toolProfile: string;
  status: 'active';
  registeredAt: string;
  updatedAt: string;
}

export interface FlushEmployeeOutboxInput {
  workspaceDir: string;
  fetchImplementation?: typeof fetch;
  environment?: Record<string, string | undefined>;
  limit?: number;
}

export interface RegisterCollectorIdentityInput {
  workspaceDir: string;
  fetchImplementation?: typeof fetch;
}

const defaultCollectorEndpoint = 'http://127.0.0.1:3000/ingestion';
const defaultCollectorAuthTokenEnv = 'AIMETRIC_COLLECTOR_TOKEN';
const defaultMetricPlatformEndpoint = 'http://127.0.0.1:3001';
const defaultToolProfile: EmployeeToolProfile = 'cursor';
const mcpTools = [
  'beforeEditFile',
  'afterEditFile',
  'recordSession',
  'getProjectRules',
  'listRuleVersions',
  'getRuleTemplate',
  'validateRuleTemplate',
  'setActiveRuleVersion',
  'getRuleRollout',
  'setRuleRollout',
  'evaluateRuleRollout',
  'searchKnowledge',
];

const nextStepsByProfile: Record<EmployeeToolProfile, string[]> = {
  cursor: [
    'Install or point your MCP client at .aimetric/mcp.json',
    'Restart Cursor so the AIMetric MCP server is loaded',
    'Start collector-gateway before sending local events',
    'Run recordSession at the end of an AI coding session',
    'Optionally run aimetric-cursor-sync for enhanced Cursor session collection',
  ],
  cli: [
    'Load .aimetric/mcp.json into your CLI agent or Codex-compatible MCP settings',
    'Export AIMETRIC_WORKSPACE_DIR or run the CLI from this workspace root',
    'Start collector-gateway before sending local events',
    'Run recordSession at the end of an AI coding session',
  ],
  vscode: [
    'Import .aimetric/mcp.json into your VS Code MCP or agent extension settings',
    'Reload the VS Code window so the AIMetric MCP server is loaded',
    'Start collector-gateway before sending local events',
    'Run recordSession at the end of an AI coding session',
  ],
  codex: [
    'Source .aimetric/codex.env before running Codex CLI in this workspace',
    'Load .aimetric/mcp.json into your Codex MCP settings if supported',
    'Run aimetric doctor to verify local AIMetric setup',
    'Start collector-gateway before publishing local events',
  ],
  'claude-code': [
    'Source .aimetric/claude-code.env before running Claude Code in this workspace',
    'Load .aimetric/mcp.json into your Claude Code MCP settings',
    'Run aimetric doctor to verify local AIMetric setup',
    'Start collector-gateway before publishing local events',
  ],
  jetbrains: [
    'Import .aimetric/mcp.json into your JetBrains AI or MCP-capable plugin settings',
    'Run aimetric doctor to verify local AIMetric setup',
    'Start collector-gateway before publishing local events',
  ],
};

export function buildEmployeeOnboardingConfig(
  input: EmployeeOnboardingInput,
): EmployeeOnboardingConfig {
  const toolProfile = input.toolProfile ?? defaultToolProfile;
  const rulePack = getProjectRulePack({
    projectKey: input.projectKey,
    toolType: toolProfile,
    sceneType: 'rule-query',
  });
  const ruleTemplate = getRuleTemplate({
    projectKey: input.projectKey,
    version: rulePack.version,
  });
  const collectorEndpoint = input.collectorEndpoint ?? defaultCollectorEndpoint;
  const collectorAuthTokenEnv =
    input.collectorAuthTokenEnv ?? defaultCollectorAuthTokenEnv;
  const metricPlatformEndpoint =
    input.metricPlatformEndpoint ?? defaultMetricPlatformEndpoint;

  return {
    projectKey: input.projectKey,
    memberId: input.memberId,
    repoName: input.repoName,
    toolProfile,
    identity: {
      identityKey: buildCollectorIdentityKey({
        projectKey: input.projectKey,
        memberId: input.memberId,
        repoName: input.repoName,
        toolProfile,
      }),
    },
    collector: {
      endpoint: collectorEndpoint,
      source: toolProfile,
      authTokenEnv: collectorAuthTokenEnv,
    },
    metricPlatform: {
      endpoint: metricPlatformEndpoint,
    },
    rules: {
      version: rulePack.version,
      must: ruleTemplate.rules.must,
      should: ruleTemplate.rules.should,
      onDemand: ruleTemplate.rules.onDemand,
      knowledgeRefs: rulePack.knowledgeRefs,
    },
    mcp: {
      tools: mcpTools,
      environment: {
        AIMETRIC_PROJECT_KEY: input.projectKey,
        AIMETRIC_MEMBER_ID: input.memberId,
        AIMETRIC_REPO_NAME: input.repoName,
        AIMETRIC_COLLECTOR_ENDPOINT: collectorEndpoint,
        AIMETRIC_METRIC_PLATFORM_ENDPOINT: metricPlatformEndpoint,
        AIMETRIC_RULE_VERSION: rulePack.version,
        AIMETRIC_TOOL_PROFILE: toolProfile,
      },
    },
  };
}

export async function writeEmployeeOnboardingFiles(
  input: EmployeeOnboardingInput & { workspaceDir: string },
): Promise<EmployeeOnboardingWriteResult> {
  const config = buildEmployeeOnboardingConfig(input);
  const aimetricDirectory = join(input.workspaceDir, '.aimetric');
  const configPath = join(aimetricDirectory, 'config.json');
  const mcpConfigPath = join(aimetricDirectory, 'mcp.json');

  await mkdir(aimetricDirectory, { recursive: true });
  const adapterPaths = await writeToolProfileArtifacts({
    workspaceDir: input.workspaceDir,
    toolProfile: config.toolProfile,
    mcpEnvironment: {
      ...config.mcp.environment,
      AIMETRIC_WORKSPACE_DIR: input.workspaceDir,
    },
  });

  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  await writeFile(
    mcpConfigPath,
    `${JSON.stringify(
      {
        mcpServers: {
          aimetric: {
            command: 'aimetric-mcp-server',
            env: {
              ...config.mcp.environment,
              AIMETRIC_WORKSPACE_DIR: input.workspaceDir,
            },
          },
        },
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  return {
    configPath,
    mcpConfigPath,
    adapterPaths,
    nextSteps: nextStepsByProfile[config.toolProfile],
  };
}

export async function buildEmployeeOnboardingStatus(input: {
  workspaceDir: string;
  fetchImplementation?: typeof fetch;
}): Promise<EmployeeOnboardingStatus> {
  const configPath = join(input.workspaceDir, '.aimetric', 'config.json');
  const mcpConfigPath = join(input.workspaceDir, '.aimetric', 'mcp.json');

  try {
    const config = await loadEmployeeOnboardingConfig(input.workspaceDir);

    const collectorIdentity =
      input.fetchImplementation
        ? await resolveCollectorIdentity(config, input.fetchImplementation)
        : undefined;

    return {
      onboarded: true,
      identityKey: config.identity.identityKey,
      collectorIdentityRegistered: Boolean(collectorIdentity),
      projectKey: config.projectKey,
      memberId: config.memberId,
      repoName: config.repoName,
      toolProfile: config.toolProfile,
      configPath,
      mcpConfigPath,
      collectorEndpoint: config.collector.endpoint,
      metricPlatformEndpoint: config.metricPlatform.endpoint,
      outboxDepth: await readOutboxDepth(input.workspaceDir),
    };
  } catch {
    return {
      onboarded: false,
      configPath,
      mcpConfigPath,
      outboxDepth: await readOutboxDepth(input.workspaceDir),
    };
  }
}

export async function runEmployeeOnboardingDoctor(input: {
  workspaceDir: string;
  fetchImplementation?: typeof fetch;
}): Promise<EmployeeOnboardingDoctorReport> {
  const configPath = join(input.workspaceDir, '.aimetric', 'config.json');
  const mcpConfigPath = join(input.workspaceDir, '.aimetric', 'mcp.json');
  const checks: EmployeeOnboardingDoctorCheck[] = [];
  let config: EmployeeOnboardingConfig | undefined;

  try {
    config = await loadEmployeeOnboardingConfig(input.workspaceDir);
    checks.push({
      key: 'config',
      status: 'pass',
      message: 'AIMetric config exists and is valid',
    });
  } catch {
    checks.push({
      key: 'config',
      status: 'fail',
      message: 'Missing .aimetric/config.json',
    });
  }

  checks.push(
    (await fileExists(mcpConfigPath))
      ? {
          key: 'mcp-config',
          status: 'pass',
          message: 'MCP config exists',
        }
      : {
          key: 'mcp-config',
          status: 'fail',
          message: 'Missing .aimetric/mcp.json',
        },
  );

  if (config) {
    checks.push({
      key: 'collector-token',
      status: 'pass',
      message: `Ensure ${config.collector.authTokenEnv} is exported before publishing events`,
    });

    if (input.fetchImplementation) {
      const collectorIdentity = await resolveCollectorIdentity(
        config,
        input.fetchImplementation,
      );
      checks.push(
        collectorIdentity
          ? {
              key: 'collector-identity',
              status: 'pass',
              message: `Collector identity ${config.identity.identityKey} is registered`,
            }
          : {
              key: 'collector-identity',
              status: 'warn',
              message: `Collector identity ${config.identity.identityKey} is not registered yet`,
            },
      );
    }
  }

  const outboxDepth = await readOutboxDepth(input.workspaceDir);
  checks.push(
    outboxDepth > 0
      ? {
          key: 'outbox',
          status: 'warn',
          message: `${outboxDepth} local ingestion ${outboxDepth === 1 ? 'batch is' : 'batches are'} waiting to be flushed`,
        }
      : {
          key: 'outbox',
          status: 'pass',
          message: 'No local ingestion batches are waiting to be flushed',
        },
  );

  const status = checks.some((check) => check.status === 'fail')
    ? 'unhealthy'
    : checks.some((check) => check.status === 'warn')
      ? 'degraded'
      : 'healthy';
  const nextActions =
    status === 'unhealthy'
      ? [
          'Run aimetric onboard --projectKey=<project> --memberId=<member> --repoName=<repo>',
        ]
      : [
          'Run aimetric status before your first AI session',
          ...(config
            ? ['Run aimetric register to bind this workspace identity to the governance directory']
            : []),
          ...(outboxDepth > 0
            ? ['Run aimetric flush to publish buffered events']
            : []),
          'Start collector-gateway before publishing events',
        ];

  return {
    status,
    checks,
    nextActions,
  };
}

export async function flushEmployeeOutbox(
  input: FlushEmployeeOutboxInput,
): Promise<FlushBufferedIngestionResult> {
  const config = await loadAimMetricConfig({
    workspaceDir: input.workspaceDir,
  });

  return flushBufferedIngestionBatches(config.collector, {
    workspaceDir: input.workspaceDir,
    fetchImplementation: input.fetchImplementation,
    environment: input.environment,
    limit: input.limit,
  });
}

export async function registerEmployeeCollectorIdentity(
  input: RegisterCollectorIdentityInput,
): Promise<CollectorIdentityRegistration> {
  const config = await loadEmployeeOnboardingConfig(input.workspaceDir);
  const fetchImplementation = input.fetchImplementation ?? globalThis.fetch;

  if (typeof fetchImplementation !== 'function') {
    throw new Error('Fetch implementation is required to register collector identity');
  }

  const response = await fetchImplementation(
    new URL(
      '/governance/collector-identities/register',
      config.metricPlatform.endpoint,
    ).toString(),
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        identityKey: config.identity.identityKey,
        memberId: config.memberId,
        projectKey: config.projectKey,
        repoName: config.repoName,
        toolProfile: config.toolProfile,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to register collector identity: ${response.status}`);
  }

  return (await response.json()) as CollectorIdentityRegistration;
}

const writeToolProfileArtifacts = async (input: {
  workspaceDir: string;
  toolProfile: EmployeeToolProfile;
  mcpEnvironment: Record<string, string>;
}): Promise<string[]> => {
  if (input.toolProfile === 'cursor') {
    const cursorDirectory = join(input.workspaceDir, '.cursor');
    const cursorConfigPath = join(cursorDirectory, 'mcp.json');
    const cursorCollectorConfigPath = join(
      input.workspaceDir,
      '.aimetric',
      'cursor-collector.json',
    );

    await mkdir(cursorDirectory, { recursive: true });
    await writeFile(
      cursorConfigPath,
      `${JSON.stringify(
        {
          mcpServers: {
            aimetric: {
              command: 'aimetric-mcp-server',
              env: input.mcpEnvironment,
            },
          },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    await writeFile(
      cursorCollectorConfigPath,
      `${JSON.stringify(
        {
          enabled: true,
          publish: false,
          discovery: {
            cursorProjectsDir: null,
            cursorWorkspaceStorageDir: null,
            cursorGlobalStorageDir: null,
          },
          schedule: {
            suggestedCron: '*/15 * * * *',
          },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    return [cursorConfigPath, cursorCollectorConfigPath];
  }

  if (input.toolProfile === 'vscode') {
    const vscodeDirectory = join(input.workspaceDir, '.vscode');
    const vscodeConfigPath = join(vscodeDirectory, 'mcp.json');

    await mkdir(vscodeDirectory, { recursive: true });
    await writeFile(
      vscodeConfigPath,
      `${JSON.stringify(
        {
          servers: {
            aimetric: {
              command: 'aimetric-mcp-server',
              env: input.mcpEnvironment,
            },
          },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    return [vscodeConfigPath];
  }

  if (input.toolProfile === 'codex' || input.toolProfile === 'claude-code') {
    const envPath = join(
      input.workspaceDir,
      '.aimetric',
      `${input.toolProfile}.env`,
    );

    await writeFile(envPath, `${buildEnvContent(input.mcpEnvironment)}\n`, 'utf8');

    return [envPath];
  }

  const cliEnvPath = join(input.workspaceDir, '.aimetric', 'cli.env');
  await writeFile(cliEnvPath, `${buildEnvContent(input.mcpEnvironment)}\n`, 'utf8');

  return [cliEnvPath];
};

const loadEmployeeOnboardingConfig = async (
  workspaceDir: string,
): Promise<EmployeeOnboardingConfig> =>
  JSON.parse(
    await readFile(join(workspaceDir, '.aimetric', 'config.json'), 'utf8'),
  ) as EmployeeOnboardingConfig;

const buildEnvContent = (environment: Record<string, string>): string =>
  Object.entries(environment)
    .map(([key, value]) => `export ${key}="${value}"`)
    .join('\n');

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const readOutboxDepth = async (workspaceDir: string): Promise<number> => {
  try {
    const files = await readdir(join(workspaceDir, '.aimetric', 'outbox'));

    return files.filter((file) => file.endsWith('.json')).length;
  } catch {
    return 0;
  }
};

const buildCollectorIdentityKey = (input: {
  projectKey: string;
  memberId: string;
  repoName: string;
  toolProfile: EmployeeToolProfile;
}): string =>
  `${input.projectKey}:${input.memberId}:${input.toolProfile}:${normalizeIdentitySegment(input.repoName)}`;

const normalizeIdentitySegment = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const resolveCollectorIdentity = async (
  config: EmployeeOnboardingConfig,
  fetchImplementation?: typeof fetch,
): Promise<CollectorIdentityRegistration | undefined> => {
  const fetchFn = fetchImplementation ?? globalThis.fetch;

  if (typeof fetchFn !== 'function') {
    return undefined;
  }

  try {
    const url = new URL(
      '/governance/collector-identities/resolve',
      config.metricPlatform.endpoint,
    );
    url.searchParams.set('identityKey', config.identity.identityKey);
    const response = await fetchFn(url.toString());

    if (!response.ok) {
      return undefined;
    }

    return (await response.json()) as CollectorIdentityRegistration;
  } catch {
    return undefined;
  }
};
