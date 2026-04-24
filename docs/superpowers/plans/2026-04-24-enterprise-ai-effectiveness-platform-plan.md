# AIMetric 企业级 AI 研发效能平台下一阶段计划

## 1. 上一阶段总结

上一阶段的目标是同构复现文章《AI出码率70%+的背后：高德团队如何实现AI研发效率的量化与优化》中的 AI 研发效能量化平台。当前已经完成从 MVP 到准生产基础能力的主链路。

已完成能力：

- `MCP 标准采集`：`beforeEditFile`、`afterEditFile`、`recordSession`、规则查询、知识查询、工具审计。
- `员工接入`：`employee-onboarding` 可生成 `.aimetric/config.json`、`.aimetric/mcp.json`、Cursor/CLI/VS Code 适配配置。
- `多入口采集`：CLI 标准采集、Cursor transcript 增强采集、Tab 接受事件、Cursor 本地状态库证据。
- `证据链`：会话主线、文件级 edit span、Tab 接受、MCP 工具审计、状态库证据。
- `平台能力`：采集网关、指标平台、PostgreSQL 持久化、幂等去重、指标快照、手动/定时回算。
- `规则中心`：规则版本、模板校验、激活版本、灰度发布、命中计算。
- `Dashboard`：个人出码、团队出码、MCP 采集质量、规则中心、会话分析、出码分析。
- `准生产基础`：采集端 token、管理端 token、管理审计、`/ready`、Prometheus `/metrics`、运维手册。

阶段性结论：

- 当前系统已经证明“AI 编码工具 -> 采集 -> 证据 -> 指标 -> 管理视图”的闭环可跑通。
- 当前还不是完整企业级产品，主要缺口在组织模型、多源集成、多维指标体系、员工侧轻量化安装体验、管理者分析工作台和后续智能分析能力。
- 下一阶段应从“文章同构复现”升级为“企业级 AI 研发效能度量产品”。

## 2. 新阶段目标

下一阶段目标是把 AIMetric 升级为企业级 AI 研发效能平台。

核心目标：

- 员工端轻量化安装，接入简单，默认不影响日常开发体验。
- 支持不同 AI 工具和不同研发入口的数据采集。
- 建立多维指标体系，而不是只看 AI 出码率。
- 面向提效管理者、技术管理者和研发平台团队提供分析工作台。
- 后续可以接入 Agent / RAG，形成“分析 -> 解释 -> 建议 -> 行动”的智能闭环。

产品定位：

```text
AIMetric 不是单纯的出码率看板，
而是企业级 AI 研发效能度量、治理与提效决策平台。
```

## 3. 目标用户与场景

### 3.1 员工 / 一线开发者

核心诉求：

- 安装简单，不想学习复杂配置。
- 日常编码不变慢，不被频繁打断。
- 清楚知道采集范围，不担心隐私和代码泄露。
- 规则和知识能帮自己提效，而不是只给管理者看数据。

典型场景：

- 安装一个轻量接入包。
- 使用 Cursor、Claude Code、Codex、VS Code、JetBrains、CLI agent 等工具正常开发。
- MCP 在后台记录轻量事件，增强采集定时补充。
- 需要时从 MCP 查询项目规则、API 文档、架构规范。

产品原则：

- 员工端默认无感。
- 热路径只做轻量采集。
- 深度分析和上报走异步或定时任务。
- 采集范围可解释、可配置、可审计。

### 3.2 提效管理者 / AI 效能运营

核心诉求：

- 看到 AI 工具是否真正被用起来。
- 识别哪些团队、哪些场景推广有效。
- 发现工具接入失败、规则不生效、采集缺失等运营问题。
- 用数据设计推广策略，而不是靠主观感受。

典型场景：

- 查看各团队 AI-IDE / SDD / MCP 覆盖率。
- 查看活跃人数、会话数、Tab 占比、增强采集覆盖率。
- 对比团队采用度、产出度和质量护栏。
- 识别低使用团队和高潜力场景。

### 3.3 技术管理者 / 研发负责人

核心诉求：

- 判断 AI 是否真的提升交付效率。
- 判断 AI 是否引入返工、缺陷、回滚、Review 负担。
- 看团队间差异和工程治理问题。
- 为投入预算、工具选型、团队培训提供依据。

典型场景：

- 比较 AI 参与需求和非 AI 参与需求的 Lead Time。
- 比较 AI 参与 PR 的缺陷率、CI 失败率、Review 退回率。
- 查看团队 ROI、单位需求成本、关键需求周期。
- 查看多维指标趋势，而不是只看出码率。

### 3.4 研发平台 / 管理员

核心诉求：

- 管理接入包、token、规则版本、采集策略。
- 监控采集链路健康。
- 维护组织、团队、项目、成员映射。
- 处理数据质量、回算、权限和审计。

典型场景：

- 管理项目接入状态。
- 查看 collector、MCP、Cursor 增强采集健康。
- 配置采样策略、隐私策略、性能阈值。
- 执行指标回算、数据修复和审计查询。

## 4. 企业级产品架构

下一阶段建议升级为八层架构。

```text
员工端轻量接入层
  -> 多工具采集适配层
  -> 采集网关与队列层
  -> 原始事件与证据层
  -> 指标模型与语义层
  -> 组织权限与治理层
  -> 多维分析工作台
  -> Agent / RAG 智能分析层
```

### 4.1 员工端轻量接入层

目标：

- 一个安装包或一条 onboarding 命令完成接入。
- 自动生成 MCP 配置和采集配置。
- 员工无需理解 Cursor 本地库、MCP 参数、token 或规则版本。

能力：

- `aimetric-onboard` 升级为企业接入向导。
- 自动检测当前工具：Cursor、VS Code、Claude Code、Codex CLI、JetBrains、通用 CLI。
- 生成 `.aimetric/config.json`、MCP 配置、工具特定适配文件。
- 支持静默升级和配置刷新。
- 支持卸载和采集状态自检。

体验目标：

- 安装 3 分钟内完成。
- 默认热路径延迟低于 100ms。
- 网络不可用时本地缓冲，不阻塞开发。

### 4.2 多工具采集适配层

目标：

- 不绑定单一 AI 工具。
- 对不同工具统一归一为 AIMetric 标准事件。

优先支持：

- Cursor：MCP + transcript + state.vscdb + Tab。
- Claude Code：MCP / CLI 事件 / 会话摘要。
- Codex CLI：CLI 会话、工具调用、代码编辑证据。
- VS Code：MCP / extension 配置 / 编辑事件。
- JetBrains：插件预留。
- 通用 CLI agent：命令行适配器。

统一事件：

- `session.recorded`
- `edit.span.recorded`
- `tab.accepted`
- `mcp.tool.called`
- `ai.tool.used`
- `ai.pr.touched`
- `delivery.item.linked`
- `survey.response.recorded`

### 4.3 采集网关与队列层

目标：

- 采集端与指标平台解耦。
- 平台短暂不可用时不影响员工使用。

建议实现：

- `collector-gateway -> queue -> ingestion-worker -> metric-platform/PostgreSQL`
- 第一阶段使用 Redis Stream / BullMQ。
- 企业级可升级到 Kafka / Redpanda。
- 增加 DLQ、重试、限流、幂等。

管理价值：

- 保护员工端体验。
- 提升大规模接入稳定性。
- 为采集失败率、延迟、积压量提供可观测指标。

### 4.4 原始事件与证据层

目标：

- 原始事实、证据、指标结果分层。

建议数据层：

```text
raw_events
session_evidence
edit_evidence
tab_evidence
git_attribution_evidence
pr_evidence
delivery_evidence
quality_evidence
metric_snapshots
```

原则：

- 原始事件不可轻易覆盖。
- 证据层可重算。
- 指标快照可按项目、团队、成员、周期回算。
- Dashboard 不直接依赖复杂 raw event 查询。

### 4.5 指标模型与语义层

目标：

- 建立企业统一指标字典。
- 每个指标都有清晰口径、数据源、公式、更新频率和适用范围。

六类核心维度：

1. 使用渗透
2. 有效产出
3. 交付效率
4. 质量与风险
5. 体验与能力
6. 业务与经济价值

每个指标定义：

- 指标名
- 要回答的问题
- 公式
- 数据源
- 自动化程度
- 更新频率
- 适用维度
- 是否可用于考核
- 是否只用于观察
- 反误导说明

### 4.6 组织权限与治理层

目标：

- 企业级多团队、多项目、多角色使用。

核心实体：

- `organization`
- `team`
- `project`
- `repository`
- `member`
- `membership`
- `collector_identity`
- `role`
- `permission`
- `policy`

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
- diff 原文存储策略。
- 增强采集授权策略。
- 数据保留周期。
- 团队级和项目级策略下发。

### 4.7 多维分析工作台

目标：

- 面向提效管理者和技术管理者，而不是只给开发者看个人指标。

建议视图：

1. 总览驾驶舱
2. 使用渗透 Dashboard
3. 有效产出 Dashboard
4. 交付效率 Dashboard
5. 质量风险 Dashboard
6. 体验与能力 Dashboard
7. 业务 ROI Dashboard
8. 平台运营 Dashboard

总览核心指标：

- AI 活跃率
- AI-IDE 覆盖率
- SDD 覆盖率
- AI 出码率
- AI 触达 PR 占比
- AI 参与需求数
- Lead Time 变化
- 测试通过率
- 缺陷率
- 回滚率
- 节省工时估算
- ROI
- 采集健康率

### 4.8 Agent / RAG 智能分析层

目标：

- 把看板从“展示数据”升级为“解释数据、给出建议、推动行动”。

可做能力：

- 指标异常解释 Agent。
- 团队提效建议 Agent。
- 采集质量诊断 Agent。
- 规则优化建议 Agent。
- RAG 查询项目规则、历史复盘、架构规范、PR 记录、缺陷记录。

典型问题：

- 为什么 A 团队 AI 活跃率高但 Lead Time 没下降？
- 哪些团队适合推广增强采集？
- 哪些项目的 AI 代码质量风险偏高？
- 本周 AI 提效最明显的场景是什么？
- 哪些规则或知识库内容最应该补充？

注意：

- Agent 不直接替代指标口径。
- Agent 的输出必须带证据来源。
- 管理建议应面向团队改进，不用于简单个人排名。

## 5. 六类指标自动化分级

### 5.1 使用渗透

自动化程度：高。

可自动采集：

- AI-IDE 使用人数比例
- 各团队 AI-IDE 覆盖率
- 活跃人数占比
- 周活 / 月活
- 会话数
- 轮次
- 使用时长
- Tab 占比
- AI 辅助编程时长
- MCP 工具调用次数
- 标准采集档 / 增强采集档覆盖率

需要外部映射：

- SDD 使用人数比例
- AI-IDE+SDD 需求覆盖率
- 结对编程参与人数
- Co-Claw / OpenClaw 指标

适合视图：

- 使用渗透 Dashboard
- 平台运营 Dashboard

### 5.2 有效产出

自动化程度：中高。

可自动采集：

- AI 出码率
- AI 生成代码采纳率
- 总代码变更行数
- AI 代码生成行数
- 人均代码产出
- 代码产出行 / 人天
- AI 触达 PR 占比
- 编辑证据数
- Tab 接受行数

需要增强归因：

- AI 产出最终保留率
- AI 测试采纳率
- AI 参与需求数

适合视图：

- 有效产出 Dashboard
- 出码分析 Dashboard

### 5.3 交付效率

自动化程度：中，需要外部系统。

数据源：

- Jira / TAPD / 禅道 / 飞书项目
- GitHub / GitLab
- CI/CD
- 发布系统

指标：

- 需求到 PR 时间
- PR 周转时间
- Lead Time
- Deployment Frequency
- 需求从开始到完成耗时
- AI 参与需求 vs 非 AI 参与需求周期差异

适合视图：

- 交付效率 Dashboard
- 价值流分析 Dashboard

### 5.4 质量与风险

自动化程度：中，需要 CI、缺陷、Review、发布系统。

指标：

- 测试通过率
- CI 失败率
- Review 退回率
- 缺陷率
- 变更失败率
- 回滚率
- 返工率
- 安全扫描问题数
- Review comment 数

适合视图：

- 质量风险 Dashboard
- AI 参与 PR 质量对照分析

### 5.5 体验与能力

自动化程度：低到中。

主要来源：

- 问卷
- 访谈
- 工具使用行为
- 接入失败与工具失败日志

指标：

- 不用 AI-IDE 的原因
- 不用 SDD 的原因
- 满意度
- 信任度
- 认知负荷
- 心流时间
- 新人上手时间

适合视图：

- 开发者体验 Dashboard
- 组织能力 Dashboard

### 5.6 业务与经济价值

自动化程度：中，需要建模。

指标：

- 终极目标指标
- 团队需求总数
- 单位需求成本
- 关键需求周期
- 缺陷损失下降
- AI 工具成本
- 节省工时估算
- ROI

适合视图：

- ROI Dashboard
- 经营汇报 Dashboard

## 6. 下一阶段实施路线

### Phase E1：企业指标语义层

目标：

- 建立指标字典和指标视图模型。
- 明确每个指标的数据源、公式和自动化等级。

交付：

- `packages/metric-taxonomy`
- 指标定义文件
- 指标自动化等级
- Dashboard View Model
- 六类核心维度总览 API

### Phase E2：组织与权限模型

目标：

- 支持组织、团队、项目、成员、角色和策略。

交付：

- PostgreSQL 组织模型
- `collector_identity`
- RBAC 基础权限
- 管理端 API 鉴权升级
- Dashboard 按角色展示不同视图

### Phase E3：员工端轻量化安装

目标：

- 把接入从“生成配置”升级为“企业安装体验”。

交付：

- `aimetric doctor`
- `aimetric onboard --profile=cursor|cli|vscode|codex|claude-code`
- 安装状态自检
- 自动修复 MCP 配置
- 性能阈值与采集策略下发
- 采集透明度说明

### Phase E4：多 AI 工具适配

目标：

- 覆盖不同 AI 工具和研发入口。

交付：

- Claude Code adapter
- Codex CLI adapter 增强
- VS Code extension profile
- JetBrains adapter 预研
- 通用 CLI agent adapter
- 多工具事件统一映射

### Phase E5：异步采集与队列

目标：

- 保护员工端体验，提升大规模接入稳定性。

交付：

- Redis Stream / BullMQ
- ingestion worker
- retry / DLQ
- queue lag 指标
- 采集失败率、重复率、延迟指标

### Phase E6：外部系统集成

目标：

- 把 AI 使用数据连接到真实研发交付。

交付：

- GitHub / GitLab PR 集成
- CI/CD 集成
- 需求系统集成
- 缺陷系统集成
- 发布系统集成
- AI 参与需求 / PR / 发布的链路归因

### Phase E7：管理者分析工作台

目标：

- 面向提效管理者和技术管理者提供决策视图。

交付：

- 使用渗透 Dashboard
- 有效产出 Dashboard
- 交付效率 Dashboard
- 质量风险 Dashboard
- 体验与 ROI Dashboard
- 平台运营 Dashboard

### Phase E8：Agent / RAG 智能分析

目标：

- 接入企业知识库、规则、历史指标和项目上下文，让管理者可以自然语言分析。

交付：

- 指标解释 Agent
- 异常诊断 Agent
- 提效建议 Agent
- 采集质量诊断 Agent
- RAG 知识库索引
- 分析结论证据引用

## 7. 优先级建议

最推荐先做：

```text
Phase E1 企业指标语义层
```

原因：

- 现在底层采集和基础平台已经具备，下一步最需要统一“指标口径”。
- 没有指标语义层，后续 Dashboard、外部系统集成、Agent 分析都会各自定义口径，容易失控。
- 企业管理者最先需要看到的是一套可信的指标体系，而不是更多零散事件。

建议顺序：

1. `E1 企业指标语义层`
2. `E3 员工端轻量化安装`
3. `E5 异步采集与队列`
4. `E2 组织与权限模型`
5. `E6 外部系统集成`
6. `E7 管理者分析工作台`
7. `E8 Agent / RAG 智能分析`
8. `E4 多 AI 工具适配` 与 E3、E6 并行推进

## 8. 企业级成功标准

员工侧：

- 安装简单。
- 日常使用无明显延迟。
- 清楚知道采集范围。
- 不因为采集导致工具不可用。

管理侧：

- 能看清采用度、产出度、效率、质量、体验、ROI 六类指标。
- 能按组织、团队、项目、成员、工具、时间维度分析。
- 能识别推广问题、质量风险和真实提效场景。

平台侧：

- 多工具接入统一。
- 采集链路稳定可观测。
- 指标口径可解释。
- 权限、审计、隐私策略可治理。
- 可对接 Agent / RAG 形成智能分析能力。

经营侧：

- 能回答 AI 投入是否值得。
- 能解释哪些团队、哪些场景真的提效。
- 能证明提效没有牺牲质量。
- 能把 AI 效能从工具使用数据转成研发经营语言。

## 9. 执行记录

### 2026-04-24：E1 企业指标语义层第一版

已完成：

- 在 `@aimetric/metric-core` 建立企业指标语义字典，覆盖使用渗透、有效产出、交付效率、质量与风险、体验与能力、业务与经济价值六类维度。
- 每个指标包含指标问题、公式、数据源、自动化程度、更新频率、Dashboard 放置位置、考核使用边界和反误导说明。
- 在 `metric-platform` 暴露企业指标目录 API：`GET /enterprise-metrics/catalog`。
- 在 `metric-platform` 暴露按维度过滤 API：`GET /enterprise-metrics?dimension=<dimension>`。
- 在 Dashboard 接入企业指标目录，并增加“企业指标语义层”管理者展示区。
- Dashboard 仅在启动时加载指标目录，不随筛选条件和自动刷新重复请求，减少管理端无效请求。

下一步建议：

1. 基于语义字典增加六类指标的管理者分屏与钻取视图。
2. 把现有出码率、会话数、MCP 审计指标映射到语义字典中的可计算指标。
3. 设计组织、团队、项目、成员维度模型，为后续权限和多团队对比做准备。
