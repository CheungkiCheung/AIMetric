import type { RuleRollout, RuleVersionCatalog } from '../api/client.js';
import { MetricCard } from '../components/metric-card.js';

export interface RuleCenterDashboardProps {
  versions: RuleVersionCatalog;
  rollout: RuleRollout;
}

const gridStyle = {
  display: 'grid',
  gap: '16px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
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

export const RuleCenterDashboard = ({
  versions,
  rollout,
}: RuleCenterDashboardProps) => (
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
    </div>
  </section>
);
