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

  it('serves readiness and prometheus metrics endpoints', async () => {
    const app = await bootstrap({ port: 0 });
    servers.push(app);

    const readyResponse = await fetch(`${app.baseUrl}/ready`);
    const metricsResponse = await fetch(`${app.baseUrl}/metrics`);

    expect(readyResponse.status).toBe(200);
    await expect(readyResponse.json()).resolves.toEqual({
      status: 'ready',
      service: 'collector-gateway',
    });
    expect(metricsResponse.status).toBe(200);
    expect(metricsResponse.headers.get('content-type')).toContain('text/plain');
    await expect(metricsResponse.text()).resolves.toContain(
      'aimetric_collector_gateway_uptime_seconds',
    );
  });

  it('reports queued ingestion health over HTTP', async () => {
    const app = await bootstrap({
      port: 0,
      ingestionDeliveryMode: 'queue',
    });
    servers.push(app);

    const ingestionResponse = await fetch(`${app.baseUrl}/ingestion`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(createIngestionBatch()),
    });
    const healthResponse = await fetch(`${app.baseUrl}/ingestion/health`);
    const metricsResponse = await fetch(`${app.baseUrl}/metrics`);

    expect(ingestionResponse.status).toBe(200);
    await expect(ingestionResponse.json()).resolves.toMatchObject({
      accepted: 1,
      queued: true,
      queueDepth: 1,
    });
    expect(healthResponse.status).toBe(200);
    await expect(healthResponse.json()).resolves.toMatchObject({
      deliveryMode: 'queue',
      queueDepth: 1,
      deadLetterDepth: 0,
    });
    await expect(metricsResponse.text()).resolves.toContain(
      'aimetric_collector_gateway_ingestion_queue_depth 1',
    );
  });

  it('requires a bearer token for manual ingestion flush when auth is configured', async () => {
    const app = await bootstrap({
      port: 0,
      collectorToken: 'secret-token',
      ingestionDeliveryMode: 'queue',
    });
    servers.push(app);

    const unauthorizedResponse = await fetch(`${app.baseUrl}/ingestion/flush`, {
      method: 'POST',
    });
    const authorizedResponse = await fetch(`${app.baseUrl}/ingestion/flush`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer secret-token',
      },
    });

    expect(unauthorizedResponse.status).toBe(401);
    await expect(unauthorizedResponse.json()).resolves.toEqual({
      message: 'Unauthorized ingestion request',
    });
    expect(authorizedResponse.status).toBe(200);
    await expect(authorizedResponse.json()).resolves.toMatchObject({
      attempted: 0,
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
