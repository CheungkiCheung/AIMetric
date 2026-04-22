import type { IngestionBatch } from '@aimetric/event-schema';
import { PrismaService } from './database/prisma.service.js';
import { MetricsController } from './metrics/metrics.controller.js';
import { MetricsService } from './metrics/metrics.service.js';

interface RecordedMetricEvent {
  memberId: string;
  acceptedAiLines: number;
  commitTotalLines: number;
  sessionCount: number;
}

export class AppModule {
  readonly metricsController: MetricsController;
  readonly prismaService: PrismaService;

  constructor() {
    this.prismaService = new PrismaService();
    const metricsService = new MetricsService();
    this.metricsController = new MetricsController(metricsService);
  }

  importEvents(batch: IngestionBatch) {
    this.prismaService.appendBatch(batch);

    return {
      imported: batch.events.length,
      schemaVersion: batch.schemaVersion,
    };
  }

  private buildRecordedMetricEvents(): RecordedMetricEvent[] {
    return this.prismaService
      .listBatches()
      .flatMap((batch) => batch.events)
      .filter((event) => event.eventType === 'session.recorded')
      .map((event) => ({
        memberId:
          typeof event.payload.memberId === 'string'
            ? event.payload.memberId
            : event.payload.sessionId,
        acceptedAiLines:
          typeof event.payload.acceptedAiLines === 'number'
            ? event.payload.acceptedAiLines
            : 0,
        commitTotalLines:
          typeof event.payload.commitTotalLines === 'number'
            ? event.payload.commitTotalLines
            : 0,
        sessionCount: 1,
      }));
  }

  buildPersonalSnapshot() {
    const recordedMetricEvents = this.buildRecordedMetricEvents();
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

  buildTeamSnapshot() {
    const recordedMetricEvents = this.buildRecordedMetricEvents();

    return this.metricsController.buildTeamSnapshot({
      members: recordedMetricEvents,
    });
  }
}
