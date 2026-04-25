import { calculateAiOutputRate } from './formulas.js';
import {
  getEnterpriseMetricCatalog,
  type EnterpriseMetricDefinition,
} from './metric-catalog.js';

export type EnterpriseMetricScope = 'personal' | 'team' | 'project';

export type EnterpriseMetricValueUnit = 'ratio' | 'count' | 'lines' | 'hours';

export type EnterpriseMetricConfidence = 'high' | 'medium' | 'low';

export type MetricDataRequirement =
  | 'recorded-metric-events'
  | 'analysis-summary'
  | 'mcp-audit-metrics'
  | 'requirement-summary'
  | 'pull-request-summary'
  | 'ci-summary'
  | 'deployment-summary';

export interface MetricCalculationContext {
  scope: EnterpriseMetricScope;
  projectKey: string;
  periodStart: string;
  periodEnd: string;
  calculatedAt: string;
  memberId?: string;
  teamKey?: string;
}

export interface CalculationRecordedMetricEvent {
  memberId: string;
  acceptedAiLines: number;
  commitTotalLines: number;
  sessionCount: number;
}

export interface CalculationAnalysisSummary {
  sessionCount: number;
  editSpanCount: number;
  tabAcceptedCount: number;
  tabAcceptedLines: number;
}

export interface CalculationMcpAuditMetrics {
  totalToolCalls: number;
  successfulToolCalls: number;
  failedToolCalls: number;
  successRate: number;
  failureRate: number;
  averageDurationMs: number;
}

export interface CalculationRequirementSummary {
  totalRequirementCount: number;
  aiTouchedRequirementCount: number;
  nonAiRequirementCount: number;
  averageAiLeadTimeHours: number;
  averageNonAiLeadTimeHours: number;
}

export interface CalculationPullRequestSummary {
  totalPullRequestCount: number;
  mergedPullRequestCount: number;
  averageCycleTimeHours: number;
  reviewedPullRequestCount: number;
  rejectedPullRequestCount: number;
}

export interface CalculationCiSummary {
  totalRunCount: number;
  completedRunCount: number;
  successfulRunCount: number;
  failedRunCount: number;
  passRate: number;
}

export interface CalculationDeploymentSummary {
  totalDeploymentCount: number;
  successfulDeploymentCount: number;
  failedDeploymentCount: number;
  rolledBackDeploymentCount: number;
  aiTouchedDeploymentCount: number;
  changeFailureRate: number;
  rollbackRate: number;
}

export interface MetricCalculationInput {
  recordedMetricEvents?: CalculationRecordedMetricEvent[];
  analysisSummary?: CalculationAnalysisSummary;
  mcpAuditMetrics?: CalculationMcpAuditMetrics;
  requirementSummary?: CalculationRequirementSummary;
  pullRequestSummary?: CalculationPullRequestSummary;
  ciSummary?: CalculationCiSummary;
  deploymentSummary?: CalculationDeploymentSummary;
}

export interface MetricCalculationResult {
  metricKey: string;
  value: number;
  unit: EnterpriseMetricValueUnit;
  confidence: EnterpriseMetricConfidence;
  scope: EnterpriseMetricScope;
  projectKey: string;
  periodStart: string;
  periodEnd: string;
  calculatedAt: string;
  definitionVersion: number;
  dataRequirements: MetricDataRequirement[];
  definition: EnterpriseMetricDefinition;
  memberId?: string;
  teamKey?: string;
}

export interface MetricCalculator {
  metricKey: string;
  unit: EnterpriseMetricValueUnit;
  requiredEvidence: MetricDataRequirement[];
  outputSchema: {
    unit: EnterpriseMetricValueUnit;
  };
  calculate: (
    input: MetricCalculationInput,
    context: MetricCalculationContext,
    definition: EnterpriseMetricDefinition,
  ) => MetricCalculationResult;
}

export interface EnterpriseMetricRegistry {
  listMetricKeys: () => string[];
  getDefinition: (metricKey: string) => EnterpriseMetricDefinition | undefined;
  getCalculator: (metricKey: string) => MetricCalculator | undefined;
  listCalculators: () => MetricCalculator[];
}

export interface CalculateEnterpriseMetricsInput {
  context: MetricCalculationContext;
  input: MetricCalculationInput;
  metricKeys?: string[];
  registry?: EnterpriseMetricRegistry;
}

const currentMetricDefinitionVersion = 1;

const cloneDefinition = (
  definition: EnterpriseMetricDefinition,
): EnterpriseMetricDefinition => ({
  ...definition,
  dataSources: [...definition.dataSources],
});

const buildResult = (
  context: MetricCalculationContext,
  definition: EnterpriseMetricDefinition,
  value: number,
  unit: EnterpriseMetricValueUnit,
  confidence: EnterpriseMetricConfidence,
  dataRequirements: MetricDataRequirement[],
): MetricCalculationResult => ({
  metricKey: definition.key,
  value,
  unit,
  confidence,
  scope: context.scope,
  projectKey: context.projectKey,
  periodStart: context.periodStart,
  periodEnd: context.periodEnd,
  calculatedAt: context.calculatedAt,
  definitionVersion: currentMetricDefinitionVersion,
  dataRequirements: [...dataRequirements],
  definition: cloneDefinition(definition),
  ...(context.memberId ? { memberId: context.memberId } : {}),
  ...(context.teamKey ? { teamKey: context.teamKey } : {}),
});

const sumRecordedMetricEvents = (
  events: CalculationRecordedMetricEvent[] = [],
) =>
  events.reduce(
    (summary, event) => ({
      acceptedAiLines: summary.acceptedAiLines + event.acceptedAiLines,
      commitTotalLines: summary.commitTotalLines + event.commitTotalLines,
      sessionCount: summary.sessionCount + event.sessionCount,
    }),
    {
      acceptedAiLines: 0,
      commitTotalLines: 0,
      sessionCount: 0,
    },
  );

const createCalculator = (
  metricKey: string,
  unit: EnterpriseMetricValueUnit,
  requiredEvidence: MetricDataRequirement[],
  calculateValue: (
    input: MetricCalculationInput,
  ) => {
    value: number;
    confidence: EnterpriseMetricConfidence;
  },
): MetricCalculator => ({
  metricKey,
  unit,
  requiredEvidence,
  outputSchema: {
    unit,
  },
  calculate: (input, context, definition) => {
    const { value, confidence } = calculateValue(input);

    return buildResult(
      context,
      definition,
      value,
      unit,
      confidence,
      requiredEvidence,
    );
  },
});

const defaultCalculators: MetricCalculator[] = [
  createCalculator(
    'ai_output_rate',
    'ratio',
    ['recorded-metric-events'],
    (input) => {
      const summary = sumRecordedMetricEvents(input.recordedMetricEvents);

      return {
        value: calculateAiOutputRate(
          summary.acceptedAiLines,
          summary.commitTotalLines,
        ),
        confidence: summary.commitTotalLines > 0 ? 'high' : 'low',
      };
    },
  ),
  createCalculator(
    'ai_session_count',
    'count',
    ['recorded-metric-events'],
    (input) => {
      const summary = sumRecordedMetricEvents(input.recordedMetricEvents);

      return {
        value: summary.sessionCount,
        confidence: input.recordedMetricEvents ? 'high' : 'low',
      };
    },
  ),
  createCalculator(
    'tab_accepted_lines',
    'lines',
    ['analysis-summary'],
    (input) => ({
      value: input.analysisSummary?.tabAcceptedLines ?? 0,
      confidence: input.analysisSummary ? 'medium' : 'low',
    }),
  ),
  createCalculator(
    'mcp_tool_success_rate',
    'ratio',
    ['mcp-audit-metrics'],
    (input) => ({
      value: input.mcpAuditMetrics?.successRate ?? 0,
      confidence:
        (input.mcpAuditMetrics?.totalToolCalls ?? 0) > 0 ? 'high' : 'low',
    }),
  ),
  createCalculator(
    'lead_time_ai_vs_non_ai',
    'hours',
    ['requirement-summary'],
    (input) => {
      const requirementSummary = input.requirementSummary;

      if (
        !requirementSummary ||
        requirementSummary.aiTouchedRequirementCount === 0 ||
        requirementSummary.nonAiRequirementCount === 0
      ) {
        return {
          value: 0,
          confidence: 'low' as const,
        };
      }

      return {
        value:
          requirementSummary.averageAiLeadTimeHours -
          requirementSummary.averageNonAiLeadTimeHours,
        confidence: 'medium' as const,
      };
    },
  ),
  createCalculator(
    'pr_cycle_time',
    'hours',
    ['pull-request-summary'],
    (input) => {
      const pullRequestSummary = input.pullRequestSummary;

      if (!pullRequestSummary || pullRequestSummary.mergedPullRequestCount === 0) {
        return {
          value: 0,
          confidence: 'low' as const,
        };
      }

      return {
        value: pullRequestSummary.averageCycleTimeHours,
        confidence: 'high' as const,
      };
    },
  ),
  createCalculator(
    'deployment_frequency',
    'count',
    ['deployment-summary'],
    (input) => {
      const deploymentSummary = input.deploymentSummary;

      if (!deploymentSummary) {
        return {
          value: 0,
          confidence: 'low' as const,
        };
      }

      return {
        value: deploymentSummary.totalDeploymentCount,
        confidence:
          deploymentSummary.totalDeploymentCount > 0
            ? ('high' as const)
            : ('low' as const),
      };
    },
  ),
  createCalculator(
    'review_rejection_rate',
    'ratio',
    ['pull-request-summary'],
    (input) => {
      const pullRequestSummary = input.pullRequestSummary;

      if (!pullRequestSummary || pullRequestSummary.reviewedPullRequestCount === 0) {
        return {
          value: 0,
          confidence: 'low' as const,
        };
      }

      return {
        value:
          pullRequestSummary.rejectedPullRequestCount /
          pullRequestSummary.reviewedPullRequestCount,
        confidence: 'medium' as const,
      };
    },
  ),
  createCalculator(
    'ci_pass_rate',
    'ratio',
    ['ci-summary'],
    (input) => {
      const ciSummary = input.ciSummary;

      if (!ciSummary || ciSummary.completedRunCount === 0) {
        return {
          value: 0,
          confidence: 'low' as const,
        };
      }

      return {
        value: ciSummary.passRate,
        confidence: 'high' as const,
      };
    },
  ),
  createCalculator(
    'change_failure_rate',
    'ratio',
    ['deployment-summary'],
    (input) => {
      const deploymentSummary = input.deploymentSummary;

      if (!deploymentSummary || deploymentSummary.totalDeploymentCount === 0) {
        return {
          value: 0,
          confidence: 'low' as const,
        };
      }

      return {
        value: deploymentSummary.changeFailureRate,
        confidence: 'medium' as const,
      };
    },
  ),
  createCalculator(
    'rollback_rate',
    'ratio',
    ['deployment-summary'],
    (input) => {
      const deploymentSummary = input.deploymentSummary;

      if (!deploymentSummary || deploymentSummary.totalDeploymentCount === 0) {
        return {
          value: 0,
          confidence: 'low' as const,
        };
      }

      return {
        value: deploymentSummary.rollbackRate,
        confidence: 'medium' as const,
      };
    },
  ),
];

export const createEnterpriseMetricRegistry = (
  calculators: MetricCalculator[] = defaultCalculators,
): EnterpriseMetricRegistry => {
  const definitions = new Map(
    getEnterpriseMetricCatalog().metrics.map((definition) => [
      definition.key,
      definition,
    ]),
  );
  const calculatorMap = new Map(
    calculators.map((calculator) => [calculator.metricKey, calculator]),
  );

  return {
    listMetricKeys: () => [...calculatorMap.keys()],
    getDefinition: (metricKey) => {
      const definition = definitions.get(metricKey);

      return definition ? cloneDefinition(definition) : undefined;
    },
    getCalculator: (metricKey) => calculatorMap.get(metricKey),
    listCalculators: () => [...calculatorMap.values()],
  };
};

export const calculateEnterpriseMetrics = ({
  context,
  input,
  metricKeys,
  registry = createEnterpriseMetricRegistry(),
}: CalculateEnterpriseMetricsInput): MetricCalculationResult[] => {
  const selectedMetricKeys = metricKeys ?? registry.listMetricKeys();

  return selectedMetricKeys.map((metricKey) => {
    const definition = registry.getDefinition(metricKey);
    const calculator = registry.getCalculator(metricKey);

    if (!definition || !calculator) {
      throw new Error(`Metric calculator is not registered: ${metricKey}`);
    }

    return calculator.calculate(input, context, definition);
  });
};
