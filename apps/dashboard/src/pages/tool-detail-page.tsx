import type {
  AnalysisSummary,
  CollectorIngestionHealth,
  DefectAttributionSummary,
  DeploymentSummary,
  McpAuditMetrics,
  PullRequestSummary,
  RequirementSummary,
  TeamSnapshot,
} from '../api/client.js';

interface ToolDetailPageProps {
  toolKey: string;
  onBack: () => void;
  teamSnapshot: TeamSnapshot;
  analysisSummary: AnalysisSummary;
  requirementSummary: RequirementSummary;
  pullRequestSummary: PullRequestSummary;
  deploymentSummary: DeploymentSummary;
  defectAttributionSummary: DefectAttributionSummary;
  collectorHealth: CollectorIngestionHealth;
  mcpAuditMetrics: McpAuditMetrics;
}

interface ToolDetailConfig {
  label: string;
  heading: string;
  badge: string;
  role: string;
  metrics: string;
  collectionBoundary: string;
  adoptionPath: string;
  nextAction: string;
}

const formatRatio = (value: number) => `${(value * 100).toFixed(1)}%`;

const toolDetailByKey: Record<string, ToolDetailConfig> = {
  mcp: {
    label: 'MCP 工具链',
    heading: 'MCP 工具链详情',
    badge: '主采集入口',
    role: '统一承接员工侧 AI 使用、工具调用、知识检索、编辑证据和工具审计事件。',
    metrics: '会话数、工具调用成功率、编辑证据数、AI 触达 PR 的证据基础',
    collectionBoundary:
      'MCP 适合作为默认主通道：员工只需要在 AI 工具链里配置一次采集入口，平台侧用 identity、projectKey 和 event type 归一化后进入指标管线。',
    adoptionPath:
      '先保证低打扰接入和离线 outbox，再把 Cursor、Claude Code、Codex CLI、内部 Agent 等工具通过 MCP 或 Adapter 统一归档。',
    nextAction: '优先把 MCP 成功率、队列堆积、失败重试和死信处理做成治理红线。',
  },
  cursor: {
    label: 'Cursor',
    heading: 'Cursor 详情',
    badge: 'AI-IDE 深采集',
    role: '补齐 IDE 热路径、Tab 补全、AI 采纳行数和编码会话等深度行为。',
    metrics: 'Tab 接受行数、AI-IDE 使用人数比例、AI 代码生成行数补充证据',
    collectionBoundary:
      'Cursor 适合做 AI-IDE 标杆样本：它提供更贴近编码现场的补全、采纳和编辑行为，但需要和 Git / PR 结果信号交叉校验。',
    adoptionPath:
      '先看活跃人数、AI-IDE 覆盖率和 Tab 采纳趋势，再下钻到团队、项目和需求类型，避免只看单一出码率。',
    nextAction: '把 Cursor 口径沉淀成 IDE Adapter 标准，再复制到 VS Code、JetBrains 和内部 IDE 插件。',
  },
  cli: {
    label: 'CLI Agent',
    heading: 'CLI Agent 详情',
    badge: '命令行采集',
    role: '覆盖 Codex、Claude Code、内部 CLI Agent 等非 IDE 场景，记录会话、命令和工具调用链路。',
    metrics: 'CLI AI 会话数、多工具活跃人数、AI 工具覆盖率',
    collectionBoundary:
      'CLI Adapter 适合低成本扩展不同 AI 工具，把终端会话和工具调用转成统一事件，但代码采纳仍需 Git / PR 侧确认。',
    adoptionPath: '先从活跃人数和会话数做推广监测，再接入 PR、CI、缺陷归因形成闭环。',
    nextAction: '给 CLI 工具补统一安装脚本、身份绑定和 outbox 缓冲，降低员工侧接入摩擦。',
  },
  gateway: {
    label: 'Collector Gateway',
    heading: 'Collector Gateway 详情',
    badge: '采集可靠性',
    role: '统一接收 MCP、IDE Adapter、CLI Adapter 和后链路系统事件，负责缓冲、转发和死信。',
    metrics: '队列深度、投递成功数、转发失败数、死信数量',
    collectionBoundary:
      'Gateway 不直接代表提效结果，但决定管理者看到的数据是否完整可信，是企业级采集链路的可靠性底座。',
    adoptionPath: '先确保事件不丢、可重放、可审计，再逐步扩展更多采集源和组织权限隔离。',
    nextAction: '把队列堆积、DLQ 和失败转发做成告警，并进入治理页的运行水位。',
  },
};

const defaultToolDetail: ToolDetailConfig = {
  label: 'AI 工具',
  heading: 'AI 工具详情',
  badge: '扩展采集源',
  role: '承接新的 AI 提效工具，按照统一事件模型进入指标语义层。',
  metrics: '活跃人数、会话数、AI 触达需求、AI 触达 PR、质量风险护栏',
  collectionBoundary:
    '新工具默认先做轻量事件采集，后续按能力逐步扩展到代码采纳、需求流转、PR、CI、发布和缺陷归因。',
  adoptionPath: '从安装渗透和活跃使用开始，逐步验证是否带来正式产出与交付效率改善。',
  nextAction: '为该工具补齐 Adapter 配置、采集口径说明和指标归属。',
};

const pageStyle = {
  display: 'grid',
  gap: '22px',
};

const heroStyle = {
  borderRadius: '34px',
  padding: '32px',
  color: '#e2f2ff',
  background:
    'radial-gradient(circle at top right, rgba(94, 234, 212, 0.22), transparent 32%), radial-gradient(circle at bottom left, rgba(251, 191, 36, 0.18), transparent 28%), linear-gradient(135deg, #0f172a 0%, #123047 48%, #0f3f46 100%)',
  border: '1px solid rgba(125, 211, 252, 0.18)',
  boxShadow: '0 30px 90px rgba(15, 23, 42, 0.22)',
};

const panelStyle = {
  borderRadius: '28px',
  padding: '24px',
  background: 'rgba(255, 255, 255, 0.9)',
  border: '1px solid rgba(15, 23, 42, 0.08)',
  boxShadow: '0 18px 42px rgba(15, 23, 42, 0.07)',
};

const metricGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
  gap: '14px',
};

const twoColumnStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: '18px',
};

const getMetricCards = ({
  toolKey,
  analysisSummary,
  teamSnapshot,
  requirementSummary,
  pullRequestSummary,
  deploymentSummary,
  defectAttributionSummary,
  collectorHealth,
  mcpAuditMetrics,
}: Omit<ToolDetailPageProps, 'onBack'>) => {
  if (toolKey === 'mcp') {
    return [
      { label: '工具调用成功率', value: formatRatio(mcpAuditMetrics.successRate) },
      { label: 'MCP 工具调用', value: `${mcpAuditMetrics.totalToolCalls}` },
      { label: '平均耗时', value: `${mcpAuditMetrics.averageDurationMs.toFixed(0)} ms` },
      { label: '当前队列', value: `${collectorHealth.queueDepth}` },
    ];
  }

  if (toolKey === 'cursor') {
    return [
      { label: '团队 AI 会话', value: `${teamSnapshot.totalSessionCount}` },
      { label: 'Tab 接受行数', value: `${analysisSummary.tabAcceptedLines}` },
      { label: 'AI 触达 PR', value: formatRatio(pullRequestSummary.aiTouchedPrRatio) },
      {
        label: 'AI PR 逃逸缺陷率',
        value: formatRatio(defectAttributionSummary.escapedAiTouchedPullRequestDefectRate),
      },
    ];
  }

  if (toolKey === 'gateway') {
    return [
      { label: '投递模式', value: collectorHealth.deliveryMode },
      { label: '已转发事件', value: `${collectorHealth.forwardedTotal}` },
      { label: '转发失败', value: `${collectorHealth.failedForwardTotal}` },
      { label: '死信数量', value: `${collectorHealth.deadLetterDepth}` },
    ];
  }

  return [
    { label: 'AI 会话数', value: `${analysisSummary.sessionCount}` },
    { label: 'AI 触达需求', value: formatRatio(requirementSummary.aiTouchedRequirementRatio) },
    { label: 'AI 触达 PR', value: formatRatio(pullRequestSummary.aiTouchedPrRatio) },
    { label: 'AI 触达发布', value: `${deploymentSummary.aiTouchedDeploymentCount}` },
  ];
};

export const ToolDetailPage = ({
  toolKey,
  onBack,
  teamSnapshot,
  analysisSummary,
  requirementSummary,
  pullRequestSummary,
  deploymentSummary,
  defectAttributionSummary,
  collectorHealth,
  mcpAuditMetrics,
}: ToolDetailPageProps) => {
  const detail = toolDetailByKey[toolKey] ?? {
    ...defaultToolDetail,
    label: toolKey,
    heading: `${toolKey} 详情`,
  };
  const metricCards = getMetricCards({
    toolKey,
    teamSnapshot,
    analysisSummary,
    requirementSummary,
    pullRequestSummary,
    deploymentSummary,
    defectAttributionSummary,
    collectorHealth,
    mcpAuditMetrics,
  });

  return (
    <section style={pageStyle}>
      <div style={heroStyle}>
        <button
          type="button"
          onClick={onBack}
          style={{
            border: '1px solid rgba(226, 242, 255, 0.24)',
            borderRadius: '999px',
            padding: '10px 14px',
            background: 'rgba(255, 255, 255, 0.1)',
            color: '#e2f2ff',
            cursor: 'pointer',
            fontWeight: 800,
          }}
        >
          返回经营驾驶舱
        </button>
        <p
          style={{
            margin: '24px 0 0',
            color: '#8de3d5',
            fontSize: '12px',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            fontWeight: 900,
          }}
        >
          AI Tool Measurement
        </p>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '18px',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            marginTop: '10px',
          }}
        >
          <div style={{ maxWidth: '760px' }}>
            <h2 style={{ margin: 0, fontSize: '42px', lineHeight: 1.08 }}>
              {detail.heading}
            </h2>
            <p style={{ margin: '14px 0 0', color: '#bdd7e8', fontSize: '16px', lineHeight: 1.75 }}>
              {detail.role}
            </p>
          </div>
          <span
            style={{
              borderRadius: '999px',
              padding: '10px 14px',
              background: 'rgba(20, 184, 166, 0.16)',
              border: '1px solid rgba(94, 234, 212, 0.28)',
              color: '#a7f3d0',
              fontWeight: 900,
            }}
          >
            {detail.badge}
          </span>
        </div>
      </div>

      <div style={metricGridStyle}>
        {metricCards.map((metric) => (
          <article key={metric.label} style={panelStyle}>
            <p style={{ margin: 0, color: '#64748b', fontSize: '13px', fontWeight: 800 }}>
              {metric.label}
            </p>
            <strong style={{ display: 'block', marginTop: '10px', color: '#0f172a', fontSize: '30px' }}>
              {metric.value}
            </strong>
          </article>
        ))}
      </div>

      <div style={twoColumnStyle}>
        <article style={panelStyle}>
          <p style={{ margin: 0, color: '#0f766e', fontSize: '13px', fontWeight: 900 }}>
            可采集指标
          </p>
          <h3 style={{ margin: '10px 0 0', fontSize: '24px', color: '#0f172a' }}>
            {detail.metrics}
          </h3>
          <p style={{ margin: '14px 0 0', color: '#475569', lineHeight: 1.75 }}>
            {detail.collectionBoundary}
          </p>
        </article>

        <article style={panelStyle}>
          <p style={{ margin: 0, color: '#1d4ed8', fontSize: '13px', fontWeight: 900 }}>
            接入策略
          </p>
          <h3 style={{ margin: '10px 0 0', fontSize: '24px', color: '#0f172a' }}>
            员工端轻量接入，管理端统一度量
          </h3>
          <p style={{ margin: '14px 0 0', color: '#475569', lineHeight: 1.75 }}>
            {detail.adoptionPath}
          </p>
        </article>
      </div>

      <article style={panelStyle}>
        <p style={{ margin: 0, color: '#92400e', fontSize: '13px', fontWeight: 900 }}>
          下一步治理动作
        </p>
        <p style={{ margin: '10px 0 0', color: '#0f172a', fontSize: '20px', lineHeight: 1.7 }}>
          {detail.nextAction}
        </p>
      </article>
    </section>
  );
};
