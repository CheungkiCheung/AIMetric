import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildEmployeeOnboardingStatus,
  buildEmployeeOnboardingConfig,
  flushEmployeeOutbox,
  registerEmployeeCollectorIdentity,
  runEmployeeOnboardingDoctor,
  writeEmployeeOnboardingFiles,
} from './onboarding.js';

const temporaryWorkspaces: string[] = [];

afterEach(() => {
  temporaryWorkspaces.splice(0).forEach((workspace) => {
    rmSync(workspace, { recursive: true, force: true });
  });
});

describe('buildEmployeeOnboardingConfig', () => {
  it('builds a minimal employee onboarding config from the active rule template', () => {
    const config = buildEmployeeOnboardingConfig({
      projectKey: 'aimetric',
      memberId: 'alice',
      repoName: 'AIMetric',
      collectorEndpoint: 'http://127.0.0.1:3000/ingestion',
    });

    expect(config.projectKey).toBe('aimetric');
    expect(config.memberId).toBe('alice');
    expect(config.identity.identityKey).toBe('aimetric:alice:cursor:aimetric');
    expect(config.rules.version).toBe('v2');
    expect(config.rules.must).toContain('rule.template-versioning');
    expect(config.mcp.tools).toContain('getProjectRules');
    expect(config.mcp.tools).toContain('evaluateRuleRollout');
    expect(config.collector.endpoint).toBe('http://127.0.0.1:3000/ingestion');
    expect(config.collector.authTokenEnv).toBe('AIMETRIC_COLLECTOR_TOKEN');
    expect(JSON.stringify(config)).not.toContain('secret-token');
  });

  it('supports a CLI onboarding profile with cli source metadata', () => {
    const config = buildEmployeeOnboardingConfig({
      projectKey: 'aimetric',
      memberId: 'alice',
      repoName: 'AIMetric',
      toolProfile: 'cli',
    });

    expect(config.collector.source).toBe('cli');
    expect(config.toolProfile).toBe('cli');
    expect(config.mcp.environment.AIMETRIC_TOOL_PROFILE).toBe('cli');
  });

  it('supports enterprise AI tool onboarding profiles', () => {
    expect(
      buildEmployeeOnboardingConfig({
        projectKey: 'aimetric',
        memberId: 'alice',
        repoName: 'AIMetric',
        toolProfile: 'codex',
      }),
    ).toMatchObject({
      toolProfile: 'codex',
      collector: { source: 'codex' },
      mcp: {
        environment: {
          AIMETRIC_TOOL_PROFILE: 'codex',
        },
      },
    });
    expect(
      buildEmployeeOnboardingConfig({
        projectKey: 'aimetric',
        memberId: 'alice',
        repoName: 'AIMetric',
        toolProfile: 'claude-code',
      }).collector.source,
    ).toBe('claude-code');
    expect(
      buildEmployeeOnboardingConfig({
        projectKey: 'aimetric',
        memberId: 'alice',
        repoName: 'AIMetric',
        toolProfile: 'jetbrains',
      }).collector.source,
    ).toBe('jetbrains');
  });
});

describe('writeEmployeeOnboardingFiles', () => {
  it('writes local AIMetric config and MCP config files for a workspace', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'aimetric-onboarding-'));
    temporaryWorkspaces.push(workspaceDir);

    const result = await writeEmployeeOnboardingFiles({
      workspaceDir,
      projectKey: 'aimetric',
      memberId: 'alice',
      repoName: 'AIMetric',
    });

    const config = JSON.parse(readFileSync(result.configPath, 'utf8')) as {
      collector: { authTokenEnv: string };
      rules: { version: string };
    };
    const mcp = JSON.parse(readFileSync(result.mcpConfigPath, 'utf8')) as {
      mcpServers: {
        aimetric: {
          command: string;
          env: Record<string, string>;
        };
      };
    };

    expect(config.rules.version).toBe('v2');
    expect(config.collector.authTokenEnv).toBe('AIMETRIC_COLLECTOR_TOKEN');
    expect(mcp.mcpServers.aimetric.command).toBe('aimetric-mcp-server');
    expect(mcp.mcpServers.aimetric.env.AIMETRIC_PROJECT_KEY).toBe('aimetric');
    expect(mcp.mcpServers.aimetric.env.AIMETRIC_WORKSPACE_DIR).toBe(workspaceDir);
    expect(result.nextSteps).toContain('Install or point your MCP client at .aimetric/mcp.json');
    expect(result.adapterPaths).toContain(join(workspaceDir, '.cursor', 'mcp.json'));
  });

  it('writes a cursor collector config for cursor onboarding', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'aimetric-onboarding-cursor-collector-'));
    temporaryWorkspaces.push(workspaceDir);

    const result = await writeEmployeeOnboardingFiles({
      workspaceDir,
      projectKey: 'aimetric',
      memberId: 'alice',
      repoName: 'AIMetric',
      toolProfile: 'cursor',
    });

    const collectorConfigPath = join(
      workspaceDir,
      '.aimetric',
      'cursor-collector.json',
    );
    const collectorConfig = JSON.parse(readFileSync(collectorConfigPath, 'utf8')) as {
      enabled: boolean;
      publish: boolean;
      discovery: {
        cursorProjectsDir: string | null;
      };
    };

    expect(result.adapterPaths).toContain(join(workspaceDir, '.cursor', 'mcp.json'));
    expect(result.adapterPaths).toContain(collectorConfigPath);
    expect(collectorConfig.enabled).toBe(true);
    expect(collectorConfig.publish).toBe(false);
    expect(collectorConfig.discovery.cursorProjectsDir).toBeNull();
    expect(result.nextSteps).toContain(
      'Optionally run aimetric-cursor-sync for enhanced Cursor session collection',
    );
  });

  it('writes tool-specific next steps for vscode onboarding', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'aimetric-onboarding-vscode-'));
    temporaryWorkspaces.push(workspaceDir);

    const result = await writeEmployeeOnboardingFiles({
      workspaceDir,
      projectKey: 'aimetric',
      memberId: 'alice',
      repoName: 'AIMetric',
      toolProfile: 'vscode',
    });

    const config = JSON.parse(readFileSync(result.configPath, 'utf8')) as {
      collector: { source: string };
      toolProfile: string;
    };

    expect(config.collector.source).toBe('vscode');
    expect(config.toolProfile).toBe('vscode');
    expect(result.nextSteps).toContain(
      'Import .aimetric/mcp.json into your VS Code MCP or agent extension settings',
    );
    expect(result.adapterPaths).toContain(join(workspaceDir, '.vscode', 'mcp.json'));
  });

  it('writes a CLI environment helper for cli onboarding', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'aimetric-onboarding-cli-'));
    temporaryWorkspaces.push(workspaceDir);

    const result = await writeEmployeeOnboardingFiles({
      workspaceDir,
      projectKey: 'aimetric',
      memberId: 'alice',
      repoName: 'AIMetric',
      toolProfile: 'cli',
    });

    const cliEnvPath = join(workspaceDir, '.aimetric', 'cli.env');
    const cliEnv = readFileSync(cliEnvPath, 'utf8');

    expect(result.adapterPaths).toContain(cliEnvPath);
    expect(cliEnv).toContain(`export AIMETRIC_WORKSPACE_DIR="${workspaceDir}"`);
    expect(cliEnv).toContain('export AIMETRIC_TOOL_PROFILE="cli"');
  });

  it('writes profile-specific helper files for codex and claude-code onboarding', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'aimetric-onboarding-ai-cli-'));
    temporaryWorkspaces.push(workspaceDir);

    const codexResult = await writeEmployeeOnboardingFiles({
      workspaceDir,
      projectKey: 'aimetric',
      memberId: 'alice',
      repoName: 'AIMetric',
      toolProfile: 'codex',
    });
    const codexPath = join(workspaceDir, '.aimetric', 'codex.env');

    expect(codexResult.adapterPaths).toContain(codexPath);
    expect(readFileSync(codexPath, 'utf8')).toContain(
      'export AIMETRIC_TOOL_PROFILE="codex"',
    );

    const claudeResult = await writeEmployeeOnboardingFiles({
      workspaceDir,
      projectKey: 'aimetric',
      memberId: 'alice',
      repoName: 'AIMetric',
      toolProfile: 'claude-code',
    });
    const claudePath = join(workspaceDir, '.aimetric', 'claude-code.env');

    expect(claudeResult.adapterPaths).toContain(claudePath);
    expect(readFileSync(claudePath, 'utf8')).toContain(
      'export AIMETRIC_TOOL_PROFILE="claude-code"',
    );
  });
});

describe('employee onboarding status and doctor', () => {
  it('reports onboarding status from generated files', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'aimetric-onboarding-status-'));
    temporaryWorkspaces.push(workspaceDir);
    await writeEmployeeOnboardingFiles({
      workspaceDir,
      projectKey: 'aimetric',
      memberId: 'alice',
      repoName: 'AIMetric',
      toolProfile: 'cursor',
    });

    await expect(buildEmployeeOnboardingStatus({ workspaceDir })).resolves.toEqual({
      onboarded: true,
      identityKey: 'aimetric:alice:cursor:aimetric',
      collectorIdentityRegistered: false,
      projectKey: 'aimetric',
      memberId: 'alice',
      repoName: 'AIMetric',
      toolProfile: 'cursor',
      configPath: join(workspaceDir, '.aimetric', 'config.json'),
      mcpConfigPath: join(workspaceDir, '.aimetric', 'mcp.json'),
      collectorEndpoint: 'http://127.0.0.1:3000/ingestion',
      metricPlatformEndpoint: 'http://127.0.0.1:3001',
      outboxDepth: 0,
    });
  });

  it('reports pending local outbox depth in onboarding status', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'aimetric-onboarding-outbox-status-'));
    temporaryWorkspaces.push(workspaceDir);
    await writeEmployeeOnboardingFiles({
      workspaceDir,
      projectKey: 'aimetric',
      memberId: 'alice',
      repoName: 'AIMetric',
      toolProfile: 'cursor',
    });
    writeOutboxBatch(workspaceDir, 'batch-1.json');
    writeOutboxBatch(workspaceDir, 'batch-2.json');

    await expect(buildEmployeeOnboardingStatus({ workspaceDir })).resolves.toMatchObject({
      onboarded: true,
      outboxDepth: 2,
    });
  });

  it('doctor returns pass checks for a healthy onboarding workspace', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'aimetric-onboarding-doctor-'));
    temporaryWorkspaces.push(workspaceDir);
    await writeEmployeeOnboardingFiles({
      workspaceDir,
      projectKey: 'aimetric',
      memberId: 'alice',
      repoName: 'AIMetric',
      toolProfile: 'cursor',
    });

    const report = await runEmployeeOnboardingDoctor({ workspaceDir });

    expect(report.status).toBe('healthy');
    expect(report.checks).toContainEqual({
      key: 'config',
      status: 'pass',
      message: 'AIMetric config exists and is valid',
    });
    expect(report.checks).toContainEqual({
      key: 'mcp-config',
      status: 'pass',
      message: 'MCP config exists',
    });
    expect(report.nextActions).toContain('Run aimetric status before your first AI session');
    expect(report.nextActions).toContain(
      'Run aimetric register to bind this workspace identity to the governance directory',
    );
  });

  it('doctor validates collector identity registration when platform lookup is provided', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'aimetric-onboarding-doctor-identity-'));
    temporaryWorkspaces.push(workspaceDir);
    await writeEmployeeOnboardingFiles({
      workspaceDir,
      projectKey: 'aimetric',
      memberId: 'alice',
      repoName: 'AIMetric',
      toolProfile: 'cursor',
    });

    const report = await runEmployeeOnboardingDoctor({
      workspaceDir,
      fetchImplementation: async () =>
        new Response(
          JSON.stringify({
            identityKey: 'aimetric:alice:cursor:aimetric',
            memberId: 'alice',
            projectKey: 'aimetric',
            repoName: 'AIMetric',
            toolProfile: 'cursor',
            status: 'active',
            registeredAt: '2026-04-25T00:00:00.000Z',
            updatedAt: '2026-04-25T00:00:00.000Z',
          }),
          { status: 200 },
        ),
    });

    expect(report.checks).toContainEqual({
      key: 'collector-identity',
      status: 'pass',
      message: 'Collector identity aimetric:alice:cursor:aimetric is registered',
    });
  });

  it('doctor warns when local outbox contains pending batches', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'aimetric-onboarding-doctor-outbox-'));
    temporaryWorkspaces.push(workspaceDir);
    await writeEmployeeOnboardingFiles({
      workspaceDir,
      projectKey: 'aimetric',
      memberId: 'alice',
      repoName: 'AIMetric',
      toolProfile: 'cursor',
    });
    writeOutboxBatch(workspaceDir, 'batch-1.json');

    const report = await runEmployeeOnboardingDoctor({ workspaceDir });

    expect(report.status).toBe('degraded');
    expect(report.checks).toContainEqual({
      key: 'outbox',
      status: 'warn',
      message: '1 local ingestion batch is waiting to be flushed',
    });
    expect(report.nextActions).toContain('Run aimetric flush to publish buffered events');
  });

  it('doctor returns actionable repair suggestions when onboarding is missing', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'aimetric-onboarding-missing-'));
    temporaryWorkspaces.push(workspaceDir);

    const report = await runEmployeeOnboardingDoctor({ workspaceDir });

    expect(report.status).toBe('unhealthy');
    expect(report.checks).toContainEqual({
      key: 'config',
      status: 'fail',
      message: 'Missing .aimetric/config.json',
    });
    expect(report.nextActions).toContain(
      'Run aimetric onboard --projectKey=<project> --memberId=<member> --repoName=<repo>',
    );
  });
});

describe('flushEmployeeOutbox', () => {
  it('flushes buffered ingestion batches using onboarding config', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'aimetric-onboarding-flush-'));
    temporaryWorkspaces.push(workspaceDir);
    await writeEmployeeOnboardingFiles({
      workspaceDir,
      projectKey: 'aimetric',
      memberId: 'alice',
      repoName: 'AIMetric',
      toolProfile: 'cursor',
    });
    writeOutboxBatch(workspaceDir, 'batch-1.json');

    const result = await flushEmployeeOutbox({
      workspaceDir,
      fetchImplementation: async () =>
        new Response(JSON.stringify({ accepted: 1 }), { status: 200 }),
    });

    expect(result).toEqual({
      attempted: 1,
      published: 1,
      failed: 0,
      remainingDepth: 0,
    });
  });
});

describe('registerEmployeeCollectorIdentity', () => {
  it('registers the local workspace identity in metric-platform', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'aimetric-onboarding-register-'));
    temporaryWorkspaces.push(workspaceDir);
    await writeEmployeeOnboardingFiles({
      workspaceDir,
      projectKey: 'aimetric',
      memberId: 'alice',
      repoName: 'AIMetric',
      toolProfile: 'cursor',
    });

    const result = await registerEmployeeCollectorIdentity({
      workspaceDir,
      fetchImplementation: async (_input, init) => {
        expect(String(_input)).toBe(
          'http://127.0.0.1:3001/governance/collector-identities/register',
        );
        expect(init?.method).toBe('POST');
        expect(init?.body).toBe(
          JSON.stringify({
            identityKey: 'aimetric:alice:cursor:aimetric',
            memberId: 'alice',
            projectKey: 'aimetric',
            repoName: 'AIMetric',
            toolProfile: 'cursor',
          }),
        );

        return new Response(
          JSON.stringify({
            identityKey: 'aimetric:alice:cursor:aimetric',
            memberId: 'alice',
            projectKey: 'aimetric',
            repoName: 'AIMetric',
            toolProfile: 'cursor',
            status: 'active',
            registeredAt: '2026-04-25T00:00:00.000Z',
            updatedAt: '2026-04-25T00:00:00.000Z',
          }),
          { status: 200 },
        );
      },
    });

    expect(result).toMatchObject({
      identityKey: 'aimetric:alice:cursor:aimetric',
      memberId: 'alice',
      status: 'active',
    });
  });
});

const writeOutboxBatch = (workspaceDir: string, filename: string): void => {
  const outboxDir = join(workspaceDir, '.aimetric', 'outbox');
  mkdirSync(outboxDir, { recursive: true });
  writeFileSync(
    join(outboxDir, filename),
    JSON.stringify({
      schemaVersion: 'v1',
      source: 'cursor',
      events: [
        {
          eventType: 'session.recorded',
          occurredAt: '2026-04-24T00:00:00.000Z',
          payload: {
            sessionId: filename,
            projectKey: 'aimetric',
            repoName: 'AIMetric',
          },
        },
      ],
    }),
    'utf8',
  );
};
