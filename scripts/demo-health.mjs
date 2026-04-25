export const createDemoChecks = (
  metricPlatformBaseUrl = 'http://127.0.0.1:3001',
  collectorBaseUrl = 'http://127.0.0.1:3000',
  projectKey = 'aimetric',
) => [
  {
    name: 'collector-health',
    url: `${collectorBaseUrl}/health`,
  },
  {
    name: 'collector-ready',
    url: `${collectorBaseUrl}/ready`,
  },
  {
    name: 'collector-ingestion-health',
    url: `${collectorBaseUrl}/ingestion/health`,
  },
  {
    name: 'metric-platform-health',
    url: `${metricPlatformBaseUrl}/health`,
  },
  {
    name: 'metric-platform-ready',
    url: `${metricPlatformBaseUrl}/ready`,
  },
  {
    name: 'governance-directory',
    url: `${metricPlatformBaseUrl}/governance/directory`,
  },
  {
    name: 'enterprise-metric-catalog',
    url: `${metricPlatformBaseUrl}/enterprise-metrics/catalog`,
  },
  {
    name: 'requirement-summary',
    url: `${metricPlatformBaseUrl}/integrations/requirements/summary?projectKey=${encodeURIComponent(projectKey)}`,
  },
  {
    name: 'pull-request-summary',
    url: `${metricPlatformBaseUrl}/integrations/pull-requests/summary?projectKey=${encodeURIComponent(projectKey)}`,
  },
  {
    name: 'defect-attribution-summary',
    url: `${metricPlatformBaseUrl}/integrations/defects/attribution/summary?projectKey=${encodeURIComponent(projectKey)}`,
  },
];
