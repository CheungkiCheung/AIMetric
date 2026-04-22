import type { PersonalSnapshot } from '../api/client.js';
import { MetricCard } from '../components/metric-card.js';

export interface PersonalDashboardProps {
  snapshot: PersonalSnapshot;
}

export const PersonalDashboard = ({ snapshot }: PersonalDashboardProps) => (
  <section>
    <div style={{ marginBottom: '16px' }}>
      <h2 style={{ margin: 0, fontSize: '28px', color: '#241c15' }}>个人出码视图</h2>
      <p style={{ margin: '8px 0 0', color: '#6b523c' }}>
        聚焦个人提交中的 AI 采纳规模、提交体量与会话活跃度。
      </p>
    </div>
    <div
      style={{
        display: 'grid',
        gap: '16px',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      }}
    >
      <MetricCard
        label="AI 出码率"
        value={`${(snapshot.aiOutputRate * 100).toFixed(1)}%`}
        helper={`AI 采纳 ${snapshot.acceptedAiLines} 行 / 提交 ${snapshot.commitTotalLines} 行`}
      />
      <MetricCard
        label="会话数"
        value={`${snapshot.sessionCount}`}
        helper="统计周期内的 MCP 会话采集次数"
      />
    </div>
  </section>
);
