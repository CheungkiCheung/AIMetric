import type { RequirementRecord, RequirementSummary } from '../api/client.js';

export interface RequirementDashboardProps {
  summary: RequirementSummary;
  rows: RequirementRecord[];
}

const panelStyle = {
  padding: '24px',
  borderRadius: '28px',
  background:
    'linear-gradient(135deg, rgba(244, 250, 242, 0.96), rgba(230, 243, 226, 0.92))',
  border: '1px solid rgba(80, 126, 74, 0.16)',
  boxShadow: '0 18px 38px rgba(56, 93, 50, 0.08)',
};

const statGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: '14px',
  marginTop: '18px',
};

const statCardStyle = {
  borderRadius: '20px',
  padding: '16px',
  background: 'rgba(255, 255, 255, 0.76)',
  border: '1px solid rgba(80, 126, 74, 0.14)',
};

const statLabelStyle = {
  margin: 0,
  color: '#53754b',
  fontSize: '13px',
  fontWeight: 700,
};

const statValueStyle = {
  margin: '8px 0 0',
  color: '#22301f',
  fontSize: '30px',
  fontWeight: 800,
};

const listStyle = {
  margin: '18px 0 0',
  padding: 0,
  listStyle: 'none',
  display: 'grid',
  gap: '10px',
};

const statusLabelMap: Record<RequirementRecord['status'], string> = {
  open: '待开始',
  'in-progress': '进行中',
  done: '已完成',
  closed: '已关闭',
};

const providerLabelMap: Record<RequirementRecord['provider'], string> = {
  jira: 'Jira',
  tapd: 'TAPD',
};

const formatRatio = (value: number) => `${(value * 100).toFixed(1)}%`;
const formatHours = (value: number) => (value > 0 ? `${value.toFixed(1)} 小时` : '暂无');

export const RequirementDashboard = ({
  summary,
  rows,
}: RequirementDashboardProps) => (
  <section style={panelStyle}>
    <p
      style={{
        margin: 0,
        fontSize: '12px',
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: '#648a5c',
      }}
    >
      Requirement Signals
    </p>
    <h2 style={{ margin: '10px 0 6px', fontSize: '28px' }}>需求交付概览</h2>
    <p style={{ margin: 0, color: '#4d6848' }}>
      先沉淀需求系统基础事实，跟踪 AI 触达需求占比、完成节奏和“需求到首个 PR”时间，为后续 Lead Time 与 ROI 分析做底座。
    </p>
    <div style={statGridStyle}>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>需求总数</p>
        <p style={statValueStyle}>{summary.totalRequirementCount}</p>
      </article>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>AI 触达需求数</p>
        <p style={statValueStyle}>{summary.aiTouchedRequirementCount}</p>
      </article>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>AI 触达需求占比</p>
        <p style={{ ...statValueStyle, fontSize: '24px' }}>
          {formatRatio(summary.aiTouchedRequirementRatio)}
        </p>
      </article>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>已完成需求数</p>
        <p style={statValueStyle}>{summary.completedRequirementCount}</p>
      </article>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>平均需求 Lead Time</p>
        <p style={{ ...statValueStyle, fontSize: '24px' }}>
          {formatHours(summary.averageLeadTimeHours)}
        </p>
      </article>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>需求到首个 PR</p>
        <p style={{ ...statValueStyle, fontSize: '24px' }}>
          {formatHours(summary.averageLeadTimeToFirstPrHours)}
        </p>
      </article>
    </div>
    <ul style={listStyle}>
      {rows.slice(0, 6).map((row) => (
        <li
          key={`${row.provider}-${row.requirementKey}`}
          style={{
            borderRadius: '18px',
            padding: '14px 16px',
            background: 'rgba(255, 255, 255, 0.68)',
            border: '1px solid rgba(80, 126, 74, 0.14)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <strong style={{ color: '#22301f' }}>
              {providerLabelMap[row.provider]} {row.requirementKey} {row.title}
            </strong>
            <span style={{ color: '#5f7f57' }}>
              {statusLabelMap[row.status]} / {row.aiTouched ? 'AI 触达' : '非 AI 触达'}
            </span>
          </div>
          <p style={{ margin: '8px 0 0', color: '#4d6848' }}>
            项目：{row.projectKey}
            {row.ownerMemberId ? ` / 负责人：${row.ownerMemberId}` : ''}
          </p>
          <p style={{ margin: '6px 0 0', color: '#4d6848' }}>
            创建：{new Date(row.createdAt).toLocaleString('zh-CN')}
            {row.firstPrCreatedAt
              ? ` / 首个 PR：${new Date(row.firstPrCreatedAt).toLocaleString('zh-CN')}`
              : ''}
            {typeof row.leadTimeToFirstPrHours === 'number'
              ? ` / 到首个 PR：${row.leadTimeToFirstPrHours.toFixed(1)} 小时`
              : ''}
            {typeof row.leadTimeHours === 'number'
              ? ` / Lead Time：${row.leadTimeHours.toFixed(1)} 小时`
              : ''}
          </p>
        </li>
      ))}
    </ul>
  </section>
);
