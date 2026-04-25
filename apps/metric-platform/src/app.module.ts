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
  type EditEvidenceFilters,
  type MetricEventRepository,
  type MetricSnapshotRecord,
  type MetricSnapshotFilters,
  type RecordedMetricEvent,
} from './database/postgres-event.repository.js';
import { GovernanceDirectoryService } from './governance/governance-directory.service.js';
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

  getEnterpriseMetricCatalog() {
    return getEnterpriseMetricCatalog();
  }

  getOrganizationDirectory() {
    return this.governanceDirectoryService.getDirectory();
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
    const [recordedMetricEvents, analysisSummary, mcpAuditMetrics] =
      await Promise.all([
        this.metricEventRepository.listRecordedMetricEvents(filters),
        this.buildAnalysisSummary(filters),
        this.metricEventRepository.buildMcpAuditMetrics(filters),
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
