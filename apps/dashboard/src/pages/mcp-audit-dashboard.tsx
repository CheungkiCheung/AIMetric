import type { McpAuditMetrics } from '../api/client.js';
import { MetricCard } from '../components/metric-card.js';

export interface McpAuditDashboardProps {
  metrics: McpAuditMetrics;
}

const gridStyle = {
  display: 'grid',
  gap: '16px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
};

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

export const McpAuditDashboard = ({ metrics }: McpAuditDashboardProps) => (
  <section>
    <div style={{ marginBottom: '16px' }}>
      <h2 style={{ margin: 0, fontSize: '28px', color: '#241c15' }}>
        MCP 采集质量
      </h2>
      <p style={{ margin: '8px 0 0', color: '#6b523c' }}>
        观察 MCP 工具调用成功率、失败率和平均耗时，帮助定位员工接入与采集链路缺口。
      </p>
    </div>
    <div style={gridStyle}>
      <MetricCard
        label="工具成功率"
        value={formatPercent(metrics.successRate)}
        helper={`成功 ${metrics.successfulToolCalls} 次 / 总调用 ${metrics.totalToolCalls} 次`}
      />
      <MetricCard
        label="工具失败率"
        value={formatPercent(metrics.failureRate)}
        helper={`失败 ${metrics.failedToolCalls} 次，可用于定位采集链路断点`}
      />
      <MetricCard
        label="平均耗时"
        value={`${metrics.averageDurationMs.toFixed(0)}ms`}
        helper="MCP 工具调用从开始到结束的平均耗时"
      />
    </div>
  </section>
);
