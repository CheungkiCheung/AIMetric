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
  type EditEvidenceFilters,
  type MetricEventRepository,
  type MetricSnapshotRecord,
  type MetricSnapshotFilters,
  type PullRequestRecord,
  type PullRequestSummary,
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
    const [recordedMetricEvents, analysisSummary, mcpAuditMetrics, requirements] =
      await Promise.all([
        this.metricEventRepository.listRecordedMetricEvents(filters),
        this.buildAnalysisSummary(filters),
        this.metricEventRepository.buildMcpAuditMetrics(filters),
        this.listRequirements(filters),
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
  };
};
