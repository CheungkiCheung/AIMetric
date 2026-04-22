import { describe, expect, it } from 'vitest';
import { resolveRuleBundle } from './rule-bundle';

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
});
