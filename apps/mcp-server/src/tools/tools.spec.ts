import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { evaluateRuleRollout } from './evaluate-rule-rollout.tool.js';
import { getProjectRules } from './get-project-rules.tool.js';
import { getRuleRollout } from './get-rule-rollout.tool.js';
import { getRuleTemplate } from './get-rule-template.tool.js';
import { listRuleVersions } from './list-rule-versions.tool.js';
import { searchKnowledge } from './search-knowledge.tool.js';
import { setActiveRuleVersion } from './set-active-rule-version.tool.js';
import { setRuleRollout } from './set-rule-rollout.tool.js';
import { validateRuleTemplate } from './validate-rule-template.tool.js';
import { beforeEditFile } from './before-edit-file.tool.js';
import { afterEditFile } from './after-edit-file.tool.js';
import { recordSession } from './record-session.tool.js';

const temporaryCatalogRoots: string[] = [];

afterEach(() => {
  temporaryCatalogRoots.splice(0).forEach((catalogRoot) => {
    rmSync(catalogRoot, { recursive: true, force: true });
  });
});

describe('beforeEditFile', () => {
  it('captures a stable pre-edit snapshot', async () => {
    const result = await beforeEditFile({
      sessionId: 'sess_1',
      filePath: '/tmp/demo.ts',
      content: 'const a = 1;'
    });

    expect(result.filePath).toBe('/tmp/demo.ts');
    expect(result.snapshotHash).toBeDefined();
  });
});

describe('afterEditFile', () => {
  it('produces a normalized diff payload', async () => {
    const result = await afterEditFile({
      sessionId: 'sess_1',
      filePath: '/tmp/demo.ts',
      beforeContent: 'const a = 1;',
      afterContent: 'const a = 2;'
    });

    expect(result.diff).toContain('-const a = 1;');
    expect(result.diff).toContain('+const a = 2;');
  });
});

describe('recordSession', () => {
  it('captures a lightweight session summary', async () => {
    const result = await recordSession({
      sessionId: 'sess_1',
      userMessage: 'change the file',
      assistantMessage: 'file changed'
    });

    expect(result.sessionId).toBe('sess_1');
    expect(result.summary).toContain('change the file');
  });

  it('uses onboarding config to produce a session event payload', async () => {
    const workspaceDir = createWorkspaceWithAimMetricConfig();

    const result = await recordSession({
      sessionId: 'sess_1',
      userMessage: 'change the file',
      assistantMessage: 'file changed',
      workspaceDir,
    });

    expect(result.event).toEqual({
      eventType: 'session.recorded',
      payload: expect.objectContaining({
        projectKey: 'aimetric',
        memberId: 'alice',
        repoName: 'AIMetric',
        ruleVersion: 'v2',
      }),
    });
  });
});

describe('getProjectRules', () => {
  it('returns article-congruent project rules for the current project', async () => {
    const result = await getProjectRules({
      projectKey: 'aimetric',
      toolType: 'cursor',
      sceneType: 'api-change',
    });

    expect(result.projectKey).toBe('aimetric');
    expect(result.version).toBe('v2');
    expect(result.mandatoryRules).toContain('core.style');
    expect(result.knowledgeRefs).toContain(
      'docs/superpowers/specs/2026-04-22-aimetric-article-congruent-design.md',
    );
  });
});

describe('searchKnowledge', () => {
  it('finds matching knowledge snippets from local docs', async () => {
    const result = await searchKnowledge({
      query: '规则分层',
      limit: 2,
    });

    expect(result.query).toBe('规则分层');
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches[0]?.filePath).toContain('docs/superpowers');
  });
});

describe('listRuleVersions', () => {
  it('returns version catalog for the project rule set', async () => {
    const result = await listRuleVersions({
      projectKey: 'aimetric',
    });

    expect(result.projectKey).toBe('aimetric');
    expect(result.activeVersion).toBe('v2');
    expect(result.versions).toContainEqual(
      expect.objectContaining({
        version: 'v2',
      }),
    );
  });
});

describe('getRuleTemplate', () => {
  it('returns the active rule template version for MCP consumers', async () => {
    const result = await getRuleTemplate({
      projectKey: 'aimetric',
    });

    expect(result.projectKey).toBe('aimetric');
    expect(result.version).toBe('v2');
    expect(result.rules.must).toContain('core.style');
    expect(result.rules.must).toContain('rule.template-versioning');
  });
});

describe('validateRuleTemplate', () => {
  it('validates the active rule template for MCP consumers', async () => {
    const result = await validateRuleTemplate({
      projectKey: 'aimetric',
      version: 'v2',
    });

    expect(result.valid).toBe(true);
    expect(result.activeVersion).toBe('v2');
  });
});

describe('setActiveRuleVersion', () => {
  it('switches the active rule version for MCP consumers', async () => {
    const catalogRoot = createTemporaryCatalogRoot();
    const result = await setActiveRuleVersion({
      projectKey: 'aimetric',
      version: 'v1',
      catalogRoot,
    });

    expect(result.projectKey).toBe('aimetric');
    expect(result.previousVersion).toBeDefined();
    expect(result.activeVersion).toBe('v1');
  });
});

describe('rule rollout tools', () => {
  it('returns the current rule rollout policy for MCP consumers', async () => {
    const result = await getRuleRollout({
      projectKey: 'aimetric',
    });

    expect(result).toMatchObject({
      projectKey: 'aimetric',
      enabled: false,
      percentage: 0,
      includedMembers: [],
    });
  });

  it('updates the rule rollout policy for MCP consumers', async () => {
    const catalogRoot = createTemporaryCatalogRoot();
    const result = await setRuleRollout({
      projectKey: 'aimetric',
      enabled: true,
      candidateVersion: 'v1',
      percentage: 25,
      includedMembers: ['alice'],
      catalogRoot,
    });

    expect(result).toMatchObject({
      projectKey: 'aimetric',
      enabled: true,
      candidateVersion: 'v1',
      percentage: 25,
      includedMembers: ['alice'],
    });
    await expect(
      getRuleRollout({
        projectKey: 'aimetric',
        catalogRoot,
      }),
    ).resolves.toMatchObject({
      enabled: true,
      candidateVersion: 'v1',
      percentage: 25,
    });
  });

  it('evaluates rollout hits for MCP rule consumers', async () => {
    const catalogRoot = createTemporaryCatalogRoot();

    await setRuleRollout({
      projectKey: 'aimetric',
      enabled: true,
      candidateVersion: 'v1',
      percentage: 0,
      includedMembers: ['alice'],
      catalogRoot,
    });

    await expect(
      evaluateRuleRollout({
        projectKey: 'aimetric',
        memberId: 'alice',
        catalogRoot,
      }),
    ).resolves.toMatchObject({
      selectedVersion: 'v1',
      matched: true,
      reason: 'included-member',
    });
    await expect(
      getProjectRules({
        projectKey: 'aimetric',
        toolType: 'cursor',
        sceneType: 'api-change',
        memberId: 'alice',
        catalogRoot,
      }),
    ).resolves.toMatchObject({
      version: 'v1',
    });
  });
});

const createTemporaryCatalogRoot = (): string => {
  const catalogRoot = mkdtempSync(join(tmpdir(), 'aimetric-mcp-rule-catalog-'));
  temporaryCatalogRoots.push(catalogRoot);

  cpSync(
    join(
      '/Users/zhangqixiang/0_1WORK/zhongxing/AIMetric',
      'packages/rule-engine/src/templates',
    ),
    catalogRoot,
    { recursive: true },
  );

  return catalogRoot;
};

const createWorkspaceWithAimMetricConfig = (): string => {
  const workspaceDir = mkdtempSync(join(tmpdir(), 'aimetric-mcp-config-'));
  const aimetricDir = join(workspaceDir, '.aimetric');
  temporaryCatalogRoots.push(workspaceDir);
  mkdirSync(aimetricDir, { recursive: true });
  writeFileSync(
    join(aimetricDir, 'config.json'),
    JSON.stringify({
      projectKey: 'aimetric',
      memberId: 'alice',
      repoName: 'AIMetric',
      collector: {
        endpoint: 'http://127.0.0.1:3000/ingestion',
        source: 'cursor',
      },
      metricPlatform: {
        endpoint: 'http://127.0.0.1:3001',
      },
      rules: {
        version: 'v2',
        must: [],
        should: [],
        onDemand: [],
        knowledgeRefs: [],
      },
      mcp: {
        tools: [],
        environment: {},
      },
    }),
    'utf8',
  );

  return workspaceDir;
};
