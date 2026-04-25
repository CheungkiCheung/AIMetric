import type {
  AnalysisSummary,
  CollectorIngestionHealth,
  DashboardFilters,
  DefectAttributionSummary,
  DeploymentSummary,
  GovernanceDirectory,
  McpAuditMetrics,
  MetricCalculationResult,
  PullRequestSummary,
  RequirementSummary,
  TeamSnapshot,
} from '../api/client.js';

export interface EffectivenessManagerCockpitProps {
  filters: DashboardFilters;
  selectedWindowDays: number;
  onSelectWindow: (days: number) => void;
  metricValues: MetricCalculationResult[];
  metricSnapshots: MetricCalculationResult[];
  teamSnapshot: TeamSnapshot;
  analysisSummary: AnalysisSummary;
  requirementSummary: RequirementSummary;
  pullRequestSummary: PullRequestSummary;
  deploymentSummary: DeploymentSummary;
  defectAttributionSummary: DefectAttributionSummary;
  collectorHealth: CollectorIngestionHealth;
  governanceDirectory: GovernanceDirectory;
  mcpAuditMetrics: McpAuditMetrics;
}

type ToolStatus = 'active' | 'ready' | 'planned';

interface ToolCard {
  key: string;
  label: string;
  category: string;
  status: ToolStatus;
  collectionMode: string;
  confidence: string;
  value: string;
  description: string;
  signals: string[];
}

const sectionStyle = {
  borderRadius: '34px',
  padding: '30px',
  background: 'linear-gradient(180deg, rgba(248, 250, 252, 0.96), rgba(241, 245, 249, 0.94))',
  border: '1px solid rgba(15, 23, 42, 0.08)',
  boxShadow: '0 28px 72px rgba(15, 23, 42, 0.08)',
};

const darkHeroStyle = {
  ...sectionStyle,
  background:
    'radial-gradient(circle at top right, rgba(56, 189, 248, 0.22), transparent 30%), radial-gradient(circle at top left, rgba(20, 184, 166, 0.18), transparent 24%), linear-gradient(180deg, #0f172a 0%, #111c32 56%, #172554 100%)',
  border: '1px solid rgba(103, 232, 249, 0.14)',
  color: '#e5eef9',
  boxShadow: '0 32px 84px rgba(15, 23, 42, 0.28)',
};

const gridStyle = {
  display: 'grid',
  gap: '18px',
};

const heroMetricGridStyle = {
  ...gridStyle,
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  marginTop: '24px',
};

const toolGridStyle = {
  ...gridStyle,
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
};

const splitGridStyle = {
  ...gridStyle,
  gridTemplateColumns: 'minmax(0, 1.35fr) minmax(320px, 0.9fr)',
};

const cardStyle = {
  borderRadius: '24px',
  padding: '20px',
  background: 'rgba(255, 255, 255, 0.84)',
  border: '1px solid rgba(15, 23, 42, 0.07)',
};

const darkCardStyle = {
  borderRadius: '24px',
  padding: '20px',
  background: 'rgba(255, 255, 255, 0.07)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
};

const windowOptions = [7, 30, 90];

const titleByMetricKey: Record<string, string> = {
  ai_output_rate: '编码热路径渗透',
  lead_time_ai_vs_non_ai: 'AI 需求周期改善',
  ci_pass_rate: 'CI 稳定性',
  change_failure_rate: '变更失败率',
  defect_rate: '缺陷率',
  critical_requirement_cycle_time: '关键需求周期',
};

const formatValue = (value: number, unit: MetricCalculationResult['unit']) => {
  if (unit === 'ratio') {
    return `${(value * 100).toFixed(1)}%`;
  }

  if (unit === 'hours') {
    return `${value.toFixed(1)} 小时`;
  }

  return new Intl.NumberFormat('zh-CN').format(value);
};

const formatRatio = (value: number) => `${(value * 100).toFixed(1)}%`;

const formatStatusLabel = (status: ToolStatus) => {
  if (status === 'active') {
    return '已接入';
  }

  if (status === 'ready') {
    return '接入就绪';
  }

  return '规划中';
};

const statusStyleByState: Record<
  ToolStatus,
  { background: string; color: string; border: string }
> = {
  active: {
    background: 'rgba(20, 184, 166, 0.14)',
    color: '#0f766e',
    border: '1px solid rgba(20, 184, 166, 0.24)',
  },
  ready: {
    background: 'rgba(59, 130, 246, 0.12)',
    color: '#1d4ed8',
    border: '1px solid rgba(59, 130, 246, 0.2)',
  },
  planned: {
    background: 'rgba(148, 163, 184, 0.16)',
    color: '#475569',
    border: '1px solid rgba(148, 163, 184, 0.22)',
  },
};

const findMetric = (values: MetricCalculationResult[], metricKey: string) =>
  values.find((value) => value.metricKey === metricKey);

const sparklinePath = (values: number[], width = 220, height = 72) => {
  if (values.length === 0) {
    return '';
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
};

const buildTrendCards = (snapshots: MetricCalculationResult[]) => {
  const groups = new Map<string, MetricCalculationResult[]>();

  snapshots.forEach((snapshot) => {
    const current = groups.get(snapshot.metricKey) ?? [];
    current.push(snapshot);
    groups.set(snapshot.metricKey, current);
  });

  return [...groups.entries()]
    .map(([metricKey, rows]) => {
      const orderedRows = [...rows].sort((left, right) =>
        left.periodEnd.localeCompare(right.periodEnd),
      );
      const latest = orderedRows.at(-1);
      const previous = orderedRows.at(-2);

      if (!latest) {
        return undefined;
      }

      return {
        metricKey,
        name: titleByMetricKey[metricKey] ?? latest.definition.name,
        latestValue: latest.value,
        unit: latest.unit,
        change:
          previous === undefined ? undefined : latest.value - previous.value,
        path: sparklinePath(orderedRows.map((row) => row.value)),
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value));
};

const buildToolCards = ({
  teamSnapshot,
  analysisSummary,
  collectorHealth,
  mcpAuditMetrics,
}: Pick<
  EffectivenessManagerCockpitProps,
  'teamSnapshot' | 'analysisSummary' | 'collectorHealth' | 'mcpAuditMetrics'
>): ToolCard[] => [
  {
    key: 'cursor',
    label: 'Cursor',
    category: 'AI-IDE',
    status: teamSnapshot.totalSessionCount > 0 ? 'active' : 'ready',
    collectionMode: 'local-db + transcript',
    confidence: '高覆盖采集',
    value: `${teamSnapshot.totalSessionCount} 会话`,
    description: '当前最完整的热路径采集工具，支持会话、编辑证据与 Tab 接受。',
    signals: ['会话', '编辑证据', 'Tab', 'identity', 'outbox'],
  },
  {
    key: 'mcp',
    label: 'MCP 工具链',
    category: '平台能力',
    status: mcpAuditMetrics.totalToolCalls > 0 ? 'active' : 'ready',
    collectionMode: 'mcp runtime',
    confidence: '核心采集链路',
    value: formatRatio(mcpAuditMetrics.successRate),
    description: '承接规则查询、知识查询和工具调用审计，是统一采集主链路。',
    signals: ['工具审计', '规则中心', '知识查询'],
  },
  {
    key: 'cli',
    label: 'CLI Agent',
    category: '命令行',
    status: analysisSummary.sessionCount > 0 ? 'active' : 'ready',
    collectionMode: 'cli adapter',
    confidence: '标准接入档',
    value: `${analysisSummary.sessionCount} 会话`,
    description: '适合命令行型 AI 工具和内部脚本化提效工具的统一采集。',
    signals: ['会话', 'outbox', 'collector token'],
  },
  {
    key: 'codex-cli',
    label: 'Codex CLI',
    category: 'Agent CLI',
    status: 'ready',
    collectionMode: 'manifest + env onboarding',
    confidence: '接入就绪',
    value: '已具备 onboarding',
    description: '已具备轻量接入档，适合从试点团队扩展到更广泛的 CLI 场景。',
    signals: ['接入配置', 'identity', 'collector sdk'],
  },
  {
    key: 'claude-code',
    label: 'Claude Code',
    category: 'Agent CLI',
    status: 'ready',
    collectionMode: 'manifest + env onboarding',
    confidence: '接入就绪',
    value: '已具备 onboarding',
    description: '可纳入统一身份、统一 outbox 和统一 collector-gateway 采集链路。',
    signals: ['接入配置', 'identity', 'collector sdk'],
  },
  {
    key: 'vscode-jetbrains',
    label: 'VS Code / JetBrains',
    category: 'IDE',
    status: 'ready',
    collectionMode: 'profile onboarding',
    confidence: '扩展入口',
    value: '已支持 profile',
    description: '当前以轻量接入为主，为后续插件或扩展侧深采集预留入口。',
    signals: ['接入配置', 'tool profile', 'collector token'],
  },
  {
    key: 'gateway',
    label: 'Collector Gateway',
    category: '采集基础设施',
    status:
      collectorHealth.failedForwardTotal > 0 ||
      collectorHealth.deadLetterDepth > 0
        ? 'active'
        : 'ready',
    collectionMode: collectorHealth.deliveryMode,
    confidence: collectorHealth.queueBackend === 'file' ? '持久队列' : '内存队列',
    value: `${collectorHealth.forwardedTotal} 已投递`,
    description: '负责统一吸收多工具事件，支撑异步投递、DLQ 与采集健康诊断。',
    signals: ['queue', 'DLQ', 'flush', 'health'],
  },
];

const buildActionItems = ({
  requirementSummary,
  pullRequestSummary,
  deploymentSummary,
  defectAttributionSummary,
  collectorHealth,
  toolCards,
}: {
  requirementSummary: RequirementSummary;
  pullRequestSummary: PullRequestSummary;
  deploymentSummary: DeploymentSummary;
  defectAttributionSummary: DefectAttributionSummary;
  collectorHealth: CollectorIngestionHealth;
  toolCards: ToolCard[];
}) => {
  const readyOnlyTools = toolCards.filter((tool) => tool.status === 'ready');
  const items: Array<{
    title: string;
    emphasis: string;
    body: string;
  }> = [];

  if (readyOnlyTools.length > 0) {
    items.push({
      title: '仍有工具停留在“接入就绪”',
      emphasis: `${readyOnlyTools.length} 个工具未进入活跃采集`,
      body: `建议优先推进 ${readyOnlyTools
        .slice(0, 3)
        .map((tool) => tool.label)
        .join('、')} 的试点接入，避免平台只度量到单一工具。`,
    });
  }

  if (requirementSummary.aiTouchedRequirementRatio < 0.5) {
    items.push({
      title: '工具影响还没有进入需求环节',
      emphasis: `AI 触达需求占比 ${formatRatio(requirementSummary.aiTouchedRequirementRatio)}`,
      body: '说明多数工具目前还停留在编码后段，提效管理者需要补前置场景推广。',
    });
  }

  if (pullRequestSummary.aiTouchedPrRatio < 0.6) {
    items.push({
      title: '工具使用尚未稳定转化到 PR',
      emphasis: `AI 触达 PR 占比 ${formatRatio(pullRequestSummary.aiTouchedPrRatio)}`,
      body: '需要进一步看哪些团队只安装了工具，但没有真正进入交付链路。',
    });
  }

  if (deploymentSummary.changeFailureRate > 0.3) {
    items.push({
      title: '工具提效与发布风险需要一起看',
      emphasis: `变更失败率 ${formatRatio(deploymentSummary.changeFailureRate)}`,
      body: '建议把发布失败团队与高使用团队对照，避免把提效误判为纯正向收益。',
    });
  }

  if (
    defectAttributionSummary.escapedAiTouchedPullRequestDefectRate > 0.25 ||
    collectorHealth.deadLetterDepth > 0
  ) {
    items.push({
      title: '质量归因与采集健康都需要关注',
      emphasis: `逃逸缺陷率 ${formatRatio(
        defectAttributionSummary.escapedAiTouchedPullRequestDefectRate,
      )} / DLQ ${collectorHealth.deadLetterDepth}`,
      body: '先保证采集链路稳定，再做工具效果判断，避免在不完整数据上做组织决策。',
    });
  }

  return items;
};

const progressBarStyle = (ratio: number, color: string) => ({
  width: `${Math.max(6, Math.min(100, ratio * 100))}%`,
  height: '10px',
  borderRadius: '999px',
  background: color,
});

export const EffectivenessManagerCockpit = ({
  filters,
  selectedWindowDays,
  onSelectWindow,
  metricValues,
  metricSnapshots,
  teamSnapshot,
  analysisSummary,
  requirementSummary,
  pullRequestSummary,
  deploymentSummary,
  defectAttributionSummary,
  collectorHealth,
  governanceDirectory,
  mcpAuditMetrics,
}: EffectivenessManagerCockpitProps) => {
  const toolCards = buildToolCards({
    teamSnapshot,
    analysisSummary,
    collectorHealth,
    mcpAuditMetrics,
  });
  const activeToolCount = toolCards.filter((tool) => tool.status === 'active').length;
  const readyToolCount = toolCards.filter((tool) => tool.status === 'ready').length;
  const enterpriseScopeLabel = `${governanceDirectory.teams.length} 团队 / ${governanceDirectory.projects.length} 项目`;
  const trendCards = buildTrendCards(metricSnapshots).slice(0, 4);
  const actionItems = buildActionItems({
    requirementSummary,
    pullRequestSummary,
    deploymentSummary,
    defectAttributionSummary,
    collectorHealth,
    toolCards,
  });
  const toolSignals = [
    {
      label: '编码热路径',
      ratio: findMetric(metricValues, 'ai_output_rate')?.value ?? 0,
      detail: 'AI 是否真正进入代码生成与采纳过程',
      color: 'linear-gradient(90deg, #14b8a6, #22d3ee)',
    },
    {
      label: '需求环节',
      ratio: requirementSummary.aiTouchedRequirementRatio,
      detail: '工具是否前移到需求分析、拆解与澄清',
      color: 'linear-gradient(90deg, #38bdf8, #60a5fa)',
    },
    {
      label: 'PR 环节',
      ratio: pullRequestSummary.aiTouchedPrRatio,
      detail: '工具使用是否稳定转化为正式交付物',
      color: 'linear-gradient(90deg, #818cf8, #a78bfa)',
    },
    {
      label: '发布环节',
      ratio:
        deploymentSummary.totalDeploymentCount === 0
          ? 0
          : deploymentSummary.aiTouchedDeploymentCount /
            deploymentSummary.totalDeploymentCount,
      detail: '工具影响是否贯穿到上线和变更流程',
      color: 'linear-gradient(90deg, #f59e0b, #fb7185)',
    },
  ];

  const heroMetrics = [
    {
      label: '接入工具资产',
      value: `${toolCards.length}`,
      helper: '当前平台已纳入度量的 AI 工具与接入档',
    },
    {
      label: '活跃采集链路',
      value: `${activeToolCount}`,
      helper: `${readyToolCount} 个工具仍处于接入就绪状态`,
    },
    {
      label: '自动化信号面',
      value: '8 类',
      helper: '会话、编辑、需求、PR、CI、发布、事故、缺陷',
    },
    {
      label: '当前组织范围',
      value: enterpriseScopeLabel,
      helper: '提效管理者默认查看被授权的组织视角',
    },
  ];

  return (
    <section style={darkHeroStyle}>
      <div style={splitGridStyle}>
        <div style={{ display: 'grid', gap: '18px' }}>
          <div>
            <p
              style={{
                margin: 0,
                fontSize: '12px',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#67e8f9',
              }}
            >
              AI Tool Measurement Cockpit
            </p>
            <h1 style={{ margin: '14px 0 10px', fontSize: '44px', lineHeight: 1.02 }}>
              提效管理者 AI 工具度量驾驶舱
            </h1>
            <p style={{ margin: 0, color: '#c7d6ea', fontSize: '16px', lineHeight: 1.75 }}>
              首页不是看单一指标，而是看公司内部 AI 提效工具的资产盘点、采集覆盖、
              场景进入度、提效结果与质量代价，帮助提效管理者判断哪些工具值得继续投入。
            </p>
          </div>

          <div style={heroMetricGridStyle}>
            {heroMetrics.map((metric) => (
              <article key={metric.label} style={darkCardStyle}>
                <p style={{ margin: 0, color: '#8be0ea', fontSize: '13px' }}>{metric.label}</p>
                <strong style={{ display: 'block', marginTop: '10px', fontSize: '28px' }}>
                  {metric.value}
                </strong>
                <p style={{ margin: '8px 0 0', color: '#cad8ea', fontSize: '13px' }}>
                  {metric.helper}
                </p>
              </article>
            ))}
          </div>
        </div>

        <aside style={{ ...darkCardStyle, minWidth: 0 }}>
          <p style={{ margin: 0, color: '#8be0ea', fontSize: '13px' }}>观察窗口与项目口径</p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
            {windowOptions.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => onSelectWindow(days)}
                style={{
                  borderRadius: '999px',
                  border:
                    days === selectedWindowDays
                      ? '1px solid rgba(103, 232, 249, 0.75)'
                      : '1px solid rgba(255, 255, 255, 0.12)',
                  background:
                    days === selectedWindowDays ? '#ecfeff' : 'rgba(255, 255, 255, 0.06)',
                  color: days === selectedWindowDays ? '#0f172a' : '#e5eef9',
                  padding: '10px 16px',
                  font: 'inherit',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                近 {days} 天
              </button>
            ))}
          </div>
          <div style={{ marginTop: '18px', display: 'grid', gap: '12px' }}>
            <div>
              <p style={{ margin: 0, color: '#8be0ea', fontSize: '12px' }}>当前项目</p>
              <strong style={{ display: 'block', marginTop: '6px', fontSize: '20px' }}>
                {filters.projectKey ?? '全部项目'}
              </strong>
            </div>
            <div>
              <p style={{ margin: 0, color: '#8be0ea', fontSize: '12px' }}>当前判断</p>
              <p style={{ margin: '6px 0 0', color: '#dbe7f6', lineHeight: 1.7 }}>
                重点先看工具是否进入需求、PR 和发布环节，再决定要不要扩大工具覆盖面。
              </p>
            </div>
          </div>
        </aside>
      </div>

      <section style={{ ...sectionStyle, marginTop: '24px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
            alignItems: 'baseline',
          }}
        >
          <div>
            <p style={{ margin: 0, color: '#4f46e5', fontSize: '13px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Tool Portfolio
            </p>
            <h2 style={{ margin: '10px 0 0', fontSize: '30px', color: '#0f172a' }}>
              AI 工具资产与采集覆盖
            </h2>
          </div>
          <p style={{ margin: 0, color: '#475569', fontSize: '14px' }}>
            区分“已接入”“接入就绪”“规划中”，避免把工具资产和真实使用效果混为一谈。
          </p>
        </div>

        <div style={{ ...toolGridStyle, marginTop: '20px' }}>
          {toolCards.map((tool) => (
            <article key={tool.key} style={cardStyle}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '12px',
                  alignItems: 'flex-start',
                }}
              >
                <div>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '12px' }}>{tool.category}</p>
                  <h3 style={{ margin: '8px 0 0', fontSize: '24px', color: '#0f172a' }}>
                    {tool.label}
                  </h3>
                </div>
                <span
                  style={{
                    ...statusStyleByState[tool.status],
                    borderRadius: '999px',
                    padding: '6px 10px',
                    fontSize: '12px',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatStatusLabel(tool.status)}
                </span>
              </div>
              <p style={{ margin: '12px 0 0', color: '#0f172a', fontSize: '28px', fontWeight: 700 }}>
                {tool.value}
              </p>
              <p style={{ margin: '8px 0 0', color: '#475569', lineHeight: 1.7 }}>
                {tool.description}
              </p>
              <div style={{ display: 'grid', gap: '6px', marginTop: '16px' }}>
                <span style={{ color: '#475569', fontSize: '13px' }}>
                  采集方式：{tool.collectionMode}
                </span>
                <span style={{ color: '#475569', fontSize: '13px' }}>
                  当前判断：{tool.confidence}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
                {tool.signals.map((signal) => (
                  <span
                    key={signal}
                    style={{
                      borderRadius: '999px',
                      padding: '6px 10px',
                      background: '#eef2ff',
                      color: '#4338ca',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    {signal}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section style={{ ...sectionStyle, marginTop: '24px' }}>
        <div style={splitGridStyle}>
          <div>
            <p style={{ margin: 0, color: '#0f766e', fontSize: '13px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Scenario Penetration
            </p>
            <h2 style={{ margin: '10px 0 0', fontSize: '30px', color: '#0f172a' }}>
              工具进入研发链路的深度
            </h2>
            <div style={{ display: 'grid', gap: '16px', marginTop: '20px' }}>
              {toolSignals.map((signal) => (
                <article
                  key={signal.label}
                  style={{
                    borderRadius: '22px',
                    padding: '18px',
                    background: '#f8fafc',
                    border: '1px solid rgba(15, 23, 42, 0.06)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '12px',
                      alignItems: 'center',
                      marginBottom: '10px',
                    }}
                  >
                    <strong style={{ fontSize: '18px', color: '#0f172a' }}>{signal.label}</strong>
                    <span style={{ fontSize: '15px', color: '#0f172a', fontWeight: 700 }}>
                      {formatRatio(signal.ratio)}
                    </span>
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: '10px',
                      borderRadius: '999px',
                      background: '#e2e8f0',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={progressBarStyle(signal.ratio, signal.color)} />
                  </div>
                  <p style={{ margin: '10px 0 0', color: '#475569', lineHeight: 1.7 }}>
                    {signal.detail}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gap: '18px' }}>
            <article style={cardStyle}>
              <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>Tool Impact Funnel</p>
              <h3 style={{ margin: '10px 0 0', fontSize: '26px', color: '#0f172a' }}>
                工具度量漏斗
              </h3>
              <div style={{ display: 'grid', gap: '12px', marginTop: '18px' }}>
                {[
                  ['工具资产', `${toolCards.length}`],
                  ['活跃链路', `${activeToolCount}`],
                  ['进入需求', `${requirementSummary.aiTouchedRequirementCount}`],
                  ['进入 PR', `${pullRequestSummary.aiTouchedPrCount}`],
                  ['进入发布', `${deploymentSummary.aiTouchedDeploymentCount}`],
                  [
                    '触发质量预警',
                    `${defectAttributionSummary.escapedAiTouchedPullRequestDefectCount}`,
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '12px',
                      paddingBottom: '10px',
                      borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
                    }}
                  >
                    <span style={{ color: '#475569' }}>{label}</span>
                    <strong style={{ color: '#0f172a' }}>{value}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article style={cardStyle}>
              <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>Measurement Balance</p>
              <h3 style={{ margin: '10px 0 0', fontSize: '26px', color: '#0f172a' }}>
                提效结果与质量代价
              </h3>
              <div style={{ display: 'grid', gap: '14px', marginTop: '18px' }}>
                <div>
                  <p style={{ margin: 0, color: '#0f172a', fontWeight: 700 }}>关键需求周期</p>
                  <p style={{ margin: '6px 0 0', color: '#475569' }}>
                    {formatValue(
                      findMetric(metricValues, 'critical_requirement_cycle_time')?.value ?? 0,
                      'hours',
                    )}
                  </p>
                </div>
                <div>
                  <p style={{ margin: 0, color: '#0f172a', fontWeight: 700 }}>CI 通过率</p>
                  <p style={{ margin: '6px 0 0', color: '#475569' }}>
                    {formatValue(findMetric(metricValues, 'ci_pass_rate')?.value ?? 0, 'ratio')}
                  </p>
                </div>
                <div>
                  <p style={{ margin: 0, color: '#0f172a', fontWeight: 700 }}>AI PR 逃逸缺陷率</p>
                  <p style={{ margin: '6px 0 0', color: '#475569' }}>
                    {formatRatio(
                      defectAttributionSummary.escapedAiTouchedPullRequestDefectRate,
                    )}
                  </p>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section style={{ ...sectionStyle, marginTop: '24px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
            alignItems: 'baseline',
          }}
        >
          <div>
            <p style={{ margin: 0, color: '#7c3aed', fontSize: '13px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Measurement Trends
            </p>
            <h2 style={{ margin: '10px 0 0', fontSize: '30px', color: '#0f172a' }}>
              工具度量趋势
            </h2>
          </div>
          <p style={{ margin: 0, color: '#475569', fontSize: '14px' }}>
            趋势用于判断工具效果是否持续改善，而不是只看单日结果。
          </p>
        </div>

        <div style={{ ...toolGridStyle, marginTop: '20px' }}>
          {trendCards.length > 0 ? (
            trendCards.map((card) => (
              <article key={card.metricKey} style={cardStyle}>
                <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>{card.name}</p>
                <strong style={{ display: 'block', marginTop: '10px', fontSize: '28px', color: '#0f172a' }}>
                  {formatValue(card.latestValue, card.unit)}
                </strong>
                <svg viewBox="0 0 220 72" width="100%" height="76" style={{ marginTop: '12px' }}>
                  <path
                    d={card.path}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
                <p style={{ margin: '6px 0 0', color: '#475569', fontSize: '13px' }}>
                  {card.change === undefined
                    ? '当前仅有一个趋势点'
                    : `较上一周期 ${
                        card.unit === 'ratio'
                          ? `${(card.change * 100).toFixed(1)}%`
                          : `${card.change.toFixed(1)} ${card.unit === 'hours' ? '小时' : ''}`
                      }`}
                </p>
              </article>
            ))
          ) : (
            <article style={cardStyle}>
              <strong style={{ color: '#0f172a' }}>趋势快照暂不可用</strong>
              <p style={{ margin: '10px 0 0', color: '#475569', lineHeight: 1.7 }}>
                当前环境还没有足够的企业指标快照。可以先执行回算，再观察工具度量的连续变化。
              </p>
            </article>
          )}
        </div>
      </section>

      <section style={{ ...sectionStyle, marginTop: '24px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
            alignItems: 'baseline',
          }}
        >
          <div>
            <p style={{ margin: 0, color: '#b45309', fontSize: '13px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Action Board
            </p>
            <h2 style={{ margin: '10px 0 0', fontSize: '30px', color: '#0f172a' }}>
              提效管理者关注清单
            </h2>
          </div>
          <p style={{ margin: 0, color: '#475569', fontSize: '14px' }}>
            先看哪些工具值得扩大，哪些工具需要补采集或补质量护栏。
          </p>
        </div>

        <div style={{ ...toolGridStyle, marginTop: '20px' }}>
          {actionItems.map((item) => (
            <article
              key={item.title}
              style={{
                borderRadius: '24px',
                padding: '20px',
                background: '#fffaf0',
                border: '1px solid rgba(217, 119, 6, 0.18)',
              }}
            >
              <p style={{ margin: 0, color: '#92400e', fontSize: '13px', fontWeight: 700 }}>
                {item.title}
              </p>
              <strong style={{ display: 'block', marginTop: '10px', fontSize: '24px', color: '#451a03' }}>
                {item.emphasis}
              </strong>
              <p style={{ margin: '10px 0 0', color: '#78350f', lineHeight: 1.7 }}>
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
};
