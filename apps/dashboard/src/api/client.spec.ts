import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDashboardClient } from './client.js';

describe('createDashboardClient', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('uses live metric-platform responses when the backend is reachable', async () => {
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.endsWith('/metrics/personal')) {
        return new Response(
          JSON.stringify({
            acceptedAiLines: 44,
            commitTotalLines: 55,
            aiOutputRate: 0.8,
            sessionCount: 5,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/metrics/mcp-audit')) {
        return new Response(
          JSON.stringify({
            totalToolCalls: 12,
            successfulToolCalls: 10,
            failedToolCalls: 2,
            successRate: 10 / 12,
            failureRate: 2 / 12,
            averageDurationMs: 24,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/rules/versions')) {
        return new Response(
          JSON.stringify({
            projectKey: 'aimetric',
            activeVersion: 'v2',
            versions: [
              {
                version: 'v2',
                status: 'active',
                updatedAt: '2026-04-24',
                summary: '文件化模板与版本切换基础版',
              },
            ],
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/rules/rollout')) {
        return new Response(
          JSON.stringify({
            projectKey: 'aimetric',
            enabled: true,
            candidateVersion: 'v1',
            percentage: 25,
            includedMembers: ['alice'],
            updatedAt: '2026-04-24T00:00:00.000Z',
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/rules/rollout/evaluate')) {
        return new Response(
          JSON.stringify({
            projectKey: 'aimetric',
            memberId: 'alice',
            enabled: true,
            activeVersion: 'v2',
            selectedVersion: 'v1',
            candidateVersion: 'v1',
            percentage: 25,
            bucket: 7,
            matched: true,
            reason: 'included-member',
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/enterprise-metrics/catalog')) {
        return new Response(
          JSON.stringify({
            dimensions: [
              {
                key: 'adoption',
                name: '使用渗透',
                question: 'AI 有没有真正被用起来',
                primaryAudience: ['effectiveness-manager', 'engineering-manager'],
              },
            ],
            metrics: [
              {
                key: 'ai_ide_user_ratio',
                name: 'AI-IDE 使用人数比例',
                dimension: 'adoption',
                question: 'AI 有没有真正被用起来',
                formula: 'AI-IDE 活跃使用人数 / 目标开发者人数',
                dataSources: [
                  'mcp-events',
                  'tool-adapter-events',
                  'organization-directory',
                ],
                automationLevel: 'high',
                updateFrequency: 'daily',
                dashboardPlacement: 'effectiveness-management',
                assessmentUsage: 'observe-only',
                antiGamingNote: '结合有效产出判断，避免刷打开次数。',
              },
            ],
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/enterprise-metrics/values')) {
        return new Response(
          JSON.stringify([
            {
              metricKey: 'ai_output_rate',
              value: 0.7,
              unit: 'ratio',
              confidence: 'high',
              scope: 'team',
              projectKey: 'aimetric',
              periodStart: '1970-01-01T00:00:00.000Z',
              periodEnd: '2026-04-24T00:00:00.000Z',
              calculatedAt: '2026-04-24T01:00:00.000Z',
              definitionVersion: 1,
              dataRequirements: ['recorded-metric-events'],
              definition: {
                key: 'ai_output_rate',
                name: 'AI 出码率',
                dimension: 'effective-output',
              },
            },
          ]),
          { status: 200 },
        );
      }

      if (url.endsWith('/ingestion/health')) {
        return new Response(
          JSON.stringify({
            deliveryMode: 'queue',
            queueBackend: 'file',
            queueDepth: 3,
            deadLetterDepth: 1,
            enqueuedTotal: 10,
            forwardedTotal: 7,
            failedForwardTotal: 2,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/governance/directory')) {
        return new Response(
          JSON.stringify({
            organization: {
              key: 'aimetric-enterprise',
              name: 'AIMetric Enterprise',
            },
            teams: [
              {
                key: 'platform-engineering',
                name: '平台工程团队',
                organizationKey: 'aimetric-enterprise',
              },
            ],
            projects: [
              {
                key: 'aimetric',
                name: 'AIMetric',
                teamKey: 'platform-engineering',
              },
            ],
            members: [
              {
                memberId: 'alice',
                displayName: 'Alice',
                teamKey: 'platform-engineering',
                role: 'developer',
              },
            ],
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/integrations/pull-requests/summary')) {
        return new Response(
          JSON.stringify({
            totalPrCount: 4,
            aiTouchedPrCount: 3,
            aiTouchedPrRatio: 0.75,
            mergedPrCount: 2,
            averageCycleTimeHours: 18,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/integrations/pull-requests')) {
        return new Response(
          JSON.stringify([
            {
              provider: 'github',
              projectKey: 'aimetric',
              repoName: 'AIMetric',
              prNumber: 101,
              title: 'Add collector health dashboard',
              authorMemberId: 'alice',
              state: 'merged',
              aiTouched: true,
              reviewDecision: 'approved',
              linkedRequirementKeys: ['AIM-101'],
              createdAt: '2026-04-24T00:00:00.000Z',
              mergedAt: '2026-04-24T12:00:00.000Z',
              cycleTimeHours: 12,
              updatedAt: '2026-04-24T12:00:00.000Z',
            },
          ]),
          { status: 200 },
        );
      }

      if (url.endsWith('/integrations/requirements/summary')) {
        return new Response(
          JSON.stringify({
            totalRequirementCount: 5,
            aiTouchedRequirementCount: 3,
            aiTouchedRequirementRatio: 0.6,
            completedRequirementCount: 2,
            averageLeadTimeHours: 36,
            averageLeadTimeToFirstPrHours: 8,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/integrations/requirements')) {
        return new Response(
          JSON.stringify([
            {
              provider: 'jira',
              projectKey: 'aimetric',
              requirementKey: 'AIM-101',
              title: 'Build management dashboard',
              ownerMemberId: 'alice',
              status: 'done',
              aiTouched: true,
              firstPrCreatedAt: '2026-04-24T08:00:00.000Z',
              linkedPullRequestCount: 2,
              linkedPullRequestNumbers: [101, 103],
              completedAt: '2026-04-25T12:00:00.000Z',
              leadTimeHours: 36,
              leadTimeToFirstPrHours: 8,
              createdAt: '2026-04-24T00:00:00.000Z',
              updatedAt: '2026-04-25T12:00:00.000Z',
            },
          ]),
          { status: 200 },
        );
      }

      if (url.endsWith('/integrations/ci/runs/summary')) {
        return new Response(
          JSON.stringify({
            totalRunCount: 4,
            completedRunCount: 4,
            successfulRunCount: 3,
            failedRunCount: 1,
            passRate: 0.75,
            averageDurationMinutes: 12,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/integrations/ci/runs')) {
        return new Response(
          JSON.stringify([
            {
              provider: 'gitlab-ci',
              projectKey: 'aimetric',
              repoName: 'AIMetric',
              runId: 501,
              workflowName: 'ci',
              status: 'completed',
              conclusion: 'success',
              durationMinutes: 14,
              createdAt: '2026-04-24T00:00:00.000Z',
              completedAt: '2026-04-24T00:14:00.000Z',
              updatedAt: '2026-04-24T00:14:00.000Z',
            },
          ]),
          { status: 200 },
        );
      }

      if (url.endsWith('/integrations/deployments/summary')) {
        return new Response(
          JSON.stringify({
            totalDeploymentCount: 4,
            successfulDeploymentCount: 3,
            failedDeploymentCount: 1,
            rolledBackDeploymentCount: 1,
            aiTouchedDeploymentCount: 3,
            changeFailureRate: 0.25,
            rollbackRate: 0.25,
            averageDurationMinutes: 16,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/integrations/deployments')) {
        return new Response(
          JSON.stringify([
            {
              provider: 'github-actions',
              projectKey: 'aimetric',
              repoName: 'AIMetric',
              deploymentId: 'deploy-1',
              environment: 'production',
              status: 'success',
              aiTouched: true,
              rolledBack: false,
              createdAt: '2026-04-24T02:00:00.000Z',
              finishedAt: '2026-04-24T02:18:00.000Z',
              updatedAt: '2026-04-24T02:18:00.000Z',
            },
          ]),
          { status: 200 },
        );
      }

      if (url.endsWith('/integrations/incidents/summary')) {
        return new Response(
          JSON.stringify({
            totalIncidentCount: 2,
            openIncidentCount: 1,
            resolvedIncidentCount: 1,
            linkedDeploymentCount: 2,
            averageResolutionHours: 2.5,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/integrations/incidents')) {
        return new Response(
          JSON.stringify([
            {
              provider: 'pagerduty',
              projectKey: 'aimetric',
              incidentKey: 'INC-7',
              title: 'Production deployment issue',
              severity: 'sev2',
              status: 'resolved',
              linkedDeploymentIds: ['deploy-2'],
              createdAt: '2026-04-24T03:05:00.000Z',
              resolvedAt: '2026-04-24T05:35:00.000Z',
              updatedAt: '2026-04-24T05:35:00.000Z',
            },
          ]),
          { status: 200 },
        );
      }

      if (url.endsWith('/integrations/defects/summary')) {
        return new Response(
          JSON.stringify({
            totalDefectCount: 3,
            openDefectCount: 1,
            resolvedDefectCount: 2,
            productionDefectCount: 1,
            averageResolutionHours: 6,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/integrations/defects')) {
        return new Response(
          JSON.stringify([
            {
              provider: 'jira',
              projectKey: 'aimetric',
              defectKey: 'BUG-7',
              title: 'PR merge flow breaks on production',
              severity: 'sev2',
              status: 'resolved',
              foundInPhase: 'production',
              linkedRequirementKeys: ['AIM-101'],
              linkedPullRequestNumbers: [101],
              createdAt: '2026-04-24T04:00:00.000Z',
              resolvedAt: '2026-04-24T10:00:00.000Z',
              updatedAt: '2026-04-24T10:00:00.000Z',
            },
          ]),
          { status: 200 },
        );
      }

      if (url.endsWith('/integrations/defects/attribution/summary')) {
        return new Response(
          JSON.stringify({
            totalDefectCount: 3,
            aiTouchedRequirementDefectCount: 2,
            aiTouchedRequirementDefectRate: 1,
            aiTouchedPullRequestDefectCount: 2,
            escapedAiTouchedPullRequestDefectCount: 1,
            escapedAiTouchedPullRequestDefectRate: 0.5,
            productionDefectCount: 1,
            failedDeploymentLinkedDefectCount: 1,
            incidentLinkedDefectCount: 1,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith('/integrations/defects/attribution')) {
        return new Response(
          JSON.stringify([
            {
              defectKey: 'BUG-7',
              title: 'PR merge flow breaks on production',
              projectKey: 'aimetric',
              severity: 'sev2',
              status: 'resolved',
              foundInPhase: 'production',
              linkedRequirementKeys: ['AIM-101'],
              linkedPullRequestNumbers: [101],
              linkedDeploymentIds: ['deploy-2'],
              linkedIncidentKeys: ['INC-9'],
              aiTouchedRequirement: true,
              aiTouchedPullRequest: true,
              createdAt: '2026-04-24T04:00:00.000Z',
              resolvedAt: '2026-04-24T10:00:00.000Z',
            },
          ]),
          { status: 200 },
        );
      }

      if (url.includes('/governance/viewer-scopes')) {
        return new Response(
          JSON.stringify({
            viewerId: 'manager-1',
            teamKeys: ['platform-engineering'],
            projectKeys: ['aimetric'],
            updatedAt: '2026-04-25T00:00:00.000Z',
          }),
          { status: 200 },
        );
      }

      return new Response(
        JSON.stringify({
          memberCount: 3,
          totalAcceptedAiLines: 90,
          totalCommitLines: 120,
          totalSessionCount: 9,
          aiOutputRate: 0.75,
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const client = createDashboardClient('http://127.0.0.1:3001');

    await expect(client.getPersonalSnapshot()).resolves.toMatchObject({
      aiOutputRate: 0.8,
      sessionCount: 5,
    });
    await expect(client.getTeamSnapshot()).resolves.toMatchObject({
      aiOutputRate: 0.75,
      memberCount: 3,
    });
    await expect(client.getMcpAuditMetrics()).resolves.toMatchObject({
      totalToolCalls: 12,
      successfulToolCalls: 10,
      failedToolCalls: 2,
      averageDurationMs: 24,
    });
    await expect(client.getRuleVersions()).resolves.toMatchObject({
      projectKey: 'aimetric',
      activeVersion: 'v2',
    });
    await expect(client.getRuleRollout()).resolves.toMatchObject({
      projectKey: 'aimetric',
      enabled: true,
      candidateVersion: 'v1',
      percentage: 25,
    });
    await expect(client.getRuleRolloutEvaluation()).resolves.toMatchObject({
      selectedVersion: 'v1',
      matched: true,
      reason: 'included-member',
    });
    await expect(client.getEnterpriseMetricCatalog()).resolves.toMatchObject({
      dimensions: expect.arrayContaining([
        expect.objectContaining({
          key: 'adoption',
          name: '使用渗透',
        }),
      ]),
      metrics: expect.arrayContaining([
        expect.objectContaining({
          key: 'ai_ide_user_ratio',
          dashboardPlacement: 'effectiveness-management',
        }),
      ]),
    });
    await expect(client.getEnterpriseMetricValues()).resolves.toEqual([
      expect.objectContaining({
        metricKey: 'ai_output_rate',
        value: 0.7,
        definition: expect.objectContaining({
          name: 'AI 出码率',
        }),
      }),
    ]);
    await expect(client.getCollectorIngestionHealth()).resolves.toMatchObject({
      deliveryMode: 'queue',
      queueBackend: 'file',
      queueDepth: 3,
      deadLetterDepth: 1,
      failedForwardTotal: 2,
    });
    await expect(client.getGovernanceDirectory()).resolves.toMatchObject({
      organization: {
        key: 'aimetric-enterprise',
      },
      teams: [expect.objectContaining({ key: 'platform-engineering' })],
    });
    await expect(client.getPullRequestSummary()).resolves.toMatchObject({
      totalPrCount: 4,
      aiTouchedPrCount: 3,
      aiTouchedPrRatio: 0.75,
      mergedPrCount: 2,
      averageCycleTimeHours: 18,
    });
    await expect(client.getPullRequests()).resolves.toEqual([
      expect.objectContaining({
        provider: 'github',
        prNumber: 101,
        aiTouched: true,
        cycleTimeHours: 12,
        linkedRequirementKeys: ['AIM-101'],
      }),
    ]);
    await expect(client.getRequirementSummary()).resolves.toMatchObject({
      totalRequirementCount: 5,
      aiTouchedRequirementCount: 3,
      aiTouchedRequirementRatio: 0.6,
      completedRequirementCount: 2,
      averageLeadTimeHours: 36,
      averageLeadTimeToFirstPrHours: 8,
    });
    await expect(client.getRequirements()).resolves.toEqual([
      expect.objectContaining({
        provider: 'jira',
        requirementKey: 'AIM-101',
        aiTouched: true,
        leadTimeHours: 36,
        linkedPullRequestCount: 2,
      }),
    ]);
    await expect(client.getCiRunSummary()).resolves.toMatchObject({
      totalRunCount: 4,
      completedRunCount: 4,
      successfulRunCount: 3,
      failedRunCount: 1,
      passRate: 0.75,
      averageDurationMinutes: 12,
    });
    await expect(client.getCiRuns()).resolves.toEqual([
      expect.objectContaining({
        provider: 'gitlab-ci',
        runId: 501,
        conclusion: 'success',
      }),
    ]);
    await expect(client.getDeploymentSummary()).resolves.toMatchObject({
      totalDeploymentCount: 4,
      changeFailureRate: 0.25,
      rollbackRate: 0.25,
    });
    await expect(client.getDeployments()).resolves.toEqual([
      expect.objectContaining({
        deploymentId: 'deploy-1',
        status: 'success',
      }),
    ]);
    await expect(client.getIncidentSummary()).resolves.toMatchObject({
      totalIncidentCount: 2,
      openIncidentCount: 1,
    });
    await expect(client.getIncidents()).resolves.toEqual([
      expect.objectContaining({
        incidentKey: 'INC-7',
        severity: 'sev2',
      }),
    ]);
    await expect(client.getViewerScopeAssignment('manager-1')).resolves.toMatchObject({
      viewerId: 'manager-1',
      teamKeys: ['platform-engineering'],
      projectKeys: ['aimetric'],
    });
    await expect(
      client.updateRuleRollout({
        projectKey: 'aimetric',
        enabled: true,
        candidateVersion: 'v1',
        percentage: 40,
        includedMembers: ['alice', 'bob'],
      }),
    ).resolves.toMatchObject({
      projectKey: 'aimetric',
      enabled: true,
      candidateVersion: 'v1',
      percentage: 25,
    });
  });

  it('passes dashboard filters as metric query parameters', async () => {
    const requestedUrls: string[] = [];

    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      requestedUrls.push(String(input));
      return new Response(
        JSON.stringify({
          acceptedAiLines: 1,
          commitTotalLines: 2,
          aiOutputRate: 0.5,
          sessionCount: 1,
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const client = createDashboardClient('http://127.0.0.1:3001');

    const filters = {
      projectKey: 'navigation',
      memberId: 'alice',
      from: '2026-04-23T00:00:00.000Z',
      to: '2026-04-24T00:00:00.000Z',
    };

    await client.getPersonalSnapshot(filters);
    await client.getMcpAuditMetrics(filters);
    await client.getRuleVersions('navigation');
    await client.getRuleRollout('navigation');
    await client.getRuleRolloutEvaluation('navigation', 'alice');
    await client.getEnterpriseMetricCatalog();
    await client.getEnterpriseMetricValues(filters, ['ai_session_count']);
    await client.getPullRequestSummary(filters);
    await client.getPullRequests(filters);
    await client.getRequirementSummary(filters);
    await client.getRequirements(filters);
    await client.getCiRunSummary(filters);
    await client.getCiRuns(filters);
    await client.getDeploymentSummary(filters);
    await client.getDeployments(filters);
    await client.getIncidentSummary(filters);
    await client.getIncidents(filters);
    await client.getDefectSummary(filters);
    await client.getDefects(filters);
    await client.getDefectAttributionSummary(filters);
    await client.getDefectAttributionRows(filters);

    expect(requestedUrls[0]).toBe(
      'http://127.0.0.1:3001/metrics/personal?projectKey=navigation&memberId=alice&from=2026-04-23T00%3A00%3A00.000Z&to=2026-04-24T00%3A00%3A00.000Z',
    );
    expect(requestedUrls[1]).toBe(
      'http://127.0.0.1:3001/metrics/mcp-audit?projectKey=navigation&memberId=alice&from=2026-04-23T00%3A00%3A00.000Z&to=2026-04-24T00%3A00%3A00.000Z',
    );
    expect(requestedUrls[2]).toBe(
      'http://127.0.0.1:3001/rules/versions?projectKey=navigation',
    );
    expect(requestedUrls[3]).toBe(
      'http://127.0.0.1:3001/rules/rollout?projectKey=navigation',
    );
    expect(requestedUrls[4]).toBe(
      'http://127.0.0.1:3001/rules/rollout/evaluate?projectKey=navigation&memberId=alice',
    );
    expect(requestedUrls[5]).toBe(
      'http://127.0.0.1:3001/enterprise-metrics/catalog',
    );
    expect(requestedUrls[6]).toBe(
      'http://127.0.0.1:3001/enterprise-metrics/values?projectKey=navigation&memberId=alice&from=2026-04-23T00%3A00%3A00.000Z&to=2026-04-24T00%3A00%3A00.000Z&metricKey=ai_session_count',
    );
    expect(requestedUrls[7]).toBe(
      'http://127.0.0.1:3001/integrations/pull-requests/summary?projectKey=navigation&memberId=alice&from=2026-04-23T00%3A00%3A00.000Z&to=2026-04-24T00%3A00%3A00.000Z',
    );
    expect(requestedUrls[8]).toBe(
      'http://127.0.0.1:3001/integrations/pull-requests?projectKey=navigation&memberId=alice&from=2026-04-23T00%3A00%3A00.000Z&to=2026-04-24T00%3A00%3A00.000Z',
    );
    expect(requestedUrls[9]).toBe(
      'http://127.0.0.1:3001/integrations/requirements/summary?projectKey=navigation&memberId=alice&from=2026-04-23T00%3A00%3A00.000Z&to=2026-04-24T00%3A00%3A00.000Z',
    );
    expect(requestedUrls[10]).toBe(
      'http://127.0.0.1:3001/integrations/requirements?projectKey=navigation&memberId=alice&from=2026-04-23T00%3A00%3A00.000Z&to=2026-04-24T00%3A00%3A00.000Z',
    );
    expect(requestedUrls[11]).toBe(
      'http://127.0.0.1:3001/integrations/ci/runs/summary?projectKey=navigation&memberId=alice&from=2026-04-23T00%3A00%3A00.000Z&to=2026-04-24T00%3A00%3A00.000Z',
    );
    expect(requestedUrls[12]).toBe(
      'http://127.0.0.1:3001/integrations/ci/runs?projectKey=navigation&memberId=alice&from=2026-04-23T00%3A00%3A00.000Z&to=2026-04-24T00%3A00%3A00.000Z',
    );
    expect(requestedUrls[13]).toBe(
      'http://127.0.0.1:3001/integrations/deployments/summary?projectKey=navigation&memberId=alice&from=2026-04-23T00%3A00%3A00.000Z&to=2026-04-24T00%3A00%3A00.000Z',
    );
    expect(requestedUrls[14]).toBe(
      'http://127.0.0.1:3001/integrations/deployments?projectKey=navigation&memberId=alice&from=2026-04-23T00%3A00%3A00.000Z&to=2026-04-24T00%3A00%3A00.000Z',
    );
    expect(requestedUrls[15]).toBe(
      'http://127.0.0.1:3001/integrations/incidents/summary?projectKey=navigation&memberId=alice&from=2026-04-23T00%3A00%3A00.000Z&to=2026-04-24T00%3A00%3A00.000Z',
    );
    expect(requestedUrls[16]).toBe(
      'http://127.0.0.1:3001/integrations/incidents?projectKey=navigation&memberId=alice&from=2026-04-23T00%3A00%3A00.000Z&to=2026-04-24T00%3A00%3A00.000Z',
    );
    expect(requestedUrls[17]).toBe(
      'http://127.0.0.1:3001/integrations/defects/summary?projectKey=navigation&memberId=alice&from=2026-04-23T00%3A00%3A00.000Z&to=2026-04-24T00%3A00%3A00.000Z',
    );
    expect(requestedUrls[18]).toBe(
      'http://127.0.0.1:3001/integrations/defects?projectKey=navigation&memberId=alice&from=2026-04-23T00%3A00%3A00.000Z&to=2026-04-24T00%3A00%3A00.000Z',
    );
    expect(requestedUrls[19]).toBe(
      'http://127.0.0.1:3001/integrations/defects/attribution/summary?projectKey=navigation&memberId=alice&from=2026-04-23T00%3A00%3A00.000Z&to=2026-04-24T00%3A00%3A00.000Z',
    );
    expect(requestedUrls[20]).toBe(
      'http://127.0.0.1:3001/integrations/defects/attribution?projectKey=navigation&memberId=alice&from=2026-04-23T00%3A00%3A00.000Z&to=2026-04-24T00%3A00%3A00.000Z',
    );
  });

  it('can use a separate collector-gateway base url for ingestion health', async () => {
    const requestedUrls: string[] = [];
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      requestedUrls.push(String(input));
      return new Response(
        JSON.stringify({
          deliveryMode: 'sync',
          queueBackend: 'memory',
          queueDepth: 0,
          deadLetterDepth: 0,
          enqueuedTotal: 0,
          forwardedTotal: 4,
          failedForwardTotal: 0,
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const client = createDashboardClient(
      'http://127.0.0.1:3001',
      'http://127.0.0.1:3000',
    );

    await expect(client.getCollectorIngestionHealth()).resolves.toMatchObject({
      deliveryMode: 'sync',
      queueBackend: 'memory',
      forwardedTotal: 4,
    });
    expect(requestedUrls).toEqual([
      'http://127.0.0.1:3000/ingestion/health',
    ]);
  });

  it('falls back to a safe collector health snapshot when gateway is unavailable', async () => {
    globalThis.fetch = vi.fn(async () => new Response('', { status: 503 })) as typeof fetch;

    const client = createDashboardClient('http://127.0.0.1:3001');

    await expect(client.getCollectorIngestionHealth()).resolves.toEqual({
      deliveryMode: 'sync',
      queueBackend: 'memory',
      queueDepth: 0,
      deadLetterDepth: 0,
      enqueuedTotal: 0,
      forwardedTotal: 0,
      failedForwardTotal: 0,
    });
    await expect(client.getGovernanceDirectory()).resolves.toEqual({
      organization: {
        key: 'aimetric-enterprise',
        name: 'AIMetric Enterprise',
      },
      teams: [],
      projects: [],
      members: [],
    });
  });

  it('falls back to the bundled enterprise metric catalog when backend is unavailable', async () => {
    globalThis.fetch = vi.fn(async () => new Response('', { status: 503 })) as typeof fetch;

    const client = createDashboardClient('http://127.0.0.1:3001');
    const catalog = await client.getEnterpriseMetricCatalog();

    expect(catalog.dimensions.map((dimension) => dimension.key)).toEqual([
      'adoption',
      'effective-output',
      'delivery-efficiency',
      'quality-risk',
      'experience-capability',
      'business-value',
    ]);
    expect(catalog.metrics).toContainEqual(
      expect.objectContaining({
        key: 'lead_time_ai_vs_non_ai',
        dimension: 'delivery-efficiency',
      }),
    );
  });

  it('posts rollout updates to the metric platform', async () => {
    const requests: Array<{
      url: string;
      method: string;
      body: string;
    }> = [];

    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({
        url: String(input),
        method: init?.method ?? 'GET',
        body: typeof init?.body === 'string' ? init.body : '',
      });
      return new Response(
        JSON.stringify({
          projectKey: 'aimetric',
          enabled: true,
          candidateVersion: 'v1',
          percentage: 40,
          includedMembers: ['alice', 'bob'],
          updatedAt: '2026-04-24T00:00:00.000Z',
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const client = createDashboardClient('http://127.0.0.1:3001');

    await client.updateRuleRollout({
      projectKey: 'aimetric',
      enabled: true,
      candidateVersion: 'v1',
      percentage: 40,
      includedMembers: ['alice', 'bob'],
    });

    expect(requests[0]).toEqual({
      url: 'http://127.0.0.1:3001/rules/rollout',
      method: 'POST',
      body: JSON.stringify({
        projectKey: 'aimetric',
        enabled: true,
        candidateVersion: 'v1',
        percentage: 40,
        includedMembers: ['alice', 'bob'],
      }),
    });
  });

  it('posts viewer scope assignment updates to the metric platform', async () => {
    const requests: Array<{
      url: string;
      method: string;
      body: string;
    }> = [];

    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({
        url: String(input),
        method: init?.method ?? 'GET',
        body: typeof init?.body === 'string' ? init.body : '',
      });
      return new Response(
        JSON.stringify({
          viewerId: 'manager-1',
          teamKeys: ['platform-engineering'],
          projectKeys: ['aimetric'],
          updatedAt: '2026-04-25T00:00:00.000Z',
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const client = createDashboardClient('http://127.0.0.1:3001');

    await client.updateViewerScopeAssignment({
      viewerId: 'manager-1',
      teamKeys: ['platform-engineering'],
      projectKeys: ['aimetric'],
    });

    expect(requests[0]).toEqual({
      url: 'http://127.0.0.1:3001/governance/viewer-scopes',
      method: 'POST',
      body: JSON.stringify({
        viewerId: 'manager-1',
        teamKeys: ['platform-engineering'],
        projectKeys: ['aimetric'],
      }),
    });
  });

  it('fetches analysis APIs through the dashboard client', async () => {
    const requestedUrls: string[] = [];

    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      requestedUrls.push(url);

      if (url.includes('/analysis/summary')) {
        return new Response(
          JSON.stringify({
            sessionCount: 2,
            editSpanCount: 3,
            tabAcceptedCount: 4,
            tabAcceptedLines: 9,
          }),
          { status: 200 },
        );
      }

      if (url.includes('/analysis/sessions')) {
        return new Response(
          JSON.stringify([
            {
              sessionId: 'sess_1',
              projectKey: 'aimetric',
              occurredAt: '2026-04-24T00:05:00.000Z',
              editSpanCount: 2,
              tabAcceptedCount: 2,
              tabAcceptedLines: 5,
            },
          ]),
          { status: 200 },
        );
      }

      return new Response(
        JSON.stringify([
          {
            sessionId: 'sess_1',
            projectKey: 'aimetric',
            filePath: '/repo/src/demo.ts',
            editSpanCount: 2,
            latestEditAt: '2026-04-24T00:05:00.000Z',
            tabAcceptedCount: 2,
            tabAcceptedLines: 5,
            latestDiffSummary: '--- /repo/src/demo.ts',
          },
        ]),
        { status: 200 },
      );
    }) as typeof fetch;

    const client = createDashboardClient('http://127.0.0.1:3001');
    const filters = { projectKey: 'aimetric', memberId: 'alice' };

    await expect(client.getAnalysisSummary(filters)).resolves.toEqual({
      sessionCount: 2,
      editSpanCount: 3,
      tabAcceptedCount: 4,
      tabAcceptedLines: 9,
    });
    await expect(client.getSessionAnalysisRows(filters)).resolves.toHaveLength(1);
    await expect(client.getOutputAnalysisRows(filters)).resolves.toHaveLength(1);
    expect(requestedUrls).toEqual([
      'http://127.0.0.1:3001/analysis/summary?projectKey=aimetric&memberId=alice',
      'http://127.0.0.1:3001/analysis/sessions?projectKey=aimetric&memberId=alice',
      'http://127.0.0.1:3001/analysis/output?projectKey=aimetric&memberId=alice',
    ]);
  });

  it('sends viewer headers when a dashboard viewer id is configured', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];

    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({
        url: String(input),
        init,
      });

      return new Response(
        JSON.stringify({
          acceptedAiLines: 44,
          commitTotalLines: 55,
          aiOutputRate: 0.8,
          sessionCount: 5,
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const client = createDashboardClient(
      'http://127.0.0.1:3001',
      'http://127.0.0.1:3000',
      'manager-1',
    );

    await client.getPersonalSnapshot();

    expect(requests[0]).toEqual({
      url: 'http://127.0.0.1:3001/metrics/personal',
      init: {
        headers: {
          'x-aimetric-viewer-id': 'manager-1',
        },
      },
    });
  });
});
