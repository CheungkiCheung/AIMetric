import type { GovernanceDirectory } from '../api/client.js';

export interface GovernanceDirectoryDashboardProps {
  directory: GovernanceDirectory;
}

const panelStyle = {
  padding: '24px',
  borderRadius: '28px',
  background:
    'linear-gradient(135deg, rgba(242, 247, 255, 0.96), rgba(227, 238, 252, 0.92))',
  border: '1px solid rgba(85, 117, 176, 0.16)',
  boxShadow: '0 18px 38px rgba(58, 84, 138, 0.08)',
};

const statGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: '14px',
  marginTop: '18px',
};

const statCardStyle = {
  borderRadius: '20px',
  padding: '16px',
  background: 'rgba(255, 255, 255, 0.74)',
  border: '1px solid rgba(85, 117, 176, 0.14)',
};

const statLabelStyle = {
  margin: 0,
  color: '#4c679b',
  fontSize: '13px',
  fontWeight: 700,
};

const statValueStyle = {
  margin: '8px 0 0',
  color: '#1f2b46',
  fontSize: '30px',
  fontWeight: 800,
};

const listStyle = {
  margin: '18px 0 0',
  padding: 0,
  listStyle: 'none',
  display: 'grid',
  gap: '10px',
};

const roleLabels: Record<GovernanceDirectory['members'][number]['role'], string> = {
  developer: '开发',
  'engineering-manager': '技术管理者',
  'effectiveness-manager': '提效管理者',
  'platform-admin': '平台管理员',
};

export const GovernanceDirectoryDashboard = ({
  directory,
}: GovernanceDirectoryDashboardProps) => {
  const roleSummary = directory.members.reduce<Record<string, number>>((summary, member) => {
    summary[member.role] = (summary[member.role] ?? 0) + 1;
    return summary;
  }, {});

  return (
    <section style={panelStyle}>
      <p
        style={{
          margin: 0,
          fontSize: '12px',
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: '#607db5',
        }}
      >
        Governance Directory
      </p>
      <h2 style={{ margin: '10px 0 6px', fontSize: '28px' }}>组织治理概览</h2>
      <p style={{ margin: 0, color: '#4a5f8d' }}>
        为后续团队分维度分析、RBAC、采集策略和管理者视图提供统一组织上下文。当前默认目录来自平台内置治理目录服务。
      </p>
      <div style={statGridStyle}>
        <article style={statCardStyle}>
          <p style={statLabelStyle}>组织</p>
          <p style={{ ...statValueStyle, fontSize: '24px' }}>{directory.organization.name}</p>
        </article>
        <article style={statCardStyle}>
          <p style={statLabelStyle}>团队数</p>
          <p style={statValueStyle}>{directory.teams.length}</p>
        </article>
        <article style={statCardStyle}>
          <p style={statLabelStyle}>项目数</p>
          <p style={statValueStyle}>{directory.projects.length}</p>
        </article>
        <article style={statCardStyle}>
          <p style={statLabelStyle}>成员数</p>
          <p style={statValueStyle}>{directory.members.length}</p>
        </article>
      </div>
      <ul style={listStyle}>
        {directory.teams.map((team) => {
          const projects = directory.projects.filter((project) => project.teamKey === team.key);
          const members = directory.members.filter((member) => member.teamKey === team.key);

          return (
            <li
              key={team.key}
              style={{
                borderRadius: '18px',
                padding: '14px 16px',
                background: 'rgba(255, 255, 255, 0.68)',
                border: '1px solid rgba(85, 117, 176, 0.14)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <strong style={{ color: '#1f2b46' }}>{team.name}</strong>
                <span style={{ color: '#5f76a3' }}>
                  项目 {projects.length} / 成员 {members.length}
                </span>
              </div>
              <p style={{ margin: '8px 0 0', color: '#4a5f8d' }}>
                项目：{projects.map((project) => project.name).join(', ') || '未配置'}
              </p>
              <p style={{ margin: '6px 0 0', color: '#4a5f8d' }}>
                角色：{
                  Object.entries(roleSummary)
                    .map(([role, count]) => `${roleLabels[role as keyof typeof roleLabels]} ${count}`)
                    .join(' / ')
                }
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
