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

export type GovernanceRole =
  | 'developer'
  | 'engineering-manager'
  | 'effectiveness-manager'
  | 'platform-admin';

export interface GovernanceMember {
  memberId: string;
  displayName: string;
  teamKey: string;
  role: GovernanceRole;
}

export interface GovernanceViewerScope {
  viewerId: string;
  role: GovernanceRole;
  organizationKey: string;
  teamKeys: string[];
  projectKeys: string[];
  memberIds: string[];
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
    return cloneGovernanceDirectory(this.directory);
  }
}

export const cloneGovernanceDirectory = (
  directory: GovernanceDirectory,
): GovernanceDirectory => ({
  organization: { ...directory.organization },
  teams: directory.teams.map((team) => ({ ...team })),
  projects: directory.projects.map((project) => ({ ...project })),
  members: directory.members.map((member) => ({ ...member })),
});

export const buildGovernanceViewerScope = (
  directory: GovernanceDirectory,
  viewerId: string,
): GovernanceViewerScope | undefined => {
  const viewer = directory.members.find((member) => member.memberId === viewerId);

  if (!viewer) {
    return undefined;
  }

  const teamKeys =
    viewer.role === 'platform-admin'
      ? directory.teams.map((team) => team.key)
      : [viewer.teamKey];
  const allowedTeamKeys = new Set(teamKeys);

  return {
    viewerId,
    role: viewer.role,
    organizationKey: directory.organization.key,
    teamKeys,
    projectKeys: directory.projects
      .filter((project) => allowedTeamKeys.has(project.teamKey))
      .map((project) => project.key),
    memberIds: directory.members
      .filter((member) => allowedTeamKeys.has(member.teamKey))
      .map((member) => member.memberId),
  };
};

export const filterGovernanceDirectoryByViewerScope = (
  directory: GovernanceDirectory,
  scope?: GovernanceViewerScope,
): GovernanceDirectory => {
  if (!scope || scope.role === 'platform-admin') {
    return cloneGovernanceDirectory(directory);
  }

  const allowedTeamKeys = new Set(scope.teamKeys);
  const allowedProjectKeys = new Set(scope.projectKeys);
  const allowedMemberIds = new Set(scope.memberIds);

  return {
    organization: { ...directory.organization },
    teams: directory.teams
      .filter((team) => allowedTeamKeys.has(team.key))
      .map((team) => ({ ...team })),
    projects: directory.projects
      .filter((project) => allowedProjectKeys.has(project.key))
      .map((project) => ({ ...project })),
    members: directory.members
      .filter((member) => allowedMemberIds.has(member.memberId))
      .map((member) => ({ ...member })),
  };
};

export const defaultGovernanceDirectory: GovernanceDirectory = {
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
