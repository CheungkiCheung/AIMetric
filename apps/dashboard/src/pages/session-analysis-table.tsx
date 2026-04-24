import type { SessionAnalysisRow } from '../api/client.js';

export interface SessionAnalysisTableProps {
  rows: SessionAnalysisRow[];
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

export const SessionAnalysisTable = ({ rows }: SessionAnalysisTableProps) => (
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
      <h2 style={{ margin: 0, fontSize: '28px', color: '#241c15' }}>会话分析</h2>
      <p style={{ margin: '8px 0 0', color: '#6b523c' }}>
        以会话为主轴回看消息规模、工作区上下文以及关联到的编辑与 Tab 证据。
      </p>
    </div>
    {rows.length === 0 ? (
      <p style={{ margin: 0, color: '#6b523c' }}>当前筛选条件下暂无会话分析数据。</p>
    ) : (
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={headerCellStyle}>会话</th>
              <th style={headerCellStyle}>工作区</th>
              <th style={headerCellStyle}>消息规模</th>
              <th style={headerCellStyle}>编辑证据</th>
              <th style={headerCellStyle}>Tab</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.sessionId}:${row.occurredAt}`}>
                <td style={cellStyle}>
                  <div style={{ fontWeight: 700 }}>{row.sessionId}</div>
                  <div style={{ color: '#7a5d43', fontSize: '13px' }}>
                    {row.memberId ?? 'unknown'} · {row.projectKey}
                  </div>
                  <div style={{ color: '#7a5d43', fontSize: '13px' }}>
                    最近消息 {row.lastMessageAt ?? row.occurredAt}
                  </div>
                </td>
                <td style={cellStyle}>
                  <div>{row.workspacePath ?? row.workspaceId ?? '未记录工作区'}</div>
                  <div style={{ color: '#7a5d43', fontSize: '13px' }}>
                    指纹 {row.projectFingerprint ?? 'n/a'}
                  </div>
                </td>
                <td style={cellStyle}>
                  <div>轮次 {row.conversationTurns ?? 0}</div>
                  <div style={{ color: '#7a5d43', fontSize: '13px' }}>
                    用户 {row.userMessageCount ?? 0} / 助手 {row.assistantMessageCount ?? 0}
                  </div>
                </td>
                <td style={cellStyle}>{row.editSpanCount}</td>
                <td style={cellStyle}>
                  <div>{row.tabAcceptedCount} 次</div>
                  <div style={{ color: '#7a5d43', fontSize: '13px' }}>
                    {row.tabAcceptedLines} 行
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);
