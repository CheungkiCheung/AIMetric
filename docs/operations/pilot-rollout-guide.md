# AIMetric 企业试点推进手册

本文档面向提效管理者、技术管理者和平台管理员，用于把 AIMetric 从“功能完成”推进到“企业试点可落地”。

## 1. 试点目标

这一阶段不要追求一次性全员铺开，而是验证三件事：

1. 员工是否能轻量接入，且不影响正常编码体验
2. 管理侧是否能稳定看到多维指标和风险归因
3. 平台侧是否能支撑权限、审计、采集健康和排障

## 2. 建议试点范围

建议第一批：

- `1-2` 个团队
- `10-30` 名研发
- `1-2` 个核心项目
- 同时覆盖至少两类 AI 工具

例如：

- `Cursor + Codex`
- `Cursor + Claude Code`
- `CLI + VS Code`

这样可以更早验证“多工具统一采集”能力。

## 3. 角色分工

平台管理员负责：

- 部署 `collector-gateway / metric-platform / dashboard`
- 配置 token、viewer scope、collector identity
- 跟进 `/ready`、`/metrics`、`/ingestion/health`

技术管理者负责：

- 确认团队 / 项目 / 成员治理映射
- 关注需求、PR、CI、发布、事故、缺陷与归因面板
- 解释指标是否符合本团队真实语义

提效管理者负责：

- 关注使用渗透、活跃、会话、采集健康
- 看 AI adoption 是否进入真实场景
- 识别低使用、低采集质量、低转化团队

## 4. 首批建议观察的指标

先看最稳、最容易达成一致的指标：

- 使用渗透：
  - AI 工具活跃人数
  - 会话数
  - AI 触达需求占比
- 有效产出：
  - AI 出码率
  - AI 触达 PR 占比
- 交付效率：
  - `lead_time_ai_vs_non_ai`
  - `pr_cycle_time`
  - `critical_requirement_cycle_time`
- 质量风险：
  - `review_rejection_rate`
  - `ci_pass_rate`
  - `change_failure_rate`
  - `rollback_rate`
  - `defect_rate`
  - `escaped_defect_rate`
  - `AI 参与需求缺陷率`
  - `AI 触达 PR 逃逸缺陷率`

## 5. 试点成功标准

第一阶段不建议直接用 ROI 判断成败，建议用下面口径：

- 员工侧：
  - 接入时长可控
  - 日常体验无明显阻塞
  - `doctor / status / flush` 能独立排障
- 平台侧：
  - 采集健康稳定
  - outbox 不长期积压
  - viewer scope 与身份映射可控
- 管理侧：
  - 能看清团队差异
  - 能看清 AI 是否真正进入需求与 PR
  - 能看清速度提升是否带来质量代价

## 6. 建议周节奏

建议按周推进：

1. 第 1 周：
   完成员工接入、身份注册、平台健康检查
2. 第 2 周：
   校准需求 / PR / CI / 发布 / 缺陷数据导入
3. 第 3 周：
   让管理者开始稳定看趋势、对比和归因
4. 第 4 周：
   决定是否扩大范围，或进入 Agent / RAG 智能分析阶段

## 7. 当前阶段不建议做太重的事

这一版先不要重投入：

- 强经营 ROI 口径
- 复杂财务成本模型
- 全量组织一次性铺开
- 过早做过深 Agent 自动决策

更好的策略是：

```text
先把“采得到、看得清、解释得通、员工不反感”做扎实。
```
