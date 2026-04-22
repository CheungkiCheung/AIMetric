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

export interface DashboardClient {
  getPersonalSnapshot(): Promise<PersonalSnapshot>;
  getTeamSnapshot(): Promise<TeamSnapshot>;
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

export const createDashboardClient = (
  baseUrl = 'http://localhost:3001',
): DashboardClient => ({
  getPersonalSnapshot: () =>
    fetchJson<PersonalSnapshot>(`${baseUrl}/metrics/personal`, fallbackPersonalSnapshot),
  getTeamSnapshot: () =>
    fetchJson<TeamSnapshot>(`${baseUrl}/metrics/team`, fallbackTeamSnapshot),
});
