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
    expect(config.collector.endpoint).toBe('http://127.0.0.1:3000/ingestion');
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
      tools: string[];
    };

    expect(config.rules.version).toBe('v2');
    expect(mcp.tools).toContain('searchKnowledge');
    expect(result.nextSteps).toContain('Install or point your MCP client at .aimetric/mcp.json');
  });
});
