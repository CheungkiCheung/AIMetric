export async function recordSession(input: {
  sessionId: string;
  userMessage: string;
  assistantMessage: string;
}) {
  return {
    sessionId: input.sessionId,
    summary: `${input.userMessage}\n${input.assistantMessage}`
  };
}
