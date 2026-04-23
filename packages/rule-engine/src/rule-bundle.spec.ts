import { describe, expect, it } from 'vitest';
import {
  getProjectRulePack,
  getRuleTemplate,
  listRuleVersions,
  resolveRuleBundle,
} from './rule-bundle.js';

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
    expect(rulePack.version).toBe('v1');
    expect(rulePack.mandatoryRules).toContain('core.style');
    expect(rulePack.knowledgeRefs).toContain(
      'docs/superpowers/specs/2026-04-22-aimetric-article-congruent-design.md',
    );
  });
});

describe('listRuleVersions', () => {
  it('returns available rule versions with active version metadata', () => {
    const versions = listRuleVersions('aimetric');

    expect(versions.activeVersion).toBe('v1');
    expect(versions.versions).toContainEqual(
      expect.objectContaining({
        version: 'v1',
        status: 'active',
      }),
    );
  });
});

describe('getRuleTemplate', () => {
  it('returns a versioned project rule template', () => {
    const template = getRuleTemplate({
      projectKey: 'aimetric',
      version: 'v1',
    });

    expect(template.projectKey).toBe('aimetric');
    expect(template.version).toBe('v1');
    expect(template.sections).toContainEqual(
      expect.objectContaining({
        id: 'architecture',
      }),
    );
    expect(template.rules.must).toContain('architecture.article-congruent-layering');
  });
});
