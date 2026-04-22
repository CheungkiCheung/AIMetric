import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { pathToFileURL } from 'node:url';
import { IngestionBatchSchema } from '@aimetric/event-schema';
import { AppModule } from './app.module.js';
import type {
  MetricEventRepository,
  MetricSnapshotFilters,
} from './database/postgres-event.repository.js';
import {
  createSnapshotRecalculationScheduler,
  type SnapshotRecalculationScheduler,
} from './snapshots/snapshot-recalculation.scheduler.js';

export interface MetricPlatformServer {
  baseUrl: string;
  close: () => Promise<void>;
}

export interface BootstrapOptions {
  host?: string;
  metricEventRepository?: MetricEventRepository;
  port?: number;
  snapshotRecalculationFilters?: MetricSnapshotFilters;
  snapshotRecalculationIntervalMs?: number;
}

const writeJson = (
  response: ServerResponse,
  statusCode: number,
  body: unknown,
): void => {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(body));
};

const readJsonBody = async (request: IncomingMessage): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    request.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        const rawBody = Buffer.concat(chunks).toString('utf8');
        resolve(rawBody.length > 0 ? JSON.parse(rawBody) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });

const parseRequestUrl = (request: IncomingMessage): URL =>
  new URL(request.url ?? '/', 'http://localhost');

const getMetricSnapshotFilters = (url: URL): MetricSnapshotFilters => {
  const filters: MetricSnapshotFilters = {};
  const projectKey = url.searchParams.get('projectKey');
  const memberId = url.searchParams.get('memberId');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  if (projectKey) {
    filters.projectKey = projectKey;
  }

  if (memberId) {
    filters.memberId = memberId;
  }

  if (from) {
    filters.from = from;
  }

  if (to) {
    filters.to = to;
  }

  return filters;
};

const getMetricSnapshotFiltersFromBody = (body: unknown): MetricSnapshotFilters => {
  if (!body || typeof body !== 'object') {
    return {};
  }

  const payload = body as Record<string, unknown>;
  const filters: MetricSnapshotFilters = {};

  if (typeof payload.projectKey === 'string') {
    filters.projectKey = payload.projectKey;
  }

  if (typeof payload.memberId === 'string') {
    filters.memberId = payload.memberId;
  }

  if (typeof payload.from === 'string') {
    filters.from = payload.from;
  }

  if (typeof payload.to === 'string') {
    filters.to = payload.to;
  }

  return filters;
};

const handleRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  appModule: AppModule,
): Promise<void> => {
  const method = request.method ?? 'GET';
  const url = parseRequestUrl(request);

  if (method === 'GET' && url.pathname === '/health') {
    writeJson(response, 200, { status: 'ok', service: 'metric-platform' });
    return;
  }

  if (method === 'GET' && url.pathname === '/metrics/personal') {
    writeJson(
      response,
      200,
      await appModule.buildPersonalSnapshot(getMetricSnapshotFilters(url)),
    );
    return;
  }

  if (method === 'GET' && url.pathname === '/metrics/team') {
    writeJson(
      response,
      200,
      await appModule.buildTeamSnapshot(getMetricSnapshotFilters(url)),
    );
    return;
  }

  if (method === 'GET' && url.pathname === '/metrics/snapshots') {
    writeJson(
      response,
      200,
      await appModule.listMetricSnapshots(getMetricSnapshotFilters(url)),
    );
    return;
  }

  if (method === 'POST' && url.pathname === '/metrics/recalculate') {
    try {
      const body = await readJsonBody(request);

      writeJson(
        response,
        200,
        await appModule.recalculateMetricSnapshots(
          getMetricSnapshotFiltersFromBody(body),
        ),
      );
    } catch {
      writeJson(response, 400, { message: 'Invalid recalculation request' });
    }
    return;
  }

  if (method === 'POST' && url.pathname === '/events/import') {
    try {
      const body = await readJsonBody(request);
      const batch = IngestionBatchSchema.parse(body);

      writeJson(response, 200, await appModule.importEvents(batch));
    } catch {
      writeJson(response, 400, { message: 'Invalid ingestion batch' });
    }
    return;
  }

  writeJson(response, 404, { message: 'Not Found' });
};

export async function bootstrap(
  options: BootstrapOptions = {},
): Promise<MetricPlatformServer> {
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? 3001;
  const appModule = new AppModule(options.metricEventRepository);
  let snapshotScheduler: SnapshotRecalculationScheduler | undefined;

  const server = createServer((request, response) => {
    void handleRequest(request, response, appModule);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Failed to resolve metric-platform listening address');
  }

  if (
    options.snapshotRecalculationIntervalMs !== undefined &&
    options.snapshotRecalculationIntervalMs > 0
  ) {
    snapshotScheduler = createSnapshotRecalculationScheduler({
      intervalMs: options.snapshotRecalculationIntervalMs,
      filters: options.snapshotRecalculationFilters,
      recalculate: (filters) => appModule.recalculateMetricSnapshots(filters),
    });
    snapshotScheduler.start();
  }

  return {
    baseUrl: `http://${host}:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          snapshotScheduler?.stop();
          void appModule.close().then(resolve, reject);
        });
      }),
  };
}

const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const snapshotRecalculationIntervalMs = process.env
    .METRIC_SNAPSHOT_RECALCULATION_INTERVAL_MS
    ? Number(process.env.METRIC_SNAPSHOT_RECALCULATION_INTERVAL_MS)
    : undefined;

  void bootstrap({ snapshotRecalculationIntervalMs }).then((app) => {
    console.log(`metric-platform listening on ${app.baseUrl}`);
  });
}
