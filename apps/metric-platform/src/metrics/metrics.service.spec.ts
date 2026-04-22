import { describe, expect, it } from 'vitest';
import { MetricsService } from './metrics.service.js';

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

  it('builds a team snapshot from member metrics', async () => {
    const service = new MetricsService();

    const snapshot = await service.buildTeamSnapshot({
      members: [
        {
          memberId: 'alice',
          acceptedAiLines: 35,
          commitTotalLines: 50,
          sessionCount: 4,
        },
        {
          memberId: 'bob',
          acceptedAiLines: 15,
          commitTotalLines: 30,
          sessionCount: 2,
        },
      ],
    });

    expect(snapshot.memberCount).toBe(2);
    expect(snapshot.totalAcceptedAiLines).toBe(50);
    expect(snapshot.totalCommitLines).toBe(80);
    expect(snapshot.aiOutputRate).toBe(0.625);
  });
});
