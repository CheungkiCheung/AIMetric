// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';
import type { DashboardClient, DashboardFilters, RuleRollout } from './api/client.js';

const createClient = (
  overrides: Partial<DashboardClient> = {},
): DashboardClient => ({
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
    expect(screen.getByText('MCP 采集质量')).toBeInTheDocument();
    expect(screen.getByText('规则中心管理')).toBeInTheDocument();
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
