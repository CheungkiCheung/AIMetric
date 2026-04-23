import { evaluateRuleRollout as evaluateProjectRuleRollout } from '@aimetric/rule-engine';

export async function evaluateRuleRollout(input: {
  projectKey: string;
  memberId?: string;
  catalogRoot?: string;
}) {
  return evaluateProjectRuleRollout(
    {
      projectKey: input.projectKey,
      memberId: input.memberId,
    },
    {
      catalogRoot: input.catalogRoot,
    },
  );
}
