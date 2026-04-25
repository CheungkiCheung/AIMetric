// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';
import type {
  DashboardClient,
  DashboardFilters,
  PullRequestRecord,
  PullRequestSummary,
  RequirementRecord,
  RequirementSummary,
  RuleRollout,
} from './api/client.js';

const createClient = (
  overrides: Partial<DashboardClient> = {},
): DashboardClient => ({
  getPullRequestSummary: async (): Promise<PullRequestSummary> => ({
    totalPrCount: 4,
    aiTouchedPrCount: 3,
    aiTouchedPrRatio: 0.75,
    mergedPrCount: 2,
    averageCycleTimeHours: 18,
  }),
  getPullRequests: async (): Promise<PullRequestRecord[]> => [
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
      createdAt: '2026-04-24T00:00:00.000Z',
      mergedAt: '2026-04-24T12:00:00.000Z',
      cycleTimeHours: 12,
      updatedAt: '2026-04-24T12:00:00.000Z',
    },
  ],
  getRequirementSummary: async (): Promise<RequirementSummary> => ({
    totalRequirementCount: 5,
    aiTouchedRequirementCount: 3,
    aiTouchedRequirementRatio: 0.6,
    completedRequirementCount: 2,
    averageLeadTimeHours: 36,
    averageLeadTimeToFirstPrHours: 8,
  }),
  getRequirements: async (): Promise<RequirementRecord[]> => [
    {
      provider: 'jira',
      projectKey: 'aimetric',
      requirementKey: 'AIM-101',
      title: 'Build management dashboard',
      ownerMemberId: 'alice',
      status: 'done',
      aiTouched: true,
      firstPrCreatedAt: '2026-04-24T08:00:00.000Z',
      completedAt: '2026-04-25T12:00:00.000Z',
      leadTimeHours: 36,
      leadTimeToFirstPrHours: 8,
      createdAt: '2026-04-24T00:00:00.000Z',
      updatedAt: '2026-04-25T12:00:00.000Z',
    },
  ],
  getPersonalSnapshot: async () => ({
    acceptedAiLines: 35,
    commitTotalLines: 50,
    aiOutputRate: 0.7,
    sessionCount: 4,
  }),
  getTeamSnapshot: async () => ({
    memberCount: 2,
    totalAcceptedAiLines: 50,
    totalCommitLines: 80,
    aiOutputRate: 0.625,
    totalSessionCount: 6,
  }),
  getMcpAuditMetrics: async () => ({
    totalToolCalls: 12,
    successfulToolCalls: 10,
    failedToolCalls: 2,
    successRate: 10 / 12,
    failureRate: 2 / 12,
    averageDurationMs: 24,
  }),
  getRuleVersions: async () => ({
    projectKey: 'aimetric',
    activeVersion: 'v2',
    versions: [],
  }),
  getRuleRollout: async () => ({
    projectKey: 'aimetric',
    enabled: false,
    candidateVersion: undefined,
    percentage: 0,
    includedMembers: [],
    updatedAt: undefined,
  }),
  getRuleRolloutEvaluation: async () => ({
    projectKey: 'aimetric',
    memberId: undefined,
    enabled: false,
    activeVersion: 'v2',
    selectedVersion: 'v2',
    candidateVersion: undefined,
    percentage: 0,
    bucket: undefined,
    matched: false,
    reason: 'rollout-disabled' as const,
  }),
  getAnalysisSummary: async () => ({
    sessionCount: 2,
    editSpanCount: 3,
    tabAcceptedCount: 4,
    tabAcceptedLines: 9,
  }),
  getSessionAnalysisRows: async () => [
    {
      sessionId: 'sess_1',
      memberId: 'alice',
      projectKey: 'aimetric',
      occurredAt: '2026-04-24T00:05:00.000Z',
      conversationTurns: 3,
      userMessageCount: 3,
      assistantMessageCount: 3,
      firstMessageAt: '2026-04-24T00:00:00.000Z',
      lastMessageAt: '2026-04-24T00:05:00.000Z',
      workspaceId: 'workspace-1',
      workspacePath: '/repo',
      projectFingerprint: 'fingerprint-1',
      editSpanCount: 2,
      tabAcceptedCount: 2,
      tabAcceptedLines: 5,
    },
  ],
  getOutputAnalysisRows: async () => [
    {
      sessionId: 'sess_1',
      memberId: 'alice',
      projectKey: 'aimetric',
      filePath: '/repo/src/demo.ts',
      editSpanCount: 2,
      latestEditAt: '2026-04-24T00:05:00.000Z',
      tabAcceptedCount: 2,
      tabAcceptedLines: 5,
      latestDiffSummary: '--- /repo/src/demo.ts',
    },
  ],
  getEnterpriseMetricCatalog: async () => ({
    dimensions: [
      {
        key: 'adoption',
        name: '使用渗透',
        question: 'AI 有没有真正被用起来',
        primaryAudience: ['effectiveness-manager', 'engineering-manager'],
      },
      {
        key: 'effective-output',
        name: '有效产出',
        question: 'AI 生成的内容有没有变成正式成果',
        primaryAudience: ['effectiveness-manager', 'engineering-manager'],
      },
      {
        key: 'delivery-efficiency',
        name: '交付效率',
        question: '用了 AI 之后，需求是否更快流向生产',
        primaryAudience: ['engineering-manager'],
      },
      {
        key: 'quality-risk',
        name: '质量与风险',
        question: '速度提升是否以返工或事故为代价',
        primaryAudience: ['engineering-manager', 'platform-admin'],
      },
      {
        key: 'experience-capability',
        name: '体验与能力',
        question: '开发者是否更轻松、更能学、更能协作',
        primaryAudience: ['effectiveness-manager', 'employee'],
      },
      {
        key: 'business-value',
        name: '业务与经济价值',
        question: 'AI 投入是否值得',
        primaryAudience: ['engineering-manager', 'effectiveness-manager'],
      },
    ],
    metrics: [
      {
        key: 'ai_ide_user_ratio',
        name: 'AI-IDE 使用人数比例',
        dimension: 'adoption',
        question: '目标开发者里有多少人真正使用了 AI-IDE。',
        formula: 'AI-IDE 活跃使用人数 / 目标开发者人数',
        dataSources: ['mcp-events', 'tool-adapter-events', 'organization-directory'],
        automationLevel: 'high',
        updateFrequency: 'daily',
        dashboardPlacement: 'effectiveness-management',
        assessmentUsage: 'observe-only',
        antiGamingNote: '只看比例容易鼓励刷打开次数，必须结合活跃天数、会话质量和有效产出一起看。',
      },
      {
        key: 'lead_time_ai_vs_non_ai',
        name: 'AI 参与需求 Lead Time 对比',
        dimension: 'delivery-efficiency',
        question: 'AI 参与需求是否比非 AI 需求更快流向生产。',
        formula: 'AI 参与需求平均 Lead Time 与非 AI 参与需求平均 Lead Time 的差异',
        dataSources: ['delivery-tracker', 'pr-provider', 'deployment-provider', 'mcp-events'],
        automationLevel: 'medium',
        updateFrequency: 'daily',
        dashboardPlacement: 'engineering-management',
        assessmentUsage: 'team-improvement',
        antiGamingNote: '必须按需求规模和类型分层对比，避免简单平均造成误判。',
      },
    ],
  }),
  getEnterpriseMetricValues: async () => [
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
        question: 'AI 生成或辅助的代码在总代码变更中占多少。',
        formula: 'AI 采纳代码行数 / 提交总代码变更行数',
        dataSources: ['mcp-events', 'git-provider', 'tool-adapter-events'],
        automationLevel: 'high',
        updateFrequency: 'daily',
        dashboardPlacement: 'engineering-management',
        assessmentUsage: 'team-improvement',
        antiGamingNote: '出码率不是越高越好，必须同时看质量、返工和业务交付。',
      },
    },
  ],
  getCollectorIngestionHealth: async () => ({
    deliveryMode: 'queue',
    queueBackend: 'file',
    queueDepth: 3,
    deadLetterDepth: 1,
    enqueuedTotal: 10,
    forwardedTotal: 7,
    failedForwardTotal: 2,
  }),
  getGovernanceDirectory: async () => ({
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
  getViewerScopeAssignment: async () => ({
    viewerId: 'manager-1',
    teamKeys: ['platform-engineering'],
    projectKeys: ['aimetric'],
    updatedAt: '2026-04-25T00:00:00.000Z',
  }),
  updateViewerScopeAssignment: async (input) => ({
    ...input,
    updatedAt: '2026-04-25T00:00:00.000Z',
  }),
  updateRuleRollout: async (input: RuleRollout) => input,
  ...overrides,
});

describe('App', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders personal, team, and analysis views', async () => {
    render(
      <App
        client={createClient({
          getRuleVersions: async () => ({
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
          getRuleRollout: async () => ({
            projectKey: 'aimetric',
            enabled: true,
            candidateVersion: 'v1',
            percentage: 25,
            includedMembers: ['alice'],
            updatedAt: '2026-04-24T00:00:00.000Z',
          }),
          getRuleRolloutEvaluation: async () => ({
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
        })}
      />,
    );

    expect(await screen.findByText('个人出码视图')).toBeInTheDocument();
    expect(screen.getByText('团队出码视图')).toBeInTheDocument();
    expect(screen.getByText('组织治理概览')).toBeInTheDocument();
    expect(screen.getByText('权限治理配置')).toBeInTheDocument();
    expect(screen.getByText('平台工程团队')).toBeInTheDocument();
    expect(screen.getByText('MCP 采集质量')).toBeInTheDocument();
    expect(screen.getByText('采集健康运营')).toBeInTheDocument();
    expect(screen.getByText('需求交付概览')).toBeInTheDocument();
    expect(screen.getByText('GitHub PR 交付概览')).toBeInTheDocument();
    expect(screen.getByText('队列模式')).toBeInTheDocument();
    expect(screen.getByText('AI 触达需求占比')).toBeInTheDocument();
    expect(screen.getByText('60.0%')).toBeInTheDocument();
    expect(screen.getByText('36.0 小时')).toBeInTheDocument();
    expect(screen.getByText('Jira AIM-101 Build management dashboard')).toBeInTheDocument();
    expect(screen.getByText('AI 触达 PR 占比')).toBeInTheDocument();
    expect(screen.getByText('75.0%')).toBeInTheDocument();
    expect(screen.getByText('18.0 小时')).toBeInTheDocument();
    expect(screen.getByText('AIMetric #101 Add collector health dashboard')).toBeInTheDocument();
    expect(screen.getByText('文件持久队列')).toBeInTheDocument();
    expect(screen.getByText('待投递批次')).toBeInTheDocument();
    expect(screen.getByText('DLQ 批次')).toBeInTheDocument();
    expect(screen.getByText('规则中心管理')).toBeInTheDocument();
    expect(screen.getByText('企业指标语义层')).toBeInTheDocument();
    expect(screen.getByText('统一指标计算管线')).toBeInTheDocument();
    expect(screen.getAllByText('AI 出码率').length).toBeGreaterThan(0);
    expect(screen.getAllByText('70.0%').length).toBeGreaterThan(0);
    expect(screen.getByText('六类核心维度')).toBeInTheDocument();
    expect(screen.getByText('AI-IDE 使用人数比例')).toBeInTheDocument();
    expect(screen.getByText('必须按需求规模和类型分层对比，避免简单平均造成误判。')).toBeInTheDocument();
    expect(screen.getByText('会话分析')).toBeInTheDocument();
    expect(screen.getByText('出码分析')).toBeInTheDocument();
    expect(screen.getByText('编辑证据数')).toBeInTheDocument();
    expect(screen.getByText('/repo/src/demo.ts')).toBeInTheDocument();
    expect(screen.getByText('70.0%')).toBeInTheDocument();
    expect(screen.getByText('62.5%')).toBeInTheDocument();
    expect(screen.getByText('83.3%')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.getByText('命中规则版本')).toBeInTheDocument();
    expect(screen.getAllByText('v1').length).toBeGreaterThan(0);
  });

  it('reloads dashboard and analysis data when filters change', async () => {
    const getPersonalSnapshot = vi.fn(async (_filters?: DashboardFilters) => ({
      acceptedAiLines: 35,
      commitTotalLines: 50,
      aiOutputRate: 0.7,
      sessionCount: 4,
    }));
    const getTeamSnapshot = vi.fn(async (_filters?: DashboardFilters) => ({
      memberCount: 2,
      totalAcceptedAiLines: 50,
      totalCommitLines: 80,
      aiOutputRate: 0.625,
      totalSessionCount: 6,
    }));
    const getMcpAuditMetrics = vi.fn(async (_filters?: DashboardFilters) => ({
      totalToolCalls: 12,
      successfulToolCalls: 10,
      failedToolCalls: 2,
      successRate: 10 / 12,
      failureRate: 2 / 12,
      averageDurationMs: 24,
    }));
    const getRuleVersions = vi.fn(async (_projectKey?: string) => ({
      projectKey: 'aimetric',
      activeVersion: 'v2',
      versions: [],
    }));
    const getRuleRollout = vi.fn(async (_projectKey?: string) => ({
      projectKey: 'aimetric',
      enabled: false,
      candidateVersion: undefined,
      percentage: 0,
      includedMembers: [],
      updatedAt: undefined,
    }));
    const getRuleRolloutEvaluation = vi.fn(
      async (_projectKey?: string, _memberId?: string) => ({
        projectKey: 'aimetric',
        memberId: undefined,
        enabled: false,
        activeVersion: 'v2',
        selectedVersion: 'v2',
        candidateVersion: undefined,
        percentage: 0,
        bucket: undefined,
        matched: false,
        reason: 'rollout-disabled' as const,
      }),
    );
    const getAnalysisSummary = vi.fn(async (_filters?: DashboardFilters) => ({
      sessionCount: 2,
      editSpanCount: 3,
      tabAcceptedCount: 4,
      tabAcceptedLines: 9,
    }));
    const getSessionAnalysisRows = vi.fn(async (_filters?: DashboardFilters) => []);
    const getOutputAnalysisRows = vi.fn(async (_filters?: DashboardFilters) => []);
    const getEnterpriseMetricCatalog = vi.fn(
      createClient().getEnterpriseMetricCatalog,
    );
    const getEnterpriseMetricValues = vi.fn(
      createClient().getEnterpriseMetricValues,
    );
    const getRequirementSummary = vi.fn(createClient().getRequirementSummary);
    const getRequirements = vi.fn(createClient().getRequirements);
    const getPullRequestSummary = vi.fn(createClient().getPullRequestSummary);
    const getPullRequests = vi.fn(createClient().getPullRequests);
    const getCollectorIngestionHealth = vi.fn(
      createClient().getCollectorIngestionHealth,
    );
    const getGovernanceDirectory = vi.fn(
      createClient().getGovernanceDirectory,
    );
    const getViewerScopeAssignment = vi.fn(
      createClient().getViewerScopeAssignment,
    );

    render(
      <App
        client={createClient({
          getPersonalSnapshot,
          getTeamSnapshot,
          getMcpAuditMetrics,
          getRuleVersions,
          getRuleRollout,
          getRuleRolloutEvaluation,
          getAnalysisSummary,
          getSessionAnalysisRows,
          getOutputAnalysisRows,
          getEnterpriseMetricCatalog,
          getEnterpriseMetricValues,
          getRequirementSummary,
          getRequirements,
          getPullRequestSummary,
          getPullRequests,
          getCollectorIngestionHealth,
          getGovernanceDirectory,
          getViewerScopeAssignment,
        })}
      />,
    );

    await screen.findByText('个人出码视图');
    fireEvent.change(screen.getByLabelText('项目'), {
      target: { value: 'navigation' },
    });

    await waitFor(() => {
      expect(getPersonalSnapshot).toHaveBeenLastCalledWith(
        expect.objectContaining({ projectKey: 'navigation' }),
      );
      expect(getMcpAuditMetrics).toHaveBeenLastCalledWith(
        expect.objectContaining({ projectKey: 'navigation' }),
      );
      expect(getRuleVersions).toHaveBeenLastCalledWith('navigation');
      expect(getRuleRollout).toHaveBeenLastCalledWith('navigation');
      expect(getRuleRolloutEvaluation).toHaveBeenLastCalledWith(
        'navigation',
        undefined,
      );
      expect(getAnalysisSummary).toHaveBeenLastCalledWith(
        expect.objectContaining({ projectKey: 'navigation' }),
      );
      expect(getSessionAnalysisRows).toHaveBeenLastCalledWith(
        expect.objectContaining({ projectKey: 'navigation' }),
      );
      expect(getOutputAnalysisRows).toHaveBeenLastCalledWith(
        expect.objectContaining({ projectKey: 'navigation' }),
      );
      expect(getEnterpriseMetricCatalog).toHaveBeenCalledTimes(1);
      expect(getEnterpriseMetricValues).toHaveBeenLastCalledWith(
        expect.objectContaining({ projectKey: 'navigation' }),
      );
      expect(getRequirementSummary).toHaveBeenLastCalledWith(
        expect.objectContaining({ projectKey: 'navigation' }),
      );
      expect(getRequirements).toHaveBeenLastCalledWith(
        expect.objectContaining({ projectKey: 'navigation' }),
      );
      expect(getPullRequestSummary).toHaveBeenLastCalledWith(
        expect.objectContaining({ projectKey: 'navigation' }),
      );
      expect(getPullRequests).toHaveBeenLastCalledWith(
        expect.objectContaining({ projectKey: 'navigation' }),
      );
      expect(getCollectorIngestionHealth).toHaveBeenCalledTimes(2);
      expect(getGovernanceDirectory).toHaveBeenCalledTimes(2);
      expect(getViewerScopeAssignment).toHaveBeenCalledTimes(0);
    });
  });

  it('auto refreshes dashboard and analysis data on an interval', async () => {
    vi.useFakeTimers();
    const getPersonalSnapshot = vi.fn(async () => ({
      acceptedAiLines: 35,
      commitTotalLines: 50,
      aiOutputRate: 0.7,
      sessionCount: 4,
    }));
    const getTeamSnapshot = vi.fn(async () => ({
      memberCount: 2,
      totalAcceptedAiLines: 50,
      totalCommitLines: 80,
      aiOutputRate: 0.625,
      totalSessionCount: 6,
    }));
    const getMcpAuditMetrics = vi.fn(async () => ({
      totalToolCalls: 12,
      successfulToolCalls: 10,
      failedToolCalls: 2,
      successRate: 10 / 12,
      failureRate: 2 / 12,
      averageDurationMs: 24,
    }));
    const getRuleVersions = vi.fn(async () => ({
      projectKey: 'aimetric',
      activeVersion: 'v2',
      versions: [],
    }));
    const getRuleRollout = vi.fn(async () => ({
      projectKey: 'aimetric',
      enabled: false,
      candidateVersion: undefined,
      percentage: 0,
      includedMembers: [],
      updatedAt: undefined,
    }));
    const getRuleRolloutEvaluation = vi.fn(async () => ({
      projectKey: 'aimetric',
      memberId: undefined,
      enabled: false,
      activeVersion: 'v2',
      selectedVersion: 'v2',
      candidateVersion: undefined,
      percentage: 0,
      bucket: undefined,
      matched: false,
      reason: 'rollout-disabled' as const,
    }));
    const getAnalysisSummary = vi.fn(async () => ({
      sessionCount: 2,
      editSpanCount: 3,
      tabAcceptedCount: 4,
      tabAcceptedLines: 9,
    }));
    const getSessionAnalysisRows = vi.fn(async () => []);
    const getOutputAnalysisRows = vi.fn(async () => []);
    const getEnterpriseMetricCatalog = vi.fn(
      createClient().getEnterpriseMetricCatalog,
    );
    const getEnterpriseMetricValues = vi.fn(
      createClient().getEnterpriseMetricValues,
    );
    const getRequirementSummary = vi.fn(createClient().getRequirementSummary);
    const getRequirements = vi.fn(createClient().getRequirements);
    const getPullRequestSummary = vi.fn(createClient().getPullRequestSummary);
    const getPullRequests = vi.fn(createClient().getPullRequests);
    const getCollectorIngestionHealth = vi.fn(
      createClient().getCollectorIngestionHealth,
    );
    const getGovernanceDirectory = vi.fn(
      createClient().getGovernanceDirectory,
    );
    const getViewerScopeAssignment = vi.fn(
      createClient().getViewerScopeAssignment,
    );

    try {
      render(
        <App
          refreshIntervalMs={1000}
          client={createClient({
            getPersonalSnapshot,
            getTeamSnapshot,
            getMcpAuditMetrics,
            getRuleVersions,
            getRuleRollout,
            getRuleRolloutEvaluation,
            getAnalysisSummary,
            getSessionAnalysisRows,
            getOutputAnalysisRows,
            getEnterpriseMetricCatalog,
            getEnterpriseMetricValues,
            getRequirementSummary,
            getRequirements,
            getPullRequestSummary,
            getPullRequests,
            getCollectorIngestionHealth,
            getGovernanceDirectory,
            getViewerScopeAssignment,
          })}
        />,
      );

      await act(async () => {
        await Promise.resolve();
      });
      expect(screen.getByText('个人出码视图')).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(1000);
        await Promise.resolve();
      });

      expect(getPersonalSnapshot).toHaveBeenCalledTimes(2);
      expect(getTeamSnapshot).toHaveBeenCalledTimes(2);
      expect(getMcpAuditMetrics).toHaveBeenCalledTimes(2);
      expect(getRuleVersions).toHaveBeenCalledTimes(2);
      expect(getRuleRollout).toHaveBeenCalledTimes(2);
      expect(getRuleRolloutEvaluation).toHaveBeenCalledTimes(2);
      expect(getAnalysisSummary).toHaveBeenCalledTimes(2);
      expect(getSessionAnalysisRows).toHaveBeenCalledTimes(2);
      expect(getOutputAnalysisRows).toHaveBeenCalledTimes(2);
      expect(getEnterpriseMetricCatalog).toHaveBeenCalledTimes(1);
      expect(getEnterpriseMetricValues).toHaveBeenCalledTimes(2);
      expect(getRequirementSummary).toHaveBeenCalledTimes(2);
      expect(getRequirements).toHaveBeenCalledTimes(2);
      expect(getPullRequestSummary).toHaveBeenCalledTimes(2);
      expect(getPullRequests).toHaveBeenCalledTimes(2);
      expect(getCollectorIngestionHealth).toHaveBeenCalledTimes(2);
      expect(getGovernanceDirectory).toHaveBeenCalledTimes(2);
      expect(getViewerScopeAssignment).toHaveBeenCalledTimes(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('saves rollout updates from the rule center management view', async () => {
    let currentRollout: RuleRollout = {
      projectKey: 'aimetric',
      enabled: false,
      candidateVersion: undefined,
      percentage: 0,
      includedMembers: [],
      updatedAt: undefined,
    };
    const updateRuleRollout = vi.fn(async (input: RuleRollout) => {
      currentRollout = {
        ...input,
        updatedAt: '2026-04-24T00:00:00.000Z',
      };

      return currentRollout;
    });
    const client = createClient({
      getRuleVersions: async () => ({
        projectKey: 'aimetric',
        activeVersion: 'v2',
        versions: [
          {
            version: 'v1',
            status: 'deprecated' as const,
            updatedAt: '2026-04-23',
            summary: '历史版本',
          },
          {
            version: 'v2',
            status: 'active' as const,
            updatedAt: '2026-04-24',
            summary: '当前版本',
          },
        ],
      }),
      getRuleRollout: async () => currentRollout,
      getRuleRolloutEvaluation: async () => ({
        projectKey: 'aimetric',
        memberId: 'alice',
        enabled: currentRollout.enabled,
        activeVersion: 'v2',
        selectedVersion: currentRollout.enabled ? 'v1' : 'v2',
        candidateVersion: currentRollout.candidateVersion,
        percentage: currentRollout.percentage,
        bucket: currentRollout.enabled ? 7 : undefined,
        matched: currentRollout.enabled,
        reason: currentRollout.enabled
          ? ('included-member' as const)
          : ('rollout-disabled' as const),
      }),
      updateRuleRollout,
    });

    render(<App client={client} />);

    await screen.findByText('规则中心管理');
    fireEvent.click(screen.getByLabelText('启用灰度发布'));
    fireEvent.change(screen.getByLabelText('候选版本'), {
      target: { value: 'v1' },
    });
    fireEvent.change(screen.getByLabelText('灰度比例'), {
      target: { value: '40' },
    });
    fireEvent.change(screen.getByLabelText('定向成员'), {
      target: { value: 'alice, bob' },
    });
    fireEvent.click(screen.getByText('保存灰度策略'));

    await waitFor(() => {
      expect(updateRuleRollout).toHaveBeenCalledWith({
        projectKey: 'aimetric',
        enabled: true,
        candidateVersion: 'v1',
        percentage: 40,
        includedMembers: ['alice', 'bob'],
      });
    });
  });
});
