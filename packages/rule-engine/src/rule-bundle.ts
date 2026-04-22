type RuleContext = {
  projectType: string;
  toolType: string;
  sceneType: string;
};

export function resolveRuleBundle(_context: RuleContext) {
  const mandatoryRules = [
    'core.style',
    'core.comments',
    'mcp.before-after-recording'
  ];

  const onDemandRules =
    _context.sceneType === 'api-change' ? ['knowledge.api-doc'] : [];

  return {
    mandatoryRules,
    onDemandRules
  };
}
