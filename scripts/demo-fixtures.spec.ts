import { describe, expect, it } from 'vitest';
import {
  createDemoImportPlan,
  createDemoPayloads,
} from './demo-fixtures.mjs';

describe('demo fixtures', () => {
  it('builds a coherent demo dataset for the dashboard walkthrough', () => {
    const payloads = createDemoPayloads('demo-project');

    expect(payloads.pullRequests).toHaveLength(2);
    expect(payloads.requirements).toHaveLength(2);
    expect(payloads.ciRuns).toHaveLength(2);
    expect(payloads.deployments).toHaveLength(2);
    expect(payloads.incidents).toHaveLength(1);
    expect(payloads.defects).toHaveLength(2);
    expect(payloads.requirements[0]).toEqual(
      expect.objectContaining({
        projectKey: 'demo-project',
        requirementKey: 'AIM-101',
        priority: 'critical',
      }),
    );
    expect(payloads.defects[0]).toEqual(
      expect.objectContaining({
        linkedDeploymentIds: ['deploy-2'],
        linkedIncidentKeys: ['INC-9'],
      }),
    );
  });

  it('builds the import plan in the expected API order', () => {
    const plan = createDemoImportPlan('demo-project');

    expect(plan.map(([path]) => path)).toEqual([
      '/integrations/pull-requests/import',
      '/integrations/requirements/import',
      '/integrations/ci/runs/import',
      '/integrations/deployments/import',
      '/integrations/incidents/import',
      '/integrations/defects/import',
      '/enterprise-metrics/recalculate',
    ]);
    expect(plan[0][1]).toHaveProperty('pullRequests');
    expect(plan[6][1]).toEqual(
      expect.objectContaining({
        projectKey: 'demo-project',
      }),
    );
  });
});
