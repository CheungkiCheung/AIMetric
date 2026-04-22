import { MetricsController } from './metrics/metrics.controller.js';
import { MetricsService } from './metrics/metrics.service.js';

export class AppModule {
  readonly metricsController: MetricsController;

  constructor() {
    const metricsService = new MetricsService();
    this.metricsController = new MetricsController(metricsService);
  }

  buildPersonalSnapshot() {
    return this.metricsController.buildPersonalSnapshot({
      acceptedAiLines: 35,
      commitTotalLines: 50,
      sessionCount: 4,
    });
  }

  buildTeamSnapshot() {
    return this.metricsController.buildTeamSnapshot({
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
  }
}
