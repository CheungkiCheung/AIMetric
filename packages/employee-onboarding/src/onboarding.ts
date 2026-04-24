import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getProjectRulePack, getRuleTemplate } from '@aimetric/rule-engine';

export type EmployeeToolProfile = 'cursor' | 'cli' | 'vscode';

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

  const cliEnvPath = join(input.workspaceDir, '.aimetric', 'cli.env');
  const cliEnvContent = Object.entries(input.mcpEnvironment)
    .map(([key, value]) => `export ${key}="${value}"`)
    .join('\n');

  await writeFile(cliEnvPath, `${cliEnvContent}\n`, 'utf8');

  return [cliEnvPath];
};
