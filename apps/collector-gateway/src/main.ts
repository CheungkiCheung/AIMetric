import { timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { pathToFileURL } from 'node:url';
import { AppModule } from './app.module.js';
import type {
  IngestionDeliveryMode,
  IngestionQueueBackend,
} from './ingestion/ingestion.service.js';

export interface CollectorGatewayServer {
  baseUrl: string;
  close: () => Promise<void>;
}

export interface BootstrapOptions {
  host?: string;
  port?: number;
  collectorToken?: string;
  collectorTokenRequired?: boolean;
  ingestionDeliveryMode?: IngestionDeliveryMode;
  ingestionQueueBackend?: IngestionQueueBackend;
  ingestionQueueDir?: string;
  maxDeliveryAttempts?: number;
  maxRequestBodyBytes?: number;
}

class HttpBodyTooLargeError extends Error {
  constructor(readonly limitBytes: number) {
    super(`Request body exceeds ${limitBytes} bytes`);
  }
}

const defaultMaxRequestBodyBytes = 1_048_576;

const readJsonBody = async (
  request: IncomingMessage,
  maxBodyBytes = defaultMaxRequestBodyBytes,
): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let receivedBytes = 0;
    let bodyTooLarge = false;

    const contentLength = Number(request.headers['content-length'] ?? 0);
    if (contentLength > maxBodyBytes) {
      reject(new HttpBodyTooLargeError(maxBodyBytes));
      return;
    }

    request.on('data', (chunk: Buffer) => {
      if (bodyTooLarge) {
        return;
      }

      receivedBytes += chunk.length;
      if (receivedBytes > maxBodyBytes) {
        bodyTooLarge = true;
        reject(new HttpBodyTooLargeError(maxBodyBytes));
        return;
      }
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

const writeText = (
  response: ServerResponse,
  statusCode: number,
  body: string,
): void => {
  response.writeHead(statusCode, {
    'content-type': 'text/plain; version=0.0.4; charset=utf-8',
  });
  response.end(body);
};

const handleRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  appModule: AppModule,
  collectorToken?: string,
  maxRequestBodyBytes = defaultMaxRequestBodyBytes,
  metrics: { startedAt: number; requestCount: number } = {
    startedAt: Date.now(),
    requestCount: 0,
  },
): Promise<void> => {
  const method = request.method ?? 'GET';
  const url = request.url ?? '/';
  metrics.requestCount += 1;

  if (method === 'GET' && url === '/health') {
    writeJson(response, 200, { status: 'ok', service: 'collector-gateway' });
    return;
  }

  if (method === 'GET' && url === '/ready') {
    writeJson(response, 200, { status: 'ready', service: 'collector-gateway' });
    return;
  }

  if (method === 'GET' && url === '/metrics') {
    const uptimeSeconds = Math.max(0, (Date.now() - metrics.startedAt) / 1_000);
    const ingestionHealth = appModule.ingestionController.health();
    writeText(
      response,
      200,
      [
        '# HELP aimetric_collector_gateway_uptime_seconds Collector gateway uptime in seconds',
        '# TYPE aimetric_collector_gateway_uptime_seconds gauge',
        `aimetric_collector_gateway_uptime_seconds ${uptimeSeconds.toFixed(3)}`,
        '# HELP aimetric_collector_gateway_requests_total Collector gateway HTTP requests',
        '# TYPE aimetric_collector_gateway_requests_total counter',
        `aimetric_collector_gateway_requests_total ${metrics.requestCount}`,
        '# HELP aimetric_collector_gateway_ingestion_queue_depth Queued ingestion batches waiting for delivery',
        '# TYPE aimetric_collector_gateway_ingestion_queue_depth gauge',
        `aimetric_collector_gateway_ingestion_queue_depth ${ingestionHealth.queueDepth}`,
        '# HELP aimetric_collector_gateway_ingestion_dead_letter_depth Ingestion batches in the dead letter queue',
        '# TYPE aimetric_collector_gateway_ingestion_dead_letter_depth gauge',
        `aimetric_collector_gateway_ingestion_dead_letter_depth ${ingestionHealth.deadLetterDepth}`,
        '# HELP aimetric_collector_gateway_ingestion_forwarded_total Ingestion batches forwarded to metric-platform',
        '# TYPE aimetric_collector_gateway_ingestion_forwarded_total counter',
        `aimetric_collector_gateway_ingestion_forwarded_total ${ingestionHealth.forwardedTotal}`,
        '# HELP aimetric_collector_gateway_ingestion_failed_forward_total Failed metric-platform forwarding attempts',
        '# TYPE aimetric_collector_gateway_ingestion_failed_forward_total counter',
        `aimetric_collector_gateway_ingestion_failed_forward_total ${ingestionHealth.failedForwardTotal}`,
        '',
      ].join('\n'),
    );
    return;
  }

  if (method === 'GET' && url === '/ingestion/health') {
    writeJson(response, 200, appModule.ingestionController.health());
    return;
  }

  if (method === 'GET' && url === '/ingestion/dead-letter') {
    if (!isAuthorizedIngestionRequest(request, collectorToken)) {
      writeJson(response, 401, { message: 'Unauthorized ingestion request' });
      return;
    }

    writeJson(response, 200, appModule.ingestionController.listDeadLetterBatches());
    return;
  }

  if (method === 'POST' && url === '/ingestion/dead-letter/replay') {
    if (!isAuthorizedIngestionRequest(request, collectorToken)) {
      writeJson(response, 401, { message: 'Unauthorized ingestion request' });
      return;
    }

    writeJson(response, 200, appModule.ingestionController.replayDeadLetterBatches());
    return;
  }

  if (method === 'POST' && url === '/ingestion/flush') {
    if (!isAuthorizedIngestionRequest(request, collectorToken)) {
      writeJson(response, 401, { message: 'Unauthorized ingestion request' });
      return;
    }

    writeJson(response, 200, await appModule.ingestionController.flushQueuedBatches());
    return;
  }

  if (method === 'POST' && url === '/ingestion') {
    if (!isAuthorizedIngestionRequest(request, collectorToken)) {
      writeJson(response, 401, { message: 'Unauthorized ingestion request' });
      return;
    }

    try {
      const body = await readJsonBody(request, maxRequestBodyBytes);
      writeJson(response, 200, await appModule.ingestionController.ingest(body));
    } catch (error) {
      if (error instanceof HttpBodyTooLargeError) {
        writeJson(response, 413, { message: 'Request body is too large' });
        return;
      }

      writeJson(response, 400, { message: 'Invalid ingestion payload' });
    }
    return;
  }

  writeJson(response, 404, { message: 'Not Found' });
};

const isAuthorizedIngestionRequest = (
  request: IncomingMessage,
  collectorToken?: string,
): boolean => {
  if (!collectorToken) {
    return true;
  }

  const authorization = request.headers.authorization;
  const token =
    typeof authorization === 'string' && authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : '';

  return compareTokens(token, collectorToken);
};

const compareTokens = (candidate: string, expected: string): boolean => {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);

  return (
    candidateBuffer.length === expectedBuffer.length &&
    timingSafeEqual(candidateBuffer, expectedBuffer)
  );
};

export async function bootstrap(
  options: BootstrapOptions = {},
): Promise<CollectorGatewayServer> {
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? 3000;
  const collectorToken =
    options.collectorToken ?? process.env.AIMETRIC_COLLECTOR_TOKEN;
  const collectorTokenRequired =
    options.collectorTokenRequired ?? isProductionRuntime();

  if (collectorTokenRequired && !collectorToken) {
    throw new Error('AIMETRIC_COLLECTOR_TOKEN is required');
  }

  const appModule = new AppModule({
    deliveryMode: options.ingestionDeliveryMode,
    queueBackend: options.ingestionQueueBackend,
    queueDir: options.ingestionQueueDir,
    maxDeliveryAttempts: options.maxDeliveryAttempts,
  });
  const metrics = {
    startedAt: Date.now(),
    requestCount: 0,
  };

  const server = createServer((request, response) => {
    void handleRequest(
      request,
      response,
      appModule,
      collectorToken,
      options.maxRequestBodyBytes ?? defaultMaxRequestBodyBytes,
      metrics,
    ).catch((error) => {
      if (response.headersSent) {
        response.end();
        return;
      }

      if (error instanceof HttpBodyTooLargeError) {
        writeJson(response, 413, { message: 'Request body is too large' });
        return;
      }

      writeJson(response, 500, { message: 'Internal Server Error' });
    });
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
    throw new Error('Failed to resolve collector-gateway listening address');
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

          resolve();
        });
      }),
  };
}

const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  void bootstrap().then((app) => {
    console.log(`collector-gateway listening on ${app.baseUrl}`);
  });
}

const isProductionRuntime = (): boolean =>
  process.env.NODE_ENV === 'production' ||
  process.env.AIMETRIC_REQUIRE_AUTH === 'true';
