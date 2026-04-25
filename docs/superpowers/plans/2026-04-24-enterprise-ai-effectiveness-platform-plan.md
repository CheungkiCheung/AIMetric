# AIMetric 企业级 AI 研发效能平台下一阶段最终版计划

## 1. 当前阶段结论

AIMetric 已经完成从文章同构复现到准生产原型的第一阶段建设。

已经具备的能力：

- `MCP 标准采集`：支持 `beforeEditFile`、`afterEditFile`、`recordSession`、规则查询、知识查询、工具审计。
- `员工接入`：`employee-onboarding` 可生成 `.aimetric/config.json`、`.aimetric/mcp.json`、Cursor / CLI / VS Code 适配配置。
- `多入口采集`：已有 CLI 标准采集、Cursor transcript 增强采集、Tab 接受事件、Cursor 本地状态库证据。
- `证据链`：已有会话主线、文件级 edit span、Tab 接受、MCP 工具审计、状态库证据。
- `平台能力`：已有采集网关、指标平台、PostgreSQL 持久化、幂等去重、指标快照、手动 / 定时回算。
- `规则中心`：已有规则版本、模板校验、激活版本、灰度发布、命中计算。
- `Dashboard`：已有个人出码、团队出码、MCP 采集质量、规则中心、会话分析、出码分析、企业指标语义层展示。
- `准生产基础`：已有采集端 token、管理端 token、管理审计、`/ready`、Prometheus `/metrics`、运维手册。

当前判断：

- 系统已经证明“AI 编码工具 -> 采集 -> 证据 -> 指标 -> 管理视图”的闭环可跑通。
- 当前架构支持继续扩展指标和 AI 工具采集，但扩展成本仍偏中等，后续需要补齐指标注册、计算管线、工具适配器协议和组织治理模型。
- 下一阶段目标不是继续做一个更大的看板，而是升级为企业级 AI 研发效能度量、治理与提效决策平台。

## 2. 产品定位

```text
AIMetric 不是单纯的 AI 出码率看板，
而是企业级 AI 研发效能度量、治理、归因和提效决策平台。
```

平台要回答六类问题：

1. `使用渗透`：AI 有没有真正被用起来。
2. `有效产出`：AI 生成的内容有没有变成正式成果。
3. `交付效率`：用了 AI 之后，需求是否更快流向生产。
4. `质量与风险`：速度提升是否以返工、缺陷或事故为代价。
5. `体验与能力`：开发者是否更轻松、更能学、更能协作。
6. `业务与经济价值`：AI 投入是否值得。

最终形态：

- 员工侧轻量安装、无感采集、可解释隐私边界。
- 平台侧多 AI 工具统一采集、异步上报、证据可追溯。
- 管理侧多维指标分析、团队对比、趋势归因、质量护栏。
- 智能侧接入 Agent / RAG，提供带证据来源的解释、建议和行动方案。

## 3. 目标用户与痛点

### 3.1 员工 / 一线开发者

核心痛点：

- 不想安装复杂工具或维护多份配置。
- 不希望采集影响 Cursor、Claude Code、Codex、VS Code、JetBrains 等日常开发体验。
- 担心代码、提示词、文件路径、业务信息被过度采集。
- 希望系统也能给自己带来价值，例如规则查询、知识查询、采集自检、问题诊断。

产品原则：

- 安装简单，目标 3 分钟内完成。
- 热路径只做轻量采集，默认不阻塞编码。
- 网络不可用时本地缓冲，不影响 AI 工具使用。
- 采集范围、隐私策略、上报状态可解释。
- 员工侧默认看“帮助自己提效的信息”，不做个人压力型排名。

### 3.2 提效管理者 / AI 效能运营

核心痛点：

- 不知道 AI 工具是否真正进入研发流程。
- 不知道哪些团队推广有效，哪些只是装了没用。
- 不知道低使用率来自工具问题、场景问题、培训问题还是采集问题。
- 难以把推广动作和有效产出、交付效率、质量风险连接起来。

产品价值：

- 看清 AI-IDE、SDD、MCP、增强采集等覆盖率。
- 看清活跃人数、会话数、轮次、Tab 占比、采集健康率。
- 找到低使用团队、高潜力场景、采集异常、工具失败。
- 把推广策略从主观判断变成数据运营。

### 3.3 技术管理者 / 研发负责人

核心痛点：

- 不知道 AI 是否真的缩短需求周期。
- 不知道 AI 是否带来 Review 返工、缺陷、回滚或事故风险。
- 不知道不同团队和项目的差异来自人、工具、流程还是工程质量。
- 缺少能支持预算、工具选型、培训投入和组织治理的指标体系。

产品价值：

- 比较 AI 参与需求和非 AI 参与需求的 Lead Time。
- 比较 AI 参与 PR 的 CI 失败率、Review 退回率、缺陷率、回滚率。
- 分析团队、项目、工具、时间、需求类型等维度差异。
- 输出可用于经营沟通的 ROI、单位需求成本、关键需求周期等指标。

### 3.4 研发平台 / 管理员

核心痛点：

- 多工具接入配置容易散乱。
- token、采集策略、规则版本、权限、审计都需要治理。
- 数据质量问题需要排查：重复、延迟、失败、缺失、口径不一致。
- 企业级接入需要组织、团队、项目、成员、角色和策略模型。

产品价值：

- 管理接入包、采集身份、token、规则版本、采集策略。
- 监控 collector、MCP、adapter、队列、回算任务健康。
- 管理组织、团队、项目、成员映射。
- 支持数据质量修复、指标回算、权限审计和隐私策略。

## 4. 架构决策

### 4.1 推荐架构

下一阶段采用：

```text
模块化单体 + 事件驱动采集 + DDD-lite 领域边界
```

不建议现在直接做重 DDD 或微服务拆分。

原因：

- 当前团队和项目阶段更适合快速迭代、统一部署和低运维成本。
- 领域复杂度已经出现，但还没复杂到需要完整微服务。
- DDD 的价值应体现在边界、语言、模型和依赖方向，而不是堆复杂框架。
- 模块化单体可以先把领域边界立起来，未来如果某个模块压力变大，再拆成服务。

### 4.2 领域边界

建议把系统按以下领域划分：

```text
Employee Edge 员工端接入
Tool Adapter 多工具采集适配
Ingestion 采集网关与队列
Evidence & Attribution 证据与归因
Metric Semantics 指标语义
Metric Calculation 指标计算
Organization & Governance 组织权限治理
Management Analytics 管理分析
Integration 外部系统集成
Agent / RAG Intelligence 智能分析
```

需要重点领域建模的部分：

- `Metric Semantics`：指标定义、口径、数据源、自动化等级、反误导说明、适用场景。
- `Metric Calculation`：指标计算器、数据需求、快照、回算、版本化口径。
- `Evidence & Attribution`：AI 编辑证据、Tab 证据、Git 归因、PR 归因、需求归因。
- `Organization & Governance`：组织、团队、项目、成员、角色、权限、策略、审计。
- `Management Analytics`：面向管理者的分析模型、趋势、对比、异常解释。
- `Integration`：GitHub、GitLab、Jira、TAPD、禅道、CI/CD、缺陷、发布系统防腐层。

不需要重 DDD 的部分：

- 员工端安装脚本。
- HTTP 路由薄层。
- Dashboard 展示组件。
- 数据库 CRUD 适配。
- 单个工具 adapter 的浅层协议转换。

## 5. 目标企业级架构

```text
员工端轻量接入层
  -> 多工具采集适配层
  -> 本地缓冲与采集 SDK
  -> 采集网关与异步队列
  -> 原始事件层
  -> 证据与归因层
  -> 指标语义与计算层
  -> 组织权限与治理层
  -> 管理者多维分析工作台
  -> Agent / RAG 智能分析层
```

### 5.1 员工端轻量接入层

目标：

- 一个安装包或一条 onboarding 命令完成接入。
- 自动检测 AI 工具和 IDE。
- 自动生成 MCP 配置、采集配置、工具特定配置。
- 支持自检、修复、升级、卸载。

关键能力：

- `aimetric onboard --profile=cursor|claude-code|codex|vscode|jetbrains|cli`
- `aimetric doctor`
- `aimetric status`
- `aimetric uninstall`
- 采集状态展示。
- 本地配置刷新。
- 网络失败本地缓冲。

验收标准：

- 新员工 3 分钟内完成安装。
- 默认热路径延迟低于 100ms。
- 采集失败不影响 AI 工具使用。
- 员工能看到采集范围和隐私说明。

### 5.2 多工具采集适配层

目标：

- 不绑定单一 AI 工具。
- 不同 AI 工具统一归一为 AIMetric 标准事件。
- 新增工具时只需要实现 adapter，不修改核心指标平台。

优先支持：

- Cursor：MCP、transcript、state.vscdb、Tab。
- Claude Code：MCP / CLI 会话 / 工具调用 / 编辑证据。
- Codex CLI：CLI 会话、工具调用、代码编辑证据。
- VS Code：MCP / extension profile / 编辑事件。
- JetBrains：插件预留。
- 通用 CLI agent：命令行适配器。

标准 adapter 协议：

```text
ToolAdapterManifest
  toolKey
  displayName
  supportedPlatforms
  supportedEventTypes
  collectionMode
  privacyLevel
  latencyProfile
  requiredPermissions
  healthChecks
  versionCompatibility
```

adapter 必须提供：

- `manifest`：声明工具能力和采集边界。
- `eventMapper`：把工具原始事件映射为 AIMetric 标准事件。
- `healthCheck`：检测配置、权限、版本、连接状态。
- `privacyPolicy`：声明是否采集 diff、路径、prompt、文件内容、元数据。
- `failurePolicy`：声明失败后缓存、丢弃、重试或降级。

### 5.3 采集网关与异步队列

目标：

- 保护员工体验。
- 支持大规模并发接入。
- 平台短暂不可用时不影响开发者使用。

建议路径：

```text
collector-sdk / adapter
  -> local buffer / outbox
  -> collector-gateway
  -> queue
  -> ingestion-worker
  -> metric-platform / PostgreSQL
```

第一阶段队列：

- Redis Stream 或 BullMQ。

后续企业级可升级：

- Kafka 或 Redpanda。

必须能力：

- 幂等 key。
- 重试。
- DLQ。
- 限流。
- 批量上报。
- 队列积压指标。
- 采集延迟指标。
- 采集失败率。
- 采集重复率。

### 5.4 原始事件层

目标：

- 保存从工具和外部系统来的原始事实。
- 不让 Dashboard 和指标计算直接依赖复杂原始事件查询。

建议表 / 模型：

```text
raw_events
raw_event_batches
collector_identities
event_ingestion_errors
event_deduplication_keys
```

原则：

- 原始事件尽量不可变。
- 原始事件只做轻度校验和归档。
- 后续证据、归因、指标都可以从原始事件重算。

### 5.5 证据与归因层

目标：

- 把原始事件加工成可解释、可追溯、可复算的证据。
- 支撑“AI 是否参与了这段代码、这个 PR、这个需求、这个发布”的判断。

建议模型：

```text
session_evidence
edit_span_evidence
tab_acceptance_evidence
tool_call_evidence
git_attribution_evidence
pr_attribution_evidence
delivery_attribution_evidence
quality_evidence
```

核心能力：

- 会话归因。
- 文件级编辑归因。
- PR 归因。
- 需求归因。
- 发布归因。
- AI 参与程度分级。
- 证据置信度。

验收标准：

- 每个管理指标都能追溯到证据摘要。
- 每个 AI 参与判断都有置信度和来源。
- 证据层支持重算，不依赖一次性计算结果。

### 5.6 指标语义与计算层

目标：

- 指标可扩展。
- 指标口径统一。
- 指标计算可测试、可回算、可版本化。

当前已完成：

- `@aimetric/metric-core` 已有企业指标语义字典。
- 已覆盖六类指标维度。
- 已在 `metric-platform` 暴露指标目录 API。
- Dashboard 已展示企业指标语义层。
- `@aimetric/metric-core` 已新增第一版 `MetricRegistry`、`MetricCalculator` 和 `MetricCalculationPipeline`。
- 已新增 `MetricDataRequirement`，可计算指标会声明 `requiredEvidence` 和 `outputSchema`。
- 企业指标计算结果已包含 `definitionVersion`、`dataRequirements` 和数据置信度。
- `metric-platform` 已新增 `GET /enterprise-metrics/values`，支持按项目、成员、周期和 `metricKey` 计算企业指标值。
- `metric-platform` 已新增企业指标快照 writer、PostgreSQL `enterprise_metric_snapshots` 持久化和 `GET /enterprise-metrics/snapshots`。
- `metric-platform` 已新增 `POST /enterprise-metrics/recalculate`，支持按 `metricKeys` 回算并写入企业指标快照。
- Dashboard 已接入统一指标计算管线，不需要为每个新指标改主刷新流程。

第一版已补齐：

```text
MetricDefinition
MetricDataRequirement
MetricCalculator
MetricSnapshotWriter
MetricViewModel
MetricRegistry
MetricCalculationPipeline
```

下一步必须补齐：

```text
按组织、团队、项目、周期执行企业指标回算任务
指标版本废弃与迁移策略
```

指标注册协议：

```text
MetricDefinition
  key
  name
  dimension
  question
  formula
  dataSources
  automationLevel
  updateFrequency
  dashboardPlacement
  assessmentUsage
  antiGamingNote

MetricCalculator
  metricKey
  requiredEvidence
  calculate(input, context)
  outputSchema
  confidenceRule
```

新增指标的理想流程：

1. 在指标目录注册 `MetricDefinition`。
2. 声明需要哪些证据或外部数据。
3. 实现 `MetricCalculator`。
4. 增加测试样例。
5. 注册 Dashboard 放置位置。
6. 进入回算与快照管线。

验收标准：

- 新增一个基于已有数据源的指标，不需要改 HTTP 路由和 Dashboard 主流程。
- 新增一个需要新数据源的指标，只需要新增 integration adapter、防腐映射和 calculator。
- 指标计算结果包含口径版本和数据置信度。

### 5.7 组织权限与治理层

目标：

- 支持企业多团队、多项目、多角色、多策略使用。

核心实体：

```text
organization
team
project
repository
member
membership
collector_identity
role
permission
policy
audit_event
```

角色：

- `developer`
- `team_manager`
- `tech_manager`
- `efficiency_operator`
- `platform_admin`
- `security_auditor`

治理能力：

- 项目采集白名单 / 黑名单。
- 敏感文件过滤。
- prompt / diff / 文件内容采集策略。
- 增强采集授权策略。
- 数据保留周期。
- 团队级、项目级、成员级策略下发。
- 管理端操作审计。
- Dashboard 按角色展示不同视图。

### 5.8 外部系统集成层

目标：

- 把 AI 使用数据连接到真实研发交付。
- 不让 GitHub、GitLab、Jira、TAPD、禅道、CI/CD 等外部字段污染核心模型。

采用防腐层：

```text
External Provider Raw Data
  -> Provider Adapter
  -> Anti-Corruption Mapper
  -> AIMetric Canonical Model
  -> Evidence / Metric Calculation
```

优先集成：

- GitHub / GitLab PR。
- CI/CD。
- 需求系统。
- 缺陷系统。
- 发布系统。
- 事故 / 回滚系统。

统一模型：

```text
delivery_item
pull_request
ci_run
deployment
defect
incident
review_event
```

### 5.9 多维分析工作台

目标：

- 面向提效管理者和技术管理者，而不是只给开发者看个人指标。

建议视图：

1. `总览驾驶舱`
2. `使用渗透 Dashboard`
3. `有效产出 Dashboard`
4. `交付效率 Dashboard`
5. `质量风险 Dashboard`
6. `体验与能力 Dashboard`
7. `业务 ROI Dashboard`
8. `平台运营 Dashboard`

统一筛选维度：

- 组织。
- 团队。
- 项目。
- 仓库。
- 成员。
- 工具。
- 需求类型。
- 时间周期。
- 采集模式。
- 指标维度。

### 5.10 Agent / RAG 智能分析层

目标：

- 把看板从“展示数据”升级为“解释数据、给出建议、推动行动”。

原则：

- Agent 不直接定义指标口径。
- Agent 不直接乱查原始表。
- Agent 使用只读分析上下文 API。
- Agent 输出必须带证据引用。
- 管理建议面向团队改进，不用于简单个人排名。

只读分析上下文：

```text
MetricCatalogContext
MetricSnapshotContext
EvidenceSummaryContext
OrganizationContext
RuleContext
KnowledgeContext
```

Agent 能力：

- 指标解释 Agent。
- 异常诊断 Agent。
- 提效建议 Agent。
- 采集质量诊断 Agent。
- 规则优化建议 Agent。
- 管理复盘摘要 Agent。

## 6. 六类指标自动化分级

### 6.1 使用渗透

自动化程度：高。

可自动采集：

- AI-IDE 使用人数比例。
- 各团队 AI-IDE 覆盖率。
- 活跃人数占比。
- 周活 / 月活。
- 会话数。
- 轮次。
- 使用时长。
- Tab 占比。
- AI 辅助编程时长。
- MCP 工具调用次数。
- 标准采集档 / 增强采集档覆盖率。

需要外部映射：

- SDD 使用人数比例。
- AI-IDE + SDD 需求覆盖率。
- 结对编程参与人数。
- Co-Claw / OpenClaw 指标。

适合视图：

- 使用渗透 Dashboard。
- 平台运营 Dashboard。

### 6.2 有效产出

自动化程度：中高。

可自动采集：

- AI 出码率。
- AI 生成代码采纳率。
- 总代码变更行数。
- AI 代码生成行数。
- 人均代码产出。
- 代码产出行 / 人天。
- AI 触达 PR 占比。
- 编辑证据数。
- Tab 接受行数。

需要增强归因：

- AI 产出最终保留率。
- AI 测试采纳率。
- AI 参与需求数。

适合视图：

- 有效产出 Dashboard。
- 出码分析 Dashboard。

### 6.3 交付效率

自动化程度：中，需要外部系统。

指标：

- 需求到 PR 时间。
- PR 周转时间。
- Lead Time。
- Deployment Frequency。
- 需求从开始到完成耗时。
- AI 参与需求 vs 非 AI 参与需求周期差异。

适合视图：

- 交付效率 Dashboard。
- 价值流分析 Dashboard。

### 6.4 质量与风险

自动化程度：中，需要 CI、缺陷、Review、发布系统。

指标：

- 测试通过率。
- CI 失败率。
- Review 退回率。
- 缺陷率。
- 变更失败率。
- 回滚率。
- 返工率。
- 安全扫描问题数。
- Review comment 数。

适合视图：

- 质量风险 Dashboard。
- AI 参与 PR 质量对照分析。

### 6.5 体验与能力

自动化程度：低到中。

主要来源：

- 问卷。
- 访谈。
- 工具使用行为。
- 接入失败与工具失败日志。

指标：

- 不用 AI-IDE 的原因。
- 不用 SDD 的原因。
- 满意度。
- 信任度。
- 认知负荷。
- 心流时间。
- 新人上手时间。

适合视图：

- 开发者体验 Dashboard。
- 组织能力 Dashboard。

### 6.6 业务与经济价值

自动化程度：中，需要建模。

指标：

- 终极目标指标。
- 团队需求总数。
- 单位需求成本。
- 关键需求周期。
- 缺陷损失下降。
- AI 工具成本。
- 节省工时估算。
- ROI。

适合视图：

- ROI Dashboard。
- 经营汇报 Dashboard。

## 7. 下一阶段执行路线

### Phase E1：企业指标语义层

状态：第一版已完成。

已完成：

- 指标语义字典。
- 六类核心维度。
- 指标目录 API。
- Dashboard 企业指标语义层展示。

后续增强：

- 指标版本。
- 指标废弃策略。
- 指标依赖数据源声明。
- 指标和 Dashboard view model 的稳定映射。

### Phase E2：指标注册与计算管线

状态：第一版已完成，组织/团队维度回算与指标版本治理待继续。

目标：

- 把“指标字典”升级为“可扩展指标计算平台”。

交付：

- `MetricRegistry`：已完成第一版。
- `MetricCalculator` 协议：已完成第一版，包含 `requiredEvidence`、`outputSchema` 和 `calculate(input, context)`。
- `MetricDataRequirement`：已完成第一版，覆盖 `recorded-metric-events`、`analysis-summary`、`mcp-audit-metrics`。
- `MetricCalculationPipeline`：已完成第一版，支持按 `metricKey` 子集计算。
- 指标口径版本：计算结果已包含 `definitionVersion`。
- 指标置信度：计算结果已包含 `confidence`。
- 现有出码率、会话数、Tab 接受行数、MCP 审计指标已接入新管线。
- `metric-platform` 已通过 `GET /enterprise-metrics/values` 暴露计算值。
- `MetricSnapshotWriter`：已完成第一版。
- 企业指标快照持久化：已完成第一版，使用 PostgreSQL `enterprise_metric_snapshots`。
- 企业指标回算 API：已完成第一版，`POST /enterprise-metrics/recalculate` 支持按 `metricKeys` 回算。
- 企业指标快照查询 API：已完成第一版，`GET /enterprise-metrics/snapshots` 支持按筛选条件和 `metricKey` 查询。
- Dashboard 已展示统一指标计算管线结果。

后续增强：

- 回算任务按组织、团队、项目、周期执行。
- 指标版本废弃、迁移和兼容策略。

验收标准：

- 新增一个基于已有证据的指标，只需要新增 definition、calculator、test：第一版已满足。
- Dashboard 不需要为每个新指标硬编码主流程：第一版已满足。
- 回算任务可以按指标 key、项目、成员、周期执行：第一版已满足。
- 回算任务可以按组织、团队维度执行：待后续增强。

### Phase E3：多工具采集适配器协议

状态：第一版已完成，真实 Codex CLI / Claude Code 采集实现待继续。

目标：

- 让后续扩展 Claude Code、Codex、VS Code、JetBrains、通用 CLI agent 时有统一标准。

交付：

- `ToolAdapterManifest`：已完成第一版，放在 `@aimetric/event-schema`。
- `EventMapper`：已完成第一版 `normalizeToolAdapterEvent`，把 adapter 事件归一为 AIMetric ingestion event。
- `AdapterHealthCheck`：已完成第一版 `createAdapterHealthReport`。
- `AdapterPrivacyPolicy`：已完成第一版，manifest 可声明 prompt、completion、diff、filePath、fileContent 和 redaction 策略。
- `AdapterFailurePolicy`：已完成第一版，manifest 可声明 offline、permission denied、schema mismatch 和 retry 策略。
- Cursor adapter 按新协议改造：已完成第一版 manifest 和 health report。
- CLI adapter 按新协议改造：已完成第一版 manifest 和 health report。
- Codex CLI / Claude Code adapter 示例：已完成第一版 manifest preset。

后续增强：

- Codex CLI 真实会话日志采集实现。
- Claude Code 真实会话日志和 MCP 调用采集实现。
- VS Code / JetBrains adapter 预研。
- 平台运营 Dashboard 展示 adapter 健康状态。

验收标准：

- 新增一种 AI 工具时不改指标核心模型：第一版已满足，adapter 通过 manifest 和标准事件接入。
- 每个 adapter 都能声明采集能力、隐私等级、性能影响和健康状态：第一版已满足。
- 平台运营 Dashboard 能看到各 adapter 的接入状态和失败原因：待后续增强。

### Phase E4：员工端轻量化安装与自检

目标：

- 把接入从“生成配置”升级为“企业安装体验”。

当前已完成：

- `@aimetric/employee-onboarding` 已新增统一命令入口 `aimetric`，兼容原 `aimetric-onboard`。
- `aimetric onboard` 已支持 `cursor`、`cli`、`vscode`、`codex`、`claude-code`、`jetbrains` 多 profile。
- Codex CLI / Claude Code profile 会生成 `.aimetric/codex.env`、`.aimetric/claude-code.env`，员工可直接 source 后进入工具会话。
- `aimetric status` 已支持读取 `.aimetric/config.json` 并输出项目、成员、仓库、工具 profile、collector endpoint 和 metric platform endpoint。
- `aimetric doctor` 已支持检查核心配置、MCP 配置和 collector token 环境变量提示，缺失时给出明确 onboarding 修复建议。
- 员工端配置仍只保存 token 环境变量名，不保存真实 token。
- 员工端安装路径继续沿用 `.aimetric/`，便于未来扩展卸载、升级、本地缓冲和隐私透明度说明。

交付：

- `aimetric onboard` 多 profile：第一版已完成。
- `aimetric doctor`：第一版已完成。
- `aimetric status`：第一版已完成。
- 自动修复 MCP 配置：待增强。
- 本地缓冲状态查看：待 E5 异步采集与本地缓冲阶段补齐。
- 采集透明度说明：待增强为员工可读说明页 / CLI 输出。

验收标准：

- 员工无需理解 MCP 配置即可接入：第一版已满足，仍需补自动探测和自动修复。
- 安装失败时能给出明确修复建议：第一版已满足。
- 采集失败不会阻断开发：架构原则已满足，E5 需要通过本地缓冲和异步队列继续强化。

### Phase E5：异步采集与队列

目标：

- 保护员工端体验，提升大规模接入稳定性。

交付：

- Redis Stream / BullMQ：待企业级持久队列替换。
- ingestion worker：第一版已完成手动 flush worker 入口 `POST /ingestion/flush`。
- retry / DLQ：第一版已完成进程内队列重试和 DLQ 计数。
- queue lag 指标：第一版已完成 queue depth / DLQ depth。
- 采集失败率、重复率、延迟指标：第一版已完成失败投递计数，延迟和重复率待增强。
- 管理端采集健康 API：第一版已完成 `GET /ingestion/health`。

验收标准：

- collector-gateway 短暂不可用时员工端可以本地缓冲：第一版已完成，collector-sdk 支持 `.aimetric/outbox`，CLI adapter 和 Cursor adapter 已接入。
- 员工端可恢复投递：第一版已完成，`aimetric status` 展示 `outboxDepth`，`aimetric doctor` 对待 flush 批次降级提醒，`aimetric flush` 可手动发送本地 outbox。
- ingestion worker 可以恢复消费：第一版已满足，队列模式下 flush 后可恢复投递。
- 重复事件不会重复计入指标：已有 ingestion key 幂等基础，E5 后续需要把队列重放场景纳入专项测试。

### Phase E6：组织权限与治理模型

目标：

- 支持企业多团队、多项目、多角色治理。

交付：

- PostgreSQL 组织模型。
- `collector_identity`。
- RBAC 基础权限。
- 管理端 API 鉴权升级。
- Dashboard 按角色展示不同视图。
- 审计事件增强。
- 数据保留与隐私策略。

验收标准：

- 技术管理者只能看授权组织和团队。
- 平台管理员可以配置采集策略。
- 安全审计者可以查询审计和隐私策略。

### Phase E7：外部研发系统集成

目标：

- 把 AI 使用数据连接到真实研发交付。

交付：

- GitHub / GitLab PR 集成。
- CI/CD 集成。
- 需求系统集成。
- 缺陷系统集成。
- 发布系统集成。
- AI 参与需求 / PR / 发布链路归因。

验收标准：

- 能计算 AI 参与 PR 占比。
- 能计算 AI 参与需求 Lead Time 对比。
- 能计算 AI 参与 PR 的质量风险指标。

### Phase E8：管理者多维分析工作台

目标：

- 面向提效管理者和技术管理者提供决策视图。

交付：

- 使用渗透 Dashboard。
- 有效产出 Dashboard。
- 交付效率 Dashboard。
- 质量风险 Dashboard。
- 体验与 ROI Dashboard。
- 平台运营 Dashboard。
- 多维筛选和趋势对比。

验收标准：

- 提效管理者能看到推广效果和采集健康。
- 技术管理者能看到效率、质量、风险和 ROI。
- 每个关键指标都能查看口径、数据源和反误导说明。

### Phase E9：Agent / RAG 智能分析

目标：

- 让管理者可以自然语言分析指标、异常、团队差异和改进建议。

交付：

- 指标解释 Agent。
- 异常诊断 Agent。
- 提效建议 Agent。
- 采集质量诊断 Agent。
- RAG 知识库索引。
- 分析结论证据引用。

验收标准：

- Agent 回答必须引用指标口径和证据摘要。
- Agent 不直接查询原始表。
- Agent 输出区分事实、推断和建议。

### Phase E10：生产化与安全治理

目标：

- 达到企业试点和准生产部署要求。

交付：

- Helm Chart 完整化。
- 备份与恢复方案。
- 数据脱敏策略。
- 审计日志保留策略。
- SLO / SLA 指标。
- 压测脚本。
- 安全扫描。
- 运维 Runbook 升级。

验收标准：

- 支持多团队试点。
- 支持故障恢复。
- 支持权限审计。
- 支持采集链路可观测。

## 8. 推荐执行顺序

最推荐从这里继续：

```text
Phase E2 指标注册与计算管线
```

原因：

- E1 已经完成指标语义第一版。
- E2 能把“指标可扩展”真正落地。
- 没有计算管线，后续每加一个指标都要改多处代码。
- E2 完成后，Dashboard、Agent、外部系统集成都能复用统一指标能力。

推荐顺序：

1. `E2 指标注册与计算管线`
2. `E3 多工具采集适配器协议`
3. `E4 员工端轻量化安装与自检`
4. `E5 异步采集与队列`
5. `E6 组织权限与治理模型`
6. `E7 外部研发系统集成`
7. `E8 管理者多维分析工作台`
8. `E9 Agent / RAG 智能分析`
9. `E10 生产化与安全治理`

并行策略：

- `E2` 和 `E3` 可以部分并行，但 E2 优先。
- `E4` 和 `E5` 可以并行，因为都服务员工端体验。
- `E6` 应在大规模管理者 Dashboard 前完成。
- `E9` 不应早于 E2、E6、E7，否则 Agent 缺少可信上下文。

## 9. 企业级成功标准

员工侧：

- 安装简单。
- 日常使用无明显延迟。
- 清楚知道采集范围。
- 不因为采集导致工具不可用。
- 遇到采集异常能自检和修复。

提效管理侧：

- 能看清采用度、活跃度、覆盖率、采集健康。
- 能识别推广问题、低使用团队和高潜力场景。
- 能比较不同工具、团队、项目的使用效果。

技术管理侧：

- 能看清有效产出、交付效率、质量风险和 ROI。
- 能按组织、团队、项目、成员、工具、时间维度分析。
- 能证明提效没有牺牲质量。

平台侧：

- 多工具接入统一。
- 采集链路稳定可观测。
- 指标口径可解释、可测试、可回算。
- 权限、审计、隐私策略可治理。
- 可对接 Agent / RAG 形成智能分析能力。

经营侧：

- 能回答 AI 投入是否值得。
- 能解释哪些团队、哪些场景真的提效。
- 能证明提效没有牺牲质量。
- 能把 AI 效能从工具使用数据转成研发经营语言。

## 10. 关键风险与约束

### 10.1 不要把指标当个人绩效工具

风险：

- 员工为了指标刷会话、刷使用时长、刷代码行数。
- 管理者误用出码率做个人排名。

策略：

- 指标默认用于团队改进和工具运营。
- 明确 `assessmentUsage`：观察、团队改进、经营复盘。
- Dashboard 展示反误导说明。

### 10.2 不要让 Agent 绕过指标口径

风险：

- Agent 直接读原始数据，给出不可验证结论。
- Agent 把推断说成事实。

策略：

- Agent 只能使用只读分析上下文 API。
- 输出必须引用指标口径和证据摘要。
- 区分事实、推断和建议。

### 10.3 不要让工具 adapter 污染核心模型

风险：

- 每接一个 AI 工具都把工具字段写进核心表。
- 后续维护成本爆炸。

策略：

- adapter 只负责工具原始数据到 AIMetric 标准事件的映射。
- 外部工具字段进入 raw layer，不直接进入 metric core。
- 核心指标只依赖 canonical event 和 evidence model。

### 10.4 不要过早微服务化

风险：

- 运维复杂度上升。
- 数据一致性和部署成本增加。
- 早期迭代速度下降。

策略：

- 采用模块化单体。
- 通过领域边界、接口和依赖方向控制复杂度。
- 等某个模块出现独立扩展压力后再拆服务。

## 11. 当前执行记录

### 2026-04-24：E1 企业指标语义层第一版

已完成：

- 在 `@aimetric/metric-core` 建立企业指标语义字典，覆盖使用渗透、有效产出、交付效率、质量与风险、体验与能力、业务与经济价值六类维度。
- 每个指标包含指标问题、公式、数据源、自动化程度、更新频率、Dashboard 放置位置、考核使用边界和反误导说明。
- 在 `metric-platform` 暴露企业指标目录 API：`GET /enterprise-metrics/catalog`。
- 在 `metric-platform` 暴露按维度过滤 API：`GET /enterprise-metrics?dimension=<dimension>`。
- 在 Dashboard 接入企业指标目录，并增加“企业指标语义层”管理者展示区。
- Dashboard 仅在启动时加载指标目录，不随筛选条件和自动刷新重复请求，减少管理端无效请求。

## 12. 下一步明确任务

下一步执行：

```text
Phase E5 异步采集与队列
```

第一批任务：

1. 为 collector-gateway 增加可插拔 ingestion queue 接口，默认保持同步直传，准生产可切换队列模式。
2. 增加第一版内存 / 本地文件队列实现，验证失败不阻断员工端热路径。
3. 增加 ingestion worker，把队列事件异步写入 metric-platform。
4. 增加 retry、DLQ、队列积压、采集延迟和失败率指标。
5. Dashboard / 管理 API 展示采集健康状态，为企业大规模接入做运营视图。

阶段完成标志：

- collector-gateway 短暂不可用时，员工端采集不阻断正常开发。
- worker 恢复后可以继续消费积压事件。
- 重复事件不会重复计入指标。
- 管理者能看到采集链路的延迟、失败、重试和 DLQ 情况。
