import type { MetricSnapshotFilters } from '../database/postgres-event.repository.js';

export interface SnapshotRecalculationSchedulerOptions {
  intervalMs: number;
  filters?: MetricSnapshotFilters;
  recalculate: (filters?: MetricSnapshotFilters) => Promise<unknown>;
}

export interface SnapshotRecalculationScheduler {
  start(): void;
  stop(): void;
}

export const createSnapshotRecalculationScheduler = ({
  intervalMs,
  filters,
  recalculate,
}: SnapshotRecalculationSchedulerOptions): SnapshotRecalculationScheduler => {
  let interval: ReturnType<typeof setInterval> | undefined;

  return {
    start() {
      if (interval !== undefined) {
        return;
      }

      interval = setInterval(() => {
        void recalculate(filters);
      }, intervalMs);
    },
    stop() {
      if (interval === undefined) {
        return;
      }

      clearInterval(interval);
      interval = undefined;
    },
  };
};
