import type { PullRequestRecord, PullRequestSummary } from '../api/client.js';

export interface PullRequestDashboardProps {
  summary: PullRequestSummary;
  rows: PullRequestRecord[];
}

const panelStyle = {
  padding: '24px',
  borderRadius: '28px',
  background:
    'linear-gradient(135deg, rgba(255, 249, 241, 0.96), rgba(252, 237, 222, 0.92))',
  border: '1px solid rgba(166, 105, 52, 0.16)',
  boxShadow: '0 18px 38px rgba(135, 86, 44, 0.08)',
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
  border: '1px solid rgba(166, 105, 52, 0.14)',
};

const statLabelStyle = {
  margin: 0,
  color: '#9a6232',
  fontSize: '13px',
  fontWeight: 700,
};

const statValueStyle = {
  margin: '8px 0 0',
  color: '#3d2411',
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

const stateLabelMap: Record<PullRequestRecord['state'], string> = {
  open: '打开中',
  closed: '已关闭',
  merged: '已合并',
};

const reviewLabelMap: Record<NonNullable<PullRequestRecord['reviewDecision']>, string> = {
  approved: '已批准',
  'changes-requested': '要求修改',
  commented: '仅评论',
};

const formatRatio = (value: number) => `${(value * 100).toFixed(1)}%`;

const formatCycleTime = (value: number) =>
  value > 0 ? `${value.toFixed(1)} 小时` : '暂无已合并 PR';

export const PullRequestDashboard = ({
  summary,
  rows,
}: PullRequestDashboardProps) => (
  <section style={panelStyle}>
    <p
      style={{
        margin: 0,
        fontSize: '12px',
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: '#b06b36',
      }}
    >
      Delivery Signals
    </p>
    <h2 style={{ margin: '10px 0 6px', fontSize: '28px' }}>GitHub PR 交付概览</h2>
    <p style={{ margin: 0, color: '#7b4c26' }}>
      把 AI 使用链路和真实交付动作连起来，先落地 AI 触达 PR 占比、合并量和 PR 周转时长，为后续接 Jira、CI/CD、缺陷系统做准备。
    </p>
    <div style={statGridStyle}>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>PR 总数</p>
        <p style={statValueStyle}>{summary.totalPrCount}</p>
      </article>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>AI 触达 PR 数</p>
        <p style={statValueStyle}>{summary.aiTouchedPrCount}</p>
      </article>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>AI 触达 PR 占比</p>
        <p style={{ ...statValueStyle, fontSize: '24px' }}>
          {formatRatio(summary.aiTouchedPrRatio)}
        </p>
      </article>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>已合并 PR 数</p>
        <p style={statValueStyle}>{summary.mergedPrCount}</p>
      </article>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>平均 PR 周转时间</p>
        <p style={{ ...statValueStyle, fontSize: '24px' }}>
          {formatCycleTime(summary.averageCycleTimeHours)}
        </p>
      </article>
    </div>
    <ul style={listStyle}>
      {rows.slice(0, 6).map((row) => (
        <li
          key={`${row.repoName}-${row.prNumber}`}
          style={{
            borderRadius: '18px',
            padding: '14px 16px',
            background: 'rgba(255, 255, 255, 0.68)',
            border: '1px solid rgba(166, 105, 52, 0.14)',
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
            <strong style={{ color: '#3d2411' }}>
              {row.repoName} #{row.prNumber} {row.title}
            </strong>
            <span style={{ color: '#955d32' }}>
              {stateLabelMap[row.state]} / {row.aiTouched ? 'AI 触达' : '非 AI 触达'}
            </span>
          </div>
          <p style={{ margin: '8px 0 0', color: '#7b4c26' }}>
            项目：{row.projectKey}
            {row.authorMemberId ? ` / 提交人：${row.authorMemberId}` : ''}
            {row.reviewDecision ? ` / Review：${reviewLabelMap[row.reviewDecision]}` : ''}
          </p>
          <p style={{ margin: '6px 0 0', color: '#7b4c26' }}>
            创建时间：{new Date(row.createdAt).toLocaleString('zh-CN')}
            {row.mergedAt
              ? ` / 合并时间：${new Date(row.mergedAt).toLocaleString('zh-CN')}`
              : ''}
            {row.cycleTimeHours ? ` / 周转：${row.cycleTimeHours.toFixed(1)} 小时` : ''}
          </p>
        </li>
      ))}
    </ul>
  </section>
);
