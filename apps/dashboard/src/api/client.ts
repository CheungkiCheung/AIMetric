import {
  getEnterpriseMetricCatalog,
  type EnterpriseMetricCatalog,
  type EnterpriseMetricDashboardPlacement,
  type EnterpriseMetricDefinition,
  type EnterpriseMetricDimension,
  type MetricCalculationResult,
} from '@aimetric/metric-core';

export interface PersonalSnapshot {
  acceptedAiLines: number;
  commitTotalLines: number;
  aiOutputRate: number;
  sessionCount: number;
}

export interface TeamSnapshot {
  memberCount: number;
  totalAcceptedAiLines: number;
  totalCommitLines: number;
  totalSessionCount: number;
  aiOutputRate: number;
}

export interface McpAuditMetrics {
  totalToolCalls: number;
  successfulToolCalls: number;
  failedToolCalls: number;
  successRate: number;
  failureRate: number;
  averageDurationMs: number;
}

export interface RuleVersionSummary {
  version: string;
  status: 'active' | 'deprecated';
  updatedAt: string;
  summary: string;
}

export interface RuleVersionCatalog {
  projectKey: string;
  activeVersion: string;
  versions: RuleVersionSummary[];
}

export interface RuleRollout {
  projectKey: string;
  enabled: boolean;
  candidateVersion?: string;
  percentage: number;
  includedMembers: string[];
  updatedAt?: string;
}

export interface RuleRolloutEvaluation {
  projectKey: string;
  memberId?: string;
  enabled: boolean;
  activeVersion: string;
  selectedVersion: string;
  candidateVersion?: string;
  percentage: number;
  bucket?: number;
  matched: boolean;
  reason:
    | 'rollout-disabled'
    | 'no-member'
    | 'included-member'
    | 'percentage-hit'
    | 'percentage-miss';
}

export interface DashboardFilters {
  projectKey?: string;
  memberId?: string;
  from?: string;
  to?: string;
}

export interface AnalysisSummary {
  sessionCount: number;
  editSpanCount: number;
  tabAcceptedCount: number;
  tabAcceptedLines: number;
}

export interface SessionAnalysisRow {
  sessionId: string;
  memberId?: string;
  projectKey: string;
  occurredAt: string;
  conversationTurns?: number;
  userMessageCount?: number;
  assistantMessageCount?: number;
  firstMessageAt?: string;
  lastMessageAt?: string;
  workspaceId?: string;
  workspacePath?: string;
  projectFingerprint?: string;
  editSpanCount: number;
  tabAcceptedCount: number;
  tabAcceptedLines: number;
}

export interface OutputAnalysisRow {
  sessionId: string;
  memberId?: string;
  projectKey: string;
  filePath: string;
  editSpanCount: number;
  latestEditAt: string;
  tabAcceptedCount: number;
  tabAcceptedLines: number;
  latestDiffSummary?: string;
}

export interface CollectorIngestionHealth {
  deliveryMode: 'sync' | 'queue';
  queueDepth: number;
  deadLetterDepth: number;
  enqueuedTotal: number;
  forwardedTotal: number;
  failedForwardTotal: number;
}

export interface DashboardClient {
  getPersonalSnapshot(filters?: DashboardFilters): Promise<PersonalSnapshot>;
  getTeamSnapshot(filters?: DashboardFilters): Promise<TeamSnapshot>;
  getMcpAuditMetrics(filters?: DashboardFilters): Promise<McpAuditMetrics>;
  getAnalysisSummary(filters?: DashboardFilters): Promise<AnalysisSummary>;
  getSessionAnalysisRows(
    filters?: DashboardFilters,
  ): Promise<SessionAnalysisRow[]>;
  getOutputAnalysisRows(filters?: DashboardFilters): Promise<OutputAnalysisRow[]>;
  getRuleVersions(projectKey?: string): Promise<RuleVersionCatalog>;
  getRuleRollout(projectKey?: string): Promise<RuleRollout>;
  getRuleRolloutEvaluation(
    projectKey?: string,
    memberId?: string,
  ): Promise<RuleRolloutEvaluation>;
  getEnterpriseMetricCatalog(): Promise<EnterpriseMetricCatalog>;
  getEnterpriseMetricValues(
    filters?: DashboardFilters,
    metricKeys?: string[],
  ): Promise<MetricCalculationResult[]>;
  getCollectorIngestionHealth(): Promise<CollectorIngestionHealth>;
  updateRuleRollout(input: RuleRollout): Promise<RuleRollout>;
}

export type {
  EnterpriseMetricCatalog,
  EnterpriseMetricDashboardPlacement,
  EnterpriseMetricDefinition,
  EnterpriseMetricDimension,
  MetricCalculationResult,
};

const fallbackPersonalSnapshot: PersonalSnapshot = {
  acceptedAiLines: 35,
  commitTotalLines: 50,
  aiOutputRate: 0.7,
  sessionCount: 4,
};

const fallbackTeamSnapshot: TeamSnapshot = {
  memberCount: 2,
  totalAcceptedAiLines: 50,
  totalCommitLines: 80,
  totalSessionCount: 6,
  aiOutputRate: 0.625,
};

const fallbackMcpAuditMetrics: McpAuditMetrics = {
  totalToolCalls: 0,
  successfulToolCalls: 0,
  failedToolCalls: 0,
  successRate: 0,
  failureRate: 0,
  averageDurationMs: 0,
};

const fallbackAnalysisSummary: AnalysisSummary = {
  sessionCount: 0,
  editSpanCount: 0,
  tabAcceptedCount: 0,
  tabAcceptedLines: 0,
};

const fallbackRuleVersions: RuleVersionCatalog = {
  projectKey: 'aimetric',
  activeVersion: 'v2',
  versions: [],
};

const fallbackRuleRollout: RuleRollout = {
  projectKey: 'aimetric',
  enabled: false,
  candidateVersion: undefined,
  percentage: 0,
  includedMembers: [],
  updatedAt: undefined,
};

const fallbackRuleRolloutEvaluation: RuleRolloutEvaluation = {
  projectKey: 'aimetric',
  memberId: undefined,
  enabled: false,
  activeVersion: 'v2',
  selectedVersion: 'v2',
  candidateVersion: undefined,
  percentage: 0,
  bucket: undefined,
  matched: false,
  reason: 'rollout-disabled',
};

const fallbackEnterpriseMetricCatalog = getEnterpriseMetricCatalog();

const fallbackCollectorIngestionHealth: CollectorIngestionHealth = {
  deliveryMode: 'sync',
  queueDepth: 0,
  deadLetterDepth: 0,
  enqueuedTotal: 0,
  forwardedTotal: 0,
  failedForwardTotal: 0,
};

const fetchJson = async <T>(url: string, fallback: T): Promise<T> => {
  if (typeof fetch !== 'function') {
    return fallback;
  }

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return fallback;
    }

    return (await response.json()) as T;
  } catch {
    return fallback;
  }
};

const sendJson = async <T>(
  url: string,
  body: unknown,
  fallback: T,
): Promise<T> => {
  if (typeof fetch !== 'function') {
    return fallback;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return fallback;
    }

    return (await response.json()) as T;
  } catch {
    return fallback;
  }
};

const buildMetricUrl = (
  baseUrl: string,
  path: string,
  filters: DashboardFilters = {},
  metricKeys: string[] = [],
): string => {
  const url = new URL(path, baseUrl);
  const orderedFilterKeys: Array<keyof DashboardFilters> = [
    'projectKey',
    'memberId',
    'from',
    'to',
  ];

  orderedFilterKeys.forEach((key) => {
    const value = filters[key];

    if (value) {
      url.searchParams.set(key, value);
    }
  });

  metricKeys.forEach((metricKey) => {
    url.searchParams.append('metricKey', metricKey);
  });

  return url.toString();
};

const buildRuleUrl = (
  baseUrl: string,
  path: string,
  projectKey?: string,
  memberId?: string,
): string => {
  const url = new URL(path, baseUrl);

  if (projectKey) {
    url.searchParams.set('projectKey', projectKey);
  }

  if (memberId) {
    url.searchParams.set('memberId', memberId);
  }

  return url.toString();
};

export const createDashboardClient = (
  baseUrl = 'http://localhost:3001',
  collectorGatewayBaseUrl = 'http://localhost:3000',
): DashboardClient => ({
  getPersonalSnapshot: (filters) =>
    fetchJson<PersonalSnapshot>(
      buildMetricUrl(baseUrl, '/metrics/personal', filters),
      fallbackPersonalSnapshot,
    ),
  getTeamSnapshot: (filters) =>
    fetchJson<TeamSnapshot>(
      buildMetricUrl(baseUrl, '/metrics/team', filters),
      fallbackTeamSnapshot,
    ),
  getMcpAuditMetrics: (filters) =>
    fetchJson<McpAuditMetrics>(
      buildMetricUrl(baseUrl, '/metrics/mcp-audit', filters),
      fallbackMcpAuditMetrics,
    ),
  getAnalysisSummary: (filters) =>
    fetchJson<AnalysisSummary>(
      buildMetricUrl(baseUrl, '/analysis/summary', filters),
      fallbackAnalysisSummary,
    ),
  getSessionAnalysisRows: (filters) =>
    fetchJson<SessionAnalysisRow[]>(
      buildMetricUrl(baseUrl, '/analysis/sessions', filters),
      [],
    ),
  getOutputAnalysisRows: (filters) =>
    fetchJson<OutputAnalysisRow[]>(
      buildMetricUrl(baseUrl, '/analysis/output', filters),
      [],
    ),
  getRuleVersions: (projectKey) =>
    fetchJson<RuleVersionCatalog>(
      buildRuleUrl(baseUrl, '/rules/versions', projectKey),
      fallbackRuleVersions,
    ),
  getRuleRollout: (projectKey) =>
    fetchJson<RuleRollout>(
      buildRuleUrl(baseUrl, '/rules/rollout', projectKey),
      fallbackRuleRollout,
    ),
  getRuleRolloutEvaluation: (projectKey, memberId) =>
    fetchJson<RuleRolloutEvaluation>(
      buildRuleUrl(baseUrl, '/rules/rollout/evaluate', projectKey, memberId),
      fallbackRuleRolloutEvaluation,
    ),
  getEnterpriseMetricCatalog: () =>
    fetchJson<EnterpriseMetricCatalog>(
      new URL('/enterprise-metrics/catalog', baseUrl).toString(),
      fallbackEnterpriseMetricCatalog,
    ),
  getEnterpriseMetricValues: (filters, metricKeys) =>
    fetchJson<MetricCalculationResult[]>(
      buildMetricUrl(
        baseUrl,
        '/enterprise-metrics/values',
        filters,
        metricKeys,
      ),
      [],
    ),
  getCollectorIngestionHealth: () =>
    fetchJson<CollectorIngestionHealth>(
      new URL('/ingestion/health', collectorGatewayBaseUrl).toString(),
      fallbackCollectorIngestionHealth,
    ),
  updateRuleRollout: (input) =>
    sendJson<RuleRollout>(
      new URL('/rules/rollout', baseUrl).toString(),
      input,
      fallbackRuleRollout,
    ),
});
