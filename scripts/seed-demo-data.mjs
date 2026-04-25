import { createDemoImportPlan } from './demo-fixtures.mjs';

const args = process.argv.slice(2);

const readOption = (name, fallback) => {
  const match = args.find((arg) => arg.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3) : fallback;
};

const hasFlag = (name) => args.includes(`--${name}`);

const baseUrl = readOption(
  'base-url',
  process.env.METRIC_PLATFORM_URL ?? 'http://127.0.0.1:3001',
);
const projectKey = readOption('project-key', 'aimetric');
const adminToken = readOption(
  'admin-token',
  process.env.METRIC_PLATFORM_ADMIN_TOKEN ?? '',
);
const dryRun = hasFlag('dry-run');

const headers = {
  'content-type': 'application/json',
  'x-aimetric-actor': 'pilot-admin',
  ...(adminToken ? { authorization: `Bearer ${adminToken}` } : {}),
};

const run = async () => {
  const plan = createDemoImportPlan(projectKey);

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          baseUrl,
          projectKey,
          steps: plan.map(([path, body]) => ({
            path,
            topLevelKeys: Object.keys(body),
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  for (const [path, body] of plan) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed ${path}: ${response.status} ${text}`);
    }

    const json = await response.json();
    console.log(JSON.stringify({ path, result: json }, null, 2));
  }

  console.log(
    `Demo data imported for project "${projectKey}". Open the dashboard and filter by projectKey=${projectKey}.`,
  );
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
