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

export interface RuleVersionSummary {
  version: string;
  status: 'active' | 'deprecated';
  updatedAt: string;
  summary: string;
}

export interface RuleTemplateSection {
  id: string;
  title: string;
  content: string;
}

export interface ProjectRuleTemplate {
  projectKey: string;
  version: string;
  extends?: string;
  terminology: string[];
  sections: RuleTemplateSection[];
  rules: {
    must: string[];
    should: string[];
    onDemand: string[];
  };
}

type ProjectRuleCatalogEntry = Omit<ProjectRulePack, 'mandatoryRules' | 'onDemandRules'> & {
  baseMandatoryRules: string[];
  sceneMandatoryRules: Record<string, string[]>;
  sceneOnDemandRules: Record<string, string[]>;
  activeVersion: string;
  versions: RuleVersionSummary[];
  templates: Record<string, ProjectRuleTemplate>;
};

const projectRuleCatalog: Record<string, ProjectRuleCatalogEntry> = {
  aimetric: {
    projectKey: 'aimetric',
    version: 'v1',
    activeVersion: 'v1',
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
    versions: [
      {
        version: 'v1',
        status: 'active',
        updatedAt: '2026-04-23',
        summary: '文章同构 Phase 1/Phase 2 基础版规则模板',
      },
    ],
    templates: {
      v1: {
        projectKey: 'aimetric',
        version: 'v1',
        terminology: [
          '采集平台层',
          '数据采集层',
          '平台能力层',
          '指标展示层',
          '规则中心',
          '知识库查询',
        ],
        sections: [
          {
            id: 'architecture',
            title: '文章同构架构',
            content:
              '保持采集平台层、数据采集层、平台能力层、指标展示层四层边界，新增模块需优先挂靠现有分层术语。',
          },
          {
            id: 'metrics',
            title: '指标与快照',
            content:
              '涉及 AI 出码率、快照、回算、团队/个人口径时，优先复用现有指标平台与 PostgreSQL 快照链路。',
          },
          {
            id: 'mcp',
            title: 'MCP 工具约束',
            content:
              '所有新增工具优先走 MCP 标准化入口，并支持规则查询与知识查询的组合调用。',
          },
        ],
        rules: {
          must: [
            'core.style',
            'core.comments',
            'mcp.before-after-recording',
            'architecture.article-congruent-layering',
          ],
          should: [
            'metric.snapshot-recalculation',
            'rule.dynamic-resolution',
          ],
          onDemand: [
            'knowledge.api-doc',
            'knowledge.metric-calibration',
            'knowledge.project-rules',
          ],
        },
      },
    },
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

export function listRuleVersions(projectKey = defaultProjectKey) {
  const projectConfig = projectRuleCatalog[projectKey] ?? projectRuleCatalog[defaultProjectKey];

  return {
    projectKey: projectConfig.projectKey,
    activeVersion: projectConfig.activeVersion,
    versions: projectConfig.versions,
  };
}

export function getRuleTemplate(input: {
  projectKey?: string;
  version?: string;
}): ProjectRuleTemplate {
  const projectKey = input.projectKey ?? defaultProjectKey;
  const projectConfig = projectRuleCatalog[projectKey] ?? projectRuleCatalog[defaultProjectKey];
  const version = input.version ?? projectConfig.activeVersion;
  const template = projectConfig.templates[version];

  if (!template) {
    throw new Error(`Unknown rule template version: ${projectKey}@${version}`);
  }

  return template;
}
