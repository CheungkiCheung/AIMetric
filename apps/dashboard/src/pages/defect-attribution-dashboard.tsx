import type {
  DefectAttributionRow,
  DefectAttributionSummary,
} from '../api/client.js';

export interface DefectAttributionDashboardProps {
  summary: DefectAttributionSummary;
  rows: DefectAttributionRow[];
}

const panelStyle = {
  padding: '24px',
  borderRadius: '28px',
  background:
    'linear-gradient(135deg, rgba(248, 244, 255, 0.96), rgba(233, 226, 248, 0.92))',
  border: '1px solid rgba(104, 84, 160, 0.16)',
  boxShadow: '0 18px 38px rgba(74, 58, 123, 0.08)',
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
  border: '1px solid rgba(104, 84, 160, 0.14)',
};

const statLabelStyle = {
  margin: 0,
  color: '#6f5aa7',
  fontSize: '13px',
  fontWeight: 700,
};

const statValueStyle = {
  margin: '8px 0 0',
  color: '#2e2451',
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

export const DefectAttributionDashboard = ({
  summary,
  rows,
}: DefectAttributionDashboardProps) => (
  <section style={panelStyle}>
    <p
      style={{
        margin: 0,
        fontSize: '12px',
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: '#7c67b4',
      }}
    >
      Risk Attribution
    </p>
    <h2 style={{ margin: '10px 0 6px', fontSize: '28px' }}>缺陷归因分析</h2>
    <p style={{ margin: 0, color: '#5b4d86' }}>
      把缺陷与 AI 触达需求、AI 触达 PR 连接起来，帮助技术管理者识别风险主要集中在哪条交付链路。
    </p>
    <div style={statGridStyle}>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>缺陷总数</p>
        <p style={statValueStyle}>{summary.totalDefectCount}</p>
      </article>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>AI 需求关联缺陷</p>
        <p style={statValueStyle}>{summary.aiTouchedRequirementDefectCount}</p>
      </article>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>AI PR 关联缺陷</p>
        <p style={statValueStyle}>{summary.aiTouchedPullRequestDefectCount}</p>
      </article>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>AI PR 生产逃逸缺陷</p>
        <p style={statValueStyle}>{summary.escapedAiTouchedPullRequestDefectCount}</p>
      </article>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>生产缺陷总数</p>
        <p style={statValueStyle}>{summary.productionDefectCount}</p>
      </article>
    </div>
    <ul style={listStyle}>
      {rows.slice(0, 6).map((row) => (
        <li
          key={`${row.projectKey}-${row.defectKey}`}
          style={{
            borderRadius: '18px',
            padding: '14px 16px',
            background: 'rgba(255, 255, 255, 0.68)',
            border: '1px solid rgba(104, 84, 160, 0.14)',
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
            <strong style={{ color: '#2e2451' }}>
              {row.defectKey} {row.title}
            </strong>
            <span style={{ color: '#6a5a98' }}>
              {row.foundInPhase === 'production' ? '生产阶段' : '非生产阶段'} /{' '}
              {row.status === 'resolved' ? '已解决' : '处理中'}
            </span>
          </div>
          <p style={{ margin: '8px 0 0', color: '#5b4d86' }}>
            项目：{row.projectKey}
            {row.aiTouchedRequirement ? ' / AI 需求关联' : ' / 非 AI 需求关联'}
            {row.aiTouchedPullRequest ? ' / AI PR 关联' : ' / 非 AI PR 关联'}
          </p>
          <p style={{ margin: '6px 0 0', color: '#5b4d86' }}>
            {row.linkedRequirementKeys.length > 0
              ? `需求：${row.linkedRequirementKeys.join(', ')}`
              : '需求：无'}
            {' / '}
            {row.linkedPullRequestNumbers.length > 0
              ? `PR：${row.linkedPullRequestNumbers.join(', ')}`
              : 'PR：无'}
          </p>
        </li>
      ))}
    </ul>
  </section>
);
