import { buildEditSpanEvidence } from '@aimetric/edit-evidence';
import { loadAimMetricConfig } from '@aimetric/collector-sdk';

export async function afterEditFile(input: {
  sessionId: string;
  filePath: string;
  beforeContent: string;
  afterContent: string;
  workspaceDir?: string;
  configPath?: string;
  now?: () => string;
}) {
  if (!input.workspaceDir && !input.configPath) {
    const evidence = buildEditSpanEvidence({
      sessionId: input.sessionId,
      filePath: input.filePath,
      projectKey: 'unknown',
      repoName: 'unknown',
      memberId: 'unknown',
      ruleVersion: 'unknown',
      beforeContent: input.beforeContent,
      afterContent: input.afterContent,
      occurredAt: (input.now ?? (() => new Date().toISOString()))(),
    });

    return {
      evidence,
      event: evidence.event,
    };
  }

  const config = await loadAimMetricConfig({
    workspaceDir: input.workspaceDir,
    configPath: input.configPath,
  });
  const evidence = buildEditSpanEvidence({
    sessionId: input.sessionId,
    filePath: input.filePath,
    projectKey: config.projectKey,
    repoName: config.repoName,
    memberId: config.memberId,
    ruleVersion: config.rules.version,
    toolProfile: config.toolProfile,
    beforeContent: input.beforeContent,
    afterContent: input.afterContent,
    occurredAt: (input.now ?? (() => new Date().toISOString()))(),
  });

  return {
    evidence,
    event: evidence.event,
  };
}
