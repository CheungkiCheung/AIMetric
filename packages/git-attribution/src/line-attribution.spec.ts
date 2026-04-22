import { describe, expect, it } from 'vitest';
import { buildCommitEvidence } from './line-attribution';

describe('buildCommitEvidence', () => {
  it('counts accepted ai lines that appear in a commit patch', () => {
    const evidence = buildCommitEvidence({
      aiLines: ['const a = 2;', 'const b = 3;'],
      commitLines: ['const a = 2;', 'const c = 4;']
    });

    expect(evidence.acceptedAiLines).toBe(1);
    expect(evidence.commitTotalLines).toBe(2);
  });
});
