import type { IngestionBatch } from '@aimetric/event-schema';
import {
  calculateAiOutputRate,
  calculateEnterpriseMetrics,
  getEnterpriseMetricCatalog,
  listEnterpriseMetricsByDimension,
  type EnterpriseMetricDimensionKey,
  type MetricCalculationResult,
} from '@aimetric/metric-core';
import {
  PostgresMetricEventRepository,
  type CollectorIdentityRecord,
  type DefectRecord,
  type DefectSummary,
  type EditEvidenceFilters,
  type MetricEventRepository,
  type MetricSnapshotRecord,
  type MetricSnapshotFilters,
  type PullRequestRecord,
  type PullRequestSummary,
  type CiRunRecord,
  type CiRunSummary,
  type DeploymentRecord,
  type DeploymentSummary,
  type IncidentRecord,
  type IncidentSummary,
  type RequirementRecord,
  type RequirementSummary,
  type RecordedMetricEvent,
  type ViewerScopeAssignmentRecord,
} from './database/postgres-event.repository.js';
import { GovernanceDirectoryService } from './governance/governance-directory.service.js';
import {
  buildGovernanceViewerScope,
  filterGovernanceDirectoryByViewerScope,
  type GovernanceViewerScopeAssignment,
  type GovernanceViewerScope,
} from './governance/governance-directory.service.js';
import { KnowledgeSearchService } from './knowledge/knowledge-search.service.js';
import { MetricsController } from './metrics/metrics.controller.js';
import { MetricsService } from './metrics/metrics.service.js';
import { RuleCenterService } from './rules/rule-center.service.js';

export class AppModule {
  readonly metricsController: MetricsController;
  readonly metricEventRepository: MetricEventRepository;
  readonly ruleCenterService: RuleCenterService;
  readonly knowledgeSearchService: KnowledgeSearchService;
  readonly governanceDirectoryService: GovernanceDirectoryService;

  constructor(
    metricEventRepository: MetricEventRepository =
      new PostgresMetricEventRepository(),
    options: {
      ruleCatalogRoot?: string;
      docsRoot?: string;
    } = {},
  ) {
    this.metricEventRepository = metricEventRepository;
    const metricsService = new MetricsService();
    this.metricsController = new MetricsController(metricsService);
    this.ruleCenterService = new RuleCenterService({
      catalogRoot: options.ruleCatalogRoot,
    });
    this.knowledgeSearchService = new KnowledgeSearchService(options.docsRoot);
    this.governanceDirectoryService = new GovernanceDirectoryService();
  }

  async importEvents(batch: IngestionBatch) {
    await this.metricEventRepository.saveIngestionBatch(batch);

    return {
      imported: batch.events.length,
      schemaVersion: batch.schemaVersion,
    };
  }

  async close() {
    await this.metricEventRepository.disconnect();
  }

  async buildPersonalSnapshot(filters?: MetricSnapshotFilters) {
    const recordedMetricEvents =
      await this.metricEventRepository.listRecordedMetricEvents(filters);
    const personalEvent = recordedMetricEvents[0];

    if (!personalEvent) {
      return this.metricsController.buildPersonalSnapshot({
        acceptedAiLines: 0,
        commitTotalLines: 0,
        sessionCount: 0,
      });
    }

    return this.metricsController.buildPersonalSnapshot({
      acceptedAiLines: personalEvent.acceptedAiLines,
      commitTotalLines: personalEvent.commitTotalLines,
      sessionCount: personalEvent.sessionCount,
    });
  }

  async buildTeamSnapshot(filters?: MetricSnapshotFilters) {
    const recordedMetricEvents =
      await this.metricEventRepository.listRecordedMetricEvents(filters);

    return this.metricsController.buildTeamSnapshot({
      members: recordedMetricEvents,
    });
  }

  async recalculateMetricSnapshots(filters: MetricSnapshotFilters = {}) {
    const recordedMetricEvents =
      await this.metricEventRepository.listRecordedMetricEvents(filters);
    const snapshots = buildMetricSnapshots(recordedMetricEvents, filters);

    await this.metricEventRepository.saveMetricSnapshots(snapshots);

    return {
      upsertedSnapshots: snapshots.length,
      snapshots,
    };
  }

  listMetricSnapshots(filters: MetricSnapshotFilters = {}) {
    return this.metricEventRepository.listMetricSnapshots(filters);
  }

  async recalculateEnterpriseMetricSnapshots(
    filters: MetricSnapshotFilters = {},
    options: {
      metricKeys?: string[];
      calculatedAt?: string;
    } = {},
  ) {
    const snapshots = await this.calculateEnterpriseMetricValues(filters, options);

    if (!this.metricEventRepository.saveEnterpriseMetricSnapshots) {
      throw new Error('Enterprise metric snapshot writer is not configured');
    }

    await this.metricEventRepository.saveEnterpriseMetricSnapshots(snapshots);

    return {
      upsertedSnapshots: snapshots.length,
      snapshots,
    };
  }

  listEnterpriseMetricSnapshots(filters: MetricSnapshotFilters = {}) {
    if (!this.metricEventRepository.listEnterpriseMetricSnapshots) {
      return [];
    }

    return this.metricEventRepository.listEnterpriseMetricSnapshots(filters);
  }

  buildMcpAuditMetrics(filters: MetricSnapshotFilters = {}) {
    return this.metricEventRepository.buildMcpAuditMetrics(filters);
  }

  listEditSpanEvidence(filters: EditEvidenceFilters = {}) {
    return this.metricEventRepository.listEditSpanEvidence(filters);
  }

  listTabAcceptedEvents(filters: EditEvidenceFilters = {}) {
    return this.metricEventRepository.listTabAcceptedEvents(filters);
  }

  async buildAnalysisSummary(filters: MetricSnapshotFilters = {}) {
    return (
      (await this.metricEventRepository.buildAnalysisSummary?.(filters)) ?? {
        sessionCount: 0,
        editSpanCount: 0,
        tabAcceptedCount: 0,
        tabAcceptedLines: 0,
      }
    );
  }

  async listSessionAnalysisRows(filters: MetricSnapshotFilters = {}) {
    return (await this.metricEventRepository.listSessionAnalysisRows?.(filters)) ?? [];
  }

  async listOutputAnalysisRows(filters: MetricSnapshotFilters = {}) {
    return (await this.metricEventRepository.listOutputAnalysisRows?.(filters)) ?? [];
  }

  async importPullRequests(pullRequests: PullRequestRecord[]) {
    if (!this.metricEventRepository.importPullRequests) {
      throw new Error('Pull request import is not configured');
    }

    await this.metricEventRepository.importPullRequests(pullRequests);

    return {
      importedPullRequests: pullRequests.length,
    };
  }

  async listPullRequests(filters: MetricSnapshotFilters = {}) {
    return (await this.metricEventRepository.listPullRequests?.(filters)) ?? [];
  }

  async buildPullRequestSummary(
    filters: MetricSnapshotFilters = {},
  ): Promise<PullRequestSummary> {
    return (
      (await this.metricEventRepository.buildPullRequestSummary?.(filters)) ?? {
        totalPrCount: 0,
        aiTouchedPrCount: 0,
        aiTouchedPrRatio: 0,
        mergedPrCount: 0,
        averageCycleTimeHours: 0,
      }
    );
  }

  async importRequirements(requirements: RequirementRecord[]) {
    if (!this.metricEventRepository.importRequirements) {
      throw new Error('Requirement import is not configured');
    }

    await this.metricEventRepository.importRequirements(requirements);

    return {
      importedRequirements: requirements.length,
    };
  }

  async listRequirements(filters: MetricSnapshotFilters = {}) {
    return (await this.metricEventRepository.listRequirements?.(filters)) ?? [];
  }

  async buildRequirementSummary(
    filters: MetricSnapshotFilters = {},
  ): Promise<RequirementSummary> {
    return (
      (await this.metricEventRepository.buildRequirementSummary?.(filters)) ?? {
        totalRequirementCount: 0,
        aiTouchedRequirementCount: 0,
        aiTouchedRequirementRatio: 0,
        completedRequirementCount: 0,
        averageLeadTimeHours: 0,
        averageLeadTimeToFirstPrHours: 0,
      }
    );
  }

  async importCiRuns(ciRuns: CiRunRecord[]) {
    if (!this.metricEventRepository.importCiRuns) {
      throw new Error('CI run import is not configured');
    }

    await this.metricEventRepository.importCiRuns(ciRuns);

    return {
      importedCiRuns: ciRuns.length,
    };
  }

  async listCiRuns(filters: MetricSnapshotFilters = {}) {
    return (await this.metricEventRepository.listCiRuns?.(filters)) ?? [];
  }

  async buildCiRunSummary(
    filters: MetricSnapshotFilters = {},
  ): Promise<CiRunSummary> {
    return (
      (await this.metricEventRepository.buildCiRunSummary?.(filters)) ?? {
        totalRunCount: 0,
        completedRunCount: 0,
        successfulRunCount: 0,
        failedRunCount: 0,
        passRate: 0,
        averageDurationMinutes: 0,
      }
    );
  }

  async importDeployments(deployments: DeploymentRecord[]) {
    if (!this.metricEventRepository.importDeployments) {
      throw new Error('Deployment import is not configured');
    }

    await this.metricEventRepository.importDeployments(deployments);

    return {
      importedDeployments: deployments.length,
    };
  }

  async listDeployments(filters: MetricSnapshotFilters = {}) {
    return (await this.metricEventRepository.listDeployments?.(filters)) ?? [];
  }

  async buildDeploymentSummary(
    filters: MetricSnapshotFilters = {},
  ): Promise<DeploymentSummary> {
    return (
      (await this.metricEventRepository.buildDeploymentSummary?.(filters)) ?? {
        totalDeploymentCount: 0,
        successfulDeploymentCount: 0,
        failedDeploymentCount: 0,
        rolledBackDeploymentCount: 0,
        aiTouchedDeploymentCount: 0,
        changeFailureRate: 0,
        rollbackRate: 0,
        averageDurationMinutes: 0,
      }
    );
  }

  async importIncidents(incidents: IncidentRecord[]) {
    if (!this.metricEventRepository.importIncidents) {
      throw new Error('Incident import is not configured');
    }

    await this.metricEventRepository.importIncidents(incidents);

    return {
      importedIncidents: incidents.length,
    };
  }

  async listIncidents(filters: MetricSnapshotFilters = {}) {
    return (await this.metricEventRepository.listIncidents?.(filters)) ?? [];
  }

  async buildIncidentSummary(
    filters: MetricSnapshotFilters = {},
  ): Promise<IncidentSummary> {
    return (
      (await this.metricEventRepository.buildIncidentSummary?.(filters)) ?? {
        totalIncidentCount: 0,
        openIncidentCount: 0,
        resolvedIncidentCount: 0,
        linkedDeploymentCount: 0,
        averageResolutionHours: 0,
      }
    );
  }

  async importDefects(defects: DefectRecord[]) {
    if (!this.metricEventRepository.importDefects) {
      throw new Error('Defect import is not configured');
    }

    await this.metricEventRepository.importDefects(defects);

    return {
      importedDefects: defects.length,
    };
  }

  async listDefects(filters: MetricSnapshotFilters = {}) {
    return (await this.metricEventRepository.listDefects?.(filters)) ?? [];
  }

  async buildDefectSummary(
    filters: MetricSnapshotFilters = {},
  ): Promise<DefectSummary> {
    return (
      (await this.metricEventRepository.buildDefectSummary?.(filters)) ?? {
        totalDefectCount: 0,
        openDefectCount: 0,
        resolvedDefectCount: 0,
        productionDefectCount: 0,
        averageResolutionHours: 0,
      }
    );
  }

  async buildDefectAttribution(filters: MetricSnapshotFilters = {}) {
    const [defects, requirements, pullRequests] = await Promise.all([
      this.listDefects(filters),
      this.listRequirements(filters),
      this.listPullRequests(filters),
    ]);

    const aiTouchedRequirementKeys = new Set(
      requirements
        .filter((requirement) => requirement.aiTouched)
        .map((requirement) => requirement.requirementKey),
    );
    const aiTouchedPullRequestNumbers = new Set(
      pullRequests
        .filter((pullRequest) => pullRequest.aiTouched)
        .map((pullRequest) => pullRequest.prNumber),
    );
    const aiTouchedRequirementCount = aiTouchedRequirementKeys.size;
    const aiTouchedPullRequestCount = aiTouchedPullRequestNumbers.size;

    const rows = defects.map((defect) => {
      const aiTouchedRequirement = defect.linkedRequirementKeys.some((requirementKey) =>
        aiTouchedRequirementKeys.has(requirementKey),
      );
      const aiTouchedPullRequest = defect.linkedPullRequestNumbers.some((prNumber) =>
        aiTouchedPullRequestNumbers.has(prNumber),
      );

      return {
        defectKey: defect.defectKey,
        title: defect.title,
        projectKey: defect.projectKey,
        severity: defect.severity,
        status: defect.status,
        foundInPhase: defect.foundInPhase,
        linkedRequirementKeys: defect.linkedRequirementKeys,
        linkedPullRequestNumbers: defect.linkedPullRequestNumbers,
        ...(defect.linkedDeploymentIds
          ? { linkedDeploymentIds: defect.linkedDeploymentIds }
          : {}),
        ...(defect.linkedIncidentKeys
          ? { linkedIncidentKeys: defect.linkedIncidentKeys }
          : {}),
        aiTouchedRequirement,
        aiTouchedPullRequest,
        createdAt: defect.createdAt,
        ...(defect.resolvedAt ? { resolvedAt: defect.resolvedAt } : {}),
      };
    });
    const aiTouchedRequirementDefectCount = rows.filter(
      (row) => row.aiTouchedRequirement,
    ).length;
    const aiTouchedPullRequestDefectCount = rows.filter(
      (row) => row.aiTouchedPullRequest,
    ).length;
    const escapedAiTouchedPullRequestDefectCount = rows.filter(
      (row) => row.aiTouchedPullRequest && row.foundInPhase === 'production',
    ).length;

    return {
      summary: {
        totalDefectCount: rows.length,
        aiTouchedRequirementDefectCount,
        aiTouchedRequirementDefectRate:
          aiTouchedRequirementCount === 0
            ? 0
            : aiTouchedRequirementDefectCount / aiTouchedRequirementCount,
        aiTouchedPullRequestDefectCount,
        escapedAiTouchedPullRequestDefectCount,
        escapedAiTouchedPullRequestDefectRate:
          aiTouchedPullRequestCount === 0
            ? 0
            : escapedAiTouchedPullRequestDefectCount / aiTouchedPullRequestCount,
        productionDefectCount: rows.filter((row) => row.foundInPhase === 'production').length,
        failedDeploymentLinkedDefectCount: rows.filter(
          (row) => (row.linkedDeploymentIds?.length ?? 0) > 0,
        ).length,
        incidentLinkedDefectCount: rows.filter(
          (row) => (row.linkedIncidentKeys?.length ?? 0) > 0,
        ).length,
      },
      rows,
    };
  }

  getEnterpriseMetricCatalog() {
    return getEnterpriseMetricCatalog();
  }

  async getOrganizationDirectory() {
    if (this.metricEventRepository.getGovernanceDirectory) {
      return this.metricEventRepository.getGovernanceDirectory();
    }

    return this.governanceDirectoryService.getDirectory();
  }

  async getViewerScope(viewerId?: string): Promise<GovernanceViewerScope | undefined> {
    if (!viewerId) {
      return undefined;
    }

    if (this.metricEventRepository.getGovernanceViewerScope) {
      return this.metricEventRepository.getGovernanceViewerScope(viewerId);
    }

    return buildGovernanceViewerScope(
      this.governanceDirectoryService.getDirectory(),
      viewerId,
    );
  }

  async getScopedOrganizationDirectory(
    viewerId?: string,
  ) {
    const [directory, viewerScope] = await Promise.all([
      this.getOrganizationDirectory(),
      this.getViewerScope(viewerId),
    ]);

    return filterGovernanceDirectoryByViewerScope(directory, viewerScope);
  }

  async registerCollectorIdentity(
    input: Omit<CollectorIdentityRecord, 'status' | 'registeredAt' | 'updatedAt'>,
  ) {
    if (!this.metricEventRepository.registerCollectorIdentity) {
      throw new Error('Collector identity registration is not configured');
    }

    return this.metricEventRepository.registerCollectorIdentity(input);
  }

  async getCollectorIdentity(identityKey: string) {
    if (!this.metricEventRepository.getCollectorIdentity) {
      return undefined;
    }

    return this.metricEventRepository.getCollectorIdentity(identityKey);
  }

  async replaceViewerScopeAssignment(input: GovernanceViewerScopeAssignment) {
    if (!this.metricEventRepository.replaceViewerScopeAssignment) {
      throw new Error('Viewer scope assignment is not configured');
    }

    return this.metricEventRepository.replaceViewerScopeAssignment(input);
  }

  async getViewerScopeAssignment(
    viewerId: string,
  ): Promise<ViewerScopeAssignmentRecord | undefined> {
    if (!this.metricEventRepository.getViewerScopeAssignment) {
      return undefined;
    }

    return this.metricEventRepository.getViewerScopeAssignment(viewerId);
  }

  listEnterpriseMetricsByDimension(dimension: EnterpriseMetricDimensionKey) {
    return listEnterpriseMetricsByDimension(dimension);
  }

  async calculateEnterpriseMetricValues(
    filters: MetricSnapshotFilters = {},
    options: {
      metricKeys?: string[];
      calculatedAt?: string;
    } = {},
  ): Promise<MetricCalculationResult[]> {
    const [
      recordedMetricEvents,
      analysisSummary,
      mcpAuditMetrics,
      requirements,
      pullRequests,
      ciRuns,
      deployments,
      incidents,
      defects,
    ] =
      await Promise.all([
        this.metricEventRepository.listRecordedMetricEvents(filters),
        this.buildAnalysisSummary(filters),
        this.metricEventRepository.buildMcpAuditMetrics(filters),
        this.listRequirements(filters),
        this.listPullRequests(filters),
        this.listCiRuns(filters),
        this.listDeployments(filters),
        this.listIncidents(filters),
        this.listDefects(filters),
      ]);

    return calculateEnterpriseMetrics({
      metricKeys: options.metricKeys,
      context: {
        scope: filters.memberId ? 'personal' : 'team',
        projectKey: filters.projectKey ?? 'all',
        memberId: filters.memberId,
        periodStart: filters.from ?? '1970-01-01T00:00:00.000Z',
        periodEnd: filters.to ?? new Date().toISOString(),
        calculatedAt: options.calculatedAt ?? new Date().toISOString(),
      },
      input: {
        recordedMetricEvents,
        analysisSummary,
        mcpAuditMetrics,
        requirementSummary: buildRequirementCalculationSummary(requirements),
        pullRequestSummary: buildPullRequestCalculationSummary(pullRequests),
        ciSummary: buildCiCalculationSummary(ciRuns),
        deploymentSummary: buildDeploymentCalculationSummary(deployments, incidents),
        defectSummary: buildDefectCalculationSummary(defects, requirements),
      },
    });
  }

  getProjectRules(input: {
    projectKey: string;
    toolType: string;
    sceneType: string;
    memberId?: string;
  }) {
    return this.ruleCenterService.getProjectRules(input);
  }

  listRuleVersions(projectKey: string) {
    return this.ruleCenterService.listVersions(projectKey);
  }

  getRuleTemplate(input: { projectKey: string; version?: string }) {
    return this.ruleCenterService.getTemplate(input);
  }

  validateRuleTemplate(input: { projectKey: string; version?: string }) {
    return this.ruleCenterService.validateTemplate(input);
  }

  setActiveRuleVersion(input: { projectKey: string; version: string }) {
    return this.ruleCenterService.setActiveVersion(input);
  }

  getRuleRollout(projectKey: string) {
    return this.ruleCenterService.getRollout(projectKey);
  }

  setRuleRollout(input: {
    projectKey: string;
    enabled: boolean;
    candidateVersion?: string;
    percentage?: number;
    includedMembers?: string[];
  }) {
    return this.ruleCenterService.setRollout(input);
  }

  evaluateRuleRollout(input: { projectKey: string; memberId?: string }) {
    return this.ruleCenterService.evaluateRollout(input);
  }

  searchKnowledge(input: { query: string; limit?: number }) {
    return this.knowledgeSearchService.search(input);
  }
}

const buildMetricSnapshots = (
  recordedMetricEvents: RecordedMetricEvent[],
  filters: MetricSnapshotFilters,
): MetricSnapshotRecord[] => {
  const periodStart = filters.from ?? '1970-01-01T00:00:00.000Z';
  const periodEnd = filters.to ?? new Date().toISOString();
  const projectKey = filters.projectKey ?? 'all';
  const members = new Map<string, RecordedMetricEvent>();

  recordedMetricEvents.forEach((event) => {
    const current = members.get(event.memberId);

    members.set(event.memberId, {
      memberId: event.memberId,
      acceptedAiLines:
        (current?.acceptedAiLines ?? 0) + event.acceptedAiLines,
      commitTotalLines:
        (current?.commitTotalLines ?? 0) + event.commitTotalLines,
      sessionCount: (current?.sessionCount ?? 0) + event.sessionCount,
    });
  });

  const personalSnapshots = [...members.values()].map((member) => ({
    scope: 'personal' as const,
    projectKey,
    memberId: member.memberId,
    periodStart,
    periodEnd,
    acceptedAiLines: member.acceptedAiLines,
    commitTotalLines: member.commitTotalLines,
    aiOutputRate: calculateAiOutputRate(
      member.acceptedAiLines,
      member.commitTotalLines,
    ),
    sessionCount: member.sessionCount,
    memberCount: 1,
  }));
  const teamAcceptedAiLines = personalSnapshots.reduce(
    (sum, snapshot) => sum + snapshot.acceptedAiLines,
    0,
  );
  const teamCommitTotalLines = personalSnapshots.reduce(
    (sum, snapshot) => sum + snapshot.commitTotalLines,
    0,
  );
  const teamSessionCount = personalSnapshots.reduce(
    (sum, snapshot) => sum + snapshot.sessionCount,
    0,
  );
  const teamSnapshot: MetricSnapshotRecord = {
    scope: 'team',
    projectKey,
    periodStart,
    periodEnd,
    acceptedAiLines: teamAcceptedAiLines,
    commitTotalLines: teamCommitTotalLines,
    aiOutputRate: calculateAiOutputRate(
      teamAcceptedAiLines,
      teamCommitTotalLines,
    ),
    sessionCount: teamSessionCount,
    memberCount: personalSnapshots.length,
  };

  return [...personalSnapshots, teamSnapshot];
};

const buildRequirementCalculationSummary = (
  requirements: RequirementRecord[],
) => {
  const aiLeadTimes = requirements
    .filter(
      (requirement) =>
        requirement.aiTouched && typeof requirement.leadTimeHours === 'number',
    )
    .map((requirement) => requirement.leadTimeHours as number);
  const nonAiLeadTimes = requirements
    .filter(
      (requirement) =>
        !requirement.aiTouched && typeof requirement.leadTimeHours === 'number',
    )
    .map((requirement) => requirement.leadTimeHours as number);
  const criticalCycleTimes = requirements
    .filter(
      (requirement) =>
        requirement.priority === 'critical' &&
        typeof requirement.cycleTimeHours === 'number',
    )
    .map((requirement) => requirement.cycleTimeHours as number);

  return {
    totalRequirementCount: requirements.length,
    aiTouchedRequirementCount: requirements.filter((requirement) => requirement.aiTouched)
      .length,
    nonAiRequirementCount: requirements.filter((requirement) => !requirement.aiTouched)
      .length,
    averageAiLeadTimeHours:
      aiLeadTimes.length === 0
        ? 0
        : aiLeadTimes.reduce((sum, value) => sum + value, 0) / aiLeadTimes.length,
    averageNonAiLeadTimeHours:
      nonAiLeadTimes.length === 0
        ? 0
        : nonAiLeadTimes.reduce((sum, value) => sum + value, 0) / nonAiLeadTimes.length,
    criticalRequirementCount: requirements.filter(
      (requirement) => requirement.priority === 'critical',
    ).length,
    averageCriticalCycleTimeHours:
      criticalCycleTimes.length === 0
        ? 0
        : criticalCycleTimes.reduce((sum, value) => sum + value, 0) /
          criticalCycleTimes.length,
  };
};

const buildPullRequestCalculationSummary = (
  pullRequests: PullRequestRecord[],
) => {
  const mergedPullRequests = pullRequests.filter(
    (pullRequest) => typeof pullRequest.cycleTimeHours === 'number',
  );
  const reviewedPullRequests = pullRequests.filter(
    (pullRequest) => typeof pullRequest.reviewDecision === 'string',
  );
  const rejectedPullRequests = reviewedPullRequests.filter(
    (pullRequest) => pullRequest.reviewDecision === 'changes-requested',
  );

  return {
    totalPullRequestCount: pullRequests.length,
    mergedPullRequestCount: mergedPullRequests.length,
    averageCycleTimeHours:
      mergedPullRequests.length === 0
        ? 0
        : mergedPullRequests.reduce(
            (sum, pullRequest) => sum + (pullRequest.cycleTimeHours as number),
            0,
          ) / mergedPullRequests.length,
    reviewedPullRequestCount: reviewedPullRequests.length,
    rejectedPullRequestCount: rejectedPullRequests.length,
  };
};

const buildCiCalculationSummary = (
  ciRuns: CiRunRecord[],
) => {
  const completedRuns = ciRuns.filter((ciRun) => ciRun.status === 'completed');
  const successfulRuns = completedRuns.filter(
    (ciRun) => ciRun.conclusion === 'success',
  );
  const failedRuns = completedRuns.filter(
    (ciRun) => ciRun.conclusion === 'failure' || ciRun.conclusion === 'timed_out',
  );

  return {
    totalRunCount: ciRuns.length,
    completedRunCount: completedRuns.length,
    successfulRunCount: successfulRuns.length,
    failedRunCount: failedRuns.length,
    passRate:
      completedRuns.length === 0 ? 0 : successfulRuns.length / completedRuns.length,
  };
};

const buildDeploymentCalculationSummary = (
  deployments: DeploymentRecord[],
  incidents: IncidentRecord[],
) => {
  const incidentDeploymentIds = new Set(
    incidents.flatMap((incident) => incident.linkedDeploymentIds),
  );
  const successfulDeployments = deployments.filter(
    (deployment) => deployment.status === 'success',
  );
  const failedDeployments = deployments.filter(
    (deployment) =>
      deployment.status === 'failed' ||
      deployment.rolledBack ||
      typeof deployment.incidentKey === 'string' ||
      incidentDeploymentIds.has(deployment.deploymentId),
  );
  const rolledBackDeployments = deployments.filter(
    (deployment) => deployment.rolledBack,
  );
  const aiTouchedDeployments = deployments.filter(
    (deployment) => deployment.aiTouched,
  );

  return {
    totalDeploymentCount: deployments.length,
    successfulDeploymentCount: successfulDeployments.length,
    failedDeploymentCount: failedDeployments.length,
    rolledBackDeploymentCount: rolledBackDeployments.length,
    aiTouchedDeploymentCount: aiTouchedDeployments.length,
    changeFailureRate:
      deployments.length === 0 ? 0 : failedDeployments.length / deployments.length,
    rollbackRate:
      deployments.length === 0 ? 0 : rolledBackDeployments.length / deployments.length,
  };
};

const buildDefectCalculationSummary = (
  defects: DefectRecord[],
  requirements: RequirementRecord[],
) => {
  const completedRequirementCount = requirements.filter(
    (requirement) => requirement.status === 'done' || requirement.status === 'closed',
  ).length;
  const productionDefectCount = defects.filter(
    (defect) => defect.foundInPhase === 'production',
  ).length;

  return {
    totalDefectCount: defects.length,
    openDefectCount: defects.filter((defect) => defect.status === 'open').length,
    resolvedDefectCount: defects.filter((defect) => defect.status === 'resolved').length,
    productionDefectCount,
    completedRequirementCount,
    defectRate:
      completedRequirementCount === 0 ? 0 : defects.length / completedRequirementCount,
    escapedDefectRate:
      defects.length === 0 ? 0 : productionDefectCount / defects.length,
  };
};
