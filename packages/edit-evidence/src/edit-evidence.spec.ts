import { describe, expect, it } from 'vitest';
import { buildEditSpanEvidence } from './edit-evidence.js';

describe('buildEditSpanEvidence', () => {
  it('builds stable file-level edit evidence and a standard event payload', () => {
    const evidence = buildEditSpanEvidence({
      sessionId: 'sess_1',
      filePath: '/repo/src/demo.ts',
      projectKey: 'aimetric',
      repoName: 'AIMetric',
      memberId: 'alice',
      ruleVersion: 'v2',
      toolProfile: 'cursor',
      beforeContent: 'const a = 1;',
      afterContent: 'const a = 2;',
      occurredAt: '2026-04-24T00:00:00.000Z',
    });

    expect(evidence).toMatchObject({
      sessionId: 'sess_1',
      filePath: '/repo/src/demo.ts',
      toolProfile: 'cursor',
      beforeSnapshotHash: expect.any(String),
      afterSnapshotHash: expect.any(String),
      diff: expect.stringContaining('-const a = 1;'),
      event: {
        eventType: 'edit.span.recorded',
        occurredAt: '2026-04-24T00:00:00.000Z',
        payload: expect.objectContaining({
          sessionId: 'sess_1',
          projectKey: 'aimetric',
          editSpanId: expect.any(String),
        }),
      },
    });
  });

  it('generates the same editSpanId for the same edit input', () => {
    const left = buildEditSpanEvidence({
      sessionId: 'sess_1',
      filePath: '/repo/src/demo.ts',
      projectKey: 'aimetric',
      repoName: 'AIMetric',
      memberId: 'alice',
      ruleVersion: 'v2',
      beforeContent: 'const a = 1;',
      afterContent: 'const a = 2;',
      occurredAt: '2026-04-24T00:00:00.000Z',
    });
    const right = buildEditSpanEvidence({
      sessionId: 'sess_1',
      filePath: '/repo/src/demo.ts',
      projectKey: 'aimetric',
      repoName: 'AIMetric',
      memberId: 'alice',
      ruleVersion: 'v2',
      beforeContent: 'const a = 1;',
      afterContent: 'const a = 2;',
      occurredAt: '2026-04-24T00:05:00.000Z',
    });

    expect(left.editSpanId).toBe(right.editSpanId);
  });
});
