import type { DeploymentRecord, DeploymentSummary } from '../api/client.js';

export interface DeploymentDashboardProps {
  summary: DeploymentSummary;
  rows: DeploymentRecord[];
}

const panelStyle = {
  padding: '24px',
  borderRadius: '28px',
  background:
    'linear-gradient(135deg, rgba(253, 241, 232, 0.96), rgba(248, 229, 214, 0.92))',
  border: '1px solid rgba(165, 104, 56, 0.18)',
  boxShadow: '0 18px 38px rgba(116, 73, 35, 0.08)',
};

const statGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: '14px',
  marginTop: '18px',
};

const statCardStyle = {
  borderRadius: '20px',
  padding: '16px',
  background: 'rgba(255, 255, 255, 0.76)',
  border: '1px solid rgba(165, 104, 56, 0.14)',
};

const statLabelStyle = {
  margin: 0,
  color: '#9a6134',
  fontSize: '13px',
  fontWeight: 700,
};

const statValueStyle = {
  margin: '8px 0 0',
  color: '#4b2d17',
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

const statusLabelMap: Record<DeploymentRecord['status'], string> = {
  success: '成功',
  failed: '失败',
  cancelled: '已取消',
};

export const DeploymentDashboard = ({
  summary,
  rows,
}: DeploymentDashboardProps) => (
  <section style={panelStyle}>
    <p
      style={{
        margin: 0,
        fontSize: '12px',
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: '#b36e32',
      }}
    >
      Release Signals
    </p>
    <h2 style={{ margin: '10px 0 6px', fontSize: '28px' }}>发布质量概览</h2>
    <p style={{ margin: 0, color: '#7d5535' }}>
      汇总生产发布、变更失败和回滚事实，把质量与风险从 PR/CI 延伸到真正上线结果。
    </p>
    <div style={statGridStyle}>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>部署总数</p>
        <p style={statValueStyle}>{summary.totalDeploymentCount} 次</p>
      </article>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>成功部署</p>
        <p style={statValueStyle}>{summary.successfulDeploymentCount}</p>
      </article>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>失败部署</p>
        <p style={statValueStyle}>{summary.failedDeploymentCount}</p>
      </article>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>回滚部署</p>
        <p style={statValueStyle}>{summary.rolledBackDeploymentCount}</p>
      </article>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>变更失败率</p>
        <p style={{ ...statValueStyle, fontSize: '24px' }}>
          {(summary.changeFailureRate * 100).toFixed(1)}%
        </p>
      </article>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>回滚率</p>
        <p style={{ ...statValueStyle, fontSize: '24px' }}>
          {(summary.rollbackRate * 100).toFixed(1)}%
        </p>
      </article>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>平均耗时</p>
        <p style={{ ...statValueStyle, fontSize: '24px' }}>
          {summary.averageDurationMinutes.toFixed(1)} 分钟
        </p>
      </article>
    </div>
    <ul style={listStyle}>
      {rows.slice(0, 6).map((row) => (
        <li
          key={`${row.repoName}-${row.deploymentId}`}
          style={{
            borderRadius: '18px',
            padding: '14px 16px',
            background: 'rgba(255, 255, 255, 0.68)',
            border: '1px solid rgba(165, 104, 56, 0.14)',
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
            <strong style={{ color: '#4b2d17' }}>
              {row.repoName} {row.deploymentId}
            </strong>
            <span style={{ color: '#8d603f' }}>
              {row.environment} / {statusLabelMap[row.status]}
              {row.rolledBack ? ' / 已回滚' : ''}
            </span>
          </div>
          <p style={{ margin: '8px 0 0', color: '#7d5535' }}>
            项目：{row.projectKey}
            {typeof row.durationMinutes === 'number'
              ? ` / 耗时：${row.durationMinutes.toFixed(1)} 分钟`
              : ''}
            {row.incidentKey ? ` / 事故：${row.incidentKey}` : ''}
          </p>
        </li>
      ))}
    </ul>
  </section>
);
