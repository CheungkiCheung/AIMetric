import { useEffect, useState } from 'react';
import {
  createDashboardClient,
  type DashboardClient,
  type PersonalSnapshot,
  type TeamSnapshot,
} from './api/client.js';
import { PersonalDashboard } from './pages/personal-dashboard.js';
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

export interface AppProps {
  client?: DashboardClient;
}

export const App = ({ client = createDashboardClient() }: AppProps) => {
  const [personalSnapshot, setPersonalSnapshot] = useState<PersonalSnapshot | null>(null);
  const [teamSnapshot, setTeamSnapshot] = useState<TeamSnapshot | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const [personal, team] = await Promise.all([
        client.getPersonalSnapshot(),
        client.getTeamSnapshot(),
      ]);

      if (!active) {
        return;
      }

      setPersonalSnapshot(personal);
      setTeamSnapshot(team);
    };

    void load();

    return () => {
      active = false;
    };
  }, [client]);

  if (!personalSnapshot || !teamSnapshot) {
    return (
      <main style={shellStyle}>
        <div style={panelStyle}>
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
        <PersonalDashboard snapshot={personalSnapshot} />
        <TeamDashboard snapshot={teamSnapshot} />
      </div>
    </main>
  );
};
