import { createHash } from 'node:crypto';

export interface BuildEditSpanEvidenceInput {
  sessionId: string;
  filePath: string;
  projectKey: string;
  repoName: string;
  memberId: string;
  ruleVersion: string;
  toolProfile?: string;
  beforeContent: string;
  afterContent: string;
  occurredAt: string;
  projectFingerprint?: string;
  workspacePath?: string;
}

export interface EditSpanEvidence {
  editSpanId: string;
  sessionId: string;
  filePath: string;
  occurredAt: string;
  toolName: 'beforeEditFile/afterEditFile';
  toolProfile?: string;
  beforeSnapshotHash: string;
  afterSnapshotHash: string;
  diff: string;
  projectFingerprint?: string;
  workspacePath?: string;
  event: {
    eventType: 'edit.span.recorded';
    occurredAt: string;
    payload: Record<string, unknown>;
  };
}

export function buildEditSpanEvidence(
  input: BuildEditSpanEvidenceInput,
): EditSpanEvidence {
  const beforeSnapshotHash = hash(input.beforeContent);
  const afterSnapshotHash = hash(input.afterContent);
  const editSpanId = hash(
    `${input.sessionId}:${input.filePath}:${beforeSnapshotHash}:${afterSnapshotHash}`,
  );
  const diff = [
    `--- ${input.filePath}`,
    `+++ ${input.filePath}`,
    `-${input.beforeContent}`,
    `+${input.afterContent}`,
  ].join('\n');

  return {
    editSpanId,
    sessionId: input.sessionId,
    filePath: input.filePath,
    occurredAt: input.occurredAt,
    toolName: 'beforeEditFile/afterEditFile',
    ...(input.toolProfile ? { toolProfile: input.toolProfile } : {}),
    beforeSnapshotHash,
    afterSnapshotHash,
    diff,
    ...(input.projectFingerprint
      ? { projectFingerprint: input.projectFingerprint }
      : {}),
    ...(input.workspacePath ? { workspacePath: input.workspacePath } : {}),
    event: {
      eventType: 'edit.span.recorded',
      occurredAt: input.occurredAt,
      payload: {
        sessionId: input.sessionId,
        projectKey: input.projectKey,
        repoName: input.repoName,
        memberId: input.memberId,
        ruleVersion: input.ruleVersion,
        editSpanId,
        filePath: input.filePath,
        beforeSnapshotHash,
        afterSnapshotHash,
        diff,
        ...(input.toolProfile ? { toolProfile: input.toolProfile } : {}),
        ...(input.projectFingerprint
          ? { projectFingerprint: input.projectFingerprint }
          : {}),
        ...(input.workspacePath ? { workspacePath: input.workspacePath } : {}),
      },
    },
  };
}

const hash = (value: string): string =>
  createHash('sha256').update(value).digest('hex');
