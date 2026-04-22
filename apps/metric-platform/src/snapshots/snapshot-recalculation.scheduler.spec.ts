import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSnapshotRecalculationScheduler } from './snapshot-recalculation.scheduler.js';

describe('createSnapshotRecalculationScheduler', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs snapshot recalculation on an interval and stops cleanly', async () => {
    vi.useFakeTimers();
    const recalculate = vi.fn(async () => ({
      upsertedSnapshots: 0,
      snapshots: [],
    }));
    const scheduler = createSnapshotRecalculationScheduler({
      intervalMs: 1_000,
      recalculate,
      filters: {
        projectKey: 'navigation',
      },
    });

    scheduler.start();

    await vi.advanceTimersByTimeAsync(1_000);
    expect(recalculate).toHaveBeenCalledTimes(1);
    expect(recalculate).toHaveBeenCalledWith({ projectKey: 'navigation' });

    scheduler.stop();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(recalculate).toHaveBeenCalledTimes(1);
  });
});
