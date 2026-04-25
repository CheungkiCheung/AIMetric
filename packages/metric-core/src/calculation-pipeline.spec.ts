import { describe, expect, it } from 'vitest';
import {
  calculateEnterpriseMetrics,
  createEnterpriseMetricRegistry,
} from './calculation-pipeline.js';

describe('enterprise metric calculation pipeline', () => {
  it('registers the first batch of computable enterprise metrics', () => {
    const registry = createEnterpriseMetricRegistry();

    expect(registry.listMetricKeys()).toEqual([
      'ai_output_rate',
      'ai_session_count',
      'tab_accepted_lines',
      'mcp_tool_success_rate',
      'lead_time_ai_vs_non_ai',
      'pr_cycle_time',
      'deployment_frequency',
      'review_rejection_rate',
      'ci_pass_rate',
      'defect_rate',
      'escaped_defect_rate',
      'change_failure_rate',
      'rollback_rate',
    ]);
    expect(registry.getDefinition('ai_output_rate')).toMatchObject({
      key: 'ai_output_rate',
      dimension: 'effective-output',
      formula: 'AI 采纳代码行数 / 提交总代码变更行数',
    });
    expect(registry.getCalculator('ai_output_rate')).toMatchObject({
      metricKey: 'ai_output_rate',
      requiredEvidence: ['recorded-metric-events'],
      outputSchema: {
        unit: 'ratio',
      },
    });
    expect(registry.getCalculator('mcp_tool_success_rate')).toMatchObject({
      requiredEvidence: ['mcp-audit-metrics'],
    });
  });

  it('calculates metric values with definitions, scope, period, and confidence', () => {
    const values = calculateEnterpriseMetrics({
      context: {
        scope: 'team',
        projectKey: 'navigation',
        periodStart: '2026-04-23T00:00:00.000Z',
        periodEnd: '2026-04-24T00:00:00.000Z',
        calculatedAt: '2026-04-24T01:00:00.000Z',
      },
      input: {
        recordedMetricEvents: [
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
        ],
        analysisSummary: {
          sessionCount: 5,
          editSpanCount: 4,
          tabAcceptedCount: 6,
          tabAcceptedLines: 18,
        },
        mcpAuditMetrics: {
          totalToolCalls: 10,
          successfulToolCalls: 8,
          failedToolCalls: 2,
          successRate: 0.8,
          failureRate: 0.2,
          averageDurationMs: 24,
        },
        requirementSummary: {
          totalRequirementCount: 5,
          aiTouchedRequirementCount: 3,
          nonAiRequirementCount: 2,
          averageAiLeadTimeHours: 24,
          averageNonAiLeadTimeHours: 36,
        },
        pullRequestSummary: {
          totalPullRequestCount: 4,
          mergedPullRequestCount: 3,
          averageCycleTimeHours: 18,
          reviewedPullRequestCount: 4,
          rejectedPullRequestCount: 1,
        },
        ciSummary: {
          totalRunCount: 6,
          completedRunCount: 5,
          successfulRunCount: 4,
          failedRunCount: 1,
          passRate: 0.8,
        },
        deploymentSummary: {
          totalDeploymentCount: 4,
          successfulDeploymentCount: 2,
          failedDeploymentCount: 1,
          rolledBackDeploymentCount: 1,
          aiTouchedDeploymentCount: 3,
          changeFailureRate: 0.5,
          rollbackRate: 0.25,
        },
        defectSummary: {
          totalDefectCount: 3,
          openDefectCount: 1,
          resolvedDefectCount: 2,
          productionDefectCount: 1,
          completedRequirementCount: 2,
          defectRate: 1.5,
          escapedDefectRate: 1 / 3,
        },
      },
    });

    expect(values).toEqual([
      expect.objectContaining({
        metricKey: 'ai_output_rate',
        value: 0.5,
        unit: 'ratio',
        confidence: 'high',
        scope: 'team',
        projectKey: 'navigation',
        periodStart: '2026-04-23T00:00:00.000Z',
        periodEnd: '2026-04-24T00:00:00.000Z',
        calculatedAt: '2026-04-24T01:00:00.000Z',
        definitionVersion: 1,
        dataRequirements: ['recorded-metric-events'],
        definition: expect.objectContaining({
          name: 'AI 出码率',
          dimension: 'effective-output',
        }),
      }),
      expect.objectContaining({
        metricKey: 'ai_session_count',
        value: 5,
        unit: 'count',
        confidence: 'high',
      }),
      expect.objectContaining({
        metricKey: 'tab_accepted_lines',
        value: 18,
        unit: 'lines',
        confidence: 'medium',
      }),
      expect.objectContaining({
        metricKey: 'mcp_tool_success_rate',
        value: 0.8,
        unit: 'ratio',
        confidence: 'high',
      }),
      expect.objectContaining({
        metricKey: 'lead_time_ai_vs_non_ai',
        value: -12,
        unit: 'hours',
        confidence: 'medium',
        dataRequirements: ['requirement-summary'],
      }),
      expect.objectContaining({
        metricKey: 'pr_cycle_time',
        value: 18,
        unit: 'hours',
        confidence: 'high',
        dataRequirements: ['pull-request-summary'],
      }),
      expect.objectContaining({
        metricKey: 'deployment_frequency',
        value: 4,
        unit: 'count',
        confidence: 'high',
        dataRequirements: ['deployment-summary'],
      }),
      expect.objectContaining({
        metricKey: 'review_rejection_rate',
        value: 0.25,
        unit: 'ratio',
        confidence: 'medium',
        dataRequirements: ['pull-request-summary'],
      }),
      expect.objectContaining({
        metricKey: 'ci_pass_rate',
        value: 0.8,
        unit: 'ratio',
        confidence: 'high',
        dataRequirements: ['ci-summary'],
      }),
      expect.objectContaining({
        metricKey: 'defect_rate',
        value: 1.5,
        unit: 'ratio',
        confidence: 'medium',
        dataRequirements: ['defect-summary'],
      }),
      expect.objectContaining({
        metricKey: 'escaped_defect_rate',
        value: 1 / 3,
        unit: 'ratio',
        confidence: 'medium',
        dataRequirements: ['defect-summary'],
      }),
      expect.objectContaining({
        metricKey: 'change_failure_rate',
        value: 0.5,
        unit: 'ratio',
        confidence: 'medium',
        dataRequirements: ['deployment-summary'],
      }),
      expect.objectContaining({
        metricKey: 'rollback_rate',
        value: 0.25,
        unit: 'ratio',
        confidence: 'medium',
        dataRequirements: ['deployment-summary'],
      }),
    ]);
  });

  it('supports calculating a selected metric subset', () => {
    const values = calculateEnterpriseMetrics({
      metricKeys: ['ai_session_count'],
      context: {
        scope: 'team',
        projectKey: 'navigation',
        periodStart: '2026-04-23T00:00:00.000Z',
        periodEnd: '2026-04-24T00:00:00.000Z',
        calculatedAt: '2026-04-24T01:00:00.000Z',
      },
      input: {
        recordedMetricEvents: [
          {
            memberId: 'alice',
            acceptedAiLines: 30,
            commitTotalLines: 60,
            sessionCount: 2,
          },
        ],
      },
    });

    expect(values).toHaveLength(1);
    expect(values[0]).toMatchObject({
      metricKey: 'ai_session_count',
      value: 2,
    });
  });
});
