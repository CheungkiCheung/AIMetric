// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';
import type { DashboardFilters } from './api/client.js';

describe('App', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders personal and team metric views', async () => {
    render(
      <App
        client={{
          getPersonalSnapshot: async () => ({
            acceptedAiLines: 35,
            commitTotalLines: 50,
            aiOutputRate: 0.7,
            sessionCount: 4,
          }),
          getTeamSnapshot: async () => ({
            memberCount: 2,
            totalAcceptedAiLines: 50,
            totalCommitLines: 80,
            aiOutputRate: 0.625,
            totalSessionCount: 6,
          }),
        }}
      />,
    );

    expect(await screen.findByText('个人出码视图')).toBeInTheDocument();
    expect(screen.getByText('团队出码视图')).toBeInTheDocument();
    expect(screen.getByText('70.0%')).toBeInTheDocument();
    expect(screen.getByText('62.5%')).toBeInTheDocument();
  });

  it('reloads metrics when filters change', async () => {
    const getPersonalSnapshot = vi.fn(async (_filters?: DashboardFilters) => ({
      acceptedAiLines: 35,
      commitTotalLines: 50,
      aiOutputRate: 0.7,
      sessionCount: 4,
    }));
    const getTeamSnapshot = vi.fn(async (_filters?: DashboardFilters) => ({
      memberCount: 2,
      totalAcceptedAiLines: 50,
      totalCommitLines: 80,
      aiOutputRate: 0.625,
      totalSessionCount: 6,
    }));

    render(
      <App
        client={{
          getPersonalSnapshot,
          getTeamSnapshot,
        }}
      />,
    );

    await screen.findByText('个人出码视图');
    fireEvent.change(screen.getByLabelText('项目'), {
      target: { value: 'navigation' },
    });

    await waitFor(() => {
      expect(getPersonalSnapshot).toHaveBeenLastCalledWith(
        expect.objectContaining({ projectKey: 'navigation' }),
      );
    });
  });

  it('auto refreshes metrics on an interval', async () => {
    vi.useFakeTimers();
    const getPersonalSnapshot = vi.fn(async () => ({
      acceptedAiLines: 35,
      commitTotalLines: 50,
      aiOutputRate: 0.7,
      sessionCount: 4,
    }));
    const getTeamSnapshot = vi.fn(async () => ({
      memberCount: 2,
      totalAcceptedAiLines: 50,
      totalCommitLines: 80,
      aiOutputRate: 0.625,
      totalSessionCount: 6,
    }));

    try {
      render(
        <App
          refreshIntervalMs={1000}
          client={{
            getPersonalSnapshot,
            getTeamSnapshot,
          }}
        />,
      );

      await act(async () => {
        await Promise.resolve();
      });
      expect(screen.getByText('个人出码视图')).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(1000);
        await Promise.resolve();
      });

      expect(getPersonalSnapshot).toHaveBeenCalledTimes(2);
      expect(getTeamSnapshot).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
