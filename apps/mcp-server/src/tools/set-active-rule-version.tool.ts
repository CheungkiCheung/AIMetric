import { setActiveRuleVersion as setProjectActiveRuleVersion } from '@aimetric/rule-engine';

export async function setActiveRuleVersion(input: {
  projectKey: string;
  version: string;
  catalogRoot?: string;
}) {
  return setProjectActiveRuleVersion(
    {
      projectKey: input.projectKey,
      version: input.version,
    },
    {
      catalogRoot: input.catalogRoot,
    },
  );
}
