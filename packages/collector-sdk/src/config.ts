import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

export const AimMetricConfigSchema = z.object({
  projectKey: z.string().min(1),
  memberId: z.string().min(1),
  repoName: z.string().min(1),
  toolProfile: z.enum(['cursor', 'cli', 'vscode']).default('cursor'),
  collector: z.object({
    endpoint: z.string().url(),
    source: z.string().min(1),
    authTokenEnv: z.string().min(1).optional(),
  }),
  metricPlatform: z.object({
    endpoint: z.string().url(),
  }),
  rules: z.object({
    version: z.string().min(1),
    must: z.array(z.string()),
    should: z.array(z.string()),
    onDemand: z.array(z.string()),
    knowledgeRefs: z.array(z.string()),
  }),
  mcp: z.object({
    tools: z.array(z.string()),
    environment: z.record(z.string()),
  }),
});

export type AimMetricConfig = z.infer<typeof AimMetricConfigSchema>;

export async function loadAimMetricConfig(input: {
  workspaceDir?: string;
  configPath?: string;
}): Promise<AimMetricConfig> {
  const configPath =
    input.configPath ??
    join(input.workspaceDir ?? process.cwd(), '.aimetric', 'config.json');
  const rawConfig = await readFile(configPath, 'utf8');
  const parsedConfig = AimMetricConfigSchema.safeParse(JSON.parse(rawConfig));

  if (!parsedConfig.success) {
    throw new Error(
      `Invalid AIMetric config: ${parsedConfig.error.issues
        .map((issue) => issue.path.join('.') || issue.code)
        .join(', ')}`,
    );
  }

  return parsedConfig.data;
}
