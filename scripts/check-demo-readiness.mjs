import { createDemoChecks } from './demo-health.mjs';

const args = process.argv.slice(2);

const readOption = (name, fallback) => {
  const match = args.find((arg) => arg.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3) : fallback;
};

const metricPlatformBaseUrl = readOption(
  'metric-platform-url',
  process.env.METRIC_PLATFORM_URL ?? 'http://127.0.0.1:3001',
);
const collectorBaseUrl = readOption(
  'collector-url',
  process.env.COLLECTOR_GATEWAY_URL ?? 'http://127.0.0.1:3000',
);
const projectKey = readOption('project-key', 'aimetric');

const run = async () => {
  const checks = createDemoChecks(
    metricPlatformBaseUrl,
    collectorBaseUrl,
    projectKey,
  );

  const results = [];

  for (const check of checks) {
    try {
      const response = await fetch(check.url);
      results.push({
        name: check.name,
        ok: response.ok,
        status: response.status,
        url: check.url,
      });
    } catch (error) {
      results.push({
        name: check.name,
        ok: false,
        status: 'network-error',
        url: check.url,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log(JSON.stringify(results, null, 2));

  if (results.some((result) => !result.ok)) {
    console.error(
      'Demo readiness check failed. Start collector-gateway, metric-platform, and dashboard before running demo:seed.',
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `Demo readiness check passed for project "${projectKey}". You can now run "corepack pnpm demo:seed".`,
  );
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
