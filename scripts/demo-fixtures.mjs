export const createDemoPayloads = (projectKey = 'aimetric') => {
  const pullRequests = [
    {
      provider: 'github',
      projectKey,
      repoName: 'AIMetric',
      prNumber: 101,
      title: 'AIM-101 Add management dashboard',
      authorMemberId: 'alice',
      state: 'merged',
      aiTouched: true,
      reviewDecision: 'approved',
      linkedRequirementKeys: ['AIM-101'],
      createdAt: '2026-04-23T00:00:00.000Z',
      mergedAt: '2026-04-23T12:00:00.000Z',
      updatedAt: '2026-04-23T12:00:00.000Z',
    },
    {
      provider: 'gitlab',
      projectKey,
      repoName: 'AIMetric',
      prNumber: 102,
      title: 'AIM-102 Refine metrics pipeline',
      authorMemberId: 'bob',
      state: 'merged',
      aiTouched: false,
      reviewDecision: 'changes-requested',
      linkedRequirementKeys: ['AIM-102'],
      createdAt: '2026-04-23T06:00:00.000Z',
      mergedAt: '2026-04-24T06:00:00.000Z',
      updatedAt: '2026-04-24T06:00:00.000Z',
    },
  ];

  const requirements = [
    {
      provider: 'jira',
      projectKey,
      requirementKey: 'AIM-101',
      title: 'Build management dashboard',
      ownerMemberId: 'alice',
      priority: 'critical',
      status: 'done',
      aiTouched: true,
      firstPrCreatedAt: '2026-04-23T00:00:00.000Z',
      completedAt: '2026-04-24T00:00:00.000Z',
      releasedAt: '2026-04-25T00:00:00.000Z',
      createdAt: '2026-04-22T00:00:00.000Z',
      updatedAt: '2026-04-25T00:00:00.000Z',
    },
    {
      provider: 'tapd',
      projectKey,
      requirementKey: 'AIM-102',
      title: 'Improve metrics pipeline',
      ownerMemberId: 'bob',
      priority: 'high',
      status: 'done',
      aiTouched: false,
      firstPrCreatedAt: '2026-04-23T06:00:00.000Z',
      completedAt: '2026-04-24T12:00:00.000Z',
      releasedAt: '2026-04-25T12:00:00.000Z',
      createdAt: '2026-04-22T06:00:00.000Z',
      updatedAt: '2026-04-25T12:00:00.000Z',
    },
  ];

  const ciRuns = [
    {
      provider: 'github-actions',
      projectKey,
      repoName: 'AIMetric',
      runId: 501,
      workflowName: 'ci',
      status: 'completed',
      conclusion: 'success',
      createdAt: '2026-04-23T00:10:00.000Z',
      completedAt: '2026-04-23T00:24:00.000Z',
      updatedAt: '2026-04-23T00:24:00.000Z',
    },
    {
      provider: 'gitlab-ci',
      projectKey,
      repoName: 'AIMetric',
      runId: 502,
      workflowName: 'ci',
      status: 'completed',
      conclusion: 'failure',
      createdAt: '2026-04-23T06:30:00.000Z',
      completedAt: '2026-04-23T06:42:00.000Z',
      updatedAt: '2026-04-23T06:42:00.000Z',
    },
  ];

  const deployments = [
    {
      provider: 'github-actions',
      projectKey,
      repoName: 'AIMetric',
      deploymentId: 'deploy-1',
      environment: 'production',
      status: 'success',
      aiTouched: true,
      rolledBack: false,
      createdAt: '2026-04-24T01:00:00.000Z',
      finishedAt: '2026-04-24T01:18:00.000Z',
      updatedAt: '2026-04-24T01:18:00.000Z',
    },
    {
      provider: 'argo-cd',
      projectKey,
      repoName: 'AIMetric',
      deploymentId: 'deploy-2',
      environment: 'production',
      status: 'failed',
      aiTouched: false,
      rolledBack: true,
      incidentKey: 'INC-9',
      createdAt: '2026-04-24T06:00:00.000Z',
      finishedAt: '2026-04-24T06:16:00.000Z',
      updatedAt: '2026-04-24T06:16:00.000Z',
    },
  ];

  const incidents = [
    {
      provider: 'pagerduty',
      projectKey,
      incidentKey: 'INC-9',
      title: 'Production deployment issue',
      severity: 'sev2',
      status: 'resolved',
      linkedDeploymentIds: ['deploy-2'],
      createdAt: '2026-04-24T06:10:00.000Z',
      resolvedAt: '2026-04-24T08:40:00.000Z',
      updatedAt: '2026-04-24T08:40:00.000Z',
    },
  ];

  const defects = [
    {
      provider: 'jira',
      projectKey,
      defectKey: 'BUG-7',
      title: 'PR merge flow breaks on production',
      severity: 'sev2',
      status: 'resolved',
      foundInPhase: 'production',
      linkedRequirementKeys: ['AIM-101'],
      linkedPullRequestNumbers: [101],
      linkedDeploymentIds: ['deploy-2'],
      linkedIncidentKeys: ['INC-9'],
      createdAt: '2026-04-24T06:20:00.000Z',
      resolvedAt: '2026-04-24T10:20:00.000Z',
      updatedAt: '2026-04-24T10:20:00.000Z',
    },
    {
      provider: 'manual',
      projectKey,
      defectKey: 'BUG-8',
      title: 'Metrics screen edge case',
      severity: 'sev3',
      status: 'open',
      foundInPhase: 'testing',
      linkedRequirementKeys: ['AIM-102'],
      linkedPullRequestNumbers: [102],
      createdAt: '2026-04-24T02:00:00.000Z',
      updatedAt: '2026-04-24T02:00:00.000Z',
    },
  ];

  return {
    pullRequests,
    requirements,
    ciRuns,
    deployments,
    incidents,
    defects,
    recalculateBody: {
      projectKey,
      from: '2026-04-22T00:00:00.000Z',
      to: '2026-04-26T00:00:00.000Z',
    },
  };
};

export const createDemoImportPlan = (projectKey = 'aimetric') => {
  const payloads = createDemoPayloads(projectKey);

  return [
    ['/integrations/pull-requests/import', { pullRequests: payloads.pullRequests }],
    ['/integrations/requirements/import', { requirements: payloads.requirements }],
    ['/integrations/ci/runs/import', { ciRuns: payloads.ciRuns }],
    ['/integrations/deployments/import', { deployments: payloads.deployments }],
    ['/integrations/incidents/import', { incidents: payloads.incidents }],
    ['/integrations/defects/import', { defects: payloads.defects }],
    ['/enterprise-metrics/recalculate', payloads.recalculateBody],
  ];
};
