import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  getProjectRulePack,
  getRuleTemplate,
  listRuleVersions,
  resolveRuleBundle,
  setActiveRuleVersion,
  validateRuleTemplate,
} from './rule-bundle.js';

const temporaryCatalogRoots: string[] = [];

afterEach(() => {
  temporaryCatalogRoots.splice(0).forEach((catalogRoot) => {
    rmSync(catalogRoot, { recursive: true, force: true });
  });
});

describe('resolveRuleBundle', () => {
  it('returns mandatory rules and on-demand rules for matching scenes', () => {
    const bundle = resolveRuleBundle({
      projectType: 'web',
      toolType: 'cursor',
      sceneType: 'api-change'
    });

    expect(bundle.mandatoryRules).toContain('mcp.before-after-recording');
    expect(bundle.onDemandRules).toContain('knowledge.api-doc');
  });

  it('adds article-congruent rules for metric analysis scenes', () => {
    const bundle = resolveRuleBundle({
      projectKey: 'aimetric',
      projectType: 'platform',
      toolType: 'mcp',
      sceneType: 'metric-analysis',
    });

    expect(bundle.mandatoryRules).toContain('metric.snapshot-recalculation');
    expect(bundle.onDemandRules).toContain('knowledge.metric-calibration');
  });
});

describe('getProjectRulePack', () => {
  it('returns project-level rule metadata for MCP consumers', () => {
    const rulePack = getProjectRulePack({
      projectKey: 'aimetric',
      toolType: 'cursor',
      sceneType: 'api-change',
    });

    expect(rulePack.projectKey).toBe('aimetric');
    expect(rulePack.version).toBe('v2');
    expect(rulePack.mandatoryRules).toContain('core.style');
    expect(rulePack.knowledgeRefs).toContain(
      'docs/superpowers/specs/2026-04-22-aimetric-article-congruent-design.md',
    );
  });
});

describe('listRuleVersions', () => {
  it('returns available rule versions with active version metadata', () => {
    const versions = listRuleVersions('aimetric');

    expect(versions.activeVersion).toBe('v2');
    expect(versions.versions).toContainEqual(
      expect.objectContaining({
        version: 'v2',
        status: 'active',
      }),
    );
    expect(versions.versions).toContainEqual(
      expect.objectContaining({
        version: 'v1',
        status: 'deprecated',
      }),
    );
  });
});

describe('getRuleTemplate', () => {
  it('returns the active project rule template by default', () => {
    const template = getRuleTemplate({
      projectKey: 'aimetric',
    });

    expect(template.projectKey).toBe('aimetric');
    expect(template.version).toBe('v2');
    expect(template.sections).toContainEqual(
      expect.objectContaining({
        id: 'architecture',
      }),
    );
    expect(template.rules.must).toContain('architecture.article-congruent-layering');
    expect(template.rules.must).toContain('rule.template-versioning');
  });

  it('returns a specific historical rule template version', () => {
    const template = getRuleTemplate({
      projectKey: 'aimetric',
      version: 'v1',
    });

    expect(template.version).toBe('v1');
    expect(template.rules.must).not.toContain('rule.template-versioning');
  });
});

describe('validateRuleTemplate', () => {
  it('validates a versioned rule template loaded from the file catalog', () => {
    const validation = validateRuleTemplate({
      projectKey: 'aimetric',
      version: 'v2',
    });

    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(validation.activeVersion).toBe('v2');
  });
});

describe('setActiveRuleVersion', () => {
  it('switches the active rule template version in the manifest catalog', () => {
    const catalogRoot = createTemporaryCatalogRoot();

    const update = setActiveRuleVersion(
      {
        projectKey: 'aimetric',
        version: 'v1',
      },
      {
        catalogRoot,
      },
    );

    expect(update.previousVersion).toBe('v2');
    expect(update.activeVersion).toBe('v1');
    expect(
      listRuleVersions('aimetric', {
        catalogRoot,
      }).activeVersion,
    ).toBe('v1');
    expect(
      getProjectRulePack(
        {
          projectKey: 'aimetric',
          toolType: 'cursor',
          sceneType: 'api-change',
        },
        {
          catalogRoot,
        },
      ).version,
    ).toBe('v1');
  });
});

const createTemporaryCatalogRoot = (): string => {
  const catalogRoot = mkdtempSync(join(tmpdir(), 'aimetric-rule-catalog-'));
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
