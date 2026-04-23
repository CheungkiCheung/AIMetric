import { useEffect, useState } from 'react';
import {
  createDashboardClient,
  type DashboardClient,
  type DashboardFilters,
  type McpAuditMetrics,
  type PersonalSnapshot,
  type RuleRollout,
  type RuleRolloutEvaluation,
  type RuleVersionCatalog,
  type TeamSnapshot,
} from './api/client.js';
import { McpAuditDashboard } from './pages/mcp-audit-dashboard.js';
import { PersonalDashboard } from './pages/personal-dashboard.js';
import { RuleCenterDashboard } from './pages/rule-center-dashboard.js';
import { TeamDashboard } from './pages/team-dashboard.js';

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
  const [personalSnapshot, setPersonalSnapshot] = useState<PersonalSnapshot | null>(null);
  const [teamSnapshot, setTeamSnapshot] = useState<TeamSnapshot | null>(null);
  const [mcpAuditMetrics, setMcpAuditMetrics] = useState<McpAuditMetrics | null>(null);
  const [ruleVersions, setRuleVersions] = useState<RuleVersionCatalog | null>(null);
  const [ruleRollout, setRuleRollout] = useState<RuleRollout | null>(null);
  const [ruleRolloutEvaluation, setRuleRolloutEvaluation] =
    useState<RuleRolloutEvaluation | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>({});

  useEffect(() => {
    let active = true;

    const load = async () => {
      const projectKey = filters.projectKey ?? 'aimetric';
      const [personal, team, auditMetrics, versions, rollout, rolloutEvaluation] =
        await Promise.all([
        client.getPersonalSnapshot(filters),
        client.getTeamSnapshot(filters),
        client.getMcpAuditMetrics(filters),
        client.getRuleVersions(projectKey),
        client.getRuleRollout(projectKey),
        client.getRuleRolloutEvaluation(projectKey, filters.memberId),
      ]);

      if (!active) {
        return;
      }

      setPersonalSnapshot(personal);
      setTeamSnapshot(team);
      setMcpAuditMetrics(auditMetrics);
      setRuleVersions(versions);
      setRuleRollout(rollout);
      setRuleRolloutEvaluation(rolloutEvaluation);
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

  const updateFilter = (key: keyof DashboardFilters, value: string) => {
    setFilters((currentFilters) =>
      normalizeFilters({
        ...currentFilters,
        [key]: value,
      }),
    );
  };

  const filterControls = (
    <section style={filterPanelStyle} aria-label="指标筛选">
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '22px' }}>指标筛选与自动刷新</h2>
        <p style={{ margin: '6px 0 0', color: '#6b523c' }}>
          按文章中的项目、成员与周期维度收敛快照口径，看板默认 30 秒自动刷新。
        </p>
      </div>
      <div style={filterGridStyle}>
        <label style={filterLabelStyle} htmlFor="projectKey">
          项目
          <input
            id="projectKey"
            style={filterInputStyle}
            value={filters.projectKey ?? ''}
            placeholder="例如 navigation"
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
    !personalSnapshot ||
    !teamSnapshot ||
    !mcpAuditMetrics ||
    !ruleVersions ||
    !ruleRollout ||
    !ruleRolloutEvaluation
  ) {
    return (
      <main style={shellStyle}>
        <div style={panelStyle}>
          {filterControls}
          <p style={{ margin: 0, fontSize: '18px' }}>正在加载 AIMetric 仪表盘...</p>
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
            AIMetric Phase 1
          </p>
          <h1 style={{ margin: '12px 0 8px', fontSize: '44px', lineHeight: 1.05 }}>
            AI 研发效能量化看板
          </h1>
          <p style={{ margin: 0, maxWidth: '680px', color: '#5d4733', fontSize: '16px' }}>
            对齐文章里的个人与团队视图，展示 MCP 主链路采集后沉淀出的核心出码指标。
          </p>
        </header>
        {filterControls}
        <PersonalDashboard snapshot={personalSnapshot} />
        <TeamDashboard snapshot={teamSnapshot} />
        <McpAuditDashboard metrics={mcpAuditMetrics} />
        <RuleCenterDashboard
          versions={ruleVersions}
          rollout={ruleRollout}
          evaluation={ruleRolloutEvaluation}
        />
      </div>
    </main>
  );
};
