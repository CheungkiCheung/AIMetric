import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getProjectRulePack, getRuleTemplate } from '@aimetric/rule-engine';

export interface EmployeeOnboardingInput {
  workspaceDir?: string;
  projectKey: string;
  memberId: string;
  repoName: string;
  collectorEndpoint?: string;
  metricPlatformEndpoint?: string;
}

export interface EmployeeOnboardingConfig {
  projectKey: string;
  memberId: string;
  repoName: string;
  collector: {
    endpoint: string;
    source: string;
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
  nextSteps: string[];
}

const defaultCollectorEndpoint = 'http://127.0.0.1:3000/ingestion';
const defaultMetricPlatformEndpoint = 'http://127.0.0.1:3001';
const mcpTools = [
  'beforeEditFile',
  'afterEditFile',
  'recordSession',
  'getProjectRules',
  'listRuleVersions',
  'getRuleTemplate',
  'validateRuleTemplate',
  'setActiveRuleVersion',
  'searchKnowledge',
];

export function buildEmployeeOnboardingConfig(
  input: EmployeeOnboardingInput,
): EmployeeOnboardingConfig {
  const rulePack = getProjectRulePack({
    projectKey: input.projectKey,
    toolType: 'cursor',
    sceneType: 'rule-query',
  });
  const ruleTemplate = getRuleTemplate({
    projectKey: input.projectKey,
    version: rulePack.version,
  });
  const collectorEndpoint = input.collectorEndpoint ?? defaultCollectorEndpoint;
  const metricPlatformEndpoint =
    input.metricPlatformEndpoint ?? defaultMetricPlatformEndpoint;

  return {
    projectKey: input.projectKey,
    memberId: input.memberId,
    repoName: input.repoName,
    collector: {
      endpoint: collectorEndpoint,
      source: 'cursor',
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
    nextSteps: [
      'Install or point your MCP client at .aimetric/mcp.json',
      'Start collector-gateway before sending local events',
      'Run recordSession at the end of an AI coding session',
    ],
  };
}
