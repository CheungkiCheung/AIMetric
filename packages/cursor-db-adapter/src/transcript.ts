import { createHash } from 'node:crypto';

export interface CursorSessionRecord {
  sessionId: string;
  workspaceId?: string;
  workspacePath?: string;
  projectFingerprint: string;
  transcriptPath: string;
  transcriptPathHash: string;
  firstMessageAt: string;
  lastMessageAt: string;
  userMessageCount: number;
  assistantMessageCount: number;
  conversationTurns: number;
  firstUserMessage?: string;
  lastAssistantMessage?: string;
}

interface CursorTranscriptMessage {
  sessionId?: string;
  timestamp?: string;
  role?: string;
  text?: string;
  workspaceId?: string;
  workspacePath?: string;
}

export async function parseCursorTranscript(
  lines: string[],
  transcriptPath: string,
): Promise<CursorSessionRecord> {
  const messages = lines.flatMap((line) => {
    try {
      const parsed = JSON.parse(line) as CursorTranscriptMessage;

      return typeof parsed.timestamp === 'string' ? [parsed] : [];
    } catch {
      return [];
    }
  });

  if (messages.length === 0) {
    throw new Error(`No valid Cursor transcript messages found in ${transcriptPath}`);
  }

  const firstMessage = messages[0]!;
  const lastMessage = messages[messages.length - 1]!;
  const userMessages = messages.filter((message) => message.role === 'user');
  const assistantMessages = messages.filter((message) => message.role === 'assistant');
  const sessionId =
    firstMessage.sessionId ?? lastMessage.sessionId ?? buildHash(transcriptPath);
  const workspaceId = messages.find((message) => message.workspaceId)?.workspaceId;
  const workspacePath = messages.find((message) => message.workspacePath)?.workspacePath;

  return {
    sessionId,
    ...(workspaceId ? { workspaceId } : {}),
    ...(workspacePath ? { workspacePath } : {}),
    projectFingerprint: buildHash(workspacePath ?? transcriptPath),
    transcriptPath,
    transcriptPathHash: buildHash(transcriptPath),
    firstMessageAt: firstMessage.timestamp!,
    lastMessageAt: lastMessage.timestamp!,
    userMessageCount: userMessages.length,
    assistantMessageCount: assistantMessages.length,
    conversationTurns: Math.min(
      userMessages.length,
      assistantMessages.length || userMessages.length,
    ),
    ...(userMessages[0]?.text ? { firstUserMessage: userMessages[0].text } : {}),
    ...(assistantMessages.at(-1)?.text
      ? { lastAssistantMessage: assistantMessages.at(-1)?.text }
      : {}),
  };
}

const buildHash = (value: string): string =>
  createHash('sha256').update(value).digest('hex');
