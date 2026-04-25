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
  queueBackend: 'memory' | 'file';
  queueDepth: number;
  deadLetterDepth: number;
  enqueuedTotal: number;
  forwardedTotal: number;
  failedForwardTotal: number;
}

export interface GovernanceOrganization {
  key: string;
  name: string;
}

export interface GovernanceTeam {
  key: string;
  name: string;
  organizationKey: string;
}

export interface GovernanceProject {
  key: string;
  name: string;
  teamKey: string;
}

export interface GovernanceMember {
  memberId: string;
  displayName: string;
  teamKey: string;
  role: 'developer' | 'engineering-manager' | 'effectiveness-manager' | 'platform-admin';
}

export interface GovernanceDirectory {
  organization: GovernanceOrganization;
  teams: GovernanceTeam[];
  projects: GovernanceProject[];
  members: GovernanceMember[];
}

export interface ViewerScopeAssignment {
  viewerId: string;
  teamKeys: string[];
  projectKeys: string[];
  updatedAt?: string;
}

export interface PullRequestRecord {
  provider: 'github' | 'gitlab';
  projectKey: string;
  repoName: string;
  prNumber: number;
  title: string;
  authorMemberId?: string;
  state: 'open' | 'closed' | 'merged';
  aiTouched: boolean;
  reviewDecision?: 'approved' | 'changes-requested' | 'commented';
  linkedRequirementKeys?: string[];
  createdAt: string;
  mergedAt?: string;
  cycleTimeHours?: number;
  updatedAt: string;
}

export interface PullRequestSummary {
  totalPrCount: number;
  aiTouchedPrCount: number;
  aiTouchedPrRatio: number;
  mergedPrCount: number;
  averageCycleTimeHours: number;
}

export interface RequirementRecord {
  provider: 'jira' | 'tapd';
  projectKey: string;
  requirementKey: string;
  title: string;
  ownerMemberId?: string;
  status: 'open' | 'in-progress' | 'done' | 'closed';
  aiTouched: boolean;
  firstPrCreatedAt?: string;
  completedAt?: string;
  linkedPullRequestCount?: number;
  linkedPullRequestNumbers?: number[];
  leadTimeHours?: number;
  leadTimeToFirstPrHours?: number;
  createdAt: string;
  updatedAt: string;
}

export interface RequirementSummary {
  totalRequirementCount: number;
  aiTouchedRequirementCount: number;
  aiTouchedRequirementRatio: number;
  completedRequirementCount: number;
  averageLeadTimeHours: number;
  averageLeadTimeToFirstPrHours: number;
}

export interface CiRunRecord {
  provider: 'github-actions' | 'gitlab-ci';
  projectKey: string;
  repoName: string;
  runId: number;
  workflowName: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'cancelled' | 'timed_out' | 'skipped';
  createdAt: string;
  completedAt?: string;
  durationMinutes?: number;
  updatedAt: string;
}

export interface CiRunSummary {
  totalRunCount: number;
  completedRunCount: number;
  successfulRunCount: number;
  failedRunCount: number;
  passRate: number;
  averageDurationMinutes: number;
}

export interface DeploymentRecord {
  provider: 'github-actions' | 'argo-cd';
  projectKey: string;
  repoName: string;
  deploymentId: string;
  environment: 'production' | 'staging';
  status: 'success' | 'failed' | 'cancelled';
  aiTouched: boolean;
  rolledBack: boolean;
  incidentKey?: string;
  createdAt: string;
  finishedAt?: string;
  durationMinutes?: number;
  updatedAt: string;
}

export interface DeploymentSummary {
  totalDeploymentCount: number;
  successfulDeploymentCount: number;
  failedDeploymentCount: number;
  rolledBackDeploymentCount: number;
  aiTouchedDeploymentCount: number;
  changeFailureRate: number;
  rollbackRate: number;
  averageDurationMinutes: number;
}

export interface IncidentRecord {
  provider: 'pagerduty' | 'sentry' | 'manual';
  projectKey: string;
  incidentKey: string;
  title: string;
  severity: 'sev1' | 'sev2' | 'sev3' | 'sev4';
  status: 'open' | 'resolved';
  linkedDeploymentIds: string[];
  createdAt: string;
  resolvedAt?: string;
  updatedAt: string;
}

export interface IncidentSummary {
  totalIncidentCount: number;
  openIncidentCount: number;
  resolvedIncidentCount: number;
  linkedDeploymentCount: number;
  averageResolutionHours: number;
}

export interface DefectRecord {
  provider: 'jira' | 'tapd' | 'bugzilla' | 'manual';
  projectKey: string;
  defectKey: string;
  title: string;
  severity: 'sev1' | 'sev2' | 'sev3' | 'sev4';
  status: 'open' | 'resolved';
  foundInPhase: 'development' | 'testing' | 'production';
  linkedRequirementKeys: string[];
  linkedPullRequestNumbers: number[];
  createdAt: string;
  resolvedAt?: string;
  updatedAt: string;
}

export interface DefectSummary {
  totalDefectCount: number;
  openDefectCount: number;
  resolvedDefectCount: number;
  productionDefectCount: number;
  averageResolutionHours: number;
}

export interface DefectAttributionRow {
  defectKey: string;
  title: string;
  projectKey: string;
  severity: DefectRecord['severity'];
  status: DefectRecord['status'];
  foundInPhase: DefectRecord['foundInPhase'];
  linkedRequirementKeys: string[];
  linkedPullRequestNumbers: number[];
  aiTouchedRequirement: boolean;
  aiTouchedPullRequest: boolean;
  createdAt: string;
  resolvedAt?: string;
}

export interface DefectAttributionSummary {
  totalDefectCount: number;
  aiTouchedRequirementDefectCount: number;
  aiTouchedPullRequestDefectCount: number;
  escapedAiTouchedPullRequestDefectCount: number;
  productionDefectCount: number;
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
  getGovernanceDirectory(): Promise<GovernanceDirectory>;
  getViewerScopeAssignment(viewerId: string): Promise<ViewerScopeAssignment | null>;
  updateViewerScopeAssignment(input: ViewerScopeAssignment): Promise<ViewerScopeAssignment>;
  getPullRequestSummary(filters?: DashboardFilters): Promise<PullRequestSummary>;
  getPullRequests(filters?: DashboardFilters): Promise<PullRequestRecord[]>;
  getRequirementSummary(filters?: DashboardFilters): Promise<RequirementSummary>;
  getRequirements(filters?: DashboardFilters): Promise<RequirementRecord[]>;
  getCiRunSummary(filters?: DashboardFilters): Promise<CiRunSummary>;
  getCiRuns(filters?: DashboardFilters): Promise<CiRunRecord[]>;
  getDeploymentSummary(filters?: DashboardFilters): Promise<DeploymentSummary>;
  getDeployments(filters?: DashboardFilters): Promise<DeploymentRecord[]>;
  getIncidentSummary(filters?: DashboardFilters): Promise<IncidentSummary>;
  getIncidents(filters?: DashboardFilters): Promise<IncidentRecord[]>;
  getDefectSummary(filters?: DashboardFilters): Promise<DefectSummary>;
  getDefects(filters?: DashboardFilters): Promise<DefectRecord[]>;
  getDefectAttributionSummary(
    filters?: DashboardFilters,
  ): Promise<DefectAttributionSummary>;
  getDefectAttributionRows(filters?: DashboardFilters): Promise<DefectAttributionRow[]>;
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
  queueBackend: 'memory',
  queueDepth: 0,
  deadLetterDepth: 0,
  enqueuedTotal: 0,
  forwardedTotal: 0,
  failedForwardTotal: 0,
};

const fallbackGovernanceDirectory: GovernanceDirectory = {
  organization: {
    key: 'aimetric-enterprise',
    name: 'AIMetric Enterprise',
  },
  teams: [],
  projects: [],
  members: [],
};

const fallbackViewerScopeAssignment = (viewerId: string): ViewerScopeAssignment => ({
  viewerId,
  teamKeys: [],
  projectKeys: [],
});

const fallbackPullRequestSummary: PullRequestSummary = {
  totalPrCount: 0,
  aiTouchedPrCount: 0,
  aiTouchedPrRatio: 0,
  mergedPrCount: 0,
  averageCycleTimeHours: 0,
};

const fallbackRequirementSummary: RequirementSummary = {
  totalRequirementCount: 0,
  aiTouchedRequirementCount: 0,
  aiTouchedRequirementRatio: 0,
  completedRequirementCount: 0,
  averageLeadTimeHours: 0,
  averageLeadTimeToFirstPrHours: 0,
};

const fallbackCiRunSummary: CiRunSummary = {
  totalRunCount: 0,
  completedRunCount: 0,
  successfulRunCount: 0,
  failedRunCount: 0,
  passRate: 0,
  averageDurationMinutes: 0,
};

const fallbackDeploymentSummary: DeploymentSummary = {
  totalDeploymentCount: 0,
  successfulDeploymentCount: 0,
  failedDeploymentCount: 0,
  rolledBackDeploymentCount: 0,
  aiTouchedDeploymentCount: 0,
  changeFailureRate: 0,
  rollbackRate: 0,
  averageDurationMinutes: 0,
};

const fallbackIncidentSummary: IncidentSummary = {
  totalIncidentCount: 0,
  openIncidentCount: 0,
  resolvedIncidentCount: 0,
  linkedDeploymentCount: 0,
  averageResolutionHours: 0,
};

const fallbackDefectSummary: DefectSummary = {
  totalDefectCount: 0,
  openDefectCount: 0,
  resolvedDefectCount: 0,
  productionDefectCount: 0,
  averageResolutionHours: 0,
};

const fallbackDefectAttributionSummary: DefectAttributionSummary = {
  totalDefectCount: 0,
  aiTouchedRequirementDefectCount: 0,
  aiTouchedPullRequestDefectCount: 0,
  escapedAiTouchedPullRequestDefectCount: 0,
  productionDefectCount: 0,
};

const buildViewerHeaders = (viewerId?: string): HeadersInit | undefined =>
  viewerId
    ? {
        'x-aimetric-viewer-id': viewerId,
      }
    : undefined;

const buildAdminHeaders = (
  viewerId?: string,
  adminToken?: string,
  includeJsonContentType = false,
): HeadersInit | undefined => {
  const headers: Record<string, string> = {};

  if (viewerId) {
    headers['x-aimetric-viewer-id'] = viewerId;
  }

  if (adminToken) {
    headers.authorization = `Bearer ${adminToken}`;
  }

  if (includeJsonContentType) {
    headers['content-type'] = 'application/json';
  }

  return Object.keys(headers).length > 0 ? headers : undefined;
};

const fetchJson = async <T>(
  url: string,
  fallback: T,
  viewerId?: string,
  adminToken?: string,
): Promise<T> => {
  if (typeof fetch !== 'function') {
    return fallback;
  }

  try {
    const response = await fetch(url, {
      headers: buildAdminHeaders(viewerId, adminToken),
    });

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
  viewerId?: string,
  adminToken?: string,
): Promise<T> => {
  if (typeof fetch !== 'function') {
    return fallback;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildAdminHeaders(viewerId, adminToken, true),
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
  viewerId = import.meta.env.VITE_AIMETRIC_VIEWER_ID as string | undefined,
  adminToken = import.meta.env.VITE_AIMETRIC_ADMIN_TOKEN as string | undefined,
): DashboardClient => ({
  getPersonalSnapshot: (filters) =>
    fetchJson<PersonalSnapshot>(
      buildMetricUrl(baseUrl, '/metrics/personal', filters),
      fallbackPersonalSnapshot,
      viewerId,
    ),
  getTeamSnapshot: (filters) =>
    fetchJson<TeamSnapshot>(
      buildMetricUrl(baseUrl, '/metrics/team', filters),
      fallbackTeamSnapshot,
      viewerId,
    ),
  getMcpAuditMetrics: (filters) =>
    fetchJson<McpAuditMetrics>(
      buildMetricUrl(baseUrl, '/metrics/mcp-audit', filters),
      fallbackMcpAuditMetrics,
      viewerId,
    ),
  getAnalysisSummary: (filters) =>
    fetchJson<AnalysisSummary>(
      buildMetricUrl(baseUrl, '/analysis/summary', filters),
      fallbackAnalysisSummary,
      viewerId,
    ),
  getSessionAnalysisRows: (filters) =>
    fetchJson<SessionAnalysisRow[]>(
      buildMetricUrl(baseUrl, '/analysis/sessions', filters),
      [],
      viewerId,
    ),
  getOutputAnalysisRows: (filters) =>
    fetchJson<OutputAnalysisRow[]>(
      buildMetricUrl(baseUrl, '/analysis/output', filters),
      [],
      viewerId,
    ),
  getRuleVersions: (projectKey) =>
    fetchJson<RuleVersionCatalog>(
      buildRuleUrl(baseUrl, '/rules/versions', projectKey),
      fallbackRuleVersions,
      viewerId,
      adminToken,
    ),
  getRuleRollout: (projectKey) =>
    fetchJson<RuleRollout>(
      buildRuleUrl(baseUrl, '/rules/rollout', projectKey),
      fallbackRuleRollout,
      viewerId,
      adminToken,
    ),
  getRuleRolloutEvaluation: (projectKey, memberId) =>
    fetchJson<RuleRolloutEvaluation>(
      buildRuleUrl(baseUrl, '/rules/rollout/evaluate', projectKey, memberId),
      fallbackRuleRolloutEvaluation,
      viewerId,
      adminToken,
    ),
  getEnterpriseMetricCatalog: () =>
    fetchJson<EnterpriseMetricCatalog>(
      new URL('/enterprise-metrics/catalog', baseUrl).toString(),
      fallbackEnterpriseMetricCatalog,
      viewerId,
      adminToken,
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
      viewerId,
      adminToken,
    ),
  getCollectorIngestionHealth: () =>
    fetchJson<CollectorIngestionHealth>(
      new URL('/ingestion/health', collectorGatewayBaseUrl).toString(),
      fallbackCollectorIngestionHealth,
    ),
  getGovernanceDirectory: () =>
    fetchJson<GovernanceDirectory>(
      new URL('/governance/directory', baseUrl).toString(),
      fallbackGovernanceDirectory,
      viewerId,
      adminToken,
    ),
  getPullRequestSummary: (filters) =>
    fetchJson<PullRequestSummary>(
      buildMetricUrl(baseUrl, '/integrations/pull-requests/summary', filters),
      fallbackPullRequestSummary,
      viewerId,
      adminToken,
    ),
  getPullRequests: (filters) =>
    fetchJson<PullRequestRecord[]>(
      buildMetricUrl(baseUrl, '/integrations/pull-requests', filters),
      [],
      viewerId,
      adminToken,
    ),
  getRequirementSummary: (filters) =>
    fetchJson<RequirementSummary>(
      buildMetricUrl(baseUrl, '/integrations/requirements/summary', filters),
      fallbackRequirementSummary,
      viewerId,
      adminToken,
    ),
  getRequirements: (filters) =>
    fetchJson<RequirementRecord[]>(
      buildMetricUrl(baseUrl, '/integrations/requirements', filters),
      [],
      viewerId,
      adminToken,
    ),
  getCiRunSummary: (filters) =>
    fetchJson<CiRunSummary>(
      buildMetricUrl(baseUrl, '/integrations/ci/runs/summary', filters),
      fallbackCiRunSummary,
      viewerId,
      adminToken,
    ),
  getCiRuns: (filters) =>
    fetchJson<CiRunRecord[]>(
      buildMetricUrl(baseUrl, '/integrations/ci/runs', filters),
      [],
      viewerId,
      adminToken,
    ),
  getDeploymentSummary: (filters) =>
    fetchJson<DeploymentSummary>(
      buildMetricUrl(baseUrl, '/integrations/deployments/summary', filters),
      fallbackDeploymentSummary,
      viewerId,
      adminToken,
    ),
  getDeployments: (filters) =>
    fetchJson<DeploymentRecord[]>(
      buildMetricUrl(baseUrl, '/integrations/deployments', filters),
      [],
      viewerId,
      adminToken,
    ),
  getIncidentSummary: (filters) =>
    fetchJson<IncidentSummary>(
      buildMetricUrl(baseUrl, '/integrations/incidents/summary', filters),
      fallbackIncidentSummary,
      viewerId,
      adminToken,
    ),
  getIncidents: (filters) =>
    fetchJson<IncidentRecord[]>(
      buildMetricUrl(baseUrl, '/integrations/incidents', filters),
      [],
      viewerId,
      adminToken,
    ),
  getDefectSummary: (filters) =>
    fetchJson<DefectSummary>(
      buildMetricUrl(baseUrl, '/integrations/defects/summary', filters),
      fallbackDefectSummary,
      viewerId,
      adminToken,
    ),
  getDefects: (filters) =>
    fetchJson<DefectRecord[]>(
      buildMetricUrl(baseUrl, '/integrations/defects', filters),
      [],
      viewerId,
      adminToken,
    ),
  getDefectAttributionSummary: (filters) =>
    fetchJson<DefectAttributionSummary>(
      buildMetricUrl(baseUrl, '/integrations/defects/attribution/summary', filters),
      fallbackDefectAttributionSummary,
      viewerId,
      adminToken,
    ),
  getDefectAttributionRows: (filters) =>
    fetchJson<DefectAttributionRow[]>(
      buildMetricUrl(baseUrl, '/integrations/defects/attribution', filters),
      [],
      viewerId,
      adminToken,
    ),
  getViewerScopeAssignment: (scopeViewerId) =>
    fetchJson<ViewerScopeAssignment | null>(
      new URL(
        `/governance/viewer-scopes?viewerId=${encodeURIComponent(scopeViewerId)}`,
        baseUrl,
      ).toString(),
      null,
      viewerId,
      adminToken,
    ),
  updateViewerScopeAssignment: (input) =>
    sendJson<ViewerScopeAssignment>(
      new URL('/governance/viewer-scopes', baseUrl).toString(),
      input,
      fallbackViewerScopeAssignment(input.viewerId),
      viewerId,
      adminToken,
    ),
  updateRuleRollout: (input) =>
    sendJson<RuleRollout>(
      new URL('/rules/rollout', baseUrl).toString(),
      input,
      fallbackRuleRollout,
      viewerId,
      adminToken,
    ),
});
