import type { TeamSnapshot } from '../api/client.js';
import { MetricCard } from '../components/metric-card.js';

export interface TeamDashboardProps {
  snapshot: TeamSnapshot;
}

export const TeamDashboard = ({ snapshot }: TeamDashboardProps) => (
  <section>
    <div style={{ marginBottom: '16px' }}>
      <h2 style={{ margin: 0, fontSize: '28px', color: '#241c15' }}>团队出码视图</h2>
      <p style={{ margin: '8px 0 0', color: '#6b523c' }}>
        汇总成员采纳与提交表现，帮助管理者观察团队层面的 AI 产出转化情况。
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
        label="团队 AI 出码率"
        value={`${(snapshot.aiOutputRate * 100).toFixed(1)}%`}
        helper={`AI 采纳 ${snapshot.totalAcceptedAiLines} 行 / 提交 ${snapshot.totalCommitLines} 行`}
      />
      <MetricCard
        label="成员数"
        value={`${snapshot.memberCount}`}
        helper={`总会话数 ${snapshot.totalSessionCount}`}
      />
    </div>
  </section>
);
