import {
  CollectorClient,
  loadAimMetricConfig,
  type CollectorEvent,
} from '@aimetric/collector-sdk';

export async function recordSession(input: {
  sessionId: string;
  userMessage: string;
  assistantMessage: string;
  workspaceDir?: string;
  configPath?: string;
}) {
  const event = await buildSessionEvent(input);

  return {
    sessionId: input.sessionId,
    summary: `${input.userMessage}\n${input.assistantMessage}`,
    ...(event ? { event } : {}),
  };
}

const buildSessionEvent = async (input: {
  sessionId: string;
  userMessage: string;
  assistantMessage: string;
  workspaceDir?: string;
  configPath?: string;
}): Promise<Pick<CollectorEvent, 'eventType' | 'payload'> | undefined> => {
  if (!input.workspaceDir && !input.configPath) {
    return undefined;
  }

  const config = await loadAimMetricConfig({
    workspaceDir: input.workspaceDir,
    configPath: input.configPath,
  });
  const client = CollectorClient.fromConfig(config);
  const event = client.recordSession({
    sessionId: input.sessionId,
    userMessage: input.userMessage,
    assistantMessage: input.assistantMessage,
  });

  return {
    eventType: event.eventType,
    payload: event.payload,
  };
};
