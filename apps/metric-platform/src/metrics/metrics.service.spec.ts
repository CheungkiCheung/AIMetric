import { describe, expect, it } from 'vitest';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  it('builds a personal snapshot from accepted ai lines and commit total lines', async () => {
    const service = new MetricsService();

    const snapshot = await service.buildPersonalSnapshot({
      acceptedAiLines: 35,
      commitTotalLines: 50,
      sessionCount: 4
    });

    expect(snapshot.aiOutputRate).toBe(0.7);
    expect(snapshot.sessionCount).toBe(4);
  });
});
