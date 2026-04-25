import { useEffect, useState } from 'react';
import type {
  GovernanceDirectory,
  ViewerScopeAssignment,
} from '../api/client.js';

export interface ViewerScopeDashboardProps {
  directory: GovernanceDirectory;
  loadAssignment: (viewerId: string) => Promise<ViewerScopeAssignment | null>;
  saveAssignment: (input: ViewerScopeAssignment) => Promise<ViewerScopeAssignment>;
}

const panelStyle = {
  padding: '24px',
  borderRadius: '28px',
  background:
    'linear-gradient(135deg, rgba(255, 248, 239, 0.96), rgba(247, 232, 212, 0.92))',
  border: '1px solid rgba(145, 97, 43, 0.16)',
  boxShadow: '0 18px 38px rgba(102, 64, 24, 0.08)',
};

const fieldStyle = {
  display: 'grid',
  gap: '8px',
  color: '#68492b',
  fontSize: '14px',
  fontWeight: 700,
};

const inputStyle = {
  border: '1px solid #d8b791',
  borderRadius: '14px',
  padding: '12px 14px',
  background: '#fffdfa',
  color: '#241c15',
  font: 'inherit',
};

const buttonStyle = {
  border: 'none',
  borderRadius: '999px',
  padding: '12px 18px',
  background: '#a85f20',
  color: '#fffaf4',
  font: 'inherit',
  fontWeight: 700,
  cursor: 'pointer',
};

const parseCommaSeparated = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

export const ViewerScopeDashboard = ({
  directory,
  loadAssignment,
  saveAssignment,
}: ViewerScopeDashboardProps) => {
  const defaultViewerId = directory.members.find(
    (member) => member.role !== 'developer',
  )?.memberId;
  const [viewerId, setViewerId] = useState(defaultViewerId ?? '');
  const [teamKeys, setTeamKeys] = useState('');
  const [projectKeys, setProjectKeys] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!viewerId) {
      return;
    }

    let active = true;

    const load = async () => {
      const assignment = await loadAssignment(viewerId);

      if (!active) {
        return;
      }

      setTeamKeys((assignment?.teamKeys ?? []).join(', '));
      setProjectKeys((assignment?.projectKeys ?? []).join(', '));
      setUpdatedAt(assignment?.updatedAt);
    };

    void load();

    return () => {
      active = false;
    };
  }, [loadAssignment, viewerId]);

  const handleSave = async () => {
    setSaving(true);

    try {
      const saved = await saveAssignment({
        viewerId,
        teamKeys: parseCommaSeparated(teamKeys),
        projectKeys: parseCommaSeparated(projectKeys),
      });

      setTeamKeys(saved.teamKeys.join(', '));
      setProjectKeys(saved.projectKeys.join(', '));
      setUpdatedAt(saved.updatedAt);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section style={panelStyle}>
      <p
        style={{
          margin: 0,
          fontSize: '12px',
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: '#9b6b3b',
        }}
      >
        Governance Access
      </p>
      <h2 style={{ margin: '10px 0 6px', fontSize: '28px' }}>权限治理配置</h2>
      <p style={{ margin: 0, color: '#7a5735' }}>
        为提效管理者和技术管理者配置显式 viewer scope。未配置时仍回退到默认所属团队可见范围。
      </p>
      <div
        style={{
          display: 'grid',
          gap: '14px',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          marginTop: '18px',
        }}
      >
        <label style={fieldStyle} htmlFor="viewer-scope-viewer-id">
          Viewer 成员 ID
          <input
            id="viewer-scope-viewer-id"
            style={inputStyle}
            value={viewerId}
            onChange={(event) => setViewerId(event.target.value)}
            placeholder="例如 manager-1"
          />
        </label>
        <label style={fieldStyle} htmlFor="viewer-scope-teams">
          团队范围
          <input
            id="viewer-scope-teams"
            style={inputStyle}
            value={teamKeys}
            onChange={(event) => setTeamKeys(event.target.value)}
            placeholder="例如 team-a, team-b"
          />
        </label>
        <label style={fieldStyle} htmlFor="viewer-scope-projects">
          项目范围
          <input
            id="viewer-scope-projects"
            style={inputStyle}
            value={projectKeys}
            onChange={(event) => setProjectKeys(event.target.value)}
            placeholder="例如 project-a, project-b"
          />
        </label>
      </div>
      <div
        style={{
          marginTop: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <p style={{ margin: 0, color: '#7a5735' }}>
          {updatedAt ? `最近更新：${updatedAt}` : '当前尚未配置显式授权，默认按所属团队生效'}
        </p>
        <button
          type="button"
          style={buttonStyle}
          onClick={() => {
            void handleSave();
          }}
          disabled={!viewerId || saving}
        >
          {saving ? '保存中...' : '保存权限范围'}
        </button>
      </div>
    </section>
  );
};
