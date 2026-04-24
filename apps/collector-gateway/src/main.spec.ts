import { afterEach, describe, expect, it } from 'vitest';
import { bootstrap } from './main.js';

describe('collector gateway bootstrap', () => {
  const servers: Array<{ close: () => Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(servers.map((server) => server.close()));
    servers.length = 0;
  });

  it('accepts ingestion batches over HTTP', async () => {
    const app = await bootstrap({ port: 0 });
    servers.push(app);

    const response = await fetch(`${app.baseUrl}/ingestion`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        schemaVersion: 'v1',
        source: 'cursor',
        events: [
          {
            eventType: 'session.started',
            occurredAt: '2026-04-23T00:00:00.000Z',
            payload: {
              sessionId: 'sess_1',
              projectKey: 'proj',
              repoName: 'repo',
            },
          },
        ],
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      accepted: 1,
      schemaVersion: 'v1',
    });
  });

  it('requires a bearer token when ingestion auth is configured', async () => {
    const app = await bootstrap({
      port: 0,
      collectorToken: 'secret-token',
    });
    servers.push(app);

    const unauthorizedResponse = await fetch(`${app.baseUrl}/ingestion`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(createIngestionBatch()),
    });
    const authorizedResponse = await fetch(`${app.baseUrl}/ingestion`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer secret-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify(createIngestionBatch()),
    });

    expect(unauthorizedResponse.status).toBe(401);
    await expect(unauthorizedResponse.json()).resolves.toEqual({
      message: 'Unauthorized ingestion request',
    });
    expect(authorizedResponse.status).toBe(200);
    await expect(authorizedResponse.json()).resolves.toMatchObject({
      accepted: 1,
      schemaVersion: 'v1',
    });
  });
});

const createIngestionBatch = () => ({
  schemaVersion: 'v1',
  source: 'cursor',
  events: [
    {
      eventType: 'session.started',
      occurredAt: '2026-04-23T00:00:00.000Z',
      payload: {
        sessionId: 'sess_1',
        projectKey: 'proj',
        repoName: 'repo',
      },
    },
  ],
});
