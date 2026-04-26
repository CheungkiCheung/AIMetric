import { timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { pathToFileURL } from 'node:url';
import { IngestionBatchSchema } from '@aimetric/event-schema';
import type { EnterpriseMetricDimensionKey } from '@aimetric/metric-core';
import { AppModule } from './app.module.js';
import type {
  CiRunRecord,
  CollectorIdentityRecord,
  DefectRecord,
  DeploymentRecord,
  EditEvidenceFilters,
  IncidentRecord,
  MetricEventRepository,
  MetricSnapshotFilters,
  PullRequestRecord,
  RequirementRecord,
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
  adminTokenRequired?: boolean;
  collectorToken?: string;
  collectorTokenRequired?: boolean;
  metricEventRepository?: MetricEventRepository;
  maxRequestBodyBytes?: number;
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

class HttpBodyTooLargeError extends Error {
  constructor(readonly limitBytes: number) {
    super(`Request body exceeds ${limitBytes} bytes`);
  }
}

const defaultMaxRequestBodyBytes = 1_048_576;

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

const writeJsonBodyError = (
  response: ServerResponse,
  error: unknown,
  fallbackMessage: string,
): void => {
  if (error instanceof HttpBodyTooLargeError) {
    writeJson(response, 413, { message: 'Request body is too large' });
    return;
  }

  writeJson(response, 400, { message: fallbackMessage });
};

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

const getPullRequestsFromBody = (body: unknown): PullRequestRecord[] | undefined => {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  const pullRequests = (body as Record<string, unknown>).pullRequests;

  if (!Array.isArray(pullRequests)) {
    return undefined;
  }

  const normalized = pullRequests.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }

    const payload = item as Record<string, unknown>;

    if (
      (payload.provider !== 'github' && payload.provider !== 'gitlab') ||
      typeof payload.projectKey !== 'string' ||
      typeof payload.repoName !== 'string' ||
      typeof payload.prNumber !== 'number' ||
      typeof payload.title !== 'string' ||
      typeof payload.state !== 'string' ||
      typeof payload.aiTouched !== 'boolean' ||
      typeof payload.createdAt !== 'string' ||
      typeof payload.updatedAt !== 'string'
    ) {
      return [];
    }

    return [
      {
        provider: payload.provider as PullRequestRecord['provider'],
        projectKey: payload.projectKey,
        repoName: payload.repoName,
        prNumber: payload.prNumber,
        title: payload.title,
        ...(typeof payload.authorMemberId === 'string'
          ? { authorMemberId: payload.authorMemberId }
          : {}),
        state: payload.state as PullRequestRecord['state'],
        aiTouched: payload.aiTouched,
        ...(typeof payload.reviewDecision === 'string'
          ? { reviewDecision: payload.reviewDecision as PullRequestRecord['reviewDecision'] }
          : {}),
        ...(Array.isArray(payload.linkedRequirementKeys) &&
        payload.linkedRequirementKeys.every((value) => typeof value === 'string')
          ? {
              linkedRequirementKeys: [
                ...new Set(payload.linkedRequirementKeys as string[]),
              ],
            }
          : {}),
        createdAt: payload.createdAt,
        ...(typeof payload.mergedAt === 'string' ? { mergedAt: payload.mergedAt } : {}),
        updatedAt: payload.updatedAt,
      },
    ];
  });

  return normalized.length === pullRequests.length ? normalized : undefined;
};

const getRequirementsFromBody = (body: unknown): RequirementRecord[] | undefined => {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  const requirements = (body as Record<string, unknown>).requirements;

  if (!Array.isArray(requirements)) {
    return undefined;
  }

  const normalized = requirements.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }

    const payload = item as Record<string, unknown>;

    if (
      (payload.provider !== 'jira' && payload.provider !== 'tapd') ||
      typeof payload.projectKey !== 'string' ||
      typeof payload.requirementKey !== 'string' ||
      typeof payload.title !== 'string' ||
      typeof payload.status !== 'string' ||
      typeof payload.aiTouched !== 'boolean' ||
      typeof payload.createdAt !== 'string' ||
      typeof payload.updatedAt !== 'string'
    ) {
      return [];
    }

    return [
      {
        provider: payload.provider as RequirementRecord['provider'],
        projectKey: payload.projectKey,
        requirementKey: payload.requirementKey,
        title: payload.title,
        ...(typeof payload.ownerMemberId === 'string'
          ? { ownerMemberId: payload.ownerMemberId }
          : {}),
        ...(typeof payload.priority === 'string'
          ? { priority: payload.priority as RequirementRecord['priority'] }
          : {}),
        status: payload.status as RequirementRecord['status'],
        aiTouched: payload.aiTouched,
        ...(typeof payload.firstPrCreatedAt === 'string'
          ? { firstPrCreatedAt: payload.firstPrCreatedAt }
          : {}),
        ...(typeof payload.completedAt === 'string'
          ? { completedAt: payload.completedAt }
          : {}),
        ...(typeof payload.releasedAt === 'string'
          ? { releasedAt: payload.releasedAt }
          : {}),
        createdAt: payload.createdAt,
        updatedAt: payload.updatedAt,
      },
    ];
  });

  return normalized.length === requirements.length ? normalized : undefined;
};

const getCiRunsFromBody = (body: unknown): CiRunRecord[] | undefined => {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  const ciRuns = (body as Record<string, unknown>).ciRuns;

  if (!Array.isArray(ciRuns)) {
    return undefined;
  }

  const normalized = ciRuns.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }

    const payload = item as Record<string, unknown>;

    if (
      (payload.provider !== 'github-actions' && payload.provider !== 'gitlab-ci') ||
      typeof payload.projectKey !== 'string' ||
      typeof payload.repoName !== 'string' ||
      typeof payload.runId !== 'number' ||
      typeof payload.workflowName !== 'string' ||
      typeof payload.status !== 'string' ||
      typeof payload.createdAt !== 'string' ||
      typeof payload.updatedAt !== 'string'
    ) {
      return [];
    }

    return [
      {
        provider: payload.provider as CiRunRecord['provider'],
        projectKey: payload.projectKey,
        repoName: payload.repoName,
        runId: payload.runId,
        workflowName: payload.workflowName,
        status: payload.status as CiRunRecord['status'],
        ...(typeof payload.conclusion === 'string'
          ? { conclusion: payload.conclusion as CiRunRecord['conclusion'] }
          : {}),
        createdAt: payload.createdAt,
        ...(typeof payload.completedAt === 'string'
          ? { completedAt: payload.completedAt }
          : {}),
        updatedAt: payload.updatedAt,
      },
    ];
  });

  return normalized.length === ciRuns.length ? normalized : undefined;
};

const getDeploymentsFromBody = (body: unknown): DeploymentRecord[] | undefined => {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  const deployments = (body as Record<string, unknown>).deployments;

  if (!Array.isArray(deployments)) {
    return undefined;
  }

  const normalized = deployments.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }

    const payload = item as Record<string, unknown>;

    if (
      (payload.provider !== 'github-actions' && payload.provider !== 'argo-cd') ||
      typeof payload.projectKey !== 'string' ||
      typeof payload.repoName !== 'string' ||
      typeof payload.deploymentId !== 'string' ||
      typeof payload.environment !== 'string' ||
      typeof payload.status !== 'string' ||
      typeof payload.aiTouched !== 'boolean' ||
      typeof payload.rolledBack !== 'boolean' ||
      typeof payload.createdAt !== 'string' ||
      typeof payload.updatedAt !== 'string'
    ) {
      return [];
    }

    return [
      {
        provider: payload.provider as DeploymentRecord['provider'],
        projectKey: payload.projectKey,
        repoName: payload.repoName,
        deploymentId: payload.deploymentId,
        environment: payload.environment as DeploymentRecord['environment'],
        status: payload.status as DeploymentRecord['status'],
        aiTouched: payload.aiTouched,
        rolledBack: payload.rolledBack,
        ...(typeof payload.incidentKey === 'string'
          ? { incidentKey: payload.incidentKey }
          : {}),
        createdAt: payload.createdAt,
        ...(typeof payload.finishedAt === 'string'
          ? { finishedAt: payload.finishedAt }
          : {}),
        updatedAt: payload.updatedAt,
      },
    ];
  });

  return normalized.length === deployments.length ? normalized : undefined;
};

const getIncidentsFromBody = (body: unknown): IncidentRecord[] | undefined => {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  const incidents = (body as Record<string, unknown>).incidents;

  if (!Array.isArray(incidents)) {
    return undefined;
  }

  const normalized = incidents.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }

    const payload = item as Record<string, unknown>;

    if (
      (payload.provider !== 'pagerduty' &&
        payload.provider !== 'sentry' &&
        payload.provider !== 'manual') ||
      typeof payload.projectKey !== 'string' ||
      typeof payload.incidentKey !== 'string' ||
      typeof payload.title !== 'string' ||
      typeof payload.severity !== 'string' ||
      typeof payload.status !== 'string' ||
      !Array.isArray(payload.linkedDeploymentIds) ||
      payload.linkedDeploymentIds.some((value) => typeof value !== 'string') ||
      typeof payload.createdAt !== 'string' ||
      typeof payload.updatedAt !== 'string'
    ) {
      return [];
    }

    return [
      {
        provider: payload.provider as IncidentRecord['provider'],
        projectKey: payload.projectKey,
        incidentKey: payload.incidentKey,
        title: payload.title,
        severity: payload.severity as IncidentRecord['severity'],
        status: payload.status as IncidentRecord['status'],
        linkedDeploymentIds: [...new Set(payload.linkedDeploymentIds as string[])],
        createdAt: payload.createdAt,
        ...(typeof payload.resolvedAt === 'string'
          ? { resolvedAt: payload.resolvedAt }
          : {}),
        updatedAt: payload.updatedAt,
      },
    ];
  });

  return normalized.length === incidents.length ? normalized : undefined;
};

const getDefectsFromBody = (body: unknown): DefectRecord[] | undefined => {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  const defects = (body as Record<string, unknown>).defects;

  if (!Array.isArray(defects)) {
    return undefined;
  }

  const normalized = defects.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }

    const payload = item as Record<string, unknown>;

    if (
      (payload.provider !== 'jira' &&
        payload.provider !== 'tapd' &&
        payload.provider !== 'bugzilla' &&
        payload.provider !== 'manual') ||
      typeof payload.projectKey !== 'string' ||
      typeof payload.defectKey !== 'string' ||
      typeof payload.title !== 'string' ||
      typeof payload.severity !== 'string' ||
      typeof payload.status !== 'string' ||
      typeof payload.foundInPhase !== 'string' ||
      !Array.isArray(payload.linkedRequirementKeys) ||
      payload.linkedRequirementKeys.some((value) => typeof value !== 'string') ||
      !Array.isArray(payload.linkedPullRequestNumbers) ||
      payload.linkedPullRequestNumbers.some((value) => typeof value !== 'number') ||
      (payload.linkedDeploymentIds !== undefined &&
        (!Array.isArray(payload.linkedDeploymentIds) ||
          payload.linkedDeploymentIds.some((value) => typeof value !== 'string'))) ||
      (payload.linkedIncidentKeys !== undefined &&
        (!Array.isArray(payload.linkedIncidentKeys) ||
          payload.linkedIncidentKeys.some((value) => typeof value !== 'string'))) ||
      typeof payload.createdAt !== 'string' ||
      typeof payload.updatedAt !== 'string'
    ) {
      return [];
    }

    return [
      {
        provider: payload.provider as DefectRecord['provider'],
        projectKey: payload.projectKey,
        defectKey: payload.defectKey,
        title: payload.title,
        severity: payload.severity as DefectRecord['severity'],
        status: payload.status as DefectRecord['status'],
        foundInPhase: payload.foundInPhase as DefectRecord['foundInPhase'],
        linkedRequirementKeys: [...new Set(payload.linkedRequirementKeys as string[])],
        linkedPullRequestNumbers: [
          ...new Set(payload.linkedPullRequestNumbers as number[]),
        ],
        ...(Array.isArray(payload.linkedDeploymentIds)
          ? {
              linkedDeploymentIds: [
                ...new Set(payload.linkedDeploymentIds as string[]),
              ],
            }
          : {}),
        ...(Array.isArray(payload.linkedIncidentKeys)
          ? {
              linkedIncidentKeys: [
                ...new Set(payload.linkedIncidentKeys as string[]),
              ],
            }
          : {}),
        createdAt: payload.createdAt,
        ...(typeof payload.resolvedAt === 'string'
          ? { resolvedAt: payload.resolvedAt }
          : {}),
        updatedAt: payload.updatedAt,
      },
    ];
  });

  return normalized.length === defects.length ? normalized : undefined;
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
    collectorToken?: string;
    adminAuditEvents: AdminAuditEvent[];
    startedAt: number;
    requestCount: number;
    maxRequestBodyBytes: number;
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

  if (
    method === 'GET' &&
    (url.pathname === '/integrations/pull-requests' ||
      url.pathname === '/integrations/github/pull-requests')
  ) {
    const scoped = applyViewerScopeToFilters(
      getMetricSnapshotFilters(url),
      viewerScope,
    );

    if (scoped.denied) {
      writeJson(response, 403, { message: 'Project or member is outside viewer scope' });
      return;
    }

    writeJson(response, 200, await appModule.listPullRequests(scoped.filters));
    return;
  }

  if (
    method === 'GET' &&
    (url.pathname === '/integrations/pull-requests/summary' ||
      url.pathname === '/integrations/github/pull-requests/summary')
  ) {
    const scoped = applyViewerScopeToFilters(
      getMetricSnapshotFilters(url),
      viewerScope,
    );

    if (scoped.denied) {
      writeJson(response, 403, { message: 'Project or member is outside viewer scope' });
      return;
    }

    writeJson(response, 200, await appModule.buildPullRequestSummary(scoped.filters));
    return;
  }

  if (method === 'GET' && url.pathname === '/integrations/requirements') {
    const scoped = applyViewerScopeToFilters(
      getMetricSnapshotFilters(url),
      viewerScope,
    );

    if (scoped.denied) {
      writeJson(response, 403, { message: 'Project or member is outside viewer scope' });
      return;
    }

    writeJson(response, 200, await appModule.listRequirements(scoped.filters));
    return;
  }

  if (method === 'GET' && url.pathname === '/integrations/requirements/summary') {
    const scoped = applyViewerScopeToFilters(
      getMetricSnapshotFilters(url),
      viewerScope,
    );

    if (scoped.denied) {
      writeJson(response, 403, { message: 'Project or member is outside viewer scope' });
      return;
    }

    writeJson(response, 200, await appModule.buildRequirementSummary(scoped.filters));
    return;
  }

  if (method === 'GET' && url.pathname === '/integrations/ci/runs') {
    const scoped = applyViewerScopeToFilters(
      getMetricSnapshotFilters(url),
      viewerScope,
    );

    if (scoped.denied) {
      writeJson(response, 403, { message: 'Project or member is outside viewer scope' });
      return;
    }

    writeJson(response, 200, await appModule.listCiRuns(scoped.filters));
    return;
  }

  if (method === 'GET' && url.pathname === '/integrations/ci/runs/summary') {
    const scoped = applyViewerScopeToFilters(
      getMetricSnapshotFilters(url),
      viewerScope,
    );

    if (scoped.denied) {
      writeJson(response, 403, { message: 'Project or member is outside viewer scope' });
      return;
    }

    writeJson(response, 200, await appModule.buildCiRunSummary(scoped.filters));
    return;
  }

  if (method === 'GET' && url.pathname === '/integrations/deployments') {
    const scoped = applyViewerScopeToFilters(
      getMetricSnapshotFilters(url),
      viewerScope,
    );

    if (scoped.denied) {
      writeJson(response, 403, { message: 'Project or member is outside viewer scope' });
      return;
    }

    writeJson(response, 200, await appModule.listDeployments(scoped.filters));
    return;
  }

  if (method === 'GET' && url.pathname === '/integrations/deployments/summary') {
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
      await appModule.buildDeploymentSummary(scoped.filters),
    );
    return;
  }

  if (method === 'GET' && url.pathname === '/integrations/incidents') {
    const scoped = applyViewerScopeToFilters(
      getMetricSnapshotFilters(url),
      viewerScope,
    );

    if (scoped.denied) {
      writeJson(response, 403, { message: 'Project or member is outside viewer scope' });
      return;
    }

    writeJson(response, 200, await appModule.listIncidents(scoped.filters));
    return;
  }

  if (method === 'GET' && url.pathname === '/integrations/incidents/summary') {
    const scoped = applyViewerScopeToFilters(
      getMetricSnapshotFilters(url),
      viewerScope,
    );

    if (scoped.denied) {
      writeJson(response, 403, { message: 'Project or member is outside viewer scope' });
      return;
    }

    writeJson(response, 200, await appModule.buildIncidentSummary(scoped.filters));
    return;
  }

  if (method === 'GET' && url.pathname === '/integrations/defects') {
    const scoped = applyViewerScopeToFilters(
      getMetricSnapshotFilters(url),
      viewerScope,
    );

    if (scoped.denied) {
      writeJson(response, 403, { message: 'Project or member is outside viewer scope' });
      return;
    }

    writeJson(response, 200, await appModule.listDefects(scoped.filters));
    return;
  }

  if (method === 'GET' && url.pathname === '/integrations/defects/summary') {
    const scoped = applyViewerScopeToFilters(
      getMetricSnapshotFilters(url),
      viewerScope,
    );

    if (scoped.denied) {
      writeJson(response, 403, { message: 'Project or member is outside viewer scope' });
      return;
    }

    writeJson(response, 200, await appModule.buildDefectSummary(scoped.filters));
    return;
  }

  if (method === 'GET' && url.pathname === '/integrations/defects/attribution') {
    const scoped = applyViewerScopeToFilters(
      getMetricSnapshotFilters(url),
      viewerScope,
    );

    if (scoped.denied) {
      writeJson(response, 403, { message: 'Project or member is outside viewer scope' });
      return;
    }

    writeJson(response, 200, (await appModule.buildDefectAttribution(scoped.filters)).rows);
    return;
  }

  if (method === 'GET' && url.pathname === '/integrations/defects/attribution/summary') {
    const scoped = applyViewerScopeToFilters(
      getMetricSnapshotFilters(url),
      viewerScope,
    );

    if (scoped.denied) {
      writeJson(response, 403, { message: 'Project or member is outside viewer scope' });
      return;
    }

    writeJson(response, 200, (await appModule.buildDefectAttribution(scoped.filters)).summary);
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
      const body = await readJsonBody(request, runtime.maxRequestBodyBytes);
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
    } catch (error) {
      writeJsonBodyError(response, error, 'Invalid rule activation request');
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
      const body = await readJsonBody(request, runtime.maxRequestBodyBytes);
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
    } catch (error) {
      writeJsonBodyError(response, error, 'Invalid rule rollout request');
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
      const body = await readJsonBody(request, runtime.maxRequestBodyBytes);

      const result = await appModule.recalculateMetricSnapshots(
        getMetricSnapshotFiltersFromBody(body),
      );
      recordAdminAudit(runtime, request, 'metrics.recalculate');
      writeJson(response, 200, result);
    } catch (error) {
      writeJsonBodyError(response, error, 'Invalid recalculation request');
    }
    return;
  }

  if (method === 'POST' && url.pathname === '/enterprise-metrics/recalculate') {
    if (!isAuthorizedAdminRequest(request, runtime.adminToken)) {
      writeJson(response, 401, { message: 'Unauthorized admin request' });
      return;
    }

    try {
      const body = await readJsonBody(request, runtime.maxRequestBodyBytes);
      const filters = getMetricSnapshotFiltersFromBody(body);

      const result = await appModule.recalculateEnterpriseMetricSnapshots(
        filters,
        {
          metricKeys: filters.metricKeys,
        },
      );
      recordAdminAudit(runtime, request, 'enterprise-metrics.recalculate');
      writeJson(response, 200, result);
    } catch (error) {
      writeJsonBodyError(
        response,
        error,
        'Invalid enterprise metric recalculation request',
      );
    }
    return;
  }

  if (method === 'POST' && url.pathname === '/events/import') {
    if (!isAuthorizedTokenRequest(request, runtime.collectorToken)) {
      writeJson(response, 401, { message: 'Unauthorized ingestion batch' });
      return;
    }

    try {
      const body = await readJsonBody(request, runtime.maxRequestBodyBytes);
      const batch = IngestionBatchSchema.parse(body);

      writeJson(response, 200, await appModule.importEvents(batch));
    } catch (error) {
      if (error instanceof HttpBodyTooLargeError) {
        writeJson(response, 413, { message: 'Request body is too large' });
        return;
      }

      writeJson(response, 400, { message: 'Invalid ingestion batch' });
    }
    return;
  }

  try {
    if (method === 'POST' && url.pathname === '/governance/collector-identities/register') {
      const body = await readJsonBody(request, runtime.maxRequestBodyBytes);
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
  } catch (error) {
    writeJsonBodyError(
      response,
      error,
      'Invalid collector identity registration request',
    );
    return;
  }

  if (method === 'POST' && url.pathname === '/governance/viewer-scopes') {
    if (!isAuthorizedAdminRequest(request, runtime.adminToken)) {
      writeJson(response, 401, { message: 'Unauthorized admin request' });
      return;
    }

    const body = await readJsonBody(request, runtime.maxRequestBodyBytes);
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

  if (
    method === 'POST' &&
    (url.pathname === '/integrations/pull-requests/import' ||
      url.pathname === '/integrations/github/pull-requests/import')
  ) {
    if (!isAuthorizedAdminRequest(request, runtime.adminToken)) {
      writeJson(response, 401, { message: 'Unauthorized admin request' });
      return;
    }

    const body = await readJsonBody(request, runtime.maxRequestBodyBytes);
    const pullRequests = getPullRequestsFromBody(body);

    if (!pullRequests) {
      writeJson(response, 400, {
        message: 'pullRequests is required and must contain valid pull request records',
      });
      return;
    }

    writeJson(response, 200, await appModule.importPullRequests(pullRequests));
    recordAdminAudit(runtime, request, 'pull-requests.import');
    return;
  }

  if (method === 'POST' && url.pathname === '/integrations/requirements/import') {
    if (!isAuthorizedAdminRequest(request, runtime.adminToken)) {
      writeJson(response, 401, { message: 'Unauthorized admin request' });
      return;
    }

    const body = await readJsonBody(request, runtime.maxRequestBodyBytes);
    const requirements = getRequirementsFromBody(body);

    if (!requirements) {
      writeJson(response, 400, {
        message: 'requirements is required and must contain valid requirement records',
      });
      return;
    }

    writeJson(response, 200, await appModule.importRequirements(requirements));
    recordAdminAudit(runtime, request, 'requirements.import');
    return;
  }

  if (method === 'POST' && url.pathname === '/integrations/ci/runs/import') {
    if (!isAuthorizedAdminRequest(request, runtime.adminToken)) {
      writeJson(response, 401, { message: 'Unauthorized admin request' });
      return;
    }

    const body = await readJsonBody(request, runtime.maxRequestBodyBytes);
    const ciRuns = getCiRunsFromBody(body);

    if (!ciRuns) {
      writeJson(response, 400, {
        message: 'ciRuns is required and must contain valid CI run records',
      });
      return;
    }

    writeJson(response, 200, await appModule.importCiRuns(ciRuns));
    recordAdminAudit(runtime, request, 'ci-runs.import');
    return;
  }

  if (method === 'POST' && url.pathname === '/integrations/deployments/import') {
    if (!isAuthorizedAdminRequest(request, runtime.adminToken)) {
      writeJson(response, 401, { message: 'Unauthorized admin request' });
      return;
    }

    const body = await readJsonBody(request, runtime.maxRequestBodyBytes);
    const deployments = getDeploymentsFromBody(body);

    if (!deployments) {
      writeJson(response, 400, {
        message: 'deployments is required and must contain valid deployment records',
      });
      return;
    }

    writeJson(response, 200, await appModule.importDeployments(deployments));
    recordAdminAudit(runtime, request, 'deployments.import');
    return;
  }

  if (method === 'POST' && url.pathname === '/integrations/incidents/import') {
    if (!isAuthorizedAdminRequest(request, runtime.adminToken)) {
      writeJson(response, 401, { message: 'Unauthorized admin request' });
      return;
    }

    const body = await readJsonBody(request, runtime.maxRequestBodyBytes);
    const incidents = getIncidentsFromBody(body);

    if (!incidents) {
      writeJson(response, 400, {
        message: 'incidents is required and must contain valid incident records',
      });
      return;
    }

    writeJson(response, 200, await appModule.importIncidents(incidents));
    recordAdminAudit(runtime, request, 'incidents.import');
    return;
  }

  if (method === 'POST' && url.pathname === '/integrations/defects/import') {
    if (!isAuthorizedAdminRequest(request, runtime.adminToken)) {
      writeJson(response, 401, { message: 'Unauthorized admin request' });
      return;
    }

    const body = await readJsonBody(request, runtime.maxRequestBodyBytes);
    const defects = getDefectsFromBody(body);

    if (!defects) {
      writeJson(response, 400, {
        message: 'defects is required and must contain valid defect records',
      });
      return;
    }

    writeJson(response, 200, await appModule.importDefects(defects));
    recordAdminAudit(runtime, request, 'defects.import');
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
  return isAuthorizedTokenRequest(request, adminToken);
};

const isAuthorizedTokenRequest = (
  request: IncomingMessage,
  expectedToken?: string,
): boolean => {
  if (!expectedToken) {
    return true;
  }
  const authorization = request.headers.authorization;
  const token =
    typeof authorization === 'string' && authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : '';

  return compareTokens(token, expectedToken);
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
  const collectorToken =
    options.collectorToken ??
    process.env.METRIC_PLATFORM_COLLECTOR_TOKEN ??
    process.env.AIMETRIC_COLLECTOR_TOKEN;
  const adminTokenRequired =
    options.adminTokenRequired ?? isProductionRuntime();
  const collectorTokenRequired =
    options.collectorTokenRequired ?? isProductionRuntime();

  if (adminTokenRequired && !adminToken) {
    throw new Error('METRIC_PLATFORM_ADMIN_TOKEN is required');
  }

  if (collectorTokenRequired && !collectorToken) {
    throw new Error('METRIC_PLATFORM_COLLECTOR_TOKEN is required');
  }

  const appModule = new AppModule(options.metricEventRepository, {
    ruleCatalogRoot: options.ruleCatalogRoot,
    docsRoot: options.docsRoot,
  });
  let snapshotScheduler: SnapshotRecalculationScheduler | undefined;
  const runtime = {
    adminToken,
    collectorToken,
    adminAuditEvents: [] as AdminAuditEvent[],
    startedAt: Date.now(),
    requestCount: 0,
    maxRequestBodyBytes: options.maxRequestBodyBytes ?? defaultMaxRequestBodyBytes,
    now: () => new Date().toISOString(),
  };

  const server = createServer((request, response) => {
    void handleRequest(request, response, appModule, runtime).catch((error) => {
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

const isProductionRuntime = (): boolean =>
  process.env.NODE_ENV === 'production' ||
  process.env.AIMETRIC_REQUIRE_AUTH === 'true';

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
