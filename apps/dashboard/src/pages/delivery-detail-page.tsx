import type { ReactNode } from 'react';

export type DeliverySectionKey =
  | 'requirements'
  | 'pull-requests'
  | 'ci'
  | 'deployments'
  | 'incidents'
  | 'defects'
  | 'defect-attribution';

export interface DeliverySectionConfig {
  key: DeliverySectionKey;
  label: string;
  heading: string;
  summary: string;
  question: string;
}

export const deliverySectionConfigs: DeliverySectionConfig[] = [
  {
    key: 'requirements',
    label: '需求交付概览',
    heading: '需求交付详情',
    summary: '从需求进入到首个 PR、完成交付和 AI 触达覆盖的链路视角。',
    question: 'AI 参与后，需求是否更快、更稳定地进入正式交付？',
  },
  {
    key: 'pull-requests',
    label: 'PR 交付概览',
    heading: 'PR 交付详情',
    summary: '观察 AI 触达 PR 占比、合并效率、评审状态和周转时间。',
    question: 'AI 生成或辅助的代码是否真正进入 PR 并通过评审？',
  },
  {
    key: 'ci',
    label: 'CI 质量概览',
    heading: 'CI 质量详情',
    summary: '把 AI 提效和 CI 稳定性放在一起看，避免快但不稳。',
    question: '提效工具扩大后，自动化验证是否仍然可靠？',
  },
  {
    key: 'deployments',
    label: '发布质量概览',
    heading: '发布质量详情',
    summary: '跟踪发布频率、失败率、回滚率和 AI 触达发布占比。',
    question: 'AI 参与的变更是否能稳定进入生产？',
  },
  {
    key: 'incidents',
    label: '事故风险概览',
    heading: '事故风险详情',
    summary: '把事故与发布链路连接，识别提效推广后的生产风险。',
    question: '速度提升是否带来了更高的事故压力？',
  },
  {
    key: 'defects',
    label: '缺陷风险概览',
    heading: '缺陷风险详情',
    summary: '跟踪缺陷总量、生产缺陷、解决时长和质量趋势。',
    question: 'AI 提效是否伴随缺陷或返工上升？',
  },
  {
    key: 'defect-attribution',
    label: '缺陷归因分析',
    heading: '缺陷归因详情',
    summary: '把缺陷归因到 AI 触达需求、AI 触达 PR、发布失败和事故链路。',
    question: '风险主要来自需求、PR、发布，还是生产逃逸？',
  },
];

interface DeliveryDetailPageProps {
  sectionKey: DeliverySectionKey;
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
    'radial-gradient(circle at top right, rgba(56, 189, 248, 0.18), transparent 30%), radial-gradient(circle at bottom left, rgba(245, 158, 11, 0.2), transparent 28%), linear-gradient(135deg, #172033 0%, #26324a 48%, #3d2a17 100%)',
  color: '#eef6ff',
  border: '1px solid rgba(191, 219, 254, 0.18)',
  boxShadow: '0 30px 80px rgba(15, 23, 42, 0.18)',
};

export const DeliveryDetailPage = ({
  sectionKey,
  onBack,
  children,
}: DeliveryDetailPageProps) => {
  const config =
    deliverySectionConfigs.find((section) => section.key === sectionKey) ??
    deliverySectionConfigs[0];

  return (
    <section style={pageStyle}>
      <div style={heroStyle}>
        <button
          type="button"
          onClick={onBack}
          style={{
            border: '1px solid rgba(238, 246, 255, 0.26)',
            borderRadius: '999px',
            padding: '10px 14px',
            background: 'rgba(255, 255, 255, 0.1)',
            color: '#eef6ff',
            cursor: 'pointer',
            fontWeight: 800,
          }}
        >
          返回交付质量
        </button>
        <p
          style={{
            margin: '24px 0 0',
            color: '#f7c46c',
            fontSize: '12px',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            fontWeight: 900,
          }}
        >
          Delivery Quality Drilldown
        </p>
        <h2 style={{ margin: '10px 0 0', fontSize: '42px', lineHeight: 1.08 }}>
          {config.heading}
        </h2>
        <p style={{ margin: '14px 0 0', maxWidth: '780px', color: '#dbeafe', fontSize: '17px' }}>
          {config.summary}
        </p>
        <p style={{ margin: '12px 0 0', maxWidth: '780px', color: '#fef3c7', lineHeight: 1.7 }}>
          {config.question}
        </p>
      </div>
      {children}
    </section>
  );
};
