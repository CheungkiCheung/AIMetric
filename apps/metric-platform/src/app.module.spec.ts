import { describe, expect, it, vi } from 'vitest';
import type { IngestionBatch } from '@aimetric/event-schema';
import { AppModule } from './app.module.js';

describe('AppModule', () => {
  it('exposes the enterprise metric catalog for management analysis', () => {
    const appModule = new AppModule(createEmptyRepository());
    const catalog = appModule.getEnterpriseMetricCatalog();

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
        key: 'ai_ide_user_ratio',
        dashboardPlacement: 'effectiveness-management',
        assessmentUsage: 'observe-only',
      }),
    );
  });

  it('exposes the organization governance directory', async () => {
    const appModule = new AppModule(createEmptyRepository());
    const directory = await appModule.getOrganizationDirectory();

    expect(directory).toMatchObject({
      organization: {
        key: 'aimetric-enterprise',
        name: 'AIMetric Enterprise',
      },
      teams: [
        expect.objectContaining({
          key: 'platform-engineering',
          name: '平台工程团队',
        }),
      ],
      projects: [
        expect.objectContaining({
          key: 'aimetric',
          teamKey: 'platform-engineering',
        }),
      ],
      members: [
        expect.objectContaining({
          memberId: 'alice',
          teamKey: 'platform-engineering',
          role: 'developer',
        }),
      ],
    });
  });

  it('prefers the repository-backed governance directory when available', async () => {
    const repository = {
      ...createEmptyRepository(),
      getGovernanceDirectory: vi.fn(async () => ({
        organization: {
          key: 'enterprise-a',
          name: 'Enterprise A',
        },
        teams: [
          {
            key: 'team-a',
            name: 'Team A',
            organizationKey: 'enterprise-a',
          },
        ],
        projects: [
          {
            key: 'project-a',
            name: 'Project A',
            teamKey: 'team-a',
          },
        ],
        members: [
          {
            memberId: 'manager-1',
            displayName: 'Manager 1',
            teamKey: 'team-a',
            role: 'engineering-manager' as const,
          },
        ],
      })),
    };
    const appModule = new AppModule(repository);
    const directory = await appModule.getOrganizationDirectory();

    expect(repository.getGovernanceDirectory).toHaveBeenCalledTimes(1);
    expect(directory).toMatchObject({
      organization: {
        key: 'enterprise-a',
      },
      teams: [
        expect.objectContaining({
          key: 'team-a',
        }),
      ],
      members: [
        expect.objectContaining({
          role: 'engineering-manager',
        }),
      ],
    });
  });

  it('filters the governance directory by viewer scope', async () => {
    const repository = {
      ...createEmptyRepository(),
      getGovernanceDirectory: vi.fn(async () => ({
        organization: {
          key: 'enterprise-a',
          name: 'Enterprise A',
        },
        teams: [
          {
            key: 'team-a',
            name: 'Team A',
            organizationKey: 'enterprise-a',
          },
          {
            key: 'team-b',
            name: 'Team B',
            organizationKey: 'enterprise-a',
          },
        ],
        projects: [
          {
            key: 'project-a',
            name: 'Project A',
            teamKey: 'team-a',
          },
          {
            key: 'project-b',
            name: 'Project B',
            teamKey: 'team-b',
          },
        ],
        members: [
          {
            memberId: 'manager-1',
            displayName: 'Manager 1',
            teamKey: 'team-a',
            role: 'engineering-manager' as const,
          },
          {
            memberId: 'developer-2',
            displayName: 'Developer 2',
            teamKey: 'team-b',
            role: 'developer' as const,
          },
        ],
      })),
      getGovernanceViewerScope: vi.fn(async () => ({
        viewerId: 'manager-1',
        role: 'engineering-manager' as const,
        organizationKey: 'enterprise-a',
        teamKeys: ['team-a'],
        projectKeys: ['project-a'],
        memberIds: ['manager-1'],
      })),
    };
    const appModule = new AppModule(repository);
    const directory = await appModule.getScopedOrganizationDirectory('manager-1');

    expect(directory).toMatchObject({
      organization: {
        key: 'enterprise-a',
      },
      teams: [
        expect.objectContaining({
          key: 'team-a',
        }),
      ],
      projects: [
        expect.objectContaining({
          key: 'project-a',
        }),
      ],
      members: [
        expect.objectContaining({
          memberId: 'manager-1',
        }),
      ],
    });
    expect(directory.teams).toHaveLength(1);
    expect(directory.projects).toHaveLength(1);
    expect(directory.members).toHaveLength(1);
  });

  it('registers and resolves collector identities through the repository abstraction', async () => {
    const repository = {
      ...createEmptyRepository(),
      registerCollectorIdentity: vi.fn(async () => ({
        identityKey: 'aimetric:alice:cursor:aimetric',
        memberId: 'alice',
        projectKey: 'aimetric',
        repoName: 'AIMetric',
        toolProfile: 'cursor',
        status: 'active' as const,
        registeredAt: '2026-04-25T00:00:00.000Z',
        updatedAt: '2026-04-25T00:00:00.000Z',
      })),
      getCollectorIdentity: vi.fn(async () => ({
        identityKey: 'aimetric:alice:cursor:aimetric',
        memberId: 'alice',
        projectKey: 'aimetric',
        repoName: 'AIMetric',
        toolProfile: 'cursor',
        status: 'active' as const,
        registeredAt: '2026-04-25T00:00:00.000Z',
        updatedAt: '2026-04-25T00:00:00.000Z',
      })),
    };
    const appModule = new AppModule(repository);

    const registered = await appModule.registerCollectorIdentity({
      identityKey: 'aimetric:alice:cursor:aimetric',
      memberId: 'alice',
      projectKey: 'aimetric',
      repoName: 'AIMetric',
      toolProfile: 'cursor',
    });
    const resolved = await appModule.getCollectorIdentity(
      'aimetric:alice:cursor:aimetric',
    );

    expect(repository.registerCollectorIdentity).toHaveBeenCalledWith({
      identityKey: 'aimetric:alice:cursor:aimetric',
      memberId: 'alice',
      projectKey: 'aimetric',
      repoName: 'AIMetric',
      toolProfile: 'cursor',
    });
    expect(repository.getCollectorIdentity).toHaveBeenCalledWith(
      'aimetric:alice:cursor:aimetric',
    );
    expect(registered.status).toBe('active');
    expect(resolved?.memberId).toBe('alice');
  });

  it('replaces and reads viewer scope assignments through the repository abstraction', async () => {
    const repository = {
      ...createEmptyRepository(),
      replaceViewerScopeAssignment: vi.fn(async () => ({
        viewerId: 'manager-1',
        teamKeys: ['team-a'],
        projectKeys: ['project-b'],
        updatedAt: '2026-04-25T00:00:00.000Z',
      })),
      getViewerScopeAssignment: vi.fn(async () => ({
        viewerId: 'manager-1',
        teamKeys: ['team-a'],
        projectKeys: ['project-b'],
        updatedAt: '2026-04-25T00:00:00.000Z',
      })),
    };
    const appModule = new AppModule(repository);

    const updated = await appModule.replaceViewerScopeAssignment({
      viewerId: 'manager-1',
      teamKeys: ['team-a'],
      projectKeys: ['project-b'],
    });
    const current = await appModule.getViewerScopeAssignment('manager-1');

    expect(repository.replaceViewerScopeAssignment).toHaveBeenCalledWith({
      viewerId: 'manager-1',
      teamKeys: ['team-a'],
      projectKeys: ['project-b'],
    });
    expect(repository.getViewerScopeAssignment).toHaveBeenCalledWith('manager-1');
    expect(updated.projectKeys).toEqual(['project-b']);
    expect(current?.teamKeys).toEqual(['team-a']);
  });

  it('imports pull requests and builds a pull request summary through the repository', async () => {
    const repository = {
      ...createEmptyRepository(),
      importPullRequests: vi.fn(async () => undefined),
      listPullRequests: vi.fn(async () => [
        {
          provider: 'github' as const,
          projectKey: 'aimetric',
          repoName: 'AIMetric',
          prNumber: 101,
          title: 'Add PR provider integration',
          authorMemberId: 'alice',
          state: 'merged' as const,
          aiTouched: true,
          reviewDecision: 'approved' as const,
          createdAt: '2026-04-25T00:00:00.000Z',
          mergedAt: '2026-04-25T12:00:00.000Z',
          cycleTimeHours: 12,
          updatedAt: '2026-04-25T12:00:00.000Z',
        },
        {
          provider: 'github' as const,
          projectKey: 'aimetric',
          repoName: 'AIMetric',
          prNumber: 102,
          title: 'Add delivery summary',
          authorMemberId: 'bob',
          state: 'open' as const,
          aiTouched: false,
          createdAt: '2026-04-26T00:00:00.000Z',
          updatedAt: '2026-04-26T04:00:00.000Z',
        },
      ]),
      buildPullRequestSummary: vi.fn(async () => ({
        totalPrCount: 2,
        aiTouchedPrCount: 1,
        aiTouchedPrRatio: 0.5,
        mergedPrCount: 1,
        averageCycleTimeHours: 12,
      })),
    };
    const appModule = new AppModule(repository);

    const importResult = await appModule.importPullRequests([
      {
        provider: 'github',
        projectKey: 'aimetric',
        repoName: 'AIMetric',
        prNumber: 101,
        title: 'Add PR provider integration',
        authorMemberId: 'alice',
        state: 'merged',
        aiTouched: true,
        createdAt: '2026-04-25T00:00:00.000Z',
        mergedAt: '2026-04-25T12:00:00.000Z',
        updatedAt: '2026-04-25T12:00:00.000Z',
      },
    ]);
    const summary = await appModule.buildPullRequestSummary({
      projectKey: 'aimetric',
    });

    expect(importResult).toEqual({ importedPullRequests: 1 });
    expect(repository.importPullRequests).toHaveBeenCalledTimes(1);
    expect(summary).toEqual({
      totalPrCount: 2,
      aiTouchedPrCount: 1,
      aiTouchedPrRatio: 0.5,
      mergedPrCount: 1,
      averageCycleTimeHours: 12,
    });
  });

  it('imports requirements and builds a requirement summary through the repository', async () => {
    const repository = {
      ...createEmptyRepository(),
      importRequirements: vi.fn(async () => undefined),
      listRequirements: vi.fn(async () => [
        {
          provider: 'jira' as const,
          projectKey: 'aimetric',
          requirementKey: 'AIM-101',
          title: 'Build management dashboard',
          ownerMemberId: 'alice',
          status: 'done' as const,
          aiTouched: true,
          firstPrCreatedAt: '2026-04-25T06:00:00.000Z',
          completedAt: '2026-04-26T00:00:00.000Z',
          leadTimeHours: 24,
          leadTimeToFirstPrHours: 6,
          createdAt: '2026-04-25T00:00:00.000Z',
          updatedAt: '2026-04-26T00:00:00.000Z',
        },
        {
          provider: 'tapd' as const,
          projectKey: 'aimetric',
          requirementKey: 'TAPD-7',
          title: 'Integrate requirement feed',
          ownerMemberId: 'bob',
          status: 'in-progress' as const,
          aiTouched: false,
          firstPrCreatedAt: '2026-04-26T08:00:00.000Z',
          leadTimeToFirstPrHours: 8,
          createdAt: '2026-04-26T00:00:00.000Z',
          updatedAt: '2026-04-26T08:00:00.000Z',
        },
      ]),
      buildRequirementSummary: vi.fn(async () => ({
        totalRequirementCount: 2,
        aiTouchedRequirementCount: 1,
        aiTouchedRequirementRatio: 0.5,
        completedRequirementCount: 1,
        averageLeadTimeHours: 24,
        averageLeadTimeToFirstPrHours: 7,
      })),
    };
    const appModule = new AppModule(repository);

    const importResult = await appModule.importRequirements([
      {
        provider: 'jira',
        projectKey: 'aimetric',
        requirementKey: 'AIM-101',
        title: 'Build management dashboard',
        ownerMemberId: 'alice',
        status: 'done',
        aiTouched: true,
        firstPrCreatedAt: '2026-04-25T06:00:00.000Z',
        completedAt: '2026-04-26T00:00:00.000Z',
        createdAt: '2026-04-25T00:00:00.000Z',
        updatedAt: '2026-04-26T00:00:00.000Z',
      },
    ]);
    const summary = await appModule.buildRequirementSummary({
      projectKey: 'aimetric',
    });

    expect(importResult).toEqual({ importedRequirements: 1 });
    expect(repository.importRequirements).toHaveBeenCalledTimes(1);
    expect(summary).toEqual({
      totalRequirementCount: 2,
      aiTouchedRequirementCount: 1,
      aiTouchedRequirementRatio: 0.5,
      completedRequirementCount: 1,
      averageLeadTimeHours: 24,
      averageLeadTimeToFirstPrHours: 7,
    });
  });

  it('filters enterprise metrics by dimension', () => {
    const appModule = new AppModule(createEmptyRepository());
    const metrics = appModule.listEnterpriseMetricsByDimension('quality-risk');

    expect(metrics.length).toBeGreaterThan(0);
    expect(metrics.every((metric) => metric.dimension === 'quality-risk')).toBe(true);
    expect(metrics.map((metric) => metric.key)).toContain('change_failure_rate');
  });

  it('builds enterprise metric values through the shared calculation pipeline', async () => {
    const repository = {
      ...createEmptyRepository(),
      listRecordedMetricEvents: vi.fn(async () => [
        {
          memberId: 'alice',
          acceptedAiLines: 30,
          commitTotalLines: 60,
          sessionCount: 2,
        },
        {
          memberId: 'bob',
          acceptedAiLines: 45,
          commitTotalLines: 90,
          sessionCount: 3,
        },
      ]),
      buildAnalysisSummary: vi.fn(async () => ({
        sessionCount: 5,
        editSpanCount: 4,
        tabAcceptedCount: 6,
        tabAcceptedLines: 18,
      })),
      buildMcpAuditMetrics: vi.fn(async () => ({
        totalToolCalls: 10,
        successfulToolCalls: 8,
        failedToolCalls: 2,
        successRate: 0.8,
        failureRate: 0.2,
        averageDurationMs: 24,
      })),
      listRequirements: vi.fn(async () => [
        {
          provider: 'jira' as const,
          projectKey: 'navigation',
          requirementKey: 'AIM-101',
          title: 'AI delivery',
          status: 'done' as const,
          aiTouched: true,
          leadTimeHours: 24,
          createdAt: '2026-04-23T00:00:00.000Z',
          updatedAt: '2026-04-24T00:00:00.000Z',
        },
        {
          provider: 'jira' as const,
          projectKey: 'navigation',
          requirementKey: 'AIM-102',
          title: 'Manual delivery',
          status: 'done' as const,
          aiTouched: false,
          leadTimeHours: 36,
          createdAt: '2026-04-23T00:00:00.000Z',
          updatedAt: '2026-04-24T00:00:00.000Z',
        },
      ]),
    };
    const filters = {
      projectKey: 'navigation',
      from: '2026-04-23T00:00:00.000Z',
      to: '2026-04-24T00:00:00.000Z',
    };

    const appModule = new AppModule(repository);
    const result = await appModule.calculateEnterpriseMetricValues(filters, {
      calculatedAt: '2026-04-24T01:00:00.000Z',
    });

    expect(repository.listRecordedMetricEvents).toHaveBeenCalledWith(filters);
    expect(repository.buildAnalysisSummary).toHaveBeenCalledWith(filters);
    expect(repository.buildMcpAuditMetrics).toHaveBeenCalledWith(filters);
    expect(repository.listRequirements).toHaveBeenCalledWith(filters);
    expect(result).toEqual([
      expect.objectContaining({
        metricKey: 'ai_output_rate',
        value: 0.5,
        projectKey: 'navigation',
        periodStart: '2026-04-23T00:00:00.000Z',
        periodEnd: '2026-04-24T00:00:00.000Z',
        calculatedAt: '2026-04-24T01:00:00.000Z',
        definitionVersion: 1,
        dataRequirements: ['recorded-metric-events'],
      }),
      expect.objectContaining({
        metricKey: 'ai_session_count',
        value: 5,
      }),
      expect.objectContaining({
        metricKey: 'tab_accepted_lines',
        value: 18,
      }),
      expect.objectContaining({
        metricKey: 'mcp_tool_success_rate',
        value: 0.8,
      }),
      expect.objectContaining({
        metricKey: 'lead_time_ai_vs_non_ai',
        value: -12,
        unit: 'hours',
      }),
    ]);
  });

  it('calculates a selected enterprise metric subset', async () => {
    const repository = {
      ...createEmptyRepository(),
      listRecordedMetricEvents: vi.fn(async () => [
        {
          memberId: 'alice',
          acceptedAiLines: 30,
          commitTotalLines: 60,
          sessionCount: 2,
        },
      ]),
    };

    const appModule = new AppModule(repository);
    const result = await appModule.calculateEnterpriseMetricValues(
      { projectKey: 'navigation' },
      {
        metricKeys: ['ai_session_count'],
        calculatedAt: '2026-04-24T01:00:00.000Z',
      },
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      metricKey: 'ai_session_count',
      value: 2,
    });
  });

  it('recalculates and persists selected enterprise metric snapshots', async () => {
    const repository = {
      ...createEmptyRepository(),
      listRecordedMetricEvents: vi.fn(async () => [
        {
          memberId: 'alice',
          acceptedAiLines: 30,
          commitTotalLines: 60,
          sessionCount: 2,
        },
      ]),
      saveEnterpriseMetricSnapshots: vi.fn(async () => undefined),
    };

    const appModule = new AppModule(repository);
    const result = await appModule.recalculateEnterpriseMetricSnapshots(
      {
        projectKey: 'navigation',
        from: '2026-04-23T00:00:00.000Z',
        to: '2026-04-24T00:00:00.000Z',
      },
      {
        metricKeys: ['ai_session_count'],
        calculatedAt: '2026-04-24T01:00:00.000Z',
      },
    );

    expect(repository.saveEnterpriseMetricSnapshots).toHaveBeenCalledWith([
      expect.objectContaining({
        metricKey: 'ai_session_count',
        value: 2,
        definitionVersion: 1,
        projectKey: 'navigation',
        periodStart: '2026-04-23T00:00:00.000Z',
        periodEnd: '2026-04-24T00:00:00.000Z',
      }),
    ]);
    expect(result).toMatchObject({
      upsertedSnapshots: 1,
      snapshots: [
        expect.objectContaining({
          metricKey: 'ai_session_count',
          value: 2,
        }),
      ],
    });
  });

  it('persists imported batches through the repository abstraction', async () => {
    const batch: IngestionBatch = {
      schemaVersion: 'v1',
      source: 'cursor',
      events: [
        {
          eventType: 'session.recorded',
          occurredAt: '2026-04-23T00:00:00.000Z',
          payload: {
            sessionId: 'sess_1',
            projectKey: 'proj',
            repoName: 'repo',
            memberId: 'alice',
            acceptedAiLines: 44,
            commitTotalLines: 55,
          },
        },
      ],
    };

    const repository = {
      saveIngestionBatch: vi.fn(async () => undefined),
      listRecordedMetricEvents: vi.fn(async () => []),
      saveMetricSnapshots: vi.fn(async () => undefined),
      listMetricSnapshots: vi.fn(async () => []),
      buildMcpAuditMetrics: vi.fn(async () => ({
        totalToolCalls: 3,
        successfulToolCalls: 2,
        failedToolCalls: 1,
        successRate: 2 / 3,
        failureRate: 1 / 3,
        averageDurationMs: 15,
      })),
      listEditSpanEvidence: vi.fn(async () => []),
      listTabAcceptedEvents: vi.fn(async () => []),
      disconnect: vi.fn(async () => undefined),
    };

    const appModule = new AppModule(repository);
    const result = await appModule.importEvents(batch);

    expect(repository.saveIngestionBatch).toHaveBeenCalledWith(batch);
    expect(result).toEqual({
      imported: 1,
      schemaVersion: 'v1',
    });
  });

  it('builds snapshots from persisted metric events', async () => {
    const repository = {
      saveIngestionBatch: vi.fn(async () => undefined),
      listRecordedMetricEvents: vi.fn(async () => [
        {
          memberId: 'alice',
          acceptedAiLines: 44,
          commitTotalLines: 55,
          sessionCount: 1,
        },
        {
          memberId: 'bob',
          acceptedAiLines: 46,
          commitTotalLines: 65,
          sessionCount: 1,
        },
      ]),
      saveMetricSnapshots: vi.fn(async () => undefined),
      listMetricSnapshots: vi.fn(async () => []),
      buildMcpAuditMetrics: vi.fn(async () => emptyMcpAuditMetrics()),
      listEditSpanEvidence: vi.fn(async () => []),
      listTabAcceptedEvents: vi.fn(async () => []),
      disconnect: vi.fn(async () => undefined),
    };

    const appModule = new AppModule(repository);
    const personalSnapshot = await appModule.buildPersonalSnapshot();
    const teamSnapshot = await appModule.buildTeamSnapshot();

    expect(personalSnapshot.aiOutputRate).toBe(0.8);
    expect(teamSnapshot.totalAcceptedAiLines).toBe(90);
    expect(teamSnapshot.totalCommitLines).toBe(120);
    expect(teamSnapshot.aiOutputRate).toBe(0.75);
  });

  it('passes metric filters to the repository when building snapshots', async () => {
    const repository = {
      saveIngestionBatch: vi.fn(async () => undefined),
      listRecordedMetricEvents: vi.fn(async () => []),
      saveMetricSnapshots: vi.fn(async () => undefined),
      listMetricSnapshots: vi.fn(async () => []),
      buildMcpAuditMetrics: vi.fn(async () => emptyMcpAuditMetrics()),
      listEditSpanEvidence: vi.fn(async () => []),
      listTabAcceptedEvents: vi.fn(async () => []),
      disconnect: vi.fn(async () => undefined),
    };
    const filters = {
      projectKey: 'navigation',
      memberId: 'alice',
      from: '2026-04-23T00:00:00.000Z',
      to: '2026-04-24T00:00:00.000Z',
    };

    const appModule = new AppModule(repository);

    await appModule.buildPersonalSnapshot(filters);
    await appModule.buildTeamSnapshot(filters);

    expect(repository.listRecordedMetricEvents).toHaveBeenNthCalledWith(1, filters);
    expect(repository.listRecordedMetricEvents).toHaveBeenNthCalledWith(2, filters);
  });

  it('recalculates personal and team snapshots into the repository', async () => {
    const repository = {
      saveIngestionBatch: vi.fn(async () => undefined),
      listRecordedMetricEvents: vi.fn(async () => [
        {
          memberId: 'alice',
          acceptedAiLines: 30,
          commitTotalLines: 60,
          sessionCount: 1,
        },
        {
          memberId: 'bob',
          acceptedAiLines: 20,
          commitTotalLines: 40,
          sessionCount: 1,
        },
      ]),
      saveMetricSnapshots: vi.fn(async () => undefined),
      listMetricSnapshots: vi.fn(async () => []),
      buildMcpAuditMetrics: vi.fn(async () => emptyMcpAuditMetrics()),
      listEditSpanEvidence: vi.fn(async () => []),
      listTabAcceptedEvents: vi.fn(async () => []),
      disconnect: vi.fn(async () => undefined),
    };
    const filters = {
      projectKey: 'navigation',
      from: '2026-04-23T00:00:00.000Z',
      to: '2026-04-24T00:00:00.000Z',
    };

    const appModule = new AppModule(repository);
    const result = await appModule.recalculateMetricSnapshots(filters);

    expect(repository.listRecordedMetricEvents).toHaveBeenCalledWith(filters);
    expect(repository.saveMetricSnapshots).toHaveBeenCalledWith([
      {
        scope: 'personal',
        projectKey: 'navigation',
        memberId: 'alice',
        periodStart: '2026-04-23T00:00:00.000Z',
        periodEnd: '2026-04-24T00:00:00.000Z',
        acceptedAiLines: 30,
        commitTotalLines: 60,
        aiOutputRate: 0.5,
        sessionCount: 1,
        memberCount: 1,
      },
      {
        scope: 'personal',
        projectKey: 'navigation',
        memberId: 'bob',
        periodStart: '2026-04-23T00:00:00.000Z',
        periodEnd: '2026-04-24T00:00:00.000Z',
        acceptedAiLines: 20,
        commitTotalLines: 40,
        aiOutputRate: 0.5,
        sessionCount: 1,
        memberCount: 1,
      },
      {
        scope: 'team',
        projectKey: 'navigation',
        periodStart: '2026-04-23T00:00:00.000Z',
        periodEnd: '2026-04-24T00:00:00.000Z',
        acceptedAiLines: 50,
        commitTotalLines: 100,
        aiOutputRate: 0.5,
        sessionCount: 2,
        memberCount: 2,
      },
    ]);
    expect(result.upsertedSnapshots).toBe(3);
  });

  it('lists persisted metric snapshots through the repository', async () => {
    const repository = {
      saveIngestionBatch: vi.fn(async () => undefined),
      listRecordedMetricEvents: vi.fn(async () => []),
      saveMetricSnapshots: vi.fn(async () => undefined),
      listMetricSnapshots: vi.fn(async () => [
        {
          scope: 'team' as const,
          projectKey: 'navigation',
          periodStart: '2026-04-23T00:00:00.000Z',
          periodEnd: '2026-04-24T00:00:00.000Z',
          acceptedAiLines: 50,
          commitTotalLines: 100,
          aiOutputRate: 0.5,
          sessionCount: 2,
          memberCount: 2,
        },
      ]),
      buildMcpAuditMetrics: vi.fn(async () => emptyMcpAuditMetrics()),
      listEditSpanEvidence: vi.fn(async () => []),
      listTabAcceptedEvents: vi.fn(async () => []),
      disconnect: vi.fn(async () => undefined),
    };
    const filters = {
      projectKey: 'navigation',
    };

    const appModule = new AppModule(repository);
    const snapshots = await appModule.listMetricSnapshots(filters);

    expect(repository.listMetricSnapshots).toHaveBeenCalledWith(filters);
    expect(snapshots).toHaveLength(1);
  });

  it('builds MCP audit metrics through the repository', async () => {
    const repository = {
      saveIngestionBatch: vi.fn(async () => undefined),
      listRecordedMetricEvents: vi.fn(async () => []),
      saveMetricSnapshots: vi.fn(async () => undefined),
      listMetricSnapshots: vi.fn(async () => []),
      buildMcpAuditMetrics: vi.fn(async () => ({
        totalToolCalls: 3,
        successfulToolCalls: 2,
        failedToolCalls: 1,
        successRate: 2 / 3,
        failureRate: 1 / 3,
        averageDurationMs: 15,
      })),
      listEditSpanEvidence: vi.fn(async () => []),
      listTabAcceptedEvents: vi.fn(async () => []),
      disconnect: vi.fn(async () => undefined),
    };
    const filters = {
      projectKey: 'aimetric',
    };

    const appModule = new AppModule(repository);
    const metrics = await appModule.buildMcpAuditMetrics(filters);

    expect(repository.buildMcpAuditMetrics).toHaveBeenCalledWith(filters);
    expect(metrics).toEqual({
      totalToolCalls: 3,
      successfulToolCalls: 2,
      failedToolCalls: 1,
      successRate: 2 / 3,
      failureRate: 1 / 3,
      averageDurationMs: 15,
    });
  });

  it('lists edit span evidence through the repository', async () => {
    const repository = {
      saveIngestionBatch: vi.fn(async () => undefined),
      listRecordedMetricEvents: vi.fn(async () => []),
      saveMetricSnapshots: vi.fn(async () => undefined),
      listMetricSnapshots: vi.fn(async () => []),
      buildMcpAuditMetrics: vi.fn(async () => emptyMcpAuditMetrics()),
      listEditSpanEvidence: vi.fn(async () => [
        {
          editSpanId: 'edit-span-1',
          sessionId: 'sess_1',
          filePath: '/repo/src/demo.ts',
          occurredAt: '2026-04-24T00:00:00.000Z',
          diff: '--- /repo/src/demo.ts',
          beforeSnapshotHash: 'before-hash',
          afterSnapshotHash: 'after-hash',
          toolProfile: 'cursor',
        },
      ]),
      listTabAcceptedEvents: vi.fn(async () => []),
      disconnect: vi.fn(async () => undefined),
    };
    const filters = {
      projectKey: 'aimetric',
      sessionId: 'sess_1',
    };

    const appModule = new AppModule(repository);
    const evidence = await appModule.listEditSpanEvidence(filters);

    expect(repository.listEditSpanEvidence).toHaveBeenCalledWith(filters);
    expect(evidence).toEqual([
      expect.objectContaining({
        editSpanId: 'edit-span-1',
        sessionId: 'sess_1',
      }),
    ]);
  });

  it('lists tab accepted events through the repository', async () => {
    const repository = {
      saveIngestionBatch: vi.fn(async () => undefined),
      listRecordedMetricEvents: vi.fn(async () => []),
      saveMetricSnapshots: vi.fn(async () => undefined),
      listMetricSnapshots: vi.fn(async () => []),
      buildMcpAuditMetrics: vi.fn(async () => emptyMcpAuditMetrics()),
      listEditSpanEvidence: vi.fn(async () => []),
      listTabAcceptedEvents: vi.fn(async () => [
        {
          sessionId: 'sess_1',
          occurredAt: '2026-04-24T00:03:00.000Z',
          acceptedLines: 2,
          filePath: '/repo/src/demo.ts',
          language: 'typescript',
          ingestionKey: 'cursor-tab:sess_1:2026-04-24T00:03:00.000Z:abc',
        },
      ]),
      disconnect: vi.fn(async () => undefined),
    };
    const filters = {
      projectKey: 'aimetric',
      sessionId: 'sess_1',
    };

    const appModule = new AppModule(repository);
    const events = await appModule.listTabAcceptedEvents(filters);

    expect(repository.listTabAcceptedEvents).toHaveBeenCalledWith(filters);
    expect(events).toEqual([
      expect.objectContaining({
        sessionId: 'sess_1',
        acceptedLines: 2,
      }),
    ]);
  });

  it('builds analysis summary through the repository', async () => {
    const repository = {
      saveIngestionBatch: vi.fn(async () => undefined),
      listRecordedMetricEvents: vi.fn(async () => []),
      saveMetricSnapshots: vi.fn(async () => undefined),
      listMetricSnapshots: vi.fn(async () => []),
      buildMcpAuditMetrics: vi.fn(async () => emptyMcpAuditMetrics()),
      listEditSpanEvidence: vi.fn(async () => []),
      listTabAcceptedEvents: vi.fn(async () => []),
      buildAnalysisSummary: vi.fn(async () => ({
        sessionCount: 2,
        editSpanCount: 3,
        tabAcceptedCount: 4,
        tabAcceptedLines: 9,
      })),
      listSessionAnalysisRows: vi.fn(async () => []),
      listOutputAnalysisRows: vi.fn(async () => []),
      disconnect: vi.fn(async () => undefined),
    };
    const filters = { projectKey: 'aimetric' };

    const appModule = new AppModule(repository);
    const summary = await appModule.buildAnalysisSummary(filters);

    expect(repository.buildAnalysisSummary).toHaveBeenCalledWith(filters);
    expect(summary).toEqual({
      sessionCount: 2,
      editSpanCount: 3,
      tabAcceptedCount: 4,
      tabAcceptedLines: 9,
    });
  });

  it('lists session and output analysis rows through the repository', async () => {
    const repository = {
      saveIngestionBatch: vi.fn(async () => undefined),
      listRecordedMetricEvents: vi.fn(async () => []),
      saveMetricSnapshots: vi.fn(async () => undefined),
      listMetricSnapshots: vi.fn(async () => []),
      buildMcpAuditMetrics: vi.fn(async () => emptyMcpAuditMetrics()),
      listEditSpanEvidence: vi.fn(async () => []),
      listTabAcceptedEvents: vi.fn(async () => []),
      buildAnalysisSummary: vi.fn(async () => ({
        sessionCount: 0,
        editSpanCount: 0,
        tabAcceptedCount: 0,
        tabAcceptedLines: 0,
      })),
      listSessionAnalysisRows: vi.fn(async () => [
        {
          sessionId: 'sess_1',
          projectKey: 'aimetric',
          occurredAt: '2026-04-24T00:05:00.000Z',
          editSpanCount: 2,
          tabAcceptedCount: 2,
          tabAcceptedLines: 5,
        },
      ]),
      listOutputAnalysisRows: vi.fn(async () => [
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
      disconnect: vi.fn(async () => undefined),
    };
    const filters = { projectKey: 'aimetric' };

    const appModule = new AppModule(repository);
    const sessionRows = await appModule.listSessionAnalysisRows(filters);
    const outputRows = await appModule.listOutputAnalysisRows(filters);

    expect(repository.listSessionAnalysisRows).toHaveBeenCalledWith(filters);
    expect(repository.listOutputAnalysisRows).toHaveBeenCalledWith(filters);
    expect(sessionRows).toHaveLength(1);
    expect(outputRows).toHaveLength(1);
  });

  it('exposes rule center operations from the application module', () => {
    const repository = createEmptyRepository();
    const appModule = new AppModule(repository);

    expect(appModule.listRuleVersions('aimetric')).toMatchObject({
      projectKey: 'aimetric',
      activeVersion: 'v2',
    });
    expect(
      appModule.getRuleTemplate({
        projectKey: 'aimetric',
        version: 'v2',
      }),
    ).toMatchObject({
      projectKey: 'aimetric',
      version: 'v2',
    });
    expect(
      appModule.validateRuleTemplate({
        projectKey: 'aimetric',
        version: 'v2',
      }),
    ).toMatchObject({
      valid: true,
    });
  });
});

const createEmptyRepository = () => ({
  saveIngestionBatch: vi.fn(async () => undefined),
  listRecordedMetricEvents: vi.fn(async () => []),
  saveMetricSnapshots: vi.fn(async () => undefined),
  listMetricSnapshots: vi.fn(async () => []),
  saveEnterpriseMetricSnapshots: vi.fn(async () => undefined),
  listEnterpriseMetricSnapshots: vi.fn(async () => []),
  buildMcpAuditMetrics: vi.fn(async () => emptyMcpAuditMetrics()),
  listEditSpanEvidence: vi.fn(async () => []),
  listTabAcceptedEvents: vi.fn(async () => []),
  buildAnalysisSummary: vi.fn(async () => ({
    sessionCount: 0,
    editSpanCount: 0,
    tabAcceptedCount: 0,
    tabAcceptedLines: 0,
  })),
  listSessionAnalysisRows: vi.fn(async () => []),
  listOutputAnalysisRows: vi.fn(async () => []),
  disconnect: vi.fn(async () => undefined),
});

const emptyMcpAuditMetrics = () => ({
  totalToolCalls: 0,
  successfulToolCalls: 0,
  failedToolCalls: 0,
  successRate: 0,
  failureRate: 0,
  averageDurationMs: 0,
});
