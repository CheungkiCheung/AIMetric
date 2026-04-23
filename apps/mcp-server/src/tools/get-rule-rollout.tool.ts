import { getRuleRollout as getProjectRuleRollout } from '@aimetric/rule-engine';

export async function getRuleRollout(input: {
  projectKey: string;
  catalogRoot?: string;
}) {
  return getProjectRuleRollout(input.projectKey, {
    catalogRoot: input.catalogRoot,
  });
}
