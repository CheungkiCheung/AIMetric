type RuleContext = {
  projectKey?: string;
  projectType?: string;
  toolType: string;
  sceneType: string;
};

export interface ProjectRulePack {
  projectKey: string;
  version: string;
  mandatoryRules: string[];
  onDemandRules: string[];
  knowledgeRefs: string[];
  terminology: string[];
}

const projectRuleCatalog: Record<string, Omit<ProjectRulePack, 'mandatoryRules' | 'onDemandRules'> & {
  baseMandatoryRules: string[];
  sceneMandatoryRules: Record<string, string[]>;
  sceneOnDemandRules: Record<string, string[]>;
}> = {
  aimetric: {
    projectKey: 'aimetric',
    version: 'v1',
    baseMandatoryRules: [
      'core.style',
      'core.comments',
      'mcp.before-after-recording',
      'architecture.article-congruent-layering',
    ],
    sceneMandatoryRules: {
      'metric-analysis': ['metric.snapshot-recalculation'],
      'rule-query': ['rule.dynamic-resolution'],
    },
    sceneOnDemandRules: {
      'api-change': ['knowledge.api-doc'],
      'metric-analysis': ['knowledge.metric-calibration'],
      'rule-query': ['knowledge.project-rules'],
    },
    knowledgeRefs: [
      'docs/superpowers/specs/2026-04-22-aimetric-article-congruent-design.md',
      'docs/superpowers/plans/2026-04-23-aimetric-中文执行计划.md',
    ],
    terminology: [
      '采集平台层',
      '数据采集层',
      '平台能力层',
      '指标展示层',
      '规则中心',
      '知识库查询',
    ],
  },
};

const defaultProjectKey = 'aimetric';

export function resolveRuleBundle(context: RuleContext) {
  const projectKey = context.projectKey ?? defaultProjectKey;
  const projectConfig = projectRuleCatalog[projectKey] ?? projectRuleCatalog[defaultProjectKey];
  const mandatoryRules = [
    ...projectConfig.baseMandatoryRules,
    ...(projectConfig.sceneMandatoryRules[context.sceneType] ?? []),
  ];
  const onDemandRules = [
    ...(projectConfig.sceneOnDemandRules[context.sceneType] ?? []),
  ];

  return {
    mandatoryRules,
    onDemandRules,
  };
}

export function getProjectRulePack(
  context: Omit<RuleContext, 'projectType'> & { projectKey?: string },
): ProjectRulePack {
  const projectKey = context.projectKey ?? defaultProjectKey;
  const projectConfig = projectRuleCatalog[projectKey] ?? projectRuleCatalog[defaultProjectKey];
  const resolved = resolveRuleBundle(context);

  return {
    projectKey: projectConfig.projectKey,
    version: projectConfig.version,
    mandatoryRules: resolved.mandatoryRules,
    onDemandRules: resolved.onDemandRules,
    knowledgeRefs: projectConfig.knowledgeRefs,
    terminology: projectConfig.terminology,
  };
}
