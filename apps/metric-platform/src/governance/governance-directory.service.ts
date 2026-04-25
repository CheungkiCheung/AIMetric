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

export class GovernanceDirectoryService {
  constructor(private readonly directory = defaultGovernanceDirectory) {}

  getDirectory(): GovernanceDirectory {
    return {
      organization: { ...this.directory.organization },
      teams: this.directory.teams.map((team) => ({ ...team })),
      projects: this.directory.projects.map((project) => ({ ...project })),
      members: this.directory.members.map((member) => ({ ...member })),
    };
  }
}

const defaultGovernanceDirectory: GovernanceDirectory = {
  organization: {
    key: 'aimetric-enterprise',
    name: 'AIMetric Enterprise',
  },
  teams: [
    {
      key: 'platform-engineering',
      name: '平台工程团队',
      organizationKey: 'aimetric-enterprise',
    },
  ],
  projects: [
    {
      key: 'aimetric',
      name: 'AIMetric',
      teamKey: 'platform-engineering',
    },
  ],
  members: [
    {
      memberId: 'alice',
      displayName: 'Alice',
      teamKey: 'platform-engineering',
      role: 'developer',
    },
  ],
};
