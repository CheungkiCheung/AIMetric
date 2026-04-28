# AIMetric 企业试点观察与改进手册

本文档面向提效部门负责人、技术管理者和平台管理员，用于把 AIMetric 从“功能完成”推进到“企业试点可落地”。试点目标不是强制推广 AI 工具，而是在真实工作流里观察员工自然使用、识别不好用原因，并把反馈转成工具和流程改进。

试点前建议先阅读 [product-loop-playbook.md](/Users/zhangqixiang/0_1WORK/zhongxing/AIMetric/docs/operations/product-loop-playbook.md)，统一“AI 工具体验、员工轻量接入、多源采集、指标分析、原因归因、改进动作、试点复盘”的产品闭环口径。

## 1. 试点目标

这一阶段不要追求一次性全员铺开，而是验证四件事：

1. 员工是否能轻量接入，且不影响正常编码体验
2. 提效部门是否能看清覆盖、持续使用、有效会话和体验反馈
3. 管理侧是否能稳定看到提效效果和风险归因
4. 平台侧是否能支撑权限、审计、采集健康和排障

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

提效部门负责人负责：

- 关注 AI-IDE、SDD、Co-Claw/OpenClaw 和内部 AI 工具的覆盖、持续使用、有效会话、体验反馈、产出、采纳和采集健康
- 看 AI 提效工具是否进入真实需求和代码产出，而不是只看安装量
- 识别覆盖但未持续使用、低频使用、员工觉得不好用的团队和场景
- 输出改工具体验、改流程入口、补充样例、补充培训、修复采集、质量治理、暂停或扩大试点动作

## 4. 试点闭环

试点不是单次演示，而是一条闭环：

```text
工具资产确认
  -> 员工接入
  -> 采集健康确认
  -> 指标口径校准
  -> 工具体验与效果分析
  -> 不用 / 低频 / 不好用原因归因
  -> 改进动作落地
  -> 复盘是否扩大范围
```

每周复盘时至少回答：

- 哪些 AI 工具已经接入，哪些只是接入就绪
- 哪些团队已经有稳定采集，哪些还需要平台修复
- 哪些团队 AI-IDE 使用人数比例、SDD 使用人数比例和 AI-IDE + SDD 需求覆盖率不足
- 哪些工具覆盖了但没有形成持续使用
- 员工不用、低频使用或觉得不好用的原因是什么
- 哪些工具产生了代码产出和采纳，而不是只有会话
- Co-Claw/OpenClaw 的使用频率、有效会话和一次完成情况是否稳定
- 哪些速度收益伴随质量风险
- 下一周应该改工具、改入口、补样例、培训、修复采集、治理质量，还是调整试点范围

## 5. 首批建议观察的指标

先看最稳、最容易达成一致的指标：

- 终极目标：
  - 人力节省比例
  - 人效提升比例
  - SDD 需求交付占比
- 代码度量：
  - 总代码变更行数
  - AI 代码生成行数
  - 人均代码产出
  - AI 代码生成率
  - 代码产出（行/人天）
  - AI 生成代码采纳率
- AI-IDE + SDD：
  - AI-IDE 使用人数比例
  - SDD 使用人数比例
  - AI-IDE + SDD 需求覆盖率
  - 提效预估（团队均值）
  - 持续使用人数比例
  - 有效会话数
  - 使用频率
  - Co-Claw / OpenClaw 使用人数比例
  - Co-Claw / OpenClaw 一次完成情况
- 团队维度：
  - 团队需求总数
  - AI-IDE 开发需求数
  - SDD 开发需求数
  - 各团队 AI-IDE 覆盖率
  - 各团队 SDD 覆盖率
  - 不用 AI-IDE / SDD 的原因
- 质量护栏：
  - `lead_time_ai_vs_non_ai`
  - `pr_cycle_time`
  - `critical_requirement_cycle_time`
  - `review_rejection_rate`
  - `ci_pass_rate`
  - `change_failure_rate`
  - `rollback_rate`
  - `defect_rate`
  - `escaped_defect_rate`
  - `AI 参与需求缺陷率`
  - `AI 触达 PR 逃逸缺陷率`

## 6. 试点成功标准

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
  - 能看清哪些工具只是覆盖但没有持续使用
  - 能看清不用、低频和不好用原因
  - 能看清速度提升是否带来质量代价

## 7. 建议周节奏

建议按周推进：

1. 第 1 周：
   完成员工接入、身份注册、平台健康检查
2. 第 2 周：
   校准需求 / PR / CI / 发布 / 缺陷数据导入
3. 第 3 周：
   让管理者开始稳定看覆盖、持续使用、体验反馈、效果趋势、对比和归因
4. 第 4 周：
   决定改工具、改入口、补样例、补培训、修复采集、调整范围，或进入 Agent / RAG 智能分析阶段

## 8. 演示与联调建议

建议给试点团队一套固定联调动作：

```bash
corepack pnpm demo:runbook
corepack pnpm demo:check
corepack pnpm demo:seed
```

完成后，让管理者按 [dashboard-walkthrough.md](/Users/zhangqixiang/0_1WORK/zhongxing/AIMetric/docs/operations/dashboard-walkthrough.md) 的顺序查看面板，避免第一次演示时在看板里无序跳转。

## 9. 当前阶段不建议做太重的事

这一版先不要重投入：

- 强经营 ROI 口径
- 复杂财务成本模型
- 全量组织一次性铺开
- 过早做过深 Agent 自动决策

更好的策略是：

```text
先把“采得到、看得清、解释得通、员工不反感、改进有方向”做扎实。
```
