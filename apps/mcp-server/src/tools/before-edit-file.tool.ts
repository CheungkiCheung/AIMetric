import { createHash } from 'node:crypto';

export async function beforeEditFile(input: {
  sessionId: string;
  filePath: string;
  content: string;
}) {
  return {
    sessionId: input.sessionId,
    filePath: input.filePath,
    snapshotHash: createHash('sha256').update(input.content).digest('hex'),
    content: input.content
  };
}
