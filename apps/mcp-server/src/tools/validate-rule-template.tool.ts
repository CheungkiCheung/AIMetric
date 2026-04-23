import { validateRuleTemplate as validateProjectRuleTemplate } from '@aimetric/rule-engine';

export async function validateRuleTemplate(input: {
  projectKey: string;
  version?: string;
  catalogRoot?: string;
}) {
  return validateProjectRuleTemplate(
    {
      projectKey: input.projectKey,
      version: input.version,
    },
    {
      catalogRoot: input.catalogRoot,
    },
  );
}
