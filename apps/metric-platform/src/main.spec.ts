import { afterEach, describe, expect, it } from 'vitest';
import { bootstrap } from './main.js';

describe('bootstrap', () => {
  const servers: Array<{ close: () => Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(servers.map((server) => server.close()));
    servers.length = 0;
  });

  it('serves personal and team metric snapshots over HTTP', async () => {
    const app = await bootstrap({ port: 0 });
    servers.push(app);

    const importResponse = await fetch(`${app.baseUrl}/events/import`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        schemaVersion: 'v1',
        source: 'cursor',
        events: [
          {
            eventType: 'session.recorded',
            occurredAt: '2026-04-23T00:00:00.000Z',
            payload: {
              sessionId: 'sess_1',
              projectKey: 'proj',
              repoName: 'repo',
              memberId: 'alice',
              acceptedAiLines: 44,
              commitTotalLines: 55,
            },
          },
          {
            eventType: 'session.recorded',
            occurredAt: '2026-04-23T00:05:00.000Z',
            payload: {
              sessionId: 'sess_2',
              projectKey: 'proj',
              repoName: 'repo',
              memberId: 'bob',
              acceptedAiLines: 46,
              commitTotalLines: 65,
            },
          },
        ],
      }),
    });
    const personalResponse = await fetch(`${app.baseUrl}/metrics/personal`);
    const teamResponse = await fetch(`${app.baseUrl}/metrics/team`);

    expect(importResponse.status).toBe(200);
    expect(personalResponse.status).toBe(200);
    expect(teamResponse.status).toBe(200);

    const personalSnapshot = await personalResponse.json();
    const teamSnapshot = await teamResponse.json();

    expect(personalSnapshot.acceptedAiLines).toBe(44);
    expect(personalSnapshot.aiOutputRate).toBe(0.8);
    expect(teamSnapshot.totalAcceptedAiLines).toBe(90);
    expect(teamSnapshot.totalCommitLines).toBe(120);
    expect(teamSnapshot.aiOutputRate).toBe(0.75);
    expect(teamSnapshot.memberCount).toBe(2);
  });
});
