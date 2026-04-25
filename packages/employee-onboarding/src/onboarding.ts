import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
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
  projectKey?: string;
  memberId?: string;
  repoName?: string;
  toolProfile?: EmployeeToolProfile;
  collectorEndpoint?: string;
  metricPlatformEndpoint?: string;
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
}): Promise<EmployeeOnboardingStatus> {
  const configPath = join(input.workspaceDir, '.aimetric', 'config.json');
  const mcpConfigPath = join(input.workspaceDir, '.aimetric', 'mcp.json');

  try {
    const config = JSON.parse(
      await readFile(configPath, 'utf8'),
    ) as EmployeeOnboardingConfig;

    return {
      onboarded: true,
      projectKey: config.projectKey,
      memberId: config.memberId,
      repoName: config.repoName,
      toolProfile: config.toolProfile,
      configPath,
      mcpConfigPath,
      collectorEndpoint: config.collector.endpoint,
      metricPlatformEndpoint: config.metricPlatform.endpoint,
    };
  } catch {
    return {
      onboarded: false,
      configPath,
      mcpConfigPath,
    };
  }
}

export async function runEmployeeOnboardingDoctor(input: {
  workspaceDir: string;
}): Promise<EmployeeOnboardingDoctorReport> {
  const configPath = join(input.workspaceDir, '.aimetric', 'config.json');
  const mcpConfigPath = join(input.workspaceDir, '.aimetric', 'mcp.json');
  const checks: EmployeeOnboardingDoctorCheck[] = [];
  let config: EmployeeOnboardingConfig | undefined;

  try {
    config = JSON.parse(await readFile(configPath, 'utf8')) as EmployeeOnboardingConfig;
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
  }

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
          'Start collector-gateway before publishing events',
        ];

  return {
    status,
    checks,
    nextActions,
  };
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
