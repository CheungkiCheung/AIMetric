import { timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { pathToFileURL } from 'node:url';
import { IngestionBatchSchema } from '@aimetric/event-schema';
import type { EnterpriseMetricDimensionKey } from '@aimetric/metric-core';
import { AppModule } from './app.module.js';
import type {
  CollectorIdentityRecord,
  EditEvidenceFilters,
  MetricEventRepository,
  MetricSnapshotFilters,
} from './database/postgres-event.repository.js';
import type {
  GovernanceViewerScope,
  GovernanceViewerScopeAssignment,
} from './governance/governance-directory.service.js';
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
  adminToken?: string;
  metricEventRepository?: MetricEventRepository;
  port?: number;
  ruleCatalogRoot?: string;
  docsRoot?: string;
  snapshotRecalculationFilters?: MetricSnapshotFilters;
  snapshotRecalculationIntervalMs?: number;
}

interface AdminAuditEvent {
  action: string;
  actor: string;
  occurredAt: string;
  status: 'success';
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

  const metricKeys = url.searchParams.getAll('metricKey');
  if (metricKeys.length > 0) {
    filters.metricKeys = metricKeys;
  }

  return filters;
};

const getEditEvidenceFilters = (url: URL): EditEvidenceFilters => {
  const filters: EditEvidenceFilters = getMetricSnapshotFilters(url);
  const sessionId = url.searchParams.get('sessionId');
  const filePath = url.searchParams.get('filePath');

  if (sessionId) {
    filters.sessionId = sessionId;
  }

  if (filePath) {
    filters.filePath = filePath;
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

  if (Array.isArray(payload.metricKeys)) {
    const metricKeys = payload.metricKeys.filter(
      (metricKey): metricKey is string => typeof metricKey === 'string',
    );

    if (metricKeys.length > 0) {
      filters.metricKeys = metricKeys;
    }
  }

  return filters;
};

const enterpriseMetricDimensionKeys = new Set<EnterpriseMetricDimensionKey>([
  'adoption',
  'effective-output',
  'delivery-efficiency',
  'quality-risk',
  'experience-capability',
  'business-value',
]);

const parseEnterpriseMetricDimension = (
  value: string | null,
): EnterpriseMetricDimensionKey | undefined => {
  if (!value) {
    return undefined;
  }

  return enterpriseMetricDimensionKeys.has(value as EnterpriseMetricDimensionKey)
    ? (value as EnterpriseMetricDimensionKey)
    : undefined;
};

const readViewerId = (request: IncomingMessage): string | undefined => {
  const viewerId = request.headers['x-aimetric-viewer-id'];
  return typeof viewerId === 'string' && viewerId.length > 0 ? viewerId : undefined;
};

const getCollectorIdentityInputFromBody = (
  body: unknown,
): Omit<CollectorIdentityRecord, 'status' | 'registeredAt' | 'updatedAt'> | undefined => {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  const payload = body as Record<string, unknown>;
  const identityKey = payload.identityKey;
  const memberId = payload.memberId;
  const projectKey = payload.projectKey;
  const repoName = payload.repoName;
  const toolProfile = payload.toolProfile;

  if (
    typeof identityKey !== 'string' ||
    typeof memberId !== 'string' ||
    typeof projectKey !== 'string' ||
    typeof repoName !== 'string' ||
    typeof toolProfile !== 'string'
  ) {
    return undefined;
  }

  return {
    identityKey,
    memberId,
    projectKey,
    repoName,
    toolProfile,
  };
};

const getViewerScopeAssignmentInputFromBody = (
  body: unknown,
): GovernanceViewerScopeAssignment | undefined => {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  const payload = body as Record<string, unknown>;
  const viewerId = payload.viewerId;
  const teamKeys = payload.teamKeys;
  const projectKeys = payload.projectKeys;

  if (
    typeof viewerId !== 'string' ||
    !Array.isArray(teamKeys) ||
    !Array.isArray(projectKeys) ||
    teamKeys.some((value) => typeof value !== 'string') ||
    projectKeys.some((value) => typeof value !== 'string')
  ) {
    return undefined;
  }

  return {
    viewerId,
    teamKeys: [...new Set(teamKeys)],
    projectKeys: [...new Set(projectKeys)],
  };
};

const applyViewerScopeToFilters = <T extends MetricSnapshotFilters>(
  filters: T,
  viewerScope?: GovernanceViewerScope,
): { denied: boolean; filters: T } => {
  if (!viewerScope || viewerScope.role === 'platform-admin') {
    return { denied: false, filters };
  }

  if (
    filters.projectKey &&
    !viewerScope.projectKeys.includes(filters.projectKey)
  ) {
    return { denied: true, filters };
  }

  if (
    filters.memberId &&
    !viewerScope.memberIds.includes(filters.memberId)
  ) {
    return { denied: true, filters };
  }

  return {
    denied: false,
    filters: filters.projectKey
      ? filters
      : {
          ...filters,
          projectKeys: viewerScope.projectKeys,
        },
  };
};

const handleRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  appModule: AppModule,
  runtime: {
    adminToken?: string;
    adminAuditEvents: AdminAuditEvent[];
    startedAt: number;
    requestCount: number;
    now: () => string;
  },
): Promise<void> => {
  const method = request.method ?? 'GET';
  const url = parseRequestUrl(request);
  const viewerId = readViewerId(request);
  const viewerScope = await appModule.getViewerScope(viewerId);
  runtime.requestCount += 1;

  if (viewerId && !viewerScope) {
    writeJson(response, 403, { message: 'Viewer is not authorized' });
    return;
  }

  if (method === 'GET' && url.pathname === '/health') {
    writeJson(response, 200, { status: 'ok', service: 'metric-platform' });
    return;
  }

  if (method === 'GET' && url.pathname === '/ready') {
    writeJson(response, 200, { status: 'ready', service: 'metric-platform' });
    return;
  }

  if (method === 'GET' && url.pathname === '/metrics') {
    const uptimeSeconds = Math.max(0, (Date.now() - runtime.startedAt) / 1_000);
    writeText(
      response,
      200,
      [
        '# HELP aimetric_metric_platform_uptime_seconds Metric platform uptime in seconds',
        '# TYPE aimetric_metric_platform_uptime_seconds gauge',
        `aimetric_metric_platform_uptime_seconds ${uptimeSeconds.toFixed(3)}`,
        '# HELP aimetric_metric_platform_requests_total Metric platform HTTP requests',
        '# TYPE aimetric_metric_platform_requests_total counter',
        `aimetric_metric_platform_requests_total ${runtime.requestCount}`,
        '# HELP aimetric_metric_platform_admin_audit_events_total Metric platform admin audit events',
        '# TYPE aimetric_metric_platform_admin_audit_events_total counter',
        `aimetric_metric_platform_admin_audit_events_total ${runtime.adminAuditEvents.length}`,
        '',
      ].join('\n'),
    );
    return;
  }

  if (method === 'GET' && url.pathname === '/metrics/personal') {
    const scoped = applyViewerScopeToFilters(
      getMetricSnapshotFilters(url),
      viewerScope,
    );

    if (scoped.denied) {
      writeJson(response, 403, { message: 'Project or member is outside viewer scope' });
      return;
    }

    writeJson(
      response,
      200,
      await appModule.buildPersonalSnapshot(scoped.filters),
    );
    return;
  }

  if (method === 'GET' && url.pathname === '/metrics/team') {
    const scoped = applyViewerScopeToFilters(
      getMetricSnapshotFilters(url),
      viewerScope,
    );

    if (scoped.denied) {
      writeJson(response, 403, { message: 'Project or member is outside viewer scope' });
      return;
    }

    writeJson(
      response,
      200,
      await appModule.buildTeamSnapshot(scoped.filters),
    );
    return;
  }

  if (method === 'GET' && url.pathname === '/metrics/snapshots') {
    const scoped = applyViewerScopeToFilters(
      getMetricSnapshotFilters(url),
      viewerScope,
    );

    if (scoped.denied) {
      writeJson(response, 403, { message: 'Project or member is outside viewer scope' });
      return;
    }

    writeJson(
      response,
      200,
      await appModule.listMetricSnapshots(scoped.filters),
    );
    return;
  }

  if (method === 'GET' && url.pathname === '/metrics/mcp-audit') {
    const scoped = applyViewerScopeToFilters(
      getMetricSnapshotFilters(url),
      viewerScope,
    );

    if (scoped.denied) {
      writeJson(response, 403, { message: 'Project or member is outside viewer scope' });
      return;
    }

    writeJson(
      response,
      200,
      await appModule.buildMcpAuditMetrics(scoped.filters),
    );
    return;
  }

  if (method === 'GET' && url.pathname === '/enterprise-metrics/catalog') {
    writeJson(response, 200, appModule.getEnterpriseMetricCatalog());
    return;
  }

  if (method === 'GET' && url.pathname === '/governance/directory') {
    writeJson(
      response,
      200,
      await appModule.getScopedOrganizationDirectory(viewerId),
    );
    return;
  }

  if (method === 'GET' && url.pathname === '/governance/viewer-scopes') {
    if (!isAuthorizedAdminRequest(request, runtime.adminToken)) {
      writeJson(response, 401, { message: 'Unauthorized admin request' });
      return;
    }

    const viewerId = url.searchParams.get('viewerId');

    if (!viewerId) {
      writeJson(response, 400, { message: 'viewerId is required' });
      return;
    }

    writeJson(response, 200, await appModule.getViewerScopeAssignment(viewerId));
    return;
  }

  if (method === 'GET' && url.pathname === '/governance/collector-identities/resolve') {
    const identityKey = url.searchParams.get('identityKey');

    if (!identityKey) {
      writeJson(response, 400, { message: 'identityKey is required' });
      return;
    }

    const collectorIdentity = await appModule.getCollectorIdentity(identityKey);

    if (!collectorIdentity) {
      writeJson(response, 404, { message: 'Collector identity not found' });
      return;
    }

    writeJson(response, 200, collectorIdentity);
    return;
  }

  if (method === 'GET' && url.pathname === '/enterprise-metrics/values') {
    const scoped = applyViewerScopeToFilters(
      getMetricSnapshotFilters(url),
      viewerScope,
    );

    if (scoped.denied) {
      writeJson(response, 403, { message: 'Project or member is outside viewer scope' });
      return;
    }

    writeJson(
      response,
      200,
      await appModule.calculateEnterpriseMetricValues(
        scoped.filters,
        {
          metricKeys: scoped.filters.metricKeys,
        },
      ),
    );
    return;
  }

  if (method === 'GET' && url.pathname === '/enterprise-metrics/snapshots') {
    const scoped = applyViewerScopeToFilters(
      getMetricSnapshotFilters(url),
      viewerScope,
    );

    if (scoped.denied) {
      writeJson(response, 403, { message: 'Project or member is outside viewer scope' });
      return;
    }

    writeJson(
      response,
      200,
      await appModule.listEnterpriseMetricSnapshots(scoped.filters),
    );
    return;
  }

  if (method === 'GET' && url.pathname === '/enterprise-metrics') {
    const dimension = parseEnterpriseMetricDimension(
      url.searchParams.get('dimension'),
    );

    if (!dimension) {
      writeJson(response, 400, { message: 'Valid dimension is required' });
      return;
    }

    writeJson(response, 200, appModule.listEnterpriseMetricsByDimension(dimension));
    return;
  }

  if (method === 'GET' && url.pathname === '/evidence/edits') {
    const scoped = applyViewerScopeToFilters(
      getEditEvidenceFilters(url),
      viewerScope,
    );

    if (scoped.denied) {
      writeJson(response, 403, { message: 'Project or member is outside viewer scope' });
      return;
    }

    writeJson(
      response,
      200,
      await appModule.listEditSpanEvidence(scoped.filters),
    );
    return;
  }

  if (method === 'GET' && url.pathname === '/evidence/tab-completions') {
    const scoped = applyViewerScopeToFilters(
      getEditEvidenceFilters(url),
      viewerScope,
    );

    if (scoped.denied) {
      writeJson(response, 403, { message: 'Project or member is outside viewer scope' });
      return;
    }

    writeJson(
      response,
      200,
      await appModule.listTabAcceptedEvents(scoped.filters),
    );
    return;
  }

  if (method === 'GET' && url.pathname === '/analysis/summary') {
    const scoped = applyViewerScopeToFilters(
      getMetricSnapshotFilters(url),
      viewerScope,
    );

    if (scoped.denied) {
      writeJson(response, 403, { message: 'Project or member is outside viewer scope' });
      return;
    }

    writeJson(
      response,
      200,
      await appModule.buildAnalysisSummary(scoped.filters),
    );
    return;
  }

  if (method === 'GET' && url.pathname === '/analysis/sessions') {
    const scoped = applyViewerScopeToFilters(
      getMetricSnapshotFilters(url),
      viewerScope,
    );

    if (scoped.denied) {
      writeJson(response, 403, { message: 'Project or member is outside viewer scope' });
      return;
    }

    writeJson(
      response,
      200,
      await appModule.listSessionAnalysisRows(scoped.filters),
    );
    return;
  }

  if (method === 'GET' && url.pathname === '/analysis/output') {
    const scoped = applyViewerScopeToFilters(
      getMetricSnapshotFilters(url),
      viewerScope,
    );

    if (scoped.denied) {
      writeJson(response, 403, { message: 'Project or member is outside viewer scope' });
      return;
    }

    writeJson(
      response,
      200,
      await appModule.listOutputAnalysisRows(scoped.filters),
    );
    return;
  }

  if (method === 'GET' && url.pathname === '/rules/project') {
    writeJson(
      response,
      200,
      appModule.getProjectRules({
        projectKey: url.searchParams.get('projectKey') ?? 'aimetric',
        toolType: url.searchParams.get('toolType') ?? 'cursor',
        sceneType: url.searchParams.get('sceneType') ?? 'rule-query',
        memberId: url.searchParams.get('memberId') ?? undefined,
      }),
    );
    return;
  }

  if (method === 'GET' && url.pathname === '/rules/versions') {
    writeJson(
      response,
      200,
      appModule.listRuleVersions(
        url.searchParams.get('projectKey') ?? 'aimetric',
      ),
    );
    return;
  }

  if (method === 'GET' && url.pathname === '/rules/template') {
    writeJson(
      response,
      200,
      appModule.getRuleTemplate({
        projectKey: url.searchParams.get('projectKey') ?? 'aimetric',
        version: url.searchParams.get('version') ?? undefined,
      }),
    );
    return;
  }

  if (method === 'GET' && url.pathname === '/rules/validate') {
    writeJson(
      response,
      200,
      appModule.validateRuleTemplate({
        projectKey: url.searchParams.get('projectKey') ?? 'aimetric',
        version: url.searchParams.get('version') ?? undefined,
      }),
    );
    return;
  }

  if (method === 'POST' && url.pathname === '/rules/active') {
    if (!isAuthorizedAdminRequest(request, runtime.adminToken)) {
      writeJson(response, 401, { message: 'Unauthorized admin request' });
      return;
    }

    try {
      const body = await readJsonBody(request);
      const payload = body as Record<string, unknown>;

      if (typeof payload.version !== 'string') {
        writeJson(response, 400, { message: 'version is required' });
        return;
      }

      const result = appModule.setActiveRuleVersion({
          projectKey:
            typeof payload.projectKey === 'string'
              ? payload.projectKey
              : 'aimetric',
          version: payload.version,
        });
      recordAdminAudit(runtime, request, 'rules.active.set');
      writeJson(response, 200, result);
    } catch {
      writeJson(response, 400, { message: 'Invalid rule activation request' });
    }
    return;
  }

  if (method === 'GET' && url.pathname === '/rules/rollout') {
    writeJson(
      response,
      200,
      appModule.getRuleRollout(url.searchParams.get('projectKey') ?? 'aimetric'),
    );
    return;
  }

  if (method === 'GET' && url.pathname === '/rules/rollout/evaluate') {
    writeJson(
      response,
      200,
      appModule.evaluateRuleRollout({
        projectKey: url.searchParams.get('projectKey') ?? 'aimetric',
        memberId: url.searchParams.get('memberId') ?? undefined,
      }),
    );
    return;
  }

  if (method === 'POST' && url.pathname === '/rules/rollout') {
    if (!isAuthorizedAdminRequest(request, runtime.adminToken)) {
      writeJson(response, 401, { message: 'Unauthorized admin request' });
      return;
    }

    try {
      const body = await readJsonBody(request);
      const payload = body as Record<string, unknown>;

      if (typeof payload.enabled !== 'boolean') {
        writeJson(response, 400, { message: 'enabled is required' });
        return;
      }

      const result = appModule.setRuleRollout({
          projectKey:
            typeof payload.projectKey === 'string'
              ? payload.projectKey
              : 'aimetric',
          enabled: payload.enabled,
          candidateVersion:
            typeof payload.candidateVersion === 'string'
              ? payload.candidateVersion
              : undefined,
          percentage:
            typeof payload.percentage === 'number'
              ? payload.percentage
              : undefined,
          includedMembers: Array.isArray(payload.includedMembers)
            ? payload.includedMembers.filter(
                (member): member is string => typeof member === 'string',
              )
            : [],
        });
      recordAdminAudit(runtime, request, 'rules.rollout.set');
      writeJson(response, 200, result);
    } catch {
      writeJson(response, 400, { message: 'Invalid rule rollout request' });
    }
    return;
  }

  if (method === 'GET' && url.pathname === '/knowledge/search') {
    writeJson(
      response,
      200,
      await appModule.searchKnowledge({
        query: url.searchParams.get('query') ?? '',
        limit: Number(url.searchParams.get('limit') ?? 5),
      }),
    );
    return;
  }

  if (method === 'POST' && url.pathname === '/metrics/recalculate') {
    if (!isAuthorizedAdminRequest(request, runtime.adminToken)) {
      writeJson(response, 401, { message: 'Unauthorized admin request' });
      return;
    }

    try {
      const body = await readJsonBody(request);

      const result = await appModule.recalculateMetricSnapshots(
        getMetricSnapshotFiltersFromBody(body),
      );
      recordAdminAudit(runtime, request, 'metrics.recalculate');
      writeJson(response, 200, result);
    } catch {
      writeJson(response, 400, { message: 'Invalid recalculation request' });
    }
    return;
  }

  if (method === 'POST' && url.pathname === '/enterprise-metrics/recalculate') {
    if (!isAuthorizedAdminRequest(request, runtime.adminToken)) {
      writeJson(response, 401, { message: 'Unauthorized admin request' });
      return;
    }

    try {
      const body = await readJsonBody(request);
      const filters = getMetricSnapshotFiltersFromBody(body);

      const result = await appModule.recalculateEnterpriseMetricSnapshots(
        filters,
        {
          metricKeys: filters.metricKeys,
        },
      );
      recordAdminAudit(runtime, request, 'enterprise-metrics.recalculate');
      writeJson(response, 200, result);
    } catch {
      writeJson(response, 400, {
        message: 'Invalid enterprise metric recalculation request',
      });
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

  if (method === 'POST' && url.pathname === '/governance/collector-identities/register') {
    const body = await readJsonBody(request);
    const registrationInput = getCollectorIdentityInputFromBody(body);

    if (!registrationInput) {
      writeJson(response, 400, {
        message:
          'identityKey, memberId, projectKey, repoName, and toolProfile are required',
      });
      return;
    }

    try {
      writeJson(
        response,
        200,
        await appModule.registerCollectorIdentity(registrationInput),
      );
    } catch (error) {
      writeJson(response, 400, {
        message:
          error instanceof Error ? error.message : 'Failed to register collector identity',
      });
    }
    return;
  }

  if (method === 'POST' && url.pathname === '/governance/viewer-scopes') {
    if (!isAuthorizedAdminRequest(request, runtime.adminToken)) {
      writeJson(response, 401, { message: 'Unauthorized admin request' });
      return;
    }

    const body = await readJsonBody(request);
    const assignmentInput = getViewerScopeAssignmentInputFromBody(body);

    if (!assignmentInput) {
      writeJson(response, 400, {
        message: 'viewerId, teamKeys, and projectKeys are required',
      });
      return;
    }

    writeJson(response, 200, await appModule.replaceViewerScopeAssignment(assignmentInput));
    recordAdminAudit(runtime, request, 'governance.viewer-scopes.update');
    return;
  }

  if (method === 'GET' && url.pathname === '/admin/audit') {
    if (!isAuthorizedAdminRequest(request, runtime.adminToken)) {
      writeJson(response, 401, { message: 'Unauthorized admin request' });
      return;
    }

    writeJson(response, 200, runtime.adminAuditEvents);
    return;
  }

  writeJson(response, 404, { message: 'Not Found' });
};

const isAuthorizedAdminRequest = (
  request: IncomingMessage,
  adminToken?: string,
): boolean => {
  if (!adminToken) {
    return true;
  }

  const authorization = request.headers.authorization;
  const token =
    typeof authorization === 'string' && authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : '';

  return compareTokens(token, adminToken);
};

const compareTokens = (candidate: string, expected: string): boolean => {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);

  return (
    candidateBuffer.length === expectedBuffer.length &&
    timingSafeEqual(candidateBuffer, expectedBuffer)
  );
};

const recordAdminAudit = (
  runtime: {
    adminAuditEvents: AdminAuditEvent[];
    now: () => string;
  },
  request: IncomingMessage,
  action: string,
): void => {
  runtime.adminAuditEvents.push({
    action,
    actor: readAdminActor(request),
    occurredAt: runtime.now(),
    status: 'success',
  });
};

const readAdminActor = (request: IncomingMessage): string => {
  const actor = request.headers['x-aimetric-actor'];
  return typeof actor === 'string' && actor.length > 0 ? actor : 'admin';
};

export async function bootstrap(
  options: BootstrapOptions = {},
): Promise<MetricPlatformServer> {
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? 3001;
  const adminToken = options.adminToken ?? process.env.METRIC_PLATFORM_ADMIN_TOKEN;
  const appModule = new AppModule(options.metricEventRepository, {
    ruleCatalogRoot: options.ruleCatalogRoot,
    docsRoot: options.docsRoot,
  });
  let snapshotScheduler: SnapshotRecalculationScheduler | undefined;
  const runtime = {
    adminToken,
    adminAuditEvents: [] as AdminAuditEvent[],
    startedAt: Date.now(),
    requestCount: 0,
    now: () => new Date().toISOString(),
  };

  const server = createServer((request, response) => {
    void handleRequest(request, response, appModule, runtime);
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
