import type { CollectorIngestionHealth } from '../api/client.js';

export interface CollectorHealthDashboardProps {
  health: CollectorIngestionHealth;
}

const panelStyle = {
  padding: '24px',
  borderRadius: '28px',
  background:
    'linear-gradient(135deg, rgba(250, 251, 246, 0.96), rgba(235, 246, 231, 0.92))',
  border: '1px solid rgba(87, 119, 72, 0.18)',
  boxShadow: '0 18px 38px rgba(48, 78, 42, 0.09)',
};

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: '14px',
  marginTop: '18px',
};

const cardStyle = {
  borderRadius: '20px',
  padding: '16px',
  background: 'rgba(255, 255, 255, 0.72)',
  border: '1px solid rgba(87, 119, 72, 0.15)',
};

const labelStyle = {
  margin: 0,
  color: '#577248',
  fontSize: '13px',
  fontWeight: 700,
};

const valueStyle = {
  margin: '8px 0 0',
  color: '#1d2a19',
  fontSize: '30px',
  fontWeight: 800,
};

export const CollectorHealthDashboard = ({
  health,
}: CollectorHealthDashboardProps) => {
  const modeLabel = health.deliveryMode === 'queue' ? '队列模式' : '同步模式';
  const riskLabel =
    health.deadLetterDepth > 0
      ? '存在 DLQ，需要排查重放'
      : health.queueDepth > 0
        ? '存在积压，建议观察 flush'
        : '采集链路无明显积压';

  return (
    <section style={panelStyle}>
      <p
        style={{
          margin: 0,
          fontSize: '12px',
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: '#6b855b',
        }}
      >
        Platform Operations
      </p>
      <h2 style={{ margin: '10px 0 6px', fontSize: '28px' }}>采集健康运营</h2>
      <p style={{ margin: 0, color: '#506243' }}>
        面向平台管理员和提效运营，监控 collector-gateway 的投递模式、队列积压、DLQ 与失败投递，避免“看板没数”被误判成“员工没用”。
      </p>
      <div style={gridStyle}>
        <article style={cardStyle}>
          <p style={labelStyle}>投递模式</p>
          <p style={{ ...valueStyle, fontSize: '24px' }}>{modeLabel}</p>
        </article>
        <article style={cardStyle}>
          <p style={labelStyle}>待投递批次</p>
          <p style={valueStyle}>{health.queueDepth}</p>
        </article>
        <article style={cardStyle}>
          <p style={labelStyle}>DLQ 批次</p>
          <p style={valueStyle}>{health.deadLetterDepth}</p>
        </article>
        <article style={cardStyle}>
          <p style={labelStyle}>已投递批次</p>
          <p style={valueStyle}>{health.forwardedTotal}</p>
        </article>
        <article style={cardStyle}>
          <p style={labelStyle}>失败投递次数</p>
          <p style={valueStyle}>{health.failedForwardTotal}</p>
        </article>
      </div>
      <p style={{ margin: '16px 0 0', color: '#506243', fontWeight: 700 }}>
        {riskLabel}
      </p>
    </section>
  );
};
