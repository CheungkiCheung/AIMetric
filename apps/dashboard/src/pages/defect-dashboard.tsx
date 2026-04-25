import type { DefectRecord, DefectSummary } from '../api/client.js';

export interface DefectDashboardProps {
  summary: DefectSummary;
  rows: DefectRecord[];
}

const panelStyle = {
  padding: '24px',
  borderRadius: '28px',
  background:
    'linear-gradient(135deg, rgba(255, 247, 245, 0.96), rgba(252, 231, 226, 0.92))',
  border: '1px solid rgba(167, 71, 49, 0.16)',
  boxShadow: '0 18px 38px rgba(139, 55, 38, 0.08)',
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
  border: '1px solid rgba(167, 71, 49, 0.14)',
};

const statLabelStyle = {
  margin: 0,
  color: '#a14f37',
  fontSize: '13px',
  fontWeight: 700,
};

const statValueStyle = {
  margin: '8px 0 0',
  color: '#3c1811',
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

const severityLabelMap: Record<DefectRecord['severity'], string> = {
  sev1: 'Sev1',
  sev2: 'Sev2',
  sev3: 'Sev3',
  sev4: 'Sev4',
};

const phaseLabelMap: Record<DefectRecord['foundInPhase'], string> = {
  development: '开发阶段',
  testing: '测试阶段',
  production: '生产阶段',
};

const formatHours = (value: number) =>
  value > 0 ? `${value.toFixed(1)} 小时` : '暂无已解决缺陷';

export const DefectDashboard = ({ summary, rows }: DefectDashboardProps) => (
  <section style={panelStyle}>
    <p
      style={{
        margin: 0,
        fontSize: '12px',
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: '#b55b3f',
      }}
    >
      Defect Signals
    </p>
    <h2 style={{ margin: '10px 0 6px', fontSize: '28px' }}>缺陷风险概览</h2>
    <p style={{ margin: 0, color: '#814032' }}>
      用真实缺陷事实补齐“质量与风险”维度，先观察缺陷总量、未关闭缺陷、生产缺陷和平均修复时长，后续再继续接事故归因和缺陷损失。
    </p>
    <div style={statGridStyle}>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>缺陷总数</p>
        <p style={statValueStyle}>{summary.totalDefectCount}</p>
      </article>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>未关闭缺陷</p>
        <p style={statValueStyle}>{summary.openDefectCount}</p>
      </article>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>已解决缺陷</p>
        <p style={statValueStyle}>{summary.resolvedDefectCount}</p>
      </article>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>生产缺陷</p>
        <p style={statValueStyle}>{summary.productionDefectCount}</p>
      </article>
      <article style={statCardStyle}>
        <p style={statLabelStyle}>平均修复时长</p>
        <p style={{ ...statValueStyle, fontSize: '24px' }}>
          {formatHours(summary.averageResolutionHours)}
        </p>
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
            border: '1px solid rgba(167, 71, 49, 0.14)',
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
            <strong style={{ color: '#3c1811' }}>
              [{row.provider.toUpperCase()}] {row.defectKey} {row.title}
            </strong>
            <span style={{ color: '#9c4c38' }}>
              {severityLabelMap[row.severity]} / {row.status === 'resolved' ? '已解决' : '处理中'}
            </span>
          </div>
          <p style={{ margin: '8px 0 0', color: '#814032' }}>
            项目：{row.projectKey} / 发现阶段：{phaseLabelMap[row.foundInPhase]}
            {row.linkedRequirementKeys.length > 0
              ? ` / 关联需求：${row.linkedRequirementKeys.join(', ')}`
              : ''}
            {row.linkedPullRequestNumbers.length > 0
              ? ` / 关联 PR：${row.linkedPullRequestNumbers.join(', ')}`
              : ''}
          </p>
          <p style={{ margin: '6px 0 0', color: '#814032' }}>
            创建时间：{new Date(row.createdAt).toLocaleString('zh-CN')}
            {row.resolvedAt
              ? ` / 解决时间：${new Date(row.resolvedAt).toLocaleString('zh-CN')}`
              : ''}
          </p>
        </li>
      ))}
    </ul>
  </section>
);
