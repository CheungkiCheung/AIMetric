import type { PersonalSnapshotInput, TeamSnapshotInput } from './metrics.service.js';
import { MetricsService } from './metrics.service.js';

export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  buildPersonalSnapshot(input: PersonalSnapshotInput) {
    return this.metricsService.buildPersonalSnapshot(input);
  }

  buildTeamSnapshot(input: TeamSnapshotInput) {
    return this.metricsService.buildTeamSnapshot(input);
  }
}
