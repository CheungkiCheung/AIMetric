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

export interface DashboardFilters {
  projectKey?: string;
  memberId?: string;
  from?: string;
  to?: string;
}

export interface DashboardClient {
  getPersonalSnapshot(filters?: DashboardFilters): Promise<PersonalSnapshot>;
  getTeamSnapshot(filters?: DashboardFilters): Promise<TeamSnapshot>;
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
});
