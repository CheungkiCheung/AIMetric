import type { OutputAnalysisRow } from '../api/client.js';

export interface OutputAnalysisTableProps {
  rows: OutputAnalysisRow[];
}

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const,
};

const cellStyle = {
  padding: '12px 14px',
  borderBottom: '1px solid rgba(138, 104, 70, 0.12)',
  textAlign: 'left' as const,
  verticalAlign: 'top' as const,
  color: '#3b2d20',
};

const headerCellStyle = {
  ...cellStyle,
  fontSize: '13px',
  color: '#7a5d43',
  fontWeight: 700,
};

export const OutputAnalysisTable = ({ rows }: OutputAnalysisTableProps) => (
  <section
    style={{
      padding: '22px',
      borderRadius: '24px',
      background: 'rgba(255, 251, 245, 0.88)',
      border: '1px solid rgba(138, 104, 70, 0.18)',
      boxShadow: '0 16px 32px rgba(87, 63, 35, 0.07)',
    }}
  >
    <div style={{ marginBottom: '16px' }}>
      <h2 style={{ margin: 0, fontSize: '28px', color: '#241c15' }}>出码分析</h2>
      <p style={{ margin: '8px 0 0', color: '#6b523c' }}>
        以文件为粒度观察编辑证据与 Tab 采纳在出码侧的落点。
      </p>
    </div>
    {rows.length === 0 ? (
      <p style={{ margin: 0, color: '#6b523c' }}>当前筛选条件下暂无出码分析数据。</p>
    ) : (
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={headerCellStyle}>文件</th>
              <th style={headerCellStyle}>会话</th>
              <th style={headerCellStyle}>编辑证据</th>
              <th style={headerCellStyle}>Tab</th>
              <th style={headerCellStyle}>最近变更摘要</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.sessionId}:${row.filePath}`}>
                <td style={cellStyle}>
                  <div style={{ fontWeight: 700 }}>{row.filePath}</div>
                  <div style={{ color: '#7a5d43', fontSize: '13px' }}>
                    最近编辑 {row.latestEditAt}
                  </div>
                </td>
                <td style={cellStyle}>
                  <div>{row.sessionId}</div>
                  <div style={{ color: '#7a5d43', fontSize: '13px' }}>
                    {row.memberId ?? 'unknown'} · {row.projectKey}
                  </div>
                </td>
                <td style={cellStyle}>{row.editSpanCount}</td>
                <td style={cellStyle}>
                  <div>{row.tabAcceptedCount} 次</div>
                  <div style={{ color: '#7a5d43', fontSize: '13px' }}>
                    {row.tabAcceptedLines} 行
                  </div>
                </td>
                <td style={cellStyle}>
                  {row.latestDiffSummary && row.latestDiffSummary.length > 0
                    ? row.latestDiffSummary
                    : '暂无 diff 摘要'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);
