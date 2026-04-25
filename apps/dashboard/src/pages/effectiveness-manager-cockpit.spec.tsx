// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { EffectivenessManagerCockpitProps } from './effectiveness-manager-cockpit.js';
import { EffectivenessManagerCockpit } from './effectiveness-manager-cockpit.js';

const metricDefinition = (key: string, name: string) =>
  ({
    key,
    name,
  }) as EffectivenessManagerCockpitProps['metricValues'][number]['definition'];

const metricResult = (
  metricKey: string,
  name: string,
  value: number,
  unit: EffectivenessManagerCockpitProps['metricValues'][number]['unit'],
  periodStart: string,
  periodEnd: string,
) =>
  ({
    metricKey,
    definition: metricDefinition(metricKey, name),
    value,
    unit,
    confidence: 'high',
    scope: 'team',
    projectKey: 'aimetric',
    periodStart,
    periodEnd,
    calculatedAt: '2026-04-25T10:00:00.000Z',
    definitionVersion: 1,
    dataRequirements: [],
  }) as EffectivenessManagerCockpitProps['metricValues'][number];

const createProps = (): EffectivenessManagerCockpitProps => ({
  filters: {
    projectKey: 'aimetric',
    from: '2026-04-01T00:00',
    to: '2026-04-30T00:00',
  },
  selectedWindowDays: 30,
  onSelectWindow: vi.fn(),
  metricValues: [
    metricResult(
      'ai_output_rate',
      'AI 出码率',
      0.72,
      'ratio',
      '2026-04-01T00:00:00.000Z',
      '2026-04-30T00:00:00.000Z',
    ),
    metricResult(
      'critical_requirement_cycle_time',
      '关键需求周期',
      48,
      'hours',
      '2026-04-01T00:00:00.000Z',
      '2026-04-30T00:00:00.000Z',
    ),
    metricResult(
      'ci_pass_rate',
      'CI 通过率',
      0.87,
      'ratio',
      '2026-04-01T00:00:00.000Z',
      '2026-04-30T00:00:00.000Z',
    ),
  ],
  metricSnapshots: [
    metricResult(
      'ai_output_rate',
      'AI 出码率',
      0.55,
      'ratio',
      '2026-04-01T00:00:00.000Z',
      '2026-04-07T00:00:00.000Z',
    ),
    metricResult(
      'ai_output_rate',
      'AI 出码率',
      0.72,
      'ratio',
      '2026-04-23T00:00:00.000Z',
      '2026-04-30T00:00:00.000Z',
    ),
    metricResult(
      'ci_pass_rate',
      'CI 通过率',
      0.81,
      'ratio',
      '2026-04-01T00:00:00.000Z',
      '2026-04-07T00:00:00.000Z',
    ),
    metricResult(
      'ci_pass_rate',
      'CI 通过率',
      0.87,
      'ratio',
      '2026-04-23T00:00:00.000Z',
      '2026-04-30T00:00:00.000Z',
    ),
  ],
  teamSnapshot: {
    memberCount: 5,
    totalAcceptedAiLines: 320,
    totalCommitLines: 500,
    aiOutputRate: 0.64,
    totalSessionCount: 34,
  },
  analysisSummary: {
    sessionCount: 22,
    editSpanCount: 41,
    tabAcceptedCount: 19,
    tabAcceptedLines: 88,
  },
  requirementSummary: {
    totalRequirementCount: 18,
    aiTouchedRequirementCount: 11,
    aiTouchedRequirementRatio: 0.61,
    completedRequirementCount: 10,
    averageLeadTimeHours: 52,
    averageLeadTimeToFirstPrHours: 14,
  },
  pullRequestSummary: {
    totalPrCount: 26,
    aiTouchedPrCount: 16,
    aiTouchedPrRatio: 0.62,
    mergedPrCount: 22,
    averageCycleTimeHours: 18,
  },
  deploymentSummary: {
    totalDeploymentCount: 12,
    successfulDeploymentCount: 10,
    failedDeploymentCount: 2,
    rolledBackDeploymentCount: 1,
    aiTouchedDeploymentCount: 8,
    changeFailureRate: 0.17,
    rollbackRate: 0.08,
    averageDurationMinutes: 16,
  },
  defectAttributionSummary: {
    totalDefectCount: 9,
    aiTouchedRequirementDefectCount: 4,
    aiTouchedRequirementDefectRate: 0.36,
    aiTouchedPullRequestDefectCount: 3,
    escapedAiTouchedPullRequestDefectCount: 1,
    escapedAiTouchedPullRequestDefectRate: 0.11,
    productionDefectCount: 2,
    failedDeploymentLinkedDefectCount: 1,
    incidentLinkedDefectCount: 1,
  },
  collectorHealth: {
    deliveryMode: 'queue',
    queueBackend: 'file',
    queueDepth: 3,
    deadLetterDepth: 0,
    enqueuedTotal: 122,
    forwardedTotal: 120,
    failedForwardTotal: 2,
  },
  governanceDirectory: {
    organization: { key: 'org-1', name: 'AI Platform' },
    teams: [{ key: 'team-1', organizationKey: 'org-1', name: '研发效能团队' }],
    projects: [{ key: 'aimetric', teamKey: 'team-1', name: 'AIMetric' }],
    members: [
      {
        memberId: 'alice',
        displayName: 'Alice',
        teamKey: 'team-1',
        role: 'effectiveness-manager',
      },
    ],
  },
  mcpAuditMetrics: {
    totalToolCalls: 120,
    successfulToolCalls: 112,
    failedToolCalls: 8,
    successRate: 112 / 120,
    failureRate: 8 / 120,
    averageDurationMs: 420,
  },
});

describe('EffectivenessManagerCockpit', () => {
  it('filters tool cards by category and integration status', () => {
    render(<EffectivenessManagerCockpit {...createProps()} />);

    expect(screen.getByText('当前显示 7 / 7 个工具')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Agent CLI' }));
    expect(screen.getByText('当前显示 2 / 7 个工具')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '仅已接入' }));
    expect(screen.getByText('当前显示 0 / 7 个工具')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '全部状态' }));
    fireEvent.click(screen.getByRole('button', { name: '全部工具' }));
    expect(screen.getByText('当前显示 7 / 7 个工具')).toBeInTheDocument();
  });

  it('switches focused tool insights when a tool card is selected', () => {
    render(<EffectivenessManagerCockpit {...createProps()} />);

    expect(screen.getAllByText('当前焦点工具').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cursor').length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole('button', { name: /MCP 工具链/i })[0]);

    expect(screen.getAllByText('MCP 工具链').length).toBeGreaterThan(0);
    expect(screen.getAllByText('平台能力').length).toBeGreaterThan(0);
    expect(screen.getByText('统一采集主链路')).toBeInTheDocument();
  });

  it('switches the main trend detail when a trend card is selected', () => {
    render(<EffectivenessManagerCockpit {...createProps()} />);

    expect(screen.getAllByText('趋势主视图').length).toBeGreaterThan(0);
    expect(screen.getAllByText('AI 代码生成率').length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole('button', { name: /CI 稳定性/i })[0]);

    expect(screen.getAllByText('CI 稳定性').length).toBeGreaterThan(0);
    expect(screen.getByText('这是提效管理者的风险护栏指标，用于观察工具扩大后工程质量是否仍可控。')).toBeInTheDocument();
  });
});
