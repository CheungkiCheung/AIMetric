import { calculateAiOutputRate } from '@aimetric/metric-core';

export class MetricsService {
  async buildPersonalSnapshot(input: {
    acceptedAiLines: number;
    commitTotalLines: number;
    sessionCount: number;
  }) {
    return {
      acceptedAiLines: input.acceptedAiLines,
      commitTotalLines: input.commitTotalLines,
      aiOutputRate: calculateAiOutputRate(
        input.acceptedAiLines,
        input.commitTotalLines
      ),
      sessionCount: input.sessionCount
    };
  }
}
