import type { ReactNode } from 'react';

export type GovernanceSectionKey =
  | 'directory'
  | 'viewer-scope'
  | 'collector-health'
  | 'mcp-audit'
  | 'rule-center';

export interface GovernanceSectionConfig {
  key: GovernanceSectionKey;
  label: string;
  heading: string;
  summary: string;
  question: string;
}

export const governanceSectionConfigs: GovernanceSectionConfig[] = [
  {
    key: 'directory',
    label: '组织治理概览',
    heading: '组织治理详情',
    summary: '查看组织、团队、项目和成员目录，保证所有指标都有可信组织归属。',
    question: '提效度量是否能按组织、团队、项目和成员正确归因？',
  },
  {
    key: 'viewer-scope',
    label: '权限治理配置',
    heading: '权限治理详情',
    summary: '管理提效管理者和技术管理者能看到的团队、项目范围。',
    question: '不同管理角色是否只看到自己应该负责的数据？',
  },
  {
    key: 'collector-health',
    label: '采集健康运营',
    heading: '采集健康详情',
    summary: '观察采集入口、队列、转发、失败和死信，保证管理者看到的数据可信。',
    question: '员工端轻量采集是否稳定、完整、可恢复？',
  },
  {
    key: 'mcp-audit',
    label: 'MCP 工具审计',
    heading: 'MCP 审计详情',
    summary: '统一审计 MCP 工具调用成功率、失败率和平均耗时。',
    question: 'MCP 主采集链路是否稳定支撑多工具接入？',
  },
  {
    key: 'rule-center',
    label: '规则中心管理',
    heading: '规则中心详情',
    summary: '管理指标规则版本、灰度策略和成员命中情况。',
    question: '指标口径和规则灰度是否可控、可解释、可回滚？',
  },
];

interface GovernanceDetailPageProps {
  sectionKey: GovernanceSectionKey;
  onBack: () => void;
  children: ReactNode;
}

const pageStyle = {
  display: 'grid',
  gap: '22px',
};

const heroStyle = {
  borderRadius: '34px',
  padding: '32px',
  background:
    'radial-gradient(circle at top right, rgba(20, 184, 166, 0.2), transparent 30%), radial-gradient(circle at bottom left, rgba(59, 130, 246, 0.16), transparent 28%), linear-gradient(135deg, #102a43 0%, #183752 48%, #18332f 100%)',
  color: '#edf9ff',
  border: '1px solid rgba(165, 243, 252, 0.18)',
  boxShadow: '0 30px 80px rgba(15, 23, 42, 0.2)',
};

export const GovernanceDetailPage = ({
  sectionKey,
  onBack,
  children,
}: GovernanceDetailPageProps) => {
  const config =
    governanceSectionConfigs.find((section) => section.key === sectionKey) ??
    governanceSectionConfigs[0];

  return (
    <section style={pageStyle}>
      <div style={heroStyle}>
        <button
          type="button"
          onClick={onBack}
          style={{
            border: '1px solid rgba(237, 249, 255, 0.26)',
            borderRadius: '999px',
            padding: '10px 14px',
            background: 'rgba(255, 255, 255, 0.1)',
            color: '#edf9ff',
            cursor: 'pointer',
            fontWeight: 800,
          }}
        >
          返回治理与采集
        </button>
        <p
          style={{
            margin: '24px 0 0',
            color: '#8de3d5',
            fontSize: '12px',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            fontWeight: 900,
          }}
        >
          Governance And Collection
        </p>
        <h2 style={{ margin: '10px 0 0', fontSize: '42px', lineHeight: 1.08 }}>
          {config.heading}
        </h2>
        <p style={{ margin: '14px 0 0', maxWidth: '780px', color: '#d8eff8', fontSize: '17px' }}>
          {config.summary}
        </p>
        <p style={{ margin: '12px 0 0', maxWidth: '780px', color: '#d1fae5', lineHeight: 1.7 }}>
          {config.question}
        </p>
      </div>
      {children}
    </section>
  );
};
