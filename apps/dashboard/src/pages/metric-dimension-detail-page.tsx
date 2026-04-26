import type {
  EnterpriseMetricCatalog,
  MetricCalculationResult,
} from '../api/client.js';

interface MetricDimensionDetailPageProps {
  dimensionKey: string;
  catalog: EnterpriseMetricCatalog;
  metricValues: MetricCalculationResult[];
  onBack: () => void;
}

const pageStyle = {
  display: 'grid',
  gap: '22px',
};

const heroStyle = {
  borderRadius: '34px',
  padding: '32px',
  background:
    'radial-gradient(circle at top left, rgba(245, 158, 11, 0.2), transparent 30%), radial-gradient(circle at bottom right, rgba(20, 184, 166, 0.18), transparent 32%), linear-gradient(135deg, #2e241b 0%, #5c4630 48%, #153b3b 100%)',
  color: '#fff8ee',
  border: '1px solid rgba(255, 248, 238, 0.18)',
  boxShadow: '0 30px 80px rgba(62, 43, 24, 0.22)',
};

const panelStyle = {
  borderRadius: '26px',
  padding: '22px',
  background: 'rgba(255, 250, 242, 0.92)',
  border: '1px solid rgba(138, 104, 70, 0.16)',
  boxShadow: '0 16px 38px rgba(87, 63, 35, 0.07)',
};

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '16px',
};

const formatMetricValue = ({ value, unit }: MetricCalculationResult) => {
  if (unit === 'ratio') {
    return `${(value * 100).toFixed(1)}%`;
  }

  if (unit === 'hours') {
    return `${value.toFixed(1)} 小时`;
  }

  return new Intl.NumberFormat('zh-CN').format(value);
};

const compactQuestion = (question: string) => question.replaceAll(' ', '');

export const MetricDimensionDetailPage = ({
  dimensionKey,
  catalog,
  metricValues,
  onBack,
}: MetricDimensionDetailPageProps) => {
  const dimension =
    catalog.dimensions.find((item) => item.key === dimensionKey) ??
    catalog.dimensions[0];
  const catalogMetrics = catalog.metrics.filter(
    (metric) => metric.dimension === dimension?.key,
  );
  const calculatedMetrics = metricValues.filter(
    (metric) => metric.definition.dimension === dimension?.key,
  );
  const allMetricNames = new Set([
    ...catalogMetrics.map((metric) => metric.name),
    ...calculatedMetrics.map((metric) => metric.definition.name),
  ]);

  if (!dimension) {
    return (
      <section style={panelStyle}>
        <h2 style={{ margin: 0 }}>指标维度暂不可用</h2>
      </section>
    );
  }

  return (
    <section style={pageStyle}>
      <div style={heroStyle}>
        <button
          type="button"
          onClick={onBack}
          style={{
            border: '1px solid rgba(255, 248, 238, 0.26)',
            borderRadius: '999px',
            padding: '10px 14px',
            background: 'rgba(255, 248, 238, 0.1)',
            color: '#fff8ee',
            cursor: 'pointer',
            fontWeight: 800,
          }}
        >
          返回指标语义层
        </button>
        <p
          style={{
            margin: '24px 0 0',
            color: '#e4c8a7',
            fontSize: '12px',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            fontWeight: 900,
          }}
        >
          Metric Dimension
        </p>
        <h2 style={{ margin: '10px 0 0', fontSize: '42px', lineHeight: 1.08 }}>
          {dimension.name}详情
        </h2>
        <p style={{ margin: '14px 0 0', maxWidth: '780px', color: '#f0ddc4', fontSize: '17px' }}>
          {compactQuestion(dimension.question)}
        </p>
      </div>

      <div style={gridStyle}>
        <article style={panelStyle}>
          <p style={{ margin: 0, color: '#8b6846', fontSize: '13px', fontWeight: 900 }}>
            维度指标数
          </p>
          <strong style={{ display: 'block', marginTop: '10px', color: '#2e241b', fontSize: '34px' }}>
            {allMetricNames.size}
          </strong>
        </article>
        <article style={panelStyle}>
          <p style={{ margin: 0, color: '#8b6846', fontSize: '13px', fontWeight: 900 }}>
            已计算指标
          </p>
          <strong style={{ display: 'block', marginTop: '10px', color: '#2e241b', fontSize: '34px' }}>
            {calculatedMetrics.length}
          </strong>
        </article>
        <article style={panelStyle}>
          <p style={{ margin: 0, color: '#8b6846', fontSize: '13px', fontWeight: 900 }}>
            主要服务对象
          </p>
          <strong style={{ display: 'block', marginTop: '10px', color: '#2e241b', fontSize: '20px' }}>
            {dimension.primaryAudience.join(' / ')}
          </strong>
        </article>
      </div>

      <div style={gridStyle}>
        {[...allMetricNames].map((metricName) => {
          const metricDefinition =
            catalogMetrics.find((metric) => metric.name === metricName) ??
            calculatedMetrics.find((metric) => metric.definition.name === metricName)?.definition;
          const calculated = calculatedMetrics.find(
            (metric) => metric.definition.name === metricName,
          );

          return (
            <article key={metricName} style={panelStyle}>
              <p style={{ margin: 0, color: '#0f766e', fontSize: '13px', fontWeight: 900 }}>
                {calculated ? `当前值 ${formatMetricValue(calculated)}` : '待进入计算管线'}
              </p>
              <h3 style={{ margin: '10px 0 0', color: '#2e241b', fontSize: '24px' }}>
                {metricName}
              </h3>
              <p style={{ margin: '12px 0 0', color: '#5d4733', lineHeight: 1.7 }}>
                {metricDefinition?.formula ?? '该指标已纳入维度视图，后续补齐计算口径。'}
              </p>
              <p style={{ margin: '12px 0 0', color: '#7c3f2c', lineHeight: 1.65, fontSize: '13px' }}>
                {metricDefinition?.antiGamingNote ?? '需要结合采集完整度和质量护栏一起解释。'}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
};
