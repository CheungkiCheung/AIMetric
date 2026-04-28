# AIMetric

AIMetric 是面向企业提效部门的 **AI 提效工具体验与效果洞察产品**。

它不是强制推广工具的督办台，也不是员工个人绩效排名系统。AIMetric 关注的是：员工在自然选择 AI 工具的情况下，哪些工具真的被持续使用，哪些只是覆盖或试用，为什么觉得不好用，以及这些工具是否在代码产出、需求交付、人力节省和人效提升上产生了可解释的效果。

产品主句：

```text
AIMetric 帮助提效部门看清哪些工具真的有效、为什么不好用、下一轮该怎么改。
```

## 核心价值

- 观察真实使用，而不是只统计安装量或覆盖率
- 解释为什么不用、为什么低频使用、为什么觉得不好用
- 分工具定义指标，避免把 AI-IDE、SDD、Co-Claw/OpenClaw 和自研工具混成一套口径
- 自动采集低打扰的员工侧使用信号：会话、活跃天数、有效会话、使用时长、Tab 接受、MCP 调用、编辑证据、采集健康
- 打通工程链路事实：需求、PR / MR、CI、发布、事故、缺陷
- 把使用体验和提效结果连起来：持续使用、代码产出、AI 采纳、SDD 需求交付、人力节省、人效提升
- 为后续 Agent / RAG 智能分析保留统一证据链和指标语义层

## 适用用户

### 提效部门负责人

关注本轮提效工具是否被员工自然使用，哪些工具覆盖了但没有持续使用，员工为什么觉得不好用，以及 AI-IDE、SDD、Co-Claw/OpenClaw、自研提效工具是否产生了可解释的提效效果。

这个角色的核心问题不是“今天要推进谁”，而是：

- 哪些工具真的留下来了
- 哪些工具只是被覆盖或安装
- 哪些场景让员工觉得不好用
- 哪些指标已经证明有提效效果
- 下一轮应该改工具、改入口、改流程，还是补采集

### 技术管理者

关注 AI 是否进入真实需求和 PR，是否缩短交付周期，是否影响 Review、CI、缺陷、发布和事故风险。这些指标在提效部门负责人视图里作为质量护栏，在技术管理者视图里作为主分析对象。

### 平台管理员

关注员工端接入是否轻量，采集链路是否稳定，权限、身份映射、审计和数据导入是否可控。

### 员工

只需要轻量安装和配置，正常使用现有 AI 工具。网络不可用时采集事件会进入本地 outbox，不阻塞编码。

## 产品闭环

```text
工具资产登记
  -> 员工低打扰接入
  -> 使用与工程事实采集
  -> 采集健康校验
  -> 指标语义层计算
  -> 工具体验与提效效果洞察
  -> 不用 / 低频 / 不好用原因归因
  -> 工具、入口、流程和培训改进
  -> 下一轮试点复盘
```

产品输出不是强制推广动作，而是改进判断：

- `改工具体验`：覆盖足够但持续使用低，反馈集中在入口、输出质量或场景适配
- `改流程入口`：SDD 等流程型工具入口不清、规约模板不统一、需求类型不适配
- `补充说明和样例`：员工不知道什么场景该用，或只会浅层试用
- `修复采集`：指标异常来自采集缺口、身份映射缺失或导入不完整
- `扩大试点范围`：工具持续使用和效果信号都稳定，质量护栏可控
- `暂停或调整试点`：使用增加但没有有效产出，或者体验反馈持续为负
- `深入分析`：进入 Agent / RAG，解释工具有效、无效或不被使用的原因

完整产品口径见 [docs/operations/product-loop-playbook.md](docs/operations/product-loop-playbook.md)。

企业试点交付建议从 [docs/operations/enterprise-pilot-delivery-kit.md](docs/operations/enterprise-pilot-delivery-kit.md) 开始，它把平台部署、员工接入、管理者验收、指标清单和周复盘模板串成一条可执行交付路径。

## 当前状态

当前版本定位为 `企业试点版 / 准生产基础版`。

已具备：

- Monorepo 工程骨架
- PostgreSQL 持久化事实表
- 统一事件 schema、采集 SDK、指标公式、规则包
- `collector-gateway` 采集接入服务
- `metric-platform` 指标平台、事件导入、快照回算、分析查询
- `mcp-server` MCP JSON-RPC runtime、工具调用审计、规则与知识查询工具
- `dashboard` 提效工具体验与效果总览、团队/个人指标、会话分析、出码分析、交付与质量视图
- `employee-onboarding` 员工接入 CLI 原型
- `cli-adapter`、`cursor-adapter`、`cursor-db-adapter` 等采集适配器
- GitHub / GitLab PR、Jira / TAPD、GitHub Actions / GitLab CI、发布、事故、缺陷主线数据接入
- 缺陷归因分析和关键需求周期轻量业务价值指标

仍需企业现场补齐：

- SSO、租户隔离、完整 RBAC 和企业级审计策略
- Kubernetes / Helm / 灰度发布 / 告警治理
- 更多真实连接器和客户现场字段映射
- Cursor 更深层本地数据库细粒度采集
- Agent / RAG 智能分析和自动洞察

## 可采集与可分析指标

### 体验与使用

- 覆盖率
- 使用人数比例
- 活跃天数
- 使用时长
- 使用频率
- 有效会话数
- 持续使用人数比例
- 覆盖但未持续使用比例
- 不用 / 低频 / 不好用原因

### 代码度量与 AI-IDE 效果

- 总代码变更行数
- AI 代码生成行数
- 人均代码产出
- AI 代码生成率
- 代码产出（行/人天）
- AI 生成代码采纳率

### SDD 规约驱动开发

- SDD 使用人数比例
- SDD 开发需求数
- SDD 需求交付占比
- AI-IDE + SDD 需求覆盖率
- 规约模板使用情况
- 流程入口与需求适配反馈

SDD 在 AIMetric 中不是 Agent，也不按单纯代码行数评估。它是规约驱动开发流程，更适合围绕需求覆盖、交付占比、流程阻塞和规约质量建立指标。

### Co-Claw / OpenClaw

- 使用人数比例
- 使用频率
- 有效会话数
- 一次完成情况
- 结果采纳情况

Co-Claw / OpenClaw 不套用结对编程批次指标。批次目标、时间窗口和完成状态属于试点运营信息，不是这类工具本体的核心效果指标。

### 团队与场景

- 团队需求总数
- AI-IDE 开发需求数
- SDD 开发需求数
- 各团队 AI-IDE 覆盖率
- 各团队 SDD 覆盖率
- 不用 AI-IDE 开发的原因
- 不用 SDD 开发的原因

### 终极目标

- 人力节省比例
- 人效提升比例
- SDD 需求交付占比
- 提效预估（团队均值）

### 质量护栏

- AI 触达 PR 占比
- AI 触达需求占比
- 需求到 PR 时间
- PR 周转时间
- Lead Time
- Deployment Frequency
- Review 退回率
- CI 通过率
- 缺陷率
- 逃逸缺陷率
- 变更失败率
- 回滚率
- AI 参与需求缺陷率
- AI 触达 PR 逃逸缺陷率
- 发布失败关联缺陷数
- 事故关联缺陷数

### 采集健康与工具调用

- AI 会话数、轮次、使用时长
- 工具来源、项目、成员、仓库、时间窗口
- MCP 工具调用成功率、失败率、平均耗时
- collector delivery mode
- queue depth
- DLQ
- forwarded / failed forward
- token、identity mapping、viewer scope、管理审计

## 架构

```text
员工侧 AI 工具 / IDE / CLI / MCP
  -> employee-onboarding / adapters / collector-sdk
  -> collector-gateway
  -> metric-platform
  -> PostgreSQL facts / snapshots / analysis APIs
  -> dashboard
```

分层说明：

- `采集入口层`：员工接入、IDE/CLI Adapter、MCP 工具
- `采集传输层`：collector SDK、outbox、collector-gateway
- `平台能力层`：事件导入、幂等去重、PostgreSQL、指标计算、快照回算
- `证据关联层`：会话主线、编辑证据、需求、PR、CI、发布、事故、缺陷归因
- `指标展示层`：提效工具体验与效果总览、团队视图、会话分析、出码分析、需求交付分析
- `产品闭环层`：工具资产、采集健康、指标解释、体验反馈、改进动作、试点复盘

## 仓库结构

```text
apps/
  collector-gateway/   采集接入 HTTP 服务
  cli-adapter/         CLI 标准采集入口
  cursor-adapter/      Cursor 增强采集入口
  dashboard/           前端提效工具体验与效果总览
  mcp-server/          MCP 工具与 stdio runtime
  metric-platform/     指标平台 HTTP 服务

packages/
  collector-sdk/       采集端本地缓冲与客户端 SDK
  cursor-db-adapter/   Cursor transcript / state 发现与增量解析
  edit-evidence/       文件级 edit span 证据建模
  employee-onboarding/ 员工接入配置生成原型
  event-schema/        统一事件模型
  git-attribution/     Git / AI 归因证据构建
  metric-core/         指标目录与计算管线
  rule-engine/         规则包解析、灰度和知识引用

docs/
  operations/          产品闭环、试点、部署、演示和员工接入文档
  superpowers/         历史计划、设计和执行记录
```

## 快速开始

### 1. 安装依赖

```bash
corepack pnpm install
```

### 2. 准备环境变量

```bash
cp .env.example .env.local
```

最小必填项：

- `DATABASE_URL`
- `METRIC_PLATFORM_URL`
- `AIMETRIC_COLLECTOR_TOKEN`
- `METRIC_PLATFORM_COLLECTOR_TOKEN`
- `METRIC_PLATFORM_ADMIN_TOKEN`

生产或准生产环境还应设置 `AIMETRIC_REQUIRE_AUTH=true`，让采集入口和管理入口在缺少 token 时 fail-closed。Dashboard 不应持有管理端 token，企业部署时建议通过统一网关 / BFF / SSO 登录态代理管理接口。

### 3. 启动基础依赖

```bash
docker compose up -d
```

默认依赖：

- PostgreSQL：`127.0.0.1:5432`
- Redis：`127.0.0.1:6379`

### 4. 启动后端服务

```bash
export DATABASE_URL='postgresql://aimetric:aimetric@127.0.0.1:5432/aimetric?sslmode=disable'
export AIMETRIC_COLLECTOR_TOKEN='local-collector-token'
export METRIC_PLATFORM_COLLECTOR_TOKEN='local-platform-collector-token'
export METRIC_PLATFORM_ADMIN_TOKEN='local-admin-token'
export METRIC_PLATFORM_URL='http://127.0.0.1:3001'

corepack pnpm start:metric-platform
corepack pnpm start:collector-gateway
```

默认端口：

- `collector-gateway`：`http://127.0.0.1:3000`
- `metric-platform`：`http://127.0.0.1:3001`

### 5. 启动 Dashboard

```bash
corepack pnpm dev:dashboard
```

默认访问：

- `dashboard`：`http://127.0.0.1:5173`

### 6. 导入演示数据

```bash
corepack pnpm demo:check
corepack pnpm demo:seed
```

## 员工侧最小接入

员工机器通常只需要：

- Node.js 运行时
- 一个 onboarding 命令入口
- 一个指向 collector 的 token 环境变量

示例：

```bash
corepack pnpm --filter @aimetric/employee-onboarding build
node packages/employee-onboarding/dist/cli.js onboard \
  --workspaceDir=/path/to/repo \
  --profile=cursor \
  --projectKey=aimetric \
  --repoName=AIMetric \
  --memberId=alice

node packages/employee-onboarding/dist/cli.js doctor --workspaceDir=/path/to/repo
node packages/employee-onboarding/dist/cli.js status --workspaceDir=/path/to/repo
```

生成文件：

```text
.aimetric/config.json
.aimetric/mcp.json
```

如果 collector 暂时不可达：

- 员工命令不会阻断开发
- 事件会缓存在 `.aimetric/outbox`
- 后续可执行 `aimetric flush`

详细说明见 [docs/operations/employee-onboarding-guide.md](docs/operations/employee-onboarding-guide.md)。

## 常用 API

健康检查：

```bash
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/ready
curl http://127.0.0.1:3000/metrics
curl http://127.0.0.1:3001/health
curl http://127.0.0.1:3001/ready
curl http://127.0.0.1:3001/metrics
```

查询分析：

```bash
curl http://127.0.0.1:3001/metrics/personal
curl http://127.0.0.1:3001/metrics/team
curl http://127.0.0.1:3001/analysis/summary
curl http://127.0.0.1:3001/analysis/sessions
curl http://127.0.0.1:3001/analysis/output
curl http://127.0.0.1:3001/evidence/edits
curl http://127.0.0.1:3001/evidence/tab-completions
```

手动回算：

```bash
curl -X POST http://127.0.0.1:3001/metrics/recalculate \
  -H 'authorization: Bearer replace-with-admin-secret' \
  -H 'content-type: application/json' \
  -d '{
    "projectKey": "proj",
    "from": "2026-04-23T00:00:00.000Z",
    "to": "2026-04-24T00:00:00.000Z"
  }'
```

## 测试与校验

```bash
corepack pnpm test
corepack pnpm -r lint
```

PostgreSQL 持久化测试默认跳过，需要显式开启：

```bash
DATABASE_URL='postgresql://aimetric:aimetric@127.0.0.1:5432/aimetric?schema=public' \
RUN_DB_TESTS=1 \
./node_modules/.bin/vitest run apps/metric-platform/src/database/postgres-event.repository.spec.ts
```

事件事实表位于 [apps/metric-platform/sql/schema.sql](apps/metric-platform/sql/schema.sql)。

## 试点建议

第一轮建议选择：

- `1-2` 个团队
- `10-30` 名研发
- `1-2` 个核心项目
- 至少两类 AI 工具

试点时优先验证：

- 员工是否能轻量接入，且不影响正常编码体验
- 提效部门是否能稳定看到覆盖、持续使用、有效会话、体验反馈和提效效果
- 是否能解释不用、低频使用和不好用原因
- 平台侧是否能支撑权限、审计、采集健康和排障
- 看板结论是否能转化为明确改进动作

试点推进见 [docs/operations/pilot-rollout-guide.md](docs/operations/pilot-rollout-guide.md)。

## 文档入口

- 产品闭环：[docs/operations/product-loop-playbook.md](docs/operations/product-loop-playbook.md)
- 企业试点交付包：[docs/operations/enterprise-pilot-delivery-kit.md](docs/operations/enterprise-pilot-delivery-kit.md)
- 员工接入：[docs/operations/employee-onboarding-guide.md](docs/operations/employee-onboarding-guide.md)
- 平台部署：[docs/operations/production-runbook.md](docs/operations/production-runbook.md)
- 试点推进：[docs/operations/pilot-rollout-guide.md](docs/operations/pilot-rollout-guide.md)
- 演示路径：[docs/operations/dashboard-walkthrough.md](docs/operations/dashboard-walkthrough.md)
- 本地演示：[docs/operations/demo-runbook.md](docs/operations/demo-runbook.md)
- 中文计划：[docs/superpowers/plans/2026-04-23-aimetric-中文执行计划.md](docs/superpowers/plans/2026-04-23-aimetric-%E4%B8%AD%E6%96%87%E6%89%A7%E8%A1%8C%E8%AE%A1%E5%88%92.md)

## 路线图

短期优先级：

1. 前端按“工具体验与提效效果中心”继续重排，强化工具资产、体验矩阵、原因归因、效果趋势和采集健康
2. 补齐指标口径说明、数据来源解释、异常诊断和不用 / 低频 / 不好用原因采集
3. 强化员工接入中心，提供更脚本化、更低心智负担的安装体验
4. 增加更多 GitLab、缺陷系统、CI、发布平台真实连接器
5. 做代码审查、安全审查、接口契约和端到端测试收敛

中期方向：

1. SSO、租户隔离、完整 RBAC、审计和数据治理
2. Helm / K8s / 告警 / 数据保留策略
3. Agent / RAG 智能分析，用于解释趋势、风险和工具有效性
4. 经营价值指标从轻量口径逐步升级为可审计 ROI 模型
