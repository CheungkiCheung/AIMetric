import { calculateAiOutputRate } from '@aimetric/metric-core';

export interface PersonalSnapshotInput {
  acceptedAiLines: number;
  commitTotalLines: number;
  sessionCount: number;
}

export interface TeamSnapshotInput {
  members: PersonalSnapshotInputWithMember[];
}

export interface PersonalSnapshotInputWithMember extends PersonalSnapshotInput {
  memberId: string;
}

export class MetricsService {
  async buildPersonalSnapshot(input: PersonalSnapshotInput) {
    return {
      acceptedAiLines: input.acceptedAiLines,
      commitTotalLines: input.commitTotalLines,
      aiOutputRate: calculateAiOutputRate(
        input.acceptedAiLines,
        input.commitTotalLines
      ),
      sessionCount: input.sessionCount
    };
  }

  async buildTeamSnapshot(input: TeamSnapshotInput) {
    const totalAcceptedAiLines = input.members.reduce(
      (sum, member) => sum + member.acceptedAiLines,
      0,
    );
    const totalCommitLines = input.members.reduce(
      (sum, member) => sum + member.commitTotalLines,
      0,
    );
    const totalSessionCount = input.members.reduce(
      (sum, member) => sum + member.sessionCount,
      0,
    );

    return {
      memberCount: input.members.length,
      totalAcceptedAiLines,
      totalCommitLines,
      totalSessionCount,
      aiOutputRate: calculateAiOutputRate(totalAcceptedAiLines, totalCommitLines),
    };
  }
}
