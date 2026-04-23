// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';
import type { DashboardFilters } from './api/client.js';

describe('App', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders personal and team metric views', async () => {
    render(
      <App
        client={{
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
        }}
      />,
    );

    expect(await screen.findByText('个人出码视图')).toBeInTheDocument();
    expect(screen.getByText('团队出码视图')).toBeInTheDocument();
    expect(screen.getByText('MCP 采集质量')).toBeInTheDocument();
    expect(screen.getByText('规则中心管理')).toBeInTheDocument();
    expect(screen.getByText('70.0%')).toBeInTheDocument();
    expect(screen.getByText('62.5%')).toBeInTheDocument();
    expect(screen.getByText('83.3%')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.getByText('命中规则版本')).toBeInTheDocument();
    expect(screen.getAllByText('v1').length).toBeGreaterThan(0);
  });

  it('reloads metrics when filters change', async () => {
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

    render(
      <App
        client={{
          getPersonalSnapshot,
          getTeamSnapshot,
          getMcpAuditMetrics,
          getRuleVersions,
          getRuleRollout,
          getRuleRolloutEvaluation,
        }}
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
    });
  });

  it('auto refreshes metrics on an interval', async () => {
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

    try {
      render(
        <App
          refreshIntervalMs={1000}
          client={{
            getPersonalSnapshot,
            getTeamSnapshot,
            getMcpAuditMetrics,
            getRuleVersions,
            getRuleRollout,
            getRuleRolloutEvaluation,
          }}
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
    } finally {
      vi.useRealTimers();
    }
  });
});
