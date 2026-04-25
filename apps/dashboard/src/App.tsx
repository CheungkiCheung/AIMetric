import { useEffect, useState } from 'react';
import {
  createDashboardClient,
  type AnalysisSummary,
  type CiRunRecord,
  type CiRunSummary,
  type CollectorIngestionHealth,
  type DashboardClient,
  type DashboardFilters,
  type DeploymentRecord,
  type DeploymentSummary,
  type DefectRecord,
  type DefectAttributionRow,
  type DefectAttributionSummary,
  type DefectSummary,
  type EnterpriseMetricCatalog,
  type GovernanceDirectory,
  type IncidentRecord,
  type IncidentSummary,
  type MetricCalculationResult,
  type McpAuditMetrics,
  type OutputAnalysisRow,
  type PersonalSnapshot,
  type PullRequestRecord,
  type PullRequestSummary,
  type RequirementRecord,
  type RequirementSummary,
  type RuleRollout,
  type RuleRolloutEvaluation,
  type RuleVersionCatalog,
  type SessionAnalysisRow,
  type TeamSnapshot,
} from './api/client.js';
import { AnalysisSummarySection } from './pages/analysis-summary.js';
import { CiRunDashboard } from './pages/ci-run-dashboard.js';
import { CollectorHealthDashboard } from './pages/collector-health-dashboard.js';
import { DeploymentDashboard } from './pages/deployment-dashboard.js';
import { DefectDashboard } from './pages/defect-dashboard.js';
import { DefectAttributionDashboard } from './pages/defect-attribution-dashboard.js';
import { EnterpriseMetricCatalogPanel } from './pages/enterprise-metric-catalog.js';
import { EffectivenessManagerCockpit } from './pages/effectiveness-manager-cockpit.js';
import { GovernanceDirectoryDashboard } from './pages/governance-directory-dashboard.js';
import { IncidentDashboard } from './pages/incident-dashboard.js';
import { McpAuditDashboard } from './pages/mcp-audit-dashboard.js';
import { OutputAnalysisTable } from './pages/output-analysis-table.js';
import { PersonalDashboard } from './pages/personal-dashboard.js';
import { PullRequestDashboard } from './pages/pull-request-dashboard.js';
import { RequirementDashboard } from './pages/requirement-dashboard.js';
import { RuleCenterDashboard } from './pages/rule-center-dashboard.js';
import { SessionAnalysisTable } from './pages/session-analysis-table.js';
import { TeamDashboard } from './pages/team-dashboard.js';
import { ViewerScopeDashboard } from './pages/viewer-scope-dashboard.js';

const shellStyle = {
  minHeight: '100vh',
  padding: '32px 20px 48px',
  background:
    'radial-gradient(circle at top, rgba(248, 221, 187, 0.65), transparent 32%), linear-gradient(180deg, #f7f1e7 0%, #efe4d6 100%)',
  color: '#241c15',
  fontFamily:
    '"IBM Plex Sans", "Segoe UI", "PingFang SC", "Hiragino Sans GB", sans-serif',
};

const panelStyle = {
  maxWidth: '1100px',
  margin: '0 auto',
  display: 'grid',
  gap: '24px',
};

const filterPanelStyle = {
  padding: '22px',
  borderRadius: '24px',
  background: 'rgba(255, 251, 245, 0.88)',
  border: '1px solid rgba(138, 104, 70, 0.18)',
  boxShadow: '0 16px 32px rgba(87, 63, 35, 0.07)',
};

const filterGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '14px',
};

const filterLabelStyle = {
  display: 'grid',
  gap: '8px',
  color: '#5d4733',
  fontSize: '14px',
  fontWeight: 700,
};

const filterInputStyle = {
  minWidth: 0,
  border: '1px solid #e0cbb2',
  borderRadius: '14px',
  padding: '12px 14px',
  background: '#fffdfa',
  color: '#241c15',
  font: 'inherit',
};

const toIsoDateTime = (date: Date) => date.toISOString().slice(0, 16);

const getDefaultFilters = (windowDays: number): DashboardFilters => {
  const to = new Date();
  const from = new Date(to.getTime() - windowDays * 24 * 60 * 60 * 1000);

  return {
    projectKey: 'aimetric',
    from: toIsoDateTime(from),
    to: toIsoDateTime(to),
  };
};

const trendMetricKeys = [
  'ai_output_rate',
  'lead_time_ai_vs_non_ai',
  'ci_pass_rate',
  'change_failure_rate',
  'defect_rate',
  'critical_requirement_cycle_time',
];

export interface AppProps {
  client?: DashboardClient;
  refreshIntervalMs?: number;
}

const normalizeFilters = (filters: DashboardFilters): DashboardFilters =>
  Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''),
  );

export const App = ({
  client = createDashboardClient(),
  refreshIntervalMs = 30_000,
}: AppProps) => {
  const [analysisSummary, setAnalysisSummary] = useState<AnalysisSummary | null>(null);
  const [sessionAnalysisRows, setSessionAnalysisRows] = useState<SessionAnalysisRow[]>([]);
  const [outputAnalysisRows, setOutputAnalysisRows] = useState<OutputAnalysisRow[]>([]);
  const [enterpriseMetricCatalog, setEnterpriseMetricCatalog] =
    useState<EnterpriseMetricCatalog | null>(null);
  const [enterpriseMetricValues, setEnterpriseMetricValues] = useState<
    MetricCalculationResult[]
  >([]);
  const [enterpriseMetricSnapshots, setEnterpriseMetricSnapshots] = useState<
    MetricCalculationResult[]
  >([]);
  const [personalSnapshot, setPersonalSnapshot] = useState<PersonalSnapshot | null>(null);
  const [teamSnapshot, setTeamSnapshot] = useState<TeamSnapshot | null>(null);
  const [mcpAuditMetrics, setMcpAuditMetrics] = useState<McpAuditMetrics | null>(null);
  const [collectorHealth, setCollectorHealth] =
    useState<CollectorIngestionHealth | null>(null);
  const [ciRunSummary, setCiRunSummary] = useState<CiRunSummary | null>(null);
  const [ciRuns, setCiRuns] = useState<CiRunRecord[]>([]);
  const [deploymentSummary, setDeploymentSummary] =
    useState<DeploymentSummary | null>(null);
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const [incidentSummary, setIncidentSummary] = useState<IncidentSummary | null>(null);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [defectSummary, setDefectSummary] = useState<DefectSummary | null>(null);
  const [defects, setDefects] = useState<DefectRecord[]>([]);
  const [defectAttributionSummary, setDefectAttributionSummary] =
    useState<DefectAttributionSummary | null>(null);
  const [defectAttributionRows, setDefectAttributionRows] = useState<DefectAttributionRow[]>(
    [],
  );
  const [governanceDirectory, setGovernanceDirectory] =
    useState<GovernanceDirectory | null>(null);
  const [pullRequestSummary, setPullRequestSummary] =
    useState<PullRequestSummary | null>(null);
  const [pullRequests, setPullRequests] = useState<PullRequestRecord[]>([]);
  const [requirementSummary, setRequirementSummary] =
    useState<RequirementSummary | null>(null);
  const [requirements, setRequirements] = useState<RequirementRecord[]>([]);
  const [ruleVersions, setRuleVersions] = useState<RuleVersionCatalog | null>(null);
  const [ruleRollout, setRuleRollout] = useState<RuleRollout | null>(null);
  const [ruleRolloutEvaluation, setRuleRolloutEvaluation] =
    useState<RuleRolloutEvaluation | null>(null);
  const [selectedWindowDays, setSelectedWindowDays] = useState(30);
  const [filters, setFilters] = useState<DashboardFilters>(getDefaultFilters(30));
  const [savingRuleRollout, setSavingRuleRollout] = useState(false);

  const loadDashboard = async (nextFilters: DashboardFilters) => {
    const projectKey = nextFilters.projectKey ?? 'aimetric';
    const [
      personal,
      team,
      auditMetrics,
      summary,
      sessions,
      output,
      versions,
      rollout,
      rolloutEvaluation,
      metricValues,
      metricSnapshots,
      collectorIngestionHealth,
      ciSummary,
      ciRows,
      deploymentSummary,
      deploymentRows,
      incidentSummary,
      incidentRows,
      defectSummary,
      defectRows,
      defectAttributionSummary,
      defectAttributionRows,
      directory,
      prSummary,
      prRows,
      requirementSummary,
      requirementRows,
    ] = await Promise.all([
      client.getPersonalSnapshot(nextFilters),
      client.getTeamSnapshot(nextFilters),
      client.getMcpAuditMetrics(nextFilters),
      client.getAnalysisSummary(nextFilters),
      client.getSessionAnalysisRows(nextFilters),
      client.getOutputAnalysisRows(nextFilters),
      client.getRuleVersions(projectKey),
      client.getRuleRollout(projectKey),
      client.getRuleRolloutEvaluation(projectKey, nextFilters.memberId),
      client.getEnterpriseMetricValues(nextFilters),
      client.getEnterpriseMetricSnapshots(nextFilters, trendMetricKeys),
      client.getCollectorIngestionHealth(),
      client.getCiRunSummary(nextFilters),
      client.getCiRuns(nextFilters),
      client.getDeploymentSummary(nextFilters),
      client.getDeployments(nextFilters),
      client.getIncidentSummary(nextFilters),
      client.getIncidents(nextFilters),
      client.getDefectSummary(nextFilters),
      client.getDefects(nextFilters),
      client.getDefectAttributionSummary(nextFilters),
      client.getDefectAttributionRows(nextFilters),
      client.getGovernanceDirectory(),
      client.getPullRequestSummary(nextFilters),
      client.getPullRequests(nextFilters),
      client.getRequirementSummary(nextFilters),
      client.getRequirements(nextFilters),
    ]);

    return {
      personal,
      team,
      auditMetrics,
      summary,
      sessions,
      output,
      versions,
      rollout,
      rolloutEvaluation,
      metricValues,
      metricSnapshots,
      collectorIngestionHealth,
      ciSummary,
      ciRows,
      deploymentSummary,
      deploymentRows,
      incidentSummary,
      incidentRows,
      defectSummary,
      defectRows,
      defectAttributionSummary,
      defectAttributionRows,
      directory,
      prSummary,
      prRows,
      requirementSummary,
      requirementRows,
    };
  };

  useEffect(() => {
    let active = true;

    const load = async () => {
      const {
        personal,
        team,
        auditMetrics,
        summary,
        sessions,
        output,
        versions,
        rollout,
        rolloutEvaluation,
        metricValues,
        metricSnapshots,
        collectorIngestionHealth,
        ciSummary,
        ciRows,
        deploymentSummary,
        deploymentRows,
        incidentSummary,
        incidentRows,
        defectSummary,
        defectRows,
        defectAttributionSummary,
        defectAttributionRows,
        directory,
        prSummary,
        prRows,
        requirementSummary,
        requirementRows,
      } = await loadDashboard(filters);

      if (!active) {
        return;
      }

      setPersonalSnapshot(personal);
      setTeamSnapshot(team);
      setMcpAuditMetrics(auditMetrics);
      setAnalysisSummary(summary);
      setSessionAnalysisRows(sessions);
      setOutputAnalysisRows(output);
      setRuleVersions(versions);
      setRuleRollout(rollout);
      setRuleRolloutEvaluation(rolloutEvaluation);
      setEnterpriseMetricValues(metricValues);
      setEnterpriseMetricSnapshots(metricSnapshots);
      setCollectorHealth(collectorIngestionHealth);
      setCiRunSummary(ciSummary);
      setCiRuns(ciRows);
      setDeploymentSummary(deploymentSummary);
      setDeployments(deploymentRows);
      setIncidentSummary(incidentSummary);
      setIncidents(incidentRows);
      setDefectSummary(defectSummary);
      setDefects(defectRows);
      setDefectAttributionSummary(defectAttributionSummary);
      setDefectAttributionRows(defectAttributionRows);
      setGovernanceDirectory(directory);
      setPullRequestSummary(prSummary);
      setPullRequests(prRows);
      setRequirementSummary(requirementSummary);
      setRequirements(requirementRows);
    };

    void load();
    const interval =
      refreshIntervalMs > 0
        ? window.setInterval(() => {
            void load();
          }, refreshIntervalMs)
        : undefined;

    return () => {
      active = false;
      if (interval !== undefined) {
        window.clearInterval(interval);
      }
    };
  }, [client, filters, refreshIntervalMs]);

  useEffect(() => {
    let active = true;

    const loadCatalog = async () => {
      const catalog = await client.getEnterpriseMetricCatalog();

      if (active) {
        setEnterpriseMetricCatalog(catalog);
      }
    };

    void loadCatalog();

    return () => {
      active = false;
    };
  }, [client]);

  const updateFilter = (key: keyof DashboardFilters, value: string) => {
    setFilters((currentFilters) =>
      normalizeFilters({
        ...currentFilters,
        [key]: value,
      }),
    );
  };

  const selectWindow = (days: number) => {
    setSelectedWindowDays(days);
    setFilters((currentFilters) =>
      normalizeFilters({
        ...getDefaultFilters(days),
        memberId: currentFilters.memberId,
      }),
    );
  };

  const saveRuleRollout = async (input: RuleRollout) => {
    setSavingRuleRollout(true);

    try {
      await client.updateRuleRollout(input);
      const {
        personal,
        team,
        auditMetrics,
        summary,
        sessions,
        output,
        versions,
        rollout,
        rolloutEvaluation,
        metricValues,
        metricSnapshots,
        collectorIngestionHealth,
        ciSummary,
        ciRows,
        deploymentSummary,
        deploymentRows,
        incidentSummary,
        incidentRows,
        defectSummary,
        defectRows,
        defectAttributionSummary,
        defectAttributionRows,
        directory,
        prSummary,
        prRows,
        requirementSummary,
        requirementRows,
      } = await loadDashboard(filters);

      setPersonalSnapshot(personal);
      setTeamSnapshot(team);
      setMcpAuditMetrics(auditMetrics);
      setAnalysisSummary(summary);
      setSessionAnalysisRows(sessions);
      setOutputAnalysisRows(output);
      setRuleVersions(versions);
      setRuleRollout(rollout);
      setRuleRolloutEvaluation(rolloutEvaluation);
      setEnterpriseMetricValues(metricValues);
      setEnterpriseMetricSnapshots(metricSnapshots);
      setCollectorHealth(collectorIngestionHealth);
      setCiRunSummary(ciSummary);
      setCiRuns(ciRows);
      setDeploymentSummary(deploymentSummary);
      setDeployments(deploymentRows);
      setIncidentSummary(incidentSummary);
      setIncidents(incidentRows);
      setDefectSummary(defectSummary);
      setDefects(defectRows);
      setDefectAttributionSummary(defectAttributionSummary);
      setDefectAttributionRows(defectAttributionRows);
      setGovernanceDirectory(directory);
      setPullRequestSummary(prSummary);
      setPullRequests(prRows);
      setRequirementSummary(requirementSummary);
      setRequirements(requirementRows);
    } finally {
      setSavingRuleRollout(false);
    }
  };

  const saveViewerScope = async (input: {
    viewerId: string;
    teamKeys: string[];
    projectKeys: string[];
  }) => {
    const savedAssignment = await client.updateViewerScopeAssignment(input);
    const directory = await client.getGovernanceDirectory();

    setGovernanceDirectory(directory);

    return savedAssignment;
  };

  const filterControls = (
    <section style={filterPanelStyle} aria-label="指标筛选">
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '22px' }}>指标筛选与自动刷新</h2>
        <p style={{ margin: '6px 0 0', color: '#6b523c' }}>
          面向提效管理者按项目、成员与观察周期切换经营口径，看板默认 30 秒自动刷新。
        </p>
      </div>
      <div style={filterGridStyle}>
        <label style={filterLabelStyle} htmlFor="projectKey">
          项目
          <input
            id="projectKey"
            style={filterInputStyle}
            value={filters.projectKey ?? ''}
            placeholder="例如 aimetric"
            onChange={(event) => updateFilter('projectKey', event.target.value)}
          />
        </label>
        <label style={filterLabelStyle} htmlFor="memberId">
          成员
          <input
            id="memberId"
            style={filterInputStyle}
            value={filters.memberId ?? ''}
            placeholder="例如 alice"
            onChange={(event) => updateFilter('memberId', event.target.value)}
          />
        </label>
        <label style={filterLabelStyle} htmlFor="from">
          开始时间
          <input
            id="from"
            type="datetime-local"
            style={filterInputStyle}
            value={filters.from ?? ''}
            onChange={(event) => updateFilter('from', event.target.value)}
          />
        </label>
        <label style={filterLabelStyle} htmlFor="to">
          结束时间
          <input
            id="to"
            type="datetime-local"
            style={filterInputStyle}
            value={filters.to ?? ''}
            onChange={(event) => updateFilter('to', event.target.value)}
          />
        </label>
      </div>
    </section>
  );

  if (
    !analysisSummary ||
    !personalSnapshot ||
    !teamSnapshot ||
    !mcpAuditMetrics ||
    !collectorHealth ||
    !ciRunSummary ||
    !deploymentSummary ||
    !incidentSummary ||
    !defectSummary ||
    !defectAttributionSummary ||
    !governanceDirectory ||
    !pullRequestSummary ||
    !requirementSummary ||
    !enterpriseMetricCatalog ||
    !ruleVersions ||
    !ruleRollout ||
    !ruleRolloutEvaluation
  ) {
    return (
      <main style={shellStyle}>
        <div style={panelStyle}>
          {filterControls}
          <p style={{ margin: 0, fontSize: '18px' }}>正在加载 AIMetric Enterprise...</p>
        </div>
      </main>
    );
  }

  return (
    <main style={shellStyle}>
      <div style={panelStyle}>
        <header
          style={{
            padding: '28px',
            borderRadius: '28px',
            background: 'rgba(255, 251, 245, 0.82)',
            border: '1px solid rgba(138, 104, 70, 0.18)',
            boxShadow: '0 20px 45px rgba(87, 63, 35, 0.08)',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.18em',
              color: '#8b6846',
            }}
          >
            AIMetric Enterprise
          </p>
          <h1 style={{ margin: '12px 0 8px', fontSize: '44px', lineHeight: 1.05 }}>
            企业级 AI 研发效能平台
          </h1>
          <p style={{ margin: 0, maxWidth: '680px', color: '#5d4733', fontSize: '16px' }}>
            统一承接员工端轻量采集、研发工具链信号、多维效能指标与治理配置，
            让提效管理者从经营视角观察 AI-IDE、SDD、代码采纳、批次推进与人效目标。
          </p>
        </header>
        <EffectivenessManagerCockpit
          filters={filters}
          selectedWindowDays={selectedWindowDays}
          onSelectWindow={selectWindow}
          metricValues={enterpriseMetricValues}
          metricSnapshots={enterpriseMetricSnapshots}
          teamSnapshot={teamSnapshot}
          analysisSummary={analysisSummary}
          requirementSummary={requirementSummary}
          pullRequestSummary={pullRequestSummary}
          deploymentSummary={deploymentSummary}
          defectAttributionSummary={defectAttributionSummary}
          collectorHealth={collectorHealth}
          governanceDirectory={governanceDirectory}
          mcpAuditMetrics={mcpAuditMetrics}
        />
        {filterControls}
        <section style={filterPanelStyle}>
          <div style={{ display: 'grid', gap: '8px' }}>
            <p
              style={{
                margin: 0,
                color: '#6b523c',
                fontSize: '13px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Deep Dive Views
            </p>
            <h2 style={{ margin: 0, fontSize: '28px' }}>专题分析与治理页</h2>
            <p style={{ margin: 0, color: '#6b523c', lineHeight: 1.7 }}>
              首页先给提效管理者一个 AI 提效经营驾驶舱，再把需求、PR、CI、发布、缺陷归因、采集健康和权限治理作为专题页继续下钻。
            </p>
          </div>
        </section>
        <EnterpriseMetricCatalogPanel
          catalog={enterpriseMetricCatalog}
          metricValues={enterpriseMetricValues}
        />
        <GovernanceDirectoryDashboard directory={governanceDirectory} />
        <ViewerScopeDashboard
          directory={governanceDirectory}
          loadAssignment={(viewerId) => client.getViewerScopeAssignment(viewerId)}
          saveAssignment={(input) => saveViewerScope(input)}
        />
        <AnalysisSummarySection summary={analysisSummary} />
        <CollectorHealthDashboard health={collectorHealth} />
        <CiRunDashboard summary={ciRunSummary} rows={ciRuns} />
        <DeploymentDashboard summary={deploymentSummary} rows={deployments} />
        <IncidentDashboard summary={incidentSummary} rows={incidents} />
        <DefectDashboard summary={defectSummary} rows={defects} />
        <DefectAttributionDashboard
          summary={defectAttributionSummary}
          rows={defectAttributionRows}
        />
        <RequirementDashboard summary={requirementSummary} rows={requirements} />
        <PullRequestDashboard summary={pullRequestSummary} rows={pullRequests} />
        <SessionAnalysisTable rows={sessionAnalysisRows} />
        <OutputAnalysisTable rows={outputAnalysisRows} />
        <PersonalDashboard snapshot={personalSnapshot} />
        <TeamDashboard snapshot={teamSnapshot} />
        <McpAuditDashboard metrics={mcpAuditMetrics} />
        <RuleCenterDashboard
          versions={ruleVersions}
          rollout={ruleRollout}
          evaluation={ruleRolloutEvaluation}
          saving={savingRuleRollout}
          onSave={saveRuleRollout}
        />
      </div>
    </main>
  );
};
