import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { getProjectRules } from './get-project-rules.tool.js';
import { getRuleTemplate } from './get-rule-template.tool.js';
import { listRuleVersions } from './list-rule-versions.tool.js';
import { searchKnowledge } from './search-knowledge.tool.js';
import { setActiveRuleVersion } from './set-active-rule-version.tool.js';
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
