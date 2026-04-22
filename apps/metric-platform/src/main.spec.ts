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

    const personalResponse = await fetch(`${app.baseUrl}/metrics/personal`);
    const teamResponse = await fetch(`${app.baseUrl}/metrics/team`);

    expect(personalResponse.status).toBe(200);
    expect(teamResponse.status).toBe(200);

    const personalSnapshot = await personalResponse.json();
    const teamSnapshot = await teamResponse.json();

    expect(personalSnapshot.aiOutputRate).toBe(0.7);
    expect(teamSnapshot.aiOutputRate).toBe(0.625);
    expect(teamSnapshot.memberCount).toBe(2);
  });
});
