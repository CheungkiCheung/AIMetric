import { describe, expect, it } from 'vitest';
import { createDemoChecks } from './demo-health.mjs';

describe('demo health checks', () => {
  it('builds the expected demo readiness endpoints', () => {
    const checks = createDemoChecks(
      'http://127.0.0.1:3001',
      'http://127.0.0.1:3000',
      'demo-project',
    );

    expect(checks.map((check) => check.name)).toEqual([
      'collector-health',
      'collector-ready',
      'collector-ingestion-health',
      'metric-platform-health',
      'metric-platform-ready',
      'governance-directory',
      'enterprise-metric-catalog',
      'requirement-summary',
      'pull-request-summary',
      'defect-attribution-summary',
    ]);
    expect(checks[7].url).toContain('projectKey=demo-project');
    expect(checks[9].url).toContain('/integrations/defects/attribution/summary');
  });
});
