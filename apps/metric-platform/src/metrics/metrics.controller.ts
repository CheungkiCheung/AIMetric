import { MetricsService } from './metrics.service';

export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  buildPersonalSnapshot(input: {
    acceptedAiLines: number;
    commitTotalLines: number;
    sessionCount: number;
  }) {
    return this.metricsService.buildPersonalSnapshot(input);
  }
}
