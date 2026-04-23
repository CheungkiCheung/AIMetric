#!/usr/bin/env node

import { writeEmployeeOnboardingFiles } from './onboarding.js';

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = ''] = arg.replace(/^--/, '').split('=');
    return [key, value];
  }),
);

const required = ['projectKey', 'memberId', 'repoName'];
const missing = required.filter((key) => !args.get(key));

if (missing.length > 0) {
  console.error(
    `Missing required arguments: ${missing.map((key) => `--${key}`).join(', ')}`,
  );
  process.exit(1);
}

const result = await writeEmployeeOnboardingFiles({
  workspaceDir: args.get('workspaceDir') ?? process.cwd(),
  projectKey: args.get('projectKey') ?? '',
  memberId: args.get('memberId') ?? '',
  repoName: args.get('repoName') ?? '',
  toolProfile:
    (args.get('toolProfile') as 'cursor' | 'cli' | 'vscode' | undefined) ??
    undefined,
  collectorEndpoint: args.get('collectorEndpoint') || undefined,
  metricPlatformEndpoint: args.get('metricPlatformEndpoint') || undefined,
});

console.log(`AIMetric config written to ${result.configPath}`);
console.log(`MCP config written to ${result.mcpConfigPath}`);
result.nextSteps.forEach((step) => console.log(`- ${step}`));
