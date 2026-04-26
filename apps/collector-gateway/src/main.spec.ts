import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { bootstrap } from './main.js';

describe('collector gateway bootstrap', () => {
  const servers: Array<{ close: () => Promise<void> }> = [];
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(servers.map((server) => server.close()));
    servers.length = 0;
    temporaryDirectories.splice(0).forEach((directory) => {
      rmSync(directory, { recursive: true, force: true });
    });
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

  it('fails closed when ingestion auth is required without a token', async () => {
    await expect(
      bootstrap({
        port: 0,
        collectorTokenRequired: true,
      }),
    ).rejects.toThrow('AIMETRIC_COLLECTOR_TOKEN is required');
  });

  it('rejects ingestion payloads over the configured body limit', async () => {
    const app = await bootstrap({
      port: 0,
      maxRequestBodyBytes: 32,
    });
    servers.push(app);

    const response = await fetch(`${app.baseUrl}/ingestion`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(createIngestionBatch()),
    });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      message: 'Request body is too large',
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

  it('can boot with a file-backed ingestion queue', async () => {
    const queueDir = mkdtempSync(join(tmpdir(), 'aimetric-http-queue-'));
    temporaryDirectories.push(queueDir);
    const app = await bootstrap({
      port: 0,
      ingestionDeliveryMode: 'queue',
      ingestionQueueBackend: 'file',
      ingestionQueueDir: queueDir,
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

    expect(ingestionResponse.status).toBe(200);
    await expect(healthResponse.json()).resolves.toMatchObject({
      deliveryMode: 'queue',
      queueBackend: 'file',
      queueDepth: 1,
    });
  });

  it('lists and replays dead-letter batches over authorized HTTP endpoints', async () => {
    const queueDir = mkdtempSync(join(tmpdir(), 'aimetric-http-dlq-'));
    temporaryDirectories.push(queueDir);
    const app = await bootstrap({
      port: 0,
      collectorToken: 'secret-token',
      ingestionDeliveryMode: 'queue',
      ingestionQueueBackend: 'file',
      ingestionQueueDir: queueDir,
      maxDeliveryAttempts: 1,
    });
    servers.push(app);

    await fetch(`${app.baseUrl}/ingestion`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer secret-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify(createIngestionBatch()),
    });
    await fetch(`${app.baseUrl}/ingestion/flush`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer secret-token',
      },
    });

    const unauthorizedListResponse = await fetch(`${app.baseUrl}/ingestion/dead-letter`);
    const listResponse = await fetch(`${app.baseUrl}/ingestion/dead-letter`, {
      headers: {
        authorization: 'Bearer secret-token',
      },
    });
    const replayResponse = await fetch(`${app.baseUrl}/ingestion/dead-letter/replay`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer secret-token',
      },
    });

    expect(unauthorizedListResponse.status).toBe(401);
    await expect(listResponse.json()).resolves.toEqual([
      expect.objectContaining({
        attempts: 1,
        eventCount: 1,
        source: 'cursor',
        firstEventType: 'session.started',
      }),
    ]);
    await expect(replayResponse.json()).resolves.toEqual({
      replayed: 1,
      remainingDeadLetterDepth: 0,
      queueDepth: 1,
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
