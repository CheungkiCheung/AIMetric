import { describe, expect, it } from 'vitest';
import {
  getEnterpriseMetricCatalog,
  listEnterpriseMetricDimensions,
  listEnterpriseMetricsByDimension,
} from './metric-catalog.js';

describe('enterprise metric catalog', () => {
  it('covers the six enterprise AI effectiveness dimensions', () => {
    expect(listEnterpriseMetricDimensions()).toEqual([
      {
        key: 'adoption',
        name: '使用渗透',
        question: 'AI 有没有真正被用起来',
        primaryAudience: ['effectiveness-manager', 'engineering-manager'],
      },
      {
        key: 'effective-output',
        name: '有效产出',
        question: 'AI 生成的内容有没有变成正式成果',
        primaryAudience: ['effectiveness-manager', 'engineering-manager'],
      },
      {
        key: 'delivery-efficiency',
        name: '交付效率',
        question: '用了 AI 之后，需求是否更快流向生产',
        primaryAudience: ['engineering-manager'],
      },
      {
        key: 'quality-risk',
        name: '质量与风险',
        question: '速度提升是否以返工或事故为代价',
        primaryAudience: ['engineering-manager', 'platform-admin'],
      },
      {
        key: 'experience-capability',
        name: '体验与能力',
        question: '开发者是否更轻松、更能学、更能协作',
        primaryAudience: ['effectiveness-manager', 'employee'],
      },
      {
        key: 'business-value',
        name: '业务与经济价值',
        question: 'AI 投入是否值得',
        primaryAudience: ['engineering-manager', 'effectiveness-manager'],
      },
    ]);
  });

  it('defines governance metadata for every metric', () => {
    const catalog = getEnterpriseMetricCatalog();

    expect(catalog.metrics.length).toBeGreaterThanOrEqual(21);
    expect(catalog.metrics).toContainEqual(
      expect.objectContaining({
        key: 'ai_ide_user_ratio',
        name: 'AI-IDE 使用人数比例',
        dimension: 'adoption',
        automationLevel: 'high',
        dataSources: ['mcp-events', 'tool-adapter-events', 'organization-directory'],
        formula: 'AI-IDE 活跃使用人数 / 目标开发者人数',
        dashboardPlacement: 'effectiveness-management',
        assessmentUsage: 'observe-only',
      }),
    );
    expect(catalog.metrics).toContainEqual(
      expect.objectContaining({
        key: 'lead_time_ai_vs_non_ai',
        name: 'AI 参与需求 Lead Time 对比',
        dimension: 'delivery-efficiency',
        automationLevel: 'medium',
        dashboardPlacement: 'engineering-management',
        assessmentUsage: 'team-improvement',
      }),
    );
    expect(catalog.metrics).toContainEqual(
      expect.objectContaining({
        key: 'rollback_rate',
        name: '回滚率',
        dimension: 'quality-risk',
        dashboardPlacement: 'engineering-management',
      }),
    );
    expect(catalog.metrics).toContainEqual(
      expect.objectContaining({
        key: 'defect_rate',
        name: '缺陷率',
        dimension: 'quality-risk',
        dataSources: ['defect-tracker', 'delivery-tracker'],
      }),
    );

    for (const metric of catalog.metrics) {
      expect(metric.question.length).toBeGreaterThan(0);
      expect(metric.formula.length).toBeGreaterThan(0);
      expect(metric.dataSources.length).toBeGreaterThan(0);
      expect(metric.updateFrequency.length).toBeGreaterThan(0);
      expect(metric.antiGamingNote.length).toBeGreaterThan(0);
    }
  });

  it('filters metrics by dimension without mutating the catalog', () => {
    const adoptionMetrics = listEnterpriseMetricsByDimension('adoption');

    expect(adoptionMetrics.map((metric) => metric.key)).toContain('weekly_active_ai_users');
    expect(adoptionMetrics.every((metric) => metric.dimension === 'adoption')).toBe(true);

    adoptionMetrics.push({
      key: 'local_only',
      name: '本地临时指标',
      dimension: 'adoption',
      question: '不应该污染全局字典',
      formula: 'N/A',
      dataSources: ['manual-survey'],
      automationLevel: 'low',
      updateFrequency: 'manual',
      dashboardPlacement: 'effectiveness-management',
      assessmentUsage: 'observe-only',
      antiGamingNote: '仅用于测试不可变返回。',
    });

    expect(listEnterpriseMetricsByDimension('adoption')).not.toContainEqual(
      expect.objectContaining({ key: 'local_only' }),
    );
  });
});
