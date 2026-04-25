#!/usr/bin/env node

import {
  buildEmployeeOnboardingStatus,
  runEmployeeOnboardingDoctor,
  writeEmployeeOnboardingFiles,
  type EmployeeToolProfile,
} from './onboarding.js';

const rawArgs = process.argv.slice(2);
const command = rawArgs[0]?.startsWith('--') ? 'onboard' : (rawArgs[0] ?? 'onboard');
const commandArgs = rawArgs[0]?.startsWith('--') ? rawArgs : rawArgs.slice(1);
const args = new Map(
  commandArgs.map((arg) => {
    const [key, value = ''] = arg.replace(/^--/, '').split('=');
    return [key, value];
  }),
);

if (command === 'status') {
  const status = await buildEmployeeOnboardingStatus({
    workspaceDir: args.get('workspaceDir') ?? process.cwd(),
  });

  console.log(JSON.stringify(status, null, 2));
  process.exit(status.onboarded ? 0 : 1);
}

if (command === 'doctor') {
  const report = await runEmployeeOnboardingDoctor({
    workspaceDir: args.get('workspaceDir') ?? process.cwd(),
  });

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.status === 'unhealthy' ? 1 : 0);
}

if (command !== 'onboard') {
  console.error(`Unknown command: ${command}`);
  console.error('Usage: aimetric onboard|status|doctor [--workspaceDir=...]');
  process.exit(1);
}

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
  toolProfile: (args.get('toolProfile') as EmployeeToolProfile | undefined) ?? undefined,
  collectorEndpoint: args.get('collectorEndpoint') || undefined,
  metricPlatformEndpoint: args.get('metricPlatformEndpoint') || undefined,
});

console.log(`AIMetric config written to ${result.configPath}`);
console.log(`MCP config written to ${result.mcpConfigPath}`);
result.nextSteps.forEach((step) => console.log(`- ${step}`));
