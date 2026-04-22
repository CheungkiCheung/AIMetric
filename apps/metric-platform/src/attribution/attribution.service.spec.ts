import { describe, expect, it } from 'vitest';
import { AttributionService } from './attribution.service.js';

describe('AttributionService', () => {
  it('builds commit evidence from ai lines and commit lines', async () => {
    const service = new AttributionService();

    const result = await service.buildEvidence({
      aiLines: ['const a = 2;', 'const b = 3;'],
      commitLines: ['const a = 2;', 'const c = 4;']
    });

    expect(result.acceptedAiLines).toBe(1);
    expect(result.commitTotalLines).toBe(2);
  });
});
