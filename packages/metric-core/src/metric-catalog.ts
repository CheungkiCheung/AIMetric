export type EnterpriseMetricDimensionKey =
  | 'adoption'
  | 'effective-output'
  | 'delivery-efficiency'
  | 'quality-risk'
  | 'experience-capability'
  | 'business-value';

export type EnterpriseMetricAudience =
  | 'employee'
  | 'effectiveness-manager'
  | 'engineering-manager'
  | 'platform-admin';

export type EnterpriseMetricAutomationLevel = 'high' | 'medium' | 'low';

export type EnterpriseMetricDataSource =
  | 'mcp-events'
  | 'tool-adapter-events'
  | 'organization-directory'
  | 'git-provider'
  | 'pr-provider'
  | 'ci-provider'
  | 'deployment-provider'
  | 'defect-tracker'
  | 'delivery-tracker'
  | 'manual-survey'
  | 'cost-model'
  | 'incident-system';

export type EnterpriseMetricDashboardPlacement =
  | 'employee-experience'
  | 'effectiveness-management'
  | 'engineering-management'
  | 'platform-operations';

export type EnterpriseMetricAssessmentUsage =
  | 'observe-only'
  | 'team-improvement'
  | 'business-review';

export interface EnterpriseMetricDimension {
  key: EnterpriseMetricDimensionKey;
  name: string;
  question: string;
  primaryAudience: EnterpriseMetricAudience[];
}

export interface EnterpriseMetricDefinition {
  key: string;
  name: string;
  dimension: EnterpriseMetricDimensionKey;
  question: string;
  formula: string;
  dataSources: EnterpriseMetricDataSource[];
  automationLevel: EnterpriseMetricAutomationLevel;
  updateFrequency: string;
  dashboardPlacement: EnterpriseMetricDashboardPlacement;
  assessmentUsage: EnterpriseMetricAssessmentUsage;
  antiGamingNote: string;
}

export interface EnterpriseMetricCatalog {
  dimensions: EnterpriseMetricDimension[];
  metrics: EnterpriseMetricDefinition[];
}

const enterpriseMetricDimensions: EnterpriseMetricDimension[] = [
  {
    key: 'adoption',
    name: '使用渗透',
    question: 'AI 有没有真正被用起来',
    primaryAudience: ['effectiveness-manager', 'engineering-manager'],
  },
  {
    key: 'effective-output',
    name: '有效产出',
    question: 'AI 生成的内容有没有变成正式成果',
    primaryAudience: ['effectiveness-manager', 'engineering-manager'],
  },
  {
    key: 'delivery-efficiency',
    name: '交付效率',
    question: '用了 AI 之后，需求是否更快流向生产',
    primaryAudience: ['engineering-manager'],
  },
  {
    key: 'quality-risk',
    name: '质量与风险',
    question: '速度提升是否以返工或事故为代价',
    primaryAudience: ['engineering-manager', 'platform-admin'],
  },
  {
    key: 'experience-capability',
    name: '体验与能力',
    question: '开发者是否更轻松、更能学、更能协作',
    primaryAudience: ['effectiveness-manager', 'employee'],
  },
  {
    key: 'business-value',
    name: '业务与经济价值',
    question: 'AI 投入是否值得',
    primaryAudience: ['engineering-manager', 'effectiveness-manager'],
  },
];

const enterpriseMetrics: EnterpriseMetricDefinition[] = [
  {
    key: 'ai_ide_user_ratio',
    name: 'AI-IDE 使用人数比例',
    dimension: 'adoption',
    question: '目标开发者里有多少人真正使用了 AI-IDE。',
    formula: 'AI-IDE 活跃使用人数 / 目标开发者人数',
    dataSources: ['mcp-events', 'tool-adapter-events', 'organization-directory'],
    automationLevel: 'high',
    updateFrequency: 'daily',
    dashboardPlacement: 'effectiveness-management',
    assessmentUsage: 'observe-only',
    antiGamingNote: '只看比例容易鼓励刷打开次数，必须结合活跃天数、会话质量和有效产出一起看。',
  },
  {
    key: 'sdd_user_ratio',
    name: 'SDD 使用人数比例',
    dimension: 'adoption',
    question: '结构化需求驱动开发是否进入团队日常流程。',
    formula: 'SDD 活跃使用人数 / 目标开发者人数',
    dataSources: ['mcp-events', 'tool-adapter-events', 'organization-directory'],
    automationLevel: 'high',
    updateFrequency: 'daily',
    dashboardPlacement: 'effectiveness-management',
    assessmentUsage: 'observe-only',
    antiGamingNote: '不能单独用于个人排名，应结合需求覆盖率和交付结果判断真实采用。',
  },
  {
    key: 'weekly_active_ai_users',
    name: 'AI 周活人数',
    dimension: 'adoption',
    question: '本周有多少开发者在真实研发场景中使用 AI。',
    formula: '周期内发生有效 AI 会话或工具调用的去重成员数',
    dataSources: ['mcp-events', 'tool-adapter-events'],
    automationLevel: 'high',
    updateFrequency: 'daily',
    dashboardPlacement: 'effectiveness-management',
    assessmentUsage: 'observe-only',
    antiGamingNote: '有效会话需要满足最小轮次或编辑证据，避免空会话刷活跃。',
  },
  {
    key: 'ai_session_count',
    name: 'AI 会话数',
    dimension: 'adoption',
    question: '团队在哪些项目和场景中持续使用 AI。',
    formula: '周期内有效 AI 会话总数',
    dataSources: ['mcp-events', 'tool-adapter-events'],
    automationLevel: 'high',
    updateFrequency: 'near-real-time',
    dashboardPlacement: 'effectiveness-management',
    assessmentUsage: 'observe-only',
    antiGamingNote: '会话数必须与会话深度、编辑证据和采纳结果交叉分析。',
  },
  {
    key: 'tab_acceptance_ratio',
    name: 'Tab 接受占比',
    dimension: 'adoption',
    question: '补全类 AI 能力是否在编码热路径中被接受。',
    formula: 'Tab 接受次数 / Tab 建议次数',
    dataSources: ['tool-adapter-events'],
    automationLevel: 'medium',
    updateFrequency: 'daily',
    dashboardPlacement: 'effectiveness-management',
    assessmentUsage: 'observe-only',
    antiGamingNote: '不同工具建议次数口径不一致，跨工具对比时需要标注采集置信度。',
  },
  {
    key: 'ai_output_rate',
    name: 'AI 出码率',
    dimension: 'effective-output',
    question: 'AI 生成或辅助的代码在总代码变更中占多少。',
    formula: 'AI 采纳代码行数 / 提交总代码变更行数',
    dataSources: ['mcp-events', 'git-provider', 'tool-adapter-events'],
    automationLevel: 'high',
    updateFrequency: 'daily',
    dashboardPlacement: 'engineering-management',
    assessmentUsage: 'team-improvement',
    antiGamingNote: '出码率不是越高越好，必须同时看质量、返工和业务交付。',
  },
  {
    key: 'ai_code_acceptance_rate',
    name: 'AI 生成代码采纳率',
    dimension: 'effective-output',
    question: 'AI 建议中有多少进入了正式代码变更。',
    formula: '被采纳 AI 代码行数 / AI 建议代码行数',
    dataSources: ['mcp-events', 'tool-adapter-events', 'git-provider'],
    automationLevel: 'medium',
    updateFrequency: 'daily',
    dashboardPlacement: 'engineering-management',
    assessmentUsage: 'team-improvement',
    antiGamingNote: '建议代码行数依赖工具暴露能力，缺失时应标记为估算口径。',
  },
  {
    key: 'ai_touched_pr_ratio',
    name: 'AI 触达 PR 占比',
    dimension: 'effective-output',
    question: '有多少 PR 经过 AI 辅助。',
    formula: '包含 AI 编辑证据的 PR 数 / PR 总数',
    dataSources: ['git-provider', 'pr-provider', 'mcp-events'],
    automationLevel: 'medium',
    updateFrequency: 'daily',
    dashboardPlacement: 'engineering-management',
    assessmentUsage: 'team-improvement',
    antiGamingNote: 'PR 触达只能说明参与度，不能直接等价为产出提升。',
  },
  {
    key: 'ai_test_acceptance_rate',
    name: 'AI 测试采纳率',
    dimension: 'effective-output',
    question: 'AI 是否帮助团队补齐测试资产。',
    formula: 'AI 辅助生成并保留的测试代码行数 / 新增测试代码行数',
    dataSources: ['mcp-events', 'git-provider'],
    automationLevel: 'medium',
    updateFrequency: 'daily',
    dashboardPlacement: 'engineering-management',
    assessmentUsage: 'team-improvement',
    antiGamingNote: '测试代码需要结合通过率和缺陷趋势，避免只堆测试行数。',
  },
  {
    key: 'lead_time_ai_vs_non_ai',
    name: 'AI 参与需求 Lead Time 对比',
    dimension: 'delivery-efficiency',
    question: 'AI 参与需求是否比非 AI 需求更快流向生产。',
    formula: 'AI 参与需求平均 Lead Time 与非 AI 参与需求平均 Lead Time 的差异',
    dataSources: ['delivery-tracker', 'pr-provider', 'deployment-provider', 'mcp-events'],
    automationLevel: 'medium',
    updateFrequency: 'daily',
    dashboardPlacement: 'engineering-management',
    assessmentUsage: 'team-improvement',
    antiGamingNote: '必须按需求规模和类型分层对比，避免简单平均造成误判。',
  },
  {
    key: 'pr_cycle_time',
    name: 'PR 周转时间',
    dimension: 'delivery-efficiency',
    question: 'AI 是否缩短从创建 PR 到合入的周期。',
    formula: 'PR 合入时间 - PR 创建时间',
    dataSources: ['pr-provider'],
    automationLevel: 'high',
    updateFrequency: 'daily',
    dashboardPlacement: 'engineering-management',
    assessmentUsage: 'team-improvement',
    antiGamingNote: '需剔除等待发布窗口、冻结期等非研发因素。',
  },
  {
    key: 'deployment_frequency',
    name: '部署频率',
    dimension: 'delivery-efficiency',
    question: 'AI 是否帮助团队更稳定地小步快跑。',
    formula: '周期内生产部署次数',
    dataSources: ['deployment-provider'],
    automationLevel: 'medium',
    updateFrequency: 'daily',
    dashboardPlacement: 'engineering-management',
    assessmentUsage: 'business-review',
    antiGamingNote: '部署频率必须结合变更失败率，否则可能鼓励高风险频繁发布。',
  },
  {
    key: 'ci_pass_rate',
    name: '测试通过率',
    dimension: 'quality-risk',
    question: 'AI 参与是否影响自动化测试稳定性。',
    formula: '通过的 CI 运行数 / CI 运行总数',
    dataSources: ['ci-provider', 'pr-provider'],
    automationLevel: 'high',
    updateFrequency: 'near-real-time',
    dashboardPlacement: 'engineering-management',
    assessmentUsage: 'team-improvement',
    antiGamingNote: '需要区分基础设施失败和代码失败，避免错误归因。',
  },
  {
    key: 'review_rejection_rate',
    name: 'Review 退回率',
    dimension: 'quality-risk',
    question: 'AI 代码是否增加 Review 返工。',
    formula: '被请求修改的 PR 数 / Review PR 总数',
    dataSources: ['pr-provider'],
    automationLevel: 'medium',
    updateFrequency: 'daily',
    dashboardPlacement: 'engineering-management',
    assessmentUsage: 'team-improvement',
    antiGamingNote: '不同团队 Review 严格度不同，跨团队对比需谨慎。',
  },
  {
    key: 'change_failure_rate',
    name: '变更失败率',
    dimension: 'quality-risk',
    question: 'AI 加速是否带来生产失败。',
    formula: '导致事故、回滚或热修的部署数 / 部署总数',
    dataSources: ['deployment-provider', 'incident-system'],
    automationLevel: 'medium',
    updateFrequency: 'daily',
    dashboardPlacement: 'engineering-management',
    assessmentUsage: 'business-review',
    antiGamingNote: '需要把 AI 参与作为归因维度之一，而不是把事故简单归咎于 AI。',
  },
  {
    key: 'ai_satisfaction_score',
    name: 'AI 使用满意度',
    dimension: 'experience-capability',
    question: '开发者是否认为 AI 真正降低了工作摩擦。',
    formula: '周期内 AI 工具满意度问卷平均分',
    dataSources: ['manual-survey'],
    automationLevel: 'low',
    updateFrequency: 'monthly',
    dashboardPlacement: 'employee-experience',
    assessmentUsage: 'observe-only',
    antiGamingNote: '问卷只用于体验洞察，不应作为个人绩效依据。',
  },
  {
    key: 'non_ai_usage_reason',
    name: '不用 AI 开发原因分布',
    dimension: 'experience-capability',
    question: '阻碍 AI 进入研发场景的真实原因是什么。',
    formula: '按原因分类统计未使用 AI 的反馈数量',
    dataSources: ['manual-survey', 'tool-adapter-events'],
    automationLevel: 'low',
    updateFrequency: 'monthly',
    dashboardPlacement: 'effectiveness-management',
    assessmentUsage: 'observe-only',
    antiGamingNote: '原因分类应允许匿名聚合，避免给员工造成被追责感。',
  },
  {
    key: 'newcomer_onboarding_time',
    name: '新人上手时间',
    dimension: 'experience-capability',
    question: 'AI 和知识库是否帮助新人更快完成首次有效交付。',
    formula: '新人入组到首次合入有效 PR 的周期',
    dataSources: ['organization-directory', 'pr-provider', 'delivery-tracker'],
    automationLevel: 'medium',
    updateFrequency: 'weekly',
    dashboardPlacement: 'engineering-management',
    assessmentUsage: 'team-improvement',
    antiGamingNote: '需要按岗位、项目复杂度和导师投入分层解释。',
  },
  {
    key: 'unit_requirement_cost',
    name: '单位需求成本',
    dimension: 'business-value',
    question: 'AI 投入是否降低单位需求交付成本。',
    formula: '周期内研发人力成本与工具成本 / 完成需求数',
    dataSources: ['delivery-tracker', 'cost-model', 'organization-directory'],
    automationLevel: 'medium',
    updateFrequency: 'monthly',
    dashboardPlacement: 'engineering-management',
    assessmentUsage: 'business-review',
    antiGamingNote: '成本模型必须透明，避免用粗糙估算压缩必要工程质量投入。',
  },
  {
    key: 'estimated_efficiency_gain',
    name: '提效预估',
    dimension: 'business-value',
    question: 'AI 带来的时间节省大致转化为多少经营价值。',
    formula: 'AI 辅助节省工时估算 * 标准人力成本系数',
    dataSources: ['mcp-events', 'delivery-tracker', 'cost-model'],
    automationLevel: 'medium',
    updateFrequency: 'monthly',
    dashboardPlacement: 'effectiveness-management',
    assessmentUsage: 'business-review',
    antiGamingNote: '提效预估只能用于趋势和投资决策，不能替代真实交付结果。',
  },
  {
    key: 'critical_requirement_cycle_time',
    name: '关键需求周期',
    dimension: 'business-value',
    question: 'AI 是否缩短关键业务需求的端到端周期。',
    formula: '关键需求从确认到上线的平均周期',
    dataSources: ['delivery-tracker', 'deployment-provider'],
    automationLevel: 'medium',
    updateFrequency: 'monthly',
    dashboardPlacement: 'engineering-management',
    assessmentUsage: 'business-review',
    antiGamingNote: '必须由业务优先级标记关键需求，避免事后挑选样本。',
  },
];

const cloneDimension = (
  dimension: EnterpriseMetricDimension,
): EnterpriseMetricDimension => ({
  ...dimension,
  primaryAudience: [...dimension.primaryAudience],
});

const cloneMetric = (
  metric: EnterpriseMetricDefinition,
): EnterpriseMetricDefinition => ({
  ...metric,
  dataSources: [...metric.dataSources],
});

export const listEnterpriseMetricDimensions = (): EnterpriseMetricDimension[] =>
  enterpriseMetricDimensions.map(cloneDimension);

export const getEnterpriseMetricCatalog = (): EnterpriseMetricCatalog => ({
  dimensions: listEnterpriseMetricDimensions(),
  metrics: enterpriseMetrics.map(cloneMetric),
});

export const listEnterpriseMetricsByDimension = (
  dimension: EnterpriseMetricDimensionKey,
): EnterpriseMetricDefinition[] =>
  enterpriseMetrics
    .filter((metric) => metric.dimension === dimension)
    .map(cloneMetric);
