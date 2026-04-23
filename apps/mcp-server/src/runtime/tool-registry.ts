import { afterEditFile } from '../tools/after-edit-file.tool.js';
import { beforeEditFile } from '../tools/before-edit-file.tool.js';
import { getProjectRules } from '../tools/get-project-rules.tool.js';
import { getRuleRollout } from '../tools/get-rule-rollout.tool.js';
import { getRuleTemplate } from '../tools/get-rule-template.tool.js';
import { listRuleVersions } from '../tools/list-rule-versions.tool.js';
import { recordSession } from '../tools/record-session.tool.js';
import { searchKnowledge } from '../tools/search-knowledge.tool.js';
import { setActiveRuleVersion } from '../tools/set-active-rule-version.tool.js';
import { setRuleRollout } from '../tools/set-rule-rollout.tool.js';
import { validateRuleTemplate } from '../tools/validate-rule-template.tool.js';

export interface JsonSchemaObject {
  type: 'object';
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface JsonSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  items?: {
    type: 'string' | 'number' | 'boolean' | 'object';
  };
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: JsonSchemaObject;
  invoke: (input: Record<string, unknown>) => Promise<unknown>;
}

export interface ToolRegistryOptions {
  environment?: Record<string, string | undefined>;
}

export const createToolRegistry = (
  options: ToolRegistryOptions = {},
): Map<string, McpTool> => {
  const environment = options.environment ?? process.env;
  const tools: McpTool[] = [
    {
      name: 'beforeEditFile',
      description: 'Capture a stable snapshot before an AI-assisted file edit.',
      inputSchema: objectSchema({
        sessionId: stringProperty('AI coding session id.'),
        filePath: stringProperty('Absolute or workspace-relative file path.'),
        content: stringProperty('File content before the edit.'),
      }, ['sessionId', 'filePath', 'content']),
      invoke: (input) => beforeEditFile(input as Parameters<typeof beforeEditFile>[0]),
    },
    {
      name: 'afterEditFile',
      description: 'Capture a normalized edit diff after an AI-assisted file edit.',
      inputSchema: objectSchema({
        sessionId: stringProperty('AI coding session id.'),
        filePath: stringProperty('Absolute or workspace-relative file path.'),
        beforeContent: stringProperty('File content before the edit.'),
        afterContent: stringProperty('File content after the edit.'),
      }, ['sessionId', 'filePath', 'beforeContent', 'afterContent']),
      invoke: (input) => afterEditFile(input as Parameters<typeof afterEditFile>[0]),
    },
    {
      name: 'recordSession',
      description: 'Record a lightweight AI coding session summary and optional collection event.',
      inputSchema: objectSchema({
        sessionId: stringProperty('AI coding session id.'),
        userMessage: stringProperty('User prompt or request.'),
        assistantMessage: stringProperty('Assistant response summary.'),
        workspaceDir: stringProperty('Workspace directory containing .aimetric/config.json.'),
        configPath: stringProperty('Explicit AIMetric config path.'),
      }, ['sessionId', 'userMessage', 'assistantMessage']),
      invoke: (input) =>
        recordSession(
          withWorkspaceDefaults(
            input as Parameters<typeof recordSession>[0],
            environment,
          ),
        ),
    },
    {
      name: 'getProjectRules',
      description: 'Resolve mandatory and contextual project rules for an MCP client.',
      inputSchema: objectSchema({
        projectKey: stringProperty('AIMetric project key.'),
        toolType: stringProperty('AI tool type, such as cursor or cli.'),
        sceneType: stringProperty('Development scene type.'),
      }, ['projectKey', 'toolType', 'sceneType']),
      invoke: (input) => getProjectRules(input as Parameters<typeof getProjectRules>[0]),
    },
    {
      name: 'listRuleVersions',
      description: 'List available rule template versions for a project.',
      inputSchema: objectSchema({
        projectKey: stringProperty('AIMetric project key.'),
      }, ['projectKey']),
      invoke: (input) => listRuleVersions(input as Parameters<typeof listRuleVersions>[0]),
    },
    {
      name: 'getRuleTemplate',
      description: 'Fetch the active or selected rule template for a project.',
      inputSchema: objectSchema({
        projectKey: stringProperty('AIMetric project key.'),
        version: stringProperty('Optional rule template version.'),
      }, ['projectKey']),
      invoke: (input) => getRuleTemplate(input as Parameters<typeof getRuleTemplate>[0]),
    },
    {
      name: 'validateRuleTemplate',
      description: 'Validate a project rule template before MCP rule injection.',
      inputSchema: objectSchema({
        projectKey: stringProperty('AIMetric project key.'),
        version: stringProperty('Optional rule template version.'),
        catalogRoot: stringProperty('Optional local rule catalog root for tests or staging.'),
      }, ['projectKey']),
      invoke: (input) =>
        validateRuleTemplate(input as Parameters<typeof validateRuleTemplate>[0]),
    },
    {
      name: 'setActiveRuleVersion',
      description: 'Switch the active rule template version for a project catalog.',
      inputSchema: objectSchema({
        projectKey: stringProperty('AIMetric project key.'),
        version: stringProperty('Rule template version to activate.'),
        catalogRoot: stringProperty('Optional local rule catalog root for tests or staging.'),
      }, ['projectKey', 'version']),
      invoke: (input) =>
        setActiveRuleVersion(input as Parameters<typeof setActiveRuleVersion>[0]),
    },
    {
      name: 'getRuleRollout',
      description: 'Read the current rule rollout policy for a project catalog.',
      inputSchema: objectSchema({
        projectKey: stringProperty('AIMetric project key.'),
        catalogRoot: stringProperty('Optional local rule catalog root for tests or staging.'),
      }, ['projectKey']),
      invoke: (input) => getRuleRollout(input as Parameters<typeof getRuleRollout>[0]),
    },
    {
      name: 'setRuleRollout',
      description: 'Update the rule rollout policy for a project catalog.',
      inputSchema: objectSchema({
        projectKey: stringProperty('AIMetric project key.'),
        enabled: {
          type: 'boolean',
          description: 'Whether rule rollout is enabled.',
        },
        candidateVersion: stringProperty('Candidate rule template version.'),
        percentage: {
          type: 'number',
          description: 'Rollout percentage from 0 to 100.',
        },
        includedMembers: {
          type: 'array',
          description: 'Members that should always receive the rollout version.',
          items: {
            type: 'string',
          },
        },
        catalogRoot: stringProperty('Optional local rule catalog root for tests or staging.'),
      }, ['projectKey', 'enabled']),
      invoke: (input) => setRuleRollout(input as Parameters<typeof setRuleRollout>[0]),
    },
    {
      name: 'searchKnowledge',
      description: 'Search local AIMetric architecture and implementation knowledge.',
      inputSchema: objectSchema({
        query: stringProperty('Search query.'),
        limit: {
          type: 'number',
          description: 'Maximum number of matches to return.',
        },
      }, ['query']),
      invoke: (input) => searchKnowledge(input as Parameters<typeof searchKnowledge>[0]),
    },
  ];

  return new Map(tools.map((tool) => [tool.name, tool]));
};

const withWorkspaceDefaults = (
  input: Parameters<typeof recordSession>[0],
  environment: Record<string, string | undefined>,
): Parameters<typeof recordSession>[0] => ({
  ...input,
  workspaceDir:
    input.workspaceDir ?? environment.AIMETRIC_WORKSPACE_DIR ?? undefined,
  configPath: input.configPath ?? environment.AIMETRIC_CONFIG_PATH ?? undefined,
});

const objectSchema = (
  properties: Record<string, JsonSchemaProperty>,
  required: string[],
): JsonSchemaObject => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

const stringProperty = (description: string): JsonSchemaProperty => ({
  type: 'string',
  description,
});
