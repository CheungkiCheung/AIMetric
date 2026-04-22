import type { ReactNode } from 'react';

export interface MetricCardProps {
  label: string;
  value: string;
  helper: ReactNode;
}

export const MetricCard = ({ label, value, helper }: MetricCardProps) => (
  <article
    style={{
      borderRadius: '20px',
      padding: '20px',
      background: 'linear-gradient(180deg, #fffdfa 0%, #f6efe5 100%)',
      border: '1px solid #e8d9c8',
      boxShadow: '0 12px 24px rgba(87, 63, 35, 0.08)',
    }}
  >
    <p
      style={{
        margin: 0,
        fontSize: '13px',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: '#7d5f43',
      }}
    >
      {label}
    </p>
    <p
      style={{
        margin: '10px 0 6px',
        fontSize: '36px',
        fontWeight: 700,
        color: '#2e241b',
      }}
    >
      {value}
    </p>
    <div style={{ color: '#5d4733', fontSize: '14px' }}>{helper}</div>
  </article>
);
