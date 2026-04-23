import { listRuleVersions as listProjectRuleVersions } from '@aimetric/rule-engine';

export async function listRuleVersions(input: {
  projectKey: string;
}) {
  return listProjectRuleVersions(input.projectKey);
}
