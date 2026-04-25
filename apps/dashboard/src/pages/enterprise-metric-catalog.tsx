import type {
  EnterpriseMetricCatalog,
  EnterpriseMetricDashboardPlacement,
  MetricCalculationResult,
} from '../api/client.js';

export interface EnterpriseMetricCatalogPanelProps {
  catalog: EnterpriseMetricCatalog;
  metricValues?: MetricCalculationResult[];
}

const sectionStyle = {
  padding: '24px',
  borderRadius: '28px',
  background:
    'linear-gradient(135deg, rgba(46, 36, 27, 0.96), rgba(92, 70, 48, 0.92))',
  color: '#fff8ee',
  boxShadow: '0 24px 48px rgba(62, 43, 24, 0.18)',
};

const dimensionGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: '12px',
  marginTop: '18px',
};

const dimensionCardStyle = {
  borderRadius: '18px',
  padding: '16px',
  background: 'rgba(255, 248, 238, 0.11)',
  border: '1px solid rgba(255, 248, 238, 0.18)',
};

const metricGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '14px',
  marginTop: '18px',
};

const metricCardStyle = {
  borderRadius: '18px',
  padding: '16px',
  background: '#fffaf2',
  color: '#2e241b',
  border: '1px solid rgba(255, 248, 238, 0.8)',
};

const calculatedMetricCardStyle = {
  borderRadius: '18px',
  padding: '16px',
  background: 'rgba(255, 248, 238, 0.11)',
  border: '1px solid rgba(255, 248, 238, 0.2)',
};

const placementNames: Record<EnterpriseMetricDashboardPlacement, string> = {
  'employee-experience': '员工体验',
  'effectiveness-management': '提效管理者',
  'engineering-management': '技术管理者',
  'platform-operations': '平台运营',
};

const getAutomationLabel = (automationLevel: string) => {
  if (automationLevel === 'high') {
    return '高自动化';
  }

  if (automationLevel === 'medium') {
    return '中自动化';
  }

  return '低自动化';
};

const countMetricsByPlacement = (
  catalog: EnterpriseMetricCatalog,
  placement: EnterpriseMetricDashboardPlacement,
) =>
  catalog.metrics.filter((metric) => metric.dashboardPlacement === placement)
    .length;

const formatMetricValue = ({ value, unit }: MetricCalculationResult) => {
  if (unit === 'ratio') {
    return `${(value * 100).toFixed(1)}％`;
  }

  if (unit === 'hours') {
    return `${value.toFixed(1)} 小时`;
  }

  return new Intl.NumberFormat('zh-CN').format(value);
};

const confidenceNames: Record<MetricCalculationResult['confidence'], string> = {
  high: '高置信',
  medium: '中置信',
  low: '低置信',
};

export const EnterpriseMetricCatalogPanel = ({
  catalog,
  metricValues = [],
}: EnterpriseMetricCatalogPanelProps) => {
  const highlightedMetrics = catalog.metrics.slice(0, 6);

  return (
    <section style={sectionStyle}>
      <div>
        <p
          style={{
            margin: 0,
            fontSize: '12px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#e4c8a7',
          }}
        >
          Enterprise Metric Semantics
        </p>
        <h2 style={{ margin: '10px 0 8px', fontSize: '30px' }}>
          企业指标语义层
        </h2>
        <p style={{ margin: 0, maxWidth: '760px', color: '#ead7bf' }}>
          把出码率升级为企业级六类指标字典：每个指标都有口径、数据源、自动化等级、适用管理场景和反误导说明，后续 Dashboard、Agent 与 RAG 都复用同一套语义。
        </p>
      </div>

      <div style={dimensionGridStyle} aria-label="六类核心维度">
        <h3
          style={{
            gridColumn: '1 / -1',
            margin: 0,
            fontSize: '18px',
            color: '#fff8ee',
          }}
        >
          六类核心维度
        </h3>
        {catalog.dimensions.map((dimension) => (
          <article key={dimension.key} style={dimensionCardStyle}>
            <h4 style={{ margin: '0 0 8px', fontSize: '17px' }}>
              {dimension.name}
            </h4>
            <p style={{ margin: 0, color: '#ead7bf', fontSize: '14px' }}>
              {dimension.question}
            </p>
          </article>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          marginTop: '18px',
        }}
      >
        {(
          [
            'effectiveness-management',
            'engineering-management',
            'employee-experience',
            'platform-operations',
          ] as EnterpriseMetricDashboardPlacement[]
        ).map((placement) => (
          <div key={placement} style={dimensionCardStyle}>
            <p style={{ margin: 0, color: '#e4c8a7', fontSize: '13px' }}>
              {placementNames[placement]}
            </p>
            <strong style={{ display: 'block', marginTop: '8px', fontSize: '28px' }}>
              {countMetricsByPlacement(catalog, placement)}
            </strong>
          </div>
        ))}
      </div>

      <div style={metricGridStyle} aria-label="统一指标计算管线">
        <h3
          style={{
            gridColumn: '1 / -1',
            margin: 0,
            fontSize: '18px',
            color: '#fff8ee',
          }}
        >
          统一指标计算管线
        </h3>
        {metricValues.map((metricValue) => (
          <article key={metricValue.metricKey} style={calculatedMetricCardStyle}>
            <p style={{ margin: 0, color: '#e4c8a7', fontSize: '13px' }}>
              {confidenceNames[metricValue.confidence]} ·{' '}
              {placementNames[metricValue.definition.dashboardPlacement]}
            </p>
            <strong
              style={{ display: 'block', marginTop: '8px', fontSize: '30px' }}
            >
              {formatMetricValue(metricValue)}
              <span style={{ fontSize: '14px', fontWeight: 600 }}>
                {' '}
                {confidenceNames[metricValue.confidence]}
              </span>
            </strong>
            <h4 style={{ margin: '8px 0 0', fontSize: '17px' }}>
              {metricValue.definition.name}
            </h4>
            <p style={{ margin: '8px 0 0', color: '#ead7bf', fontSize: '13px' }}>
              {metricValue.definition.formula}
            </p>
          </article>
        ))}
      </div>

      <div style={metricGridStyle}>
        {highlightedMetrics.map((metric) => (
          <article key={metric.key} style={metricCardStyle}>
            <p
              style={{
                margin: 0,
                color: '#8b6846',
                fontSize: '12px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {getAutomationLabel(metric.automationLevel)} ·{' '}
              {placementNames[metric.dashboardPlacement]}
            </p>
            <h3 style={{ margin: '8px 0', fontSize: '19px' }}>{metric.name}</h3>
            <p style={{ margin: 0, color: '#5d4733', fontSize: '14px' }}>
              {metric.formula}
            </p>
            <p
              style={{
                margin: '12px 0 0',
                color: '#7c3f2c',
                fontSize: '13px',
              }}
            >
              {metric.antiGamingNote}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
};
