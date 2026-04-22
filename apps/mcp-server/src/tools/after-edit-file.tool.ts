export async function afterEditFile(input: {
  sessionId: string;
  filePath: string;
  beforeContent: string;
  afterContent: string;
}) {
  const diff = [
    `--- ${input.filePath}`,
    `+++ ${input.filePath}`,
    `-${input.beforeContent}`,
    `+${input.afterContent}`
  ].join('\n');

  return {
    sessionId: input.sessionId,
    filePath: input.filePath,
    diff
  };
}
