// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';

describe('App', () => {
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
});
