import type {
  CiRunSummary,
  CollectorIngestionHealth,
  DashboardFilters,
  DefectAttributionSummary,
  GovernanceDirectory,
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
  requirementSummary: RequirementSummary;
  pullRequestSummary: PullRequestSummary;
  ciRunSummary: CiRunSummary;
  defectAttributionSummary: DefectAttributionSummary;
  collectorHealth: CollectorIngestionHealth;
  governanceDirectory: GovernanceDirectory;
}

const sectionStyle = {
  padding: '28px',
  borderRadius: '32px',
  background:
    'linear-gradient(180deg, rgba(248, 249, 252, 0.96), rgba(238, 241, 247, 0.94))',
  border: '1px solid rgba(28, 53, 87, 0.08)',
  boxShadow: '0 22px 54px rgba(16, 24, 40, 0.08)',
};

const darkSectionStyle = {
  ...sectionStyle,
  background:
    'radial-gradient(circle at top right, rgba(71, 163, 255, 0.2), transparent 28%), linear-gradient(180deg, #122033 0%, #18283d 100%)',
  color: '#f6f8fb',
  border: '1px solid rgba(104, 157, 216, 0.16)',
  boxShadow: '0 26px 60px rgba(11, 18, 32, 0.24)',
};

const gridStyle = {
  display: 'grid',
  gap: '16px',
};

const kpiGridStyle = {
  ...gridStyle,
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  marginTop: '20px',
};

const trendGridStyle = {
  ...gridStyle,
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  marginTop: '18px',
};

const alertGridStyle = {
  ...gridStyle,
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  marginTop: '18px',
};

const cardStyle = {
  borderRadius: '22px',
  padding: '18px',
  background: 'rgba(255, 255, 255, 0.84)',
  border: '1px solid rgba(17, 24, 39, 0.06)',
};

const darkCardStyle = {
  borderRadius: '22px',
  padding: '18px',
  background: 'rgba(255, 255, 255, 0.08)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
};

const windowOptions = [7, 30, 90];

const formatValue = (value: number, unit: MetricCalculationResult['unit']) => {
  if (unit === 'ratio') {
    return `${(value * 100).toFixed(1)}%`;
  }

  if (unit === 'hours') {
    return `${value.toFixed(1)} 小时`;
  }

  return new Intl.NumberFormat('zh-CN').format(value);
};

const formatPlainRatio = (value: number) => `${(value * 100).toFixed(1)}%`;

const titleByMetricKey: Record<string, string> = {
  ai_output_rate: 'AI 出码率',
  lead_time_ai_vs_non_ai: 'AI 需求 Lead Time 对比',
  ci_pass_rate: 'CI 通过率',
  change_failure_rate: '变更失败率',
  defect_rate: '缺陷率',
  critical_requirement_cycle_time: '关键需求周期',
};

const sparklinePath = (values: number[], width = 220, height = 70) => {
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

      if (!latest) {
        return undefined;
      }

      return {
        metricKey,
        name: titleByMetricKey[metricKey] ?? latest.definition.name,
        unit: latest.unit,
        latestValue: latest.value,
        path: sparklinePath(orderedRows.map((row) => row.value)),
        points: orderedRows.length,
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value));
};

const findMetric = (
  values: MetricCalculationResult[],
  metricKey: string,
) => values.find((value) => value.metricKey === metricKey);

const buildAlerts = ({
  requirementSummary,
  pullRequestSummary,
  ciRunSummary,
  defectAttributionSummary,
  collectorHealth,
}: Pick<
  EffectivenessManagerCockpitProps,
  | 'requirementSummary'
  | 'pullRequestSummary'
  | 'ciRunSummary'
  | 'defectAttributionSummary'
  | 'collectorHealth'
>) => {
  const alerts: Array<{ title: string; body: string; tone: 'risk' | 'watch' | 'healthy' }> = [];

  if (collectorHealth.deadLetterDepth > 0 || collectorHealth.queueDepth > 10) {
    alerts.push({
      title: '采集链路存在积压',
      body: `当前队列 ${collectorHealth.queueDepth}，DLQ ${collectorHealth.deadLetterDepth}，建议先处理采集健康再解释业务指标。`,
      tone: 'risk',
    });
  }

  if (requirementSummary.aiTouchedRequirementRatio < 0.5) {
    alerts.push({
      title: '需求环节 AI 渗透不足',
      body: `近窗口期 AI 触达需求占比仅 ${formatPlainRatio(requirementSummary.aiTouchedRequirementRatio)}，可能说明 AI 仍停留在编码末端。`,
      tone: 'watch',
    });
  }

  if (pullRequestSummary.aiTouchedPrRatio < 0.5) {
    alerts.push({
      title: 'PR 环节转化偏低',
      body: `AI 触达 PR 占比仅 ${formatPlainRatio(pullRequestSummary.aiTouchedPrRatio)}，建议检查工具使用是否真正进入交付链路。`,
      tone: 'watch',
    });
  }

  if (ciRunSummary.passRate < 0.8) {
    alerts.push({
      title: 'CI 稳定性偏弱',
      body: `当前 CI 通过率 ${formatPlainRatio(ciRunSummary.passRate)}，需要结合 PR 质量和规则配置一起排查。`,
      tone: 'risk',
    });
  }

  if (defectAttributionSummary.escapedAiTouchedPullRequestDefectRate > 0.25) {
    alerts.push({
      title: 'AI PR 逃逸缺陷偏高',
      body: `AI 触达 PR 逃逸缺陷率 ${formatPlainRatio(defectAttributionSummary.escapedAiTouchedPullRequestDefectRate)}，建议回看评审与测试策略。`,
      tone: 'risk',
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      title: '当前窗口整体稳定',
      body: '暂未发现明显采集、渗透或质量红灯，可以继续下钻查看团队差异和趋势变化。',
      tone: 'healthy',
    });
  }

  return alerts;
};

const alertStyleByTone = {
  risk: {
    background: '#fff1f1',
    border: '1px solid rgba(180, 43, 43, 0.16)',
    color: '#7f1d1d',
  },
  watch: {
    background: '#fff8ea',
    border: '1px solid rgba(180, 120, 16, 0.16)',
    color: '#7c4a03',
  },
  healthy: {
    background: '#f0faf5',
    border: '1px solid rgba(16, 124, 65, 0.14)',
    color: '#14532d',
  },
} as const;

export const EffectivenessManagerCockpit = ({
  filters,
  selectedWindowDays,
  onSelectWindow,
  metricValues,
  metricSnapshots,
  teamSnapshot,
  requirementSummary,
  pullRequestSummary,
  ciRunSummary,
  defectAttributionSummary,
  collectorHealth,
  governanceDirectory,
}: EffectivenessManagerCockpitProps) => {
  const activeMembers = teamSnapshot.memberCount;
  const visibleMembers = governanceDirectory.members.length || teamSnapshot.memberCount || 1;
  const trendCards = buildTrendCards(metricSnapshots);
  const alerts = buildAlerts({
    requirementSummary,
    pullRequestSummary,
    ciRunSummary,
    defectAttributionSummary,
    collectorHealth,
  });
  const kpis = [
    {
      label: 'AI 活跃覆盖率',
      value: formatPlainRatio(activeMembers / visibleMembers),
      detail: `${activeMembers}/${visibleMembers} 名可见成员有活跃数据`,
    },
    {
      label: 'AI 触达需求占比',
      value: formatPlainRatio(requirementSummary.aiTouchedRequirementRatio),
      detail: `${requirementSummary.aiTouchedRequirementCount}/${requirementSummary.totalRequirementCount} 个需求`,
    },
    {
      label: 'AI 触达 PR 占比',
      value: formatPlainRatio(pullRequestSummary.aiTouchedPrRatio),
      detail: `${pullRequestSummary.aiTouchedPrCount}/${pullRequestSummary.totalPrCount} 个 PR`,
    },
    {
      label: '关键需求周期',
      value: formatValue(
        findMetric(metricValues, 'critical_requirement_cycle_time')?.value ?? 0,
        'hours',
      ),
      detail: '关键业务需求从确认到上线的平均周期',
    },
    {
      label: 'CI 通过率',
      value: formatPlainRatio(ciRunSummary.passRate),
      detail: `${ciRunSummary.successfulRunCount}/${ciRunSummary.completedRunCount} 次完成运行成功`,
    },
    {
      label: 'AI PR 逃逸缺陷率',
      value: formatPlainRatio(defectAttributionSummary.escapedAiTouchedPullRequestDefectRate),
      detail: `${defectAttributionSummary.escapedAiTouchedPullRequestDefectCount} 个生产逃逸缺陷`,
    },
  ];

  return (
    <section style={darkSectionStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '20px',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
        }}
      >
        <div style={{ maxWidth: '720px' }}>
          <p
            style={{
              margin: 0,
              fontSize: '12px',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#8dc4ff',
            }}
          >
            Effectiveness Operations Cockpit
          </p>
          <h1 style={{ margin: '12px 0 10px', fontSize: '42px', lineHeight: 1.05 }}>
            提效管理者运营驾驶舱
          </h1>
          <p style={{ margin: 0, color: '#d3def0', fontSize: '16px', lineHeight: 1.7 }}>
            聚焦近 {selectedWindowDays} 天的 AI 使用渗透、有效转化、交付效率与质量信号，
            帮提效管理者先看经营态势，再决定往哪个专题下钻。
          </p>
        </div>
        <div style={{ ...darkCardStyle, minWidth: '280px' }}>
          <p style={{ margin: 0, color: '#8dc4ff', fontSize: '13px' }}>默认观察窗口</p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
            {windowOptions.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => onSelectWindow(days)}
                style={{
                  borderRadius: '999px',
                  border:
                    days === selectedWindowDays
                      ? '1px solid rgba(141, 196, 255, 0.8)'
                      : '1px solid rgba(255, 255, 255, 0.16)',
                  background:
                    days === selectedWindowDays ? '#e6f3ff' : 'rgba(255, 255, 255, 0.08)',
                  color: days === selectedWindowDays ? '#12385f' : '#f6f8fb',
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
          <p style={{ margin: '12px 0 0', color: '#d3def0', fontSize: '13px' }}>
            当前项目：{filters.projectKey ?? '全部项目'}
          </p>
        </div>
      </div>

      <div style={kpiGridStyle}>
        {kpis.map((kpi) => (
          <article key={kpi.label} style={darkCardStyle}>
            <p style={{ margin: 0, color: '#8dc4ff', fontSize: '13px' }}>{kpi.label}</p>
            <strong style={{ display: 'block', marginTop: '8px', fontSize: '30px' }}>
              {kpi.value}
            </strong>
            <p style={{ margin: '8px 0 0', color: '#d3def0', fontSize: '13px' }}>
              {kpi.detail}
            </p>
          </article>
        ))}
      </div>

      <div style={trendGridStyle}>
        <div style={{ ...cardStyle, gridColumn: '1 / -1' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '16px',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <p style={{ margin: 0, color: '#426280', fontSize: '13px' }}>Trend Layer</p>
              <h2 style={{ margin: '8px 0 0', fontSize: '28px', color: '#10243a' }}>
                趋势分析层
              </h2>
            </div>
            <p style={{ margin: 0, color: '#4f647c', fontSize: '14px' }}>
              通过企业指标快照观察近窗口期走势，而不只是看当前值。
            </p>
          </div>
        </div>
        {trendCards.length > 0 ? (
          trendCards.map((card) => (
            <article key={card.metricKey} style={cardStyle}>
              <p style={{ margin: 0, color: '#426280', fontSize: '13px' }}>{card.name}</p>
              <strong style={{ display: 'block', marginTop: '8px', fontSize: '26px', color: '#10243a' }}>
                {formatValue(card.latestValue, card.unit)}
              </strong>
              <svg viewBox="0 0 220 70" width="100%" height="72" style={{ marginTop: '12px' }}>
                <path
                  d={card.path}
                  fill="none"
                  stroke="#2475c7"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              <p style={{ margin: '6px 0 0', color: '#60758d', fontSize: '12px' }}>
                共 {card.points} 个趋势点
              </p>
            </article>
          ))
        ) : (
          <article style={cardStyle}>
            <strong style={{ color: '#10243a' }}>趋势快照暂不可用</strong>
            <p style={{ margin: '8px 0 0', color: '#60758d' }}>
              当前环境还没有持久化企业指标快照。可以先执行企业指标回算，再看趋势曲线。
            </p>
          </article>
        )}
      </div>

      <div style={alertGridStyle}>
        <div style={{ ...cardStyle, gridColumn: '1 / -1' }}>
          <p style={{ margin: 0, color: '#426280', fontSize: '13px' }}>Operational Alerts</p>
          <h2 style={{ margin: '8px 0 0', fontSize: '28px', color: '#10243a' }}>
            异常与行动建议
          </h2>
        </div>
        {alerts.map((alert) => (
          <article
            key={alert.title}
            style={{
              ...alertStyleByTone[alert.tone],
              borderRadius: '20px',
              padding: '18px',
            }}
          >
            <strong style={{ display: 'block', fontSize: '18px' }}>{alert.title}</strong>
            <p style={{ margin: '10px 0 0', lineHeight: 1.65 }}>{alert.body}</p>
          </article>
        ))}
        <article style={cardStyle}>
          <p style={{ margin: 0, color: '#426280', fontSize: '13px' }}>组织覆盖</p>
          <strong style={{ display: 'block', marginTop: '8px', fontSize: '26px', color: '#10243a' }}>
            {governanceDirectory.teams.length} 个团队 / {governanceDirectory.projects.length} 个项目
          </strong>
          <p style={{ margin: '8px 0 0', color: '#60758d' }}>
            当前驾驶舱聚焦可见组织范围，专题页继续下钻到需求、PR、缺陷归因与采集健康。
          </p>
        </article>
      </div>
    </section>
  );
};
