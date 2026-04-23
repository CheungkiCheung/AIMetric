import { useEffect, useState } from 'react';
import type {
  RuleRollout,
  RuleRolloutEvaluation,
  RuleVersionCatalog,
} from '../api/client.js';
import { MetricCard } from '../components/metric-card.js';

export interface RuleCenterDashboardProps {
  versions: RuleVersionCatalog;
  rollout: RuleRollout;
  evaluation: RuleRolloutEvaluation;
  saving?: boolean;
  onSave?: (input: RuleRollout) => Promise<void>;
}

const gridStyle = {
  display: 'grid',
  gap: '16px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
};

const editorStyle = {
  marginTop: '18px',
  padding: '20px',
  borderRadius: '20px',
  background: 'rgba(255, 251, 245, 0.88)',
  border: '1px solid rgba(138, 104, 70, 0.18)',
  boxShadow: '0 16px 32px rgba(87, 63, 35, 0.07)',
  display: 'grid',
  gap: '14px',
};

const editorGridStyle = {
  display: 'grid',
  gap: '14px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
};

const labelStyle = {
  display: 'grid',
  gap: '8px',
  color: '#5d4733',
  fontSize: '14px',
  fontWeight: 700,
};

const inputStyle = {
  minWidth: 0,
  border: '1px solid #e0cbb2',
  borderRadius: '14px',
  padding: '12px 14px',
  background: '#fffdfa',
  color: '#241c15',
  font: 'inherit',
};

const checkboxLabelStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  color: '#5d4733',
  fontSize: '14px',
  fontWeight: 700,
};

const buttonStyle = {
  border: 'none',
  borderRadius: '14px',
  padding: '12px 18px',
  background: '#8b6846',
  color: '#fffdfa',
  font: 'inherit',
  fontWeight: 700,
  cursor: 'pointer',
  justifySelf: 'start' as const,
};

const formatRolloutStatus = (rollout: RuleRollout): string => {
  if (!rollout.enabled) {
    return '未开启';
  }

  return rollout.candidateVersion ?? '未选择';
};

const formatIncludedMembers = (rollout: RuleRollout): string =>
  rollout.includedMembers.length > 0
    ? `定向成员 ${rollout.includedMembers.join(', ')}`
    : '未配置定向成员';

const formatEvaluationReason = (evaluation: RuleRolloutEvaluation): string => {
  const bucketText =
    evaluation.bucket === undefined ? '无百分比桶' : `桶位 ${evaluation.bucket}`;

  if (evaluation.reason === 'included-member') {
    return `定向成员命中，${bucketText}`;
  }

  if (evaluation.reason === 'percentage-hit') {
    return `百分比命中，${bucketText}`;
  }

  if (evaluation.reason === 'percentage-miss') {
    return `百分比未命中，${bucketText}`;
  }

  if (evaluation.reason === 'no-member') {
    return '未选择成员，回落生效版本';
  }

  return '灰度未开启，回落生效版本';
};

const parseIncludedMembers = (value: string): string[] =>
  value
    .split(',')
    .map((member) => member.trim())
    .filter((member) => member.length > 0);

export const RuleCenterDashboard = ({
  versions,
  rollout,
  evaluation,
  saving = false,
  onSave,
}: RuleCenterDashboardProps) => {
  const [enabled, setEnabled] = useState(rollout.enabled);
  const [candidateVersion, setCandidateVersion] = useState(
    rollout.candidateVersion ?? versions.activeVersion,
  );
  const [percentage, setPercentage] = useState(String(rollout.percentage));
  const [includedMembers, setIncludedMembers] = useState(
    rollout.includedMembers.join(', '),
  );

  useEffect(() => {
    setEnabled(rollout.enabled);
    setCandidateVersion(rollout.candidateVersion ?? versions.activeVersion);
    setPercentage(String(rollout.percentage));
    setIncludedMembers(rollout.includedMembers.join(', '));
  }, [rollout, versions.activeVersion]);

  const submit = async () => {
    if (!onSave) {
      return;
    }

    await onSave({
      projectKey: versions.projectKey,
      enabled,
      candidateVersion,
      percentage: Number(percentage),
      includedMembers: parseIncludedMembers(includedMembers),
      updatedAt: rollout.updatedAt,
    });
  };

  return (
    <section>
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '28px', color: '#241c15' }}>
          规则中心管理
        </h2>
        <p style={{ margin: '8px 0 0', color: '#6b523c' }}>
          对齐文章中的规则中心分层，展示当前生效模板、版本库存与灰度发布策略。
        </p>
      </div>
      <div style={gridStyle}>
        <MetricCard
          label="生效规则版本"
          value={versions.activeVersion}
          helper={`项目 ${versions.projectKey}`}
        />
        <MetricCard
          label="版本库存"
          value={`${versions.versions.length}`}
          helper="文件化模板可追踪、可回滚"
        />
        <MetricCard
          label="灰度候选版本"
          value={formatRolloutStatus(rollout)}
          helper={rollout.enabled ? formatIncludedMembers(rollout) : '灰度发布已关闭'}
        />
        <MetricCard
          label="灰度比例"
          value={`${rollout.percentage}%`}
          helper={rollout.updatedAt ? `更新时间 ${rollout.updatedAt}` : '尚未发布灰度策略'}
        />
        <MetricCard
          label="命中规则版本"
          value={evaluation.selectedVersion}
          helper={formatEvaluationReason(evaluation)}
        />
      </div>
      <section style={editorStyle} aria-label="规则灰度编辑器">
        <div>
          <h3 style={{ margin: 0, fontSize: '20px', color: '#241c15' }}>灰度发布编辑</h3>
          <p style={{ margin: '6px 0 0', color: '#6b523c' }}>
            在页面内直接启停灰度、调整比例，并维护定向成员名单。
          </p>
        </div>
        <label style={checkboxLabelStyle} htmlFor="rule-rollout-enabled">
          <input
            id="rule-rollout-enabled"
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          启用灰度发布
        </label>
        <div style={editorGridStyle}>
          <label style={labelStyle} htmlFor="rule-rollout-candidate">
            候选版本
            <select
              id="rule-rollout-candidate"
              style={inputStyle}
              value={candidateVersion}
              onChange={(event) => setCandidateVersion(event.target.value)}
            >
              {versions.versions.map((version) => (
                <option key={version.version} value={version.version}>
                  {version.version}
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle} htmlFor="rule-rollout-percentage">
            灰度比例
            <input
              id="rule-rollout-percentage"
              type="number"
              min={0}
              max={100}
              style={inputStyle}
              value={percentage}
              onChange={(event) => setPercentage(event.target.value)}
            />
          </label>
          <label style={labelStyle} htmlFor="rule-rollout-members">
            定向成员
            <input
              id="rule-rollout-members"
              style={inputStyle}
              value={includedMembers}
              placeholder="alice, bob"
              onChange={(event) => setIncludedMembers(event.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          style={buttonStyle}
          disabled={saving}
          onClick={() => {
            void submit();
          }}
        >
          {saving ? '保存中...' : '保存灰度策略'}
        </button>
      </section>
    </section>
  );
};
