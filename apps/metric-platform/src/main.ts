import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { pathToFileURL } from 'node:url';
import { IngestionBatchSchema } from '@aimetric/event-schema';
import { AppModule } from './app.module.js';
import type { MetricEventRepository } from './database/postgres-event.repository.js';

export interface MetricPlatformServer {
  baseUrl: string;
  close: () => Promise<void>;
}

export interface BootstrapOptions {
  host?: string;
  metricEventRepository?: MetricEventRepository;
  port?: number;
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

const handleRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  appModule: AppModule,
): Promise<void> => {
  const method = request.method ?? 'GET';
  const url = request.url ?? '/';

  if (method === 'GET' && url === '/health') {
    writeJson(response, 200, { status: 'ok', service: 'metric-platform' });
    return;
  }

  if (method === 'GET' && url === '/metrics/personal') {
    writeJson(response, 200, await appModule.buildPersonalSnapshot());
    return;
  }

  if (method === 'GET' && url === '/metrics/team') {
    writeJson(response, 200, await appModule.buildTeamSnapshot());
    return;
  }

  if (method === 'POST' && url === '/events/import') {
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

  return {
    baseUrl: `http://${host}:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          void appModule.close().then(resolve, reject);
        });
      }),
  };
}

const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  void bootstrap().then((app) => {
    console.log(`metric-platform listening on ${app.baseUrl}`);
  });
}
