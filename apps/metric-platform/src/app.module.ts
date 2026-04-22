import type { IngestionBatch } from '@aimetric/event-schema';
import {
  PostgresMetricEventRepository,
  type MetricEventRepository,
  type MetricSnapshotFilters,
} from './database/postgres-event.repository.js';
import { MetricsController } from './metrics/metrics.controller.js';
import { MetricsService } from './metrics/metrics.service.js';

export class AppModule {
  readonly metricsController: MetricsController;
  readonly metricEventRepository: MetricEventRepository;

  constructor(
    metricEventRepository: MetricEventRepository =
      new PostgresMetricEventRepository(),
  ) {
    this.metricEventRepository = metricEventRepository;
    const metricsService = new MetricsService();
    this.metricsController = new MetricsController(metricsService);
  }

  async importEvents(batch: IngestionBatch) {
    await this.metricEventRepository.saveIngestionBatch(batch);

    return {
      imported: batch.events.length,
      schemaVersion: batch.schemaVersion,
    };
  }

  async close() {
    await this.metricEventRepository.disconnect();
  }

  async buildPersonalSnapshot(filters?: MetricSnapshotFilters) {
    const recordedMetricEvents =
      await this.metricEventRepository.listRecordedMetricEvents(filters);
    const personalEvent = recordedMetricEvents[0];

    if (!personalEvent) {
      return this.metricsController.buildPersonalSnapshot({
        acceptedAiLines: 0,
        commitTotalLines: 0,
        sessionCount: 0,
      });
    }

    return this.metricsController.buildPersonalSnapshot({
      acceptedAiLines: personalEvent.acceptedAiLines,
      commitTotalLines: personalEvent.commitTotalLines,
      sessionCount: personalEvent.sessionCount,
    });
  }

  async buildTeamSnapshot(filters?: MetricSnapshotFilters) {
    const recordedMetricEvents =
      await this.metricEventRepository.listRecordedMetricEvents(filters);

    return this.metricsController.buildTeamSnapshot({
      members: recordedMetricEvents,
    });
  }
}
