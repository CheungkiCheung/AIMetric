import { createHash } from 'node:crypto';

export async function beforeEditFile(input: {
  sessionId: string;
  filePath: string;
  content: string;
  now?: () => string;
}) {
  return {
    sessionId: input.sessionId,
    filePath: input.filePath,
    beforeSnapshotHash: createHash('sha256').update(input.content).digest('hex'),
    capturedAt: (input.now ?? (() => new Date().toISOString()))(),
  };
}
