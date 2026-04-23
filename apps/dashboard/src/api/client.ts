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

export interface DashboardClient {
  getPersonalSnapshot(filters?: DashboardFilters): Promise<PersonalSnapshot>;
  getTeamSnapshot(filters?: DashboardFilters): Promise<TeamSnapshot>;
  getMcpAuditMetrics(filters?: DashboardFilters): Promise<McpAuditMetrics>;
  getRuleVersions(projectKey?: string): Promise<RuleVersionCatalog>;
  getRuleRollout(projectKey?: string): Promise<RuleRollout>;
  getRuleRolloutEvaluation(
    projectKey?: string,
    memberId?: string,
  ): Promise<RuleRolloutEvaluation>;
  updateRuleRollout(input: RuleRollout): Promise<RuleRollout>;
}

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
  updateRuleRollout: (input) =>
    sendJson<RuleRollout>(
      new URL('/rules/rollout', baseUrl).toString(),
      input,
      fallbackRuleRollout,
    ),
});
