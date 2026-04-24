import type { AnalysisSummary } from '../api/client.js';
import { MetricCard } from '../components/metric-card.js';

export interface AnalysisSummaryProps {
  summary: AnalysisSummary;
}

const gridStyle = {
  display: 'grid',
  gap: '16px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
};

export const AnalysisSummarySection = ({ summary }: AnalysisSummaryProps) => (
  <section>
    <div style={{ marginBottom: '16px' }}>
      <h2 style={{ margin: 0, fontSize: '28px', color: '#241c15' }}>分析摘要</h2>
      <p style={{ margin: '8px 0 0', color: '#6b523c' }}>
        用真实采集数据汇总文章里的会话、编辑证据与 Tab 接受主口径。
      </p>
    </div>
    <div style={gridStyle}>
      <MetricCard
        label="会话数"
        value={`${summary.sessionCount}`}
        helper="当前筛选口径下沉淀的会话主线数量"
      />
      <MetricCard
        label="编辑证据数"
        value={`${summary.editSpanCount}`}
        helper="已关联到会话的文件级 edit span 总数"
      />
      <MetricCard
        label="Tab 接受次数"
        value={`${summary.tabAcceptedCount}`}
        helper="当前已采到的补全接受事件次数"
      />
      <MetricCard
        label="Tab 接受行数"
        value={`${summary.tabAcceptedLines}`}
        helper="补全接受累积带来的行级增量"
      />
    </div>
  </section>
);
