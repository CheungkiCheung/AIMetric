import type { IncidentRecord, IncidentSummary } from '../api/client.js';

export interface IncidentDashboardProps {
  summary: IncidentSummary;
  rows: IncidentRecord[];
}

const panelStyle = {
  padding: '24px',
  borderRadius: '28px',
  background:
    'linear-gradient(135deg, rgba(249, 237, 238, 0.96), rgba(242, 222, 224, 0.92))',
  border: '1px solid rgba(154, 77, 77, 0.18)',
  boxShadow: '0 18px 38px rgba(109, 54, 54, 0.08)',
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
  border: '1px solid rgba(154, 77, 77, 0.14)',
};

const statLabelStyle = {
  margin: 0,
  color: '#9a4d4d',
  fontSize: '13px',
  fontWeight: 700,
};

const statValueStyle = {
  margin: '8px 0 0',
  color: '#4f2525',
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

export const IncidentDashboard = ({
  summary,
  rows,
}: IncidentDashboardProps) => (
  <section style={panelStyle}>
    <p
      style={{
        margin: 0,
        fontSize: '12px',
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: '#b05b5b',
      }}
    >
      Incident Signals
    </p>
    <h2 style={{ margin: '10px 0 6px', fontSize: '28px' }}>事故风险概览</h2>
    <p style={{ margin: 0, color: '#7e4848' }}>
      汇总线上事故、恢复时长与受影响发布，给变更失败率提供更真实的质量风险证据。
    </p>
    <div style={statGridStyle}>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>事故总数</p>
        <p style={statValueStyle}>{summary.totalIncidentCount}</p>
      </article>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>未恢复事故</p>
        <p style={statValueStyle}>{summary.openIncidentCount}</p>
      </article>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>已恢复事故</p>
        <p style={statValueStyle}>{summary.resolvedIncidentCount}</p>
      </article>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>关联发布数</p>
        <p style={statValueStyle}>{summary.linkedDeploymentCount}</p>
      </article>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>平均恢复时长</p>
        <p style={{ ...statValueStyle, fontSize: '24px' }}>
          {summary.averageResolutionHours.toFixed(1)} 小时
        </p>
      </article>
    </div>
    <ul style={listStyle}>
      {rows.slice(0, 6).map((row) => (
        <li
          key={`${row.projectKey}-${row.incidentKey}`}
          style={{
            borderRadius: '18px',
            padding: '14px 16px',
            background: 'rgba(255, 255, 255, 0.68)',
            border: '1px solid rgba(154, 77, 77, 0.14)',
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
            <strong style={{ color: '#4f2525' }}>
              {row.incidentKey} {row.title}
            </strong>
            <span style={{ color: '#8a5555' }}>
              {row.severity.toUpperCase()} / {row.status === 'resolved' ? '已恢复' : '处理中'}
            </span>
          </div>
          <p style={{ margin: '8px 0 0', color: '#7e4848' }}>
            项目：{row.projectKey}
            {row.linkedDeploymentIds.length > 0
              ? ` / 关联发布：${row.linkedDeploymentIds.join(', ')}`
              : ''}
          </p>
        </li>
      ))}
    </ul>
  </section>
);
