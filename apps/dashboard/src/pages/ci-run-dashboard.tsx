import type { CiRunRecord, CiRunSummary } from '../api/client.js';

export interface CiRunDashboardProps {
  summary: CiRunSummary;
  rows: CiRunRecord[];
}

const panelStyle = {
  padding: '24px',
  borderRadius: '28px',
  background:
    'linear-gradient(135deg, rgba(241, 246, 252, 0.96), rgba(227, 236, 247, 0.92))',
  border: '1px solid rgba(74, 104, 148, 0.16)',
  boxShadow: '0 18px 38px rgba(52, 78, 116, 0.08)',
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
  border: '1px solid rgba(74, 104, 148, 0.14)',
};

const statLabelStyle = {
  margin: 0,
  color: '#5571a1',
  fontSize: '13px',
  fontWeight: 700,
};

const statValueStyle = {
  margin: '8px 0 0',
  color: '#24344f',
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

const conclusionLabelMap: Record<NonNullable<CiRunRecord['conclusion']>, string> = {
  success: '成功',
  failure: '失败',
  cancelled: '已取消',
  timed_out: '超时',
  skipped: '已跳过',
};

const statusLabelMap: Record<CiRunRecord['status'], string> = {
  queued: '排队中',
  in_progress: '运行中',
  completed: '已完成',
};

export const CiRunDashboard = ({ summary, rows }: CiRunDashboardProps) => (
  <section style={panelStyle}>
    <p
      style={{
        margin: 0,
        fontSize: '12px',
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: '#6a86b4',
      }}
    >
      CI Signals
    </p>
    <h2 style={{ margin: '10px 0 6px', fontSize: '28px' }}>CI 质量概览</h2>
    <p style={{ margin: 0, color: '#50698f' }}>
      跟踪自动化测试运行、成功率和平均耗时，给质量与风险指标提供可信的流水线事实。
    </p>
    <div style={statGridStyle}>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>运行总数</p>
        <p style={statValueStyle}>{summary.totalRunCount}</p>
      </article>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>已完成运行</p>
        <p style={statValueStyle}>{summary.completedRunCount}</p>
      </article>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>成功运行</p>
        <p style={statValueStyle}>{summary.successfulRunCount}</p>
      </article>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>失败运行</p>
        <p style={statValueStyle}>{summary.failedRunCount}</p>
      </article>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>CI 通过率</p>
        <p style={{ ...statValueStyle, fontSize: '24px' }}>
          {(summary.passRate * 100).toFixed(1)}%
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
          key={`${row.repoName}-${row.runId}`}
          style={{
            borderRadius: '18px',
            padding: '14px 16px',
            background: 'rgba(255, 255, 255, 0.68)',
            border: '1px solid rgba(74, 104, 148, 0.14)',
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
            <strong style={{ color: '#24344f' }}>
              {row.repoName} #{row.runId} {row.workflowName}
            </strong>
            <span style={{ color: '#56709d' }}>
              {statusLabelMap[row.status]}
              {row.conclusion ? ` / ${conclusionLabelMap[row.conclusion]}` : ''}
            </span>
          </div>
          <p style={{ margin: '8px 0 0', color: '#50698f' }}>
            项目：{row.projectKey}
            {typeof row.durationMinutes === 'number'
              ? ` / 耗时：${row.durationMinutes.toFixed(1)} 分钟`
              : ''}
          </p>
        </li>
      ))}
    </ul>
  </section>
);
