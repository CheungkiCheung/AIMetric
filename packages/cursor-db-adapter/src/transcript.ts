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

export interface CursorTabAcceptedRecord {
  sessionId: string;
  occurredAt: string;
  acceptedLines: number;
  ingestionKey: string;
  filePath?: string;
  language?: string;
}

interface CursorTranscriptMessage {
  sessionId?: string;
  timestamp?: string;
  role?: string;
  text?: string;
  workspaceId?: string;
  workspacePath?: string;
  eventType?: string;
  type?: string;
  kind?: string;
  acceptedLines?: number;
  linesAccepted?: number;
  filePath?: string;
  language?: string;
  suggestionId?: string;
  completionId?: string;
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

export async function parseCursorTabAcceptedEvents(
  lines: string[],
  transcriptPath: string,
): Promise<CursorTabAcceptedRecord[]> {
  return lines.flatMap((line) => {
    try {
      const parsed = JSON.parse(line) as CursorTranscriptMessage;
      const normalizedEventType = normalizeEventType(parsed);

      if (normalizedEventType !== 'tab.accepted') {
        return [];
      }

      if (typeof parsed.timestamp !== 'string') {
        return [];
      }

      const sessionId =
        parsed.sessionId ?? buildHash(`${transcriptPath}:${parsed.timestamp}`);
      const acceptedLines = readAcceptedLines(parsed);

      return [
        {
          sessionId,
          occurredAt: parsed.timestamp,
          acceptedLines,
          ingestionKey: [
            'cursor-tab',
            sessionId,
            parsed.timestamp,
            buildHash(
              parsed.suggestionId ?? parsed.completionId ?? transcriptPath,
            ),
          ].join(':'),
          ...(parsed.filePath ? { filePath: parsed.filePath } : {}),
          ...(parsed.language ? { language: parsed.language } : {}),
        },
      ];
    } catch {
      return [];
    }
  });
}

const normalizeEventType = (message: CursorTranscriptMessage): string | undefined => {
  const candidate = message.eventType ?? message.type ?? message.kind;

  if (typeof candidate !== 'string') {
    return undefined;
  }

  const normalized = candidate.trim().toLowerCase();

  if (
    normalized === 'tab.accepted' ||
    normalized === 'tabaccepted' ||
    normalized === 'tab_accept' ||
    normalized === 'tab-accepted'
  ) {
    return 'tab.accepted';
  }

  return normalized;
};

const readAcceptedLines = (message: CursorTranscriptMessage): number => {
  if (typeof message.acceptedLines === 'number' && message.acceptedLines > 0) {
    return message.acceptedLines;
  }

  if (typeof message.linesAccepted === 'number' && message.linesAccepted > 0) {
    return message.linesAccepted;
  }

  if (typeof message.text === 'string' && message.text.length > 0) {
    return message.text.split('\n').length;
  }

  return 1;
};

const buildHash = (value: string): string =>
  createHash('sha256').update(value).digest('hex');
