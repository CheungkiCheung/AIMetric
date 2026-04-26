import type { ReactNode } from 'react';

export type EvidenceSectionKey = 'sessions' | 'output' | 'personal' | 'team';

export interface EvidenceSectionConfig {
  key: EvidenceSectionKey;
  label: string;
  heading: string;
  summary: string;
  question: string;
}

export const evidenceSectionConfigs: EvidenceSectionConfig[] = [
  {
    key: 'sessions',
    label: '会话分析',
    heading: '会话分析详情',
    summary: '以会话为主轴查看 AI 使用、上下文、消息规模和编辑证据。',
    question: '员工是否真的在工作流中持续使用 AI，并产生可解释的会话证据？',
  },
  {
    key: 'output',
    label: '出码分析',
    heading: '出码分析详情',
    summary: '以文件为粒度查看 AI 编辑证据、Tab 采纳和最近 diff 摘要。',
    question: 'AI 辅助是否真正落到代码文件和可追踪的工程变更上？',
  },
  {
    key: 'personal',
    label: '个人出码视图',
    heading: '个人出码详情',
    summary: '观察单个开发者的 AI 采纳规模、提交体量和会话活跃度。',
    question: '个人是否形成稳定的 AI 辅助开发习惯和有效代码产出？',
  },
  {
    key: 'team',
    label: '团队出码视图',
    heading: '团队出码详情',
    summary: '汇总团队 AI 采纳、提交表现、成员覆盖和总会话情况。',
    question: '团队层面的 AI 产出转化是否持续提升？',
  },
];

interface EvidenceDetailPageProps {
  sectionKey: EvidenceSectionKey;
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
    'radial-gradient(circle at top right, rgba(251, 191, 36, 0.22), transparent 30%), radial-gradient(circle at bottom left, rgba(14, 165, 233, 0.18), transparent 28%), linear-gradient(135deg, #241c15 0%, #3d2a17 46%, #15364a 100%)',
  color: '#fff8ee',
  border: '1px solid rgba(255, 248, 238, 0.18)',
  boxShadow: '0 30px 80px rgba(62, 43, 24, 0.2)',
};

export const EvidenceDetailPage = ({
  sectionKey,
  onBack,
  children,
}: EvidenceDetailPageProps) => {
  const config =
    evidenceSectionConfigs.find((section) => section.key === sectionKey) ??
    evidenceSectionConfigs[0];

  return (
    <section style={pageStyle}>
      <div style={heroStyle}>
        <button
          type="button"
          onClick={onBack}
          style={{
            border: '1px solid rgba(255, 248, 238, 0.26)',
            borderRadius: '999px',
            padding: '10px 14px',
            background: 'rgba(255, 255, 255, 0.1)',
            color: '#fff8ee',
            cursor: 'pointer',
            fontWeight: 800,
          }}
        >
          返回证据分析
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
          Evidence Drilldown
        </p>
        <h2 style={{ margin: '10px 0 0', fontSize: '42px', lineHeight: 1.08 }}>
          {config.heading}
        </h2>
        <p style={{ margin: '14px 0 0', maxWidth: '780px', color: '#f5dfc2', fontSize: '17px' }}>
          {config.summary}
        </p>
        <p style={{ margin: '12px 0 0', maxWidth: '780px', color: '#d7efff', lineHeight: 1.7 }}>
          {config.question}
        </p>
      </div>
      {children}
    </section>
  );
};
