import { getRuleTemplate as getProjectRuleTemplate } from '@aimetric/rule-engine';

export async function getRuleTemplate(input: {
  projectKey: string;
  version?: string;
}) {
  return getProjectRuleTemplate({
    projectKey: input.projectKey,
    version: input.version,
  });
}
