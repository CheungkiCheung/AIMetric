import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildEmployeeOnboardingConfig,
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
    expect(config.rules.version).toBe('v2');
    expect(config.rules.must).toContain('rule.template-versioning');
    expect(config.mcp.tools).toContain('getProjectRules');
    expect(config.mcp.tools).toContain('evaluateRuleRollout');
    expect(config.collector.endpoint).toBe('http://127.0.0.1:3000/ingestion');
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
    expect(mcp.mcpServers.aimetric.command).toBe('aimetric-mcp-server');
    expect(mcp.mcpServers.aimetric.env.AIMETRIC_PROJECT_KEY).toBe('aimetric');
    expect(mcp.mcpServers.aimetric.env.AIMETRIC_WORKSPACE_DIR).toBe(workspaceDir);
    expect(result.nextSteps).toContain('Install or point your MCP client at .aimetric/mcp.json');
    expect(result.adapterPaths).toContain(join(workspaceDir, '.cursor', 'mcp.json'));
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
});
