import { setRuleRollout as setProjectRuleRollout } from '@aimetric/rule-engine';

export async function setRuleRollout(input: {
  projectKey: string;
  enabled: boolean;
  candidateVersion?: string;
  percentage?: number;
  includedMembers?: string[];
  catalogRoot?: string;
}) {
  return setProjectRuleRollout(
    {
      projectKey: input.projectKey,
      enabled: input.enabled,
      candidateVersion: input.candidateVersion,
      percentage: input.percentage,
      includedMembers: input.includedMembers,
    },
    {
      catalogRoot: input.catalogRoot,
    },
  );
}
