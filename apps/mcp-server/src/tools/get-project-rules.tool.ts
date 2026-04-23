import { getProjectRulePack } from '@aimetric/rule-engine';

export async function getProjectRules(input: {
  projectKey: string;
  toolType: string;
  sceneType: string;
  memberId?: string;
  catalogRoot?: string;
}) {
  return getProjectRulePack(
    {
      projectKey: input.projectKey,
      toolType: input.toolType,
      sceneType: input.sceneType,
      memberId: input.memberId,
    },
    {
      catalogRoot: input.catalogRoot,
    },
  );
}
