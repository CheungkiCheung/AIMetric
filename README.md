# AIMetric

AIMetric 是一个面向企业的 AI 工具度量与研发提效管理平台。它把 AI-IDE、SDD、结对编程、内部 Agent/CLI 工具和研发交付链路统一到一套指标语义层里，帮助提效管理者判断 AI 提效工具是否真正铺开、是否形成代码产出与采纳、是否覆盖真实需求，以及最终是否接近人效提升和人力节省目标。

这不是一个“只看 AI 出码率”的看板，也不是员工个人绩效排名工具。AIMetric 的核心目标是让企业能够用更完整、更可解释、更可扩展的方式管理 AI 提效工具。

## 核心价值

- 统一度量多种 AI 提效工具：`AI-IDE`、`SDD`、`Cursor`、`CLI Agent`、`Codex`、`Claude Code`、`Co-Claw / OpenClaw`、`MCP 工具链`
- 低打扰采集员工侧 AI 使用信号：会话、出码、Tab 接受、MCP 调用、编辑证据、采集健康
- 打通工程链路事实：需求、PR / MR、CI、发布、事故、缺陷
- 从单点指标升级为提效经营闭环：使用渗透、代码产出、AI 采纳、SDD 覆盖、批次推进、终极人效目标
- 为后续 Agent / RAG 智能分析保留统一证据链和指标语义层

## 适用用户

### 提效管理者

关注公司投入的 AI 提效工具有没有真正铺开，AI-IDE 与 SDD 是否进入需求，AI 代码生成和采纳是否提升，结对编程批次是否达成，以及人效提升、人力节省、SDD 需求交付占比是否接近目标。

### 技术管理者

关注 AI 是否进入真实需求和 PR，是否缩短交付周期，是否影响 Review、CI、缺陷、发布和事故风险。这些指标在提效管理者视图里作为质量护栏，在技术管理者视图里作为主分析对象。

### 平台管理员

关注员工端接入是否轻量，采集链路是否稳定，权限、身份映射、审计和数据导入是否可控。

### 员工

只需要轻量安装和配置，正常使用现有 AI 工具。网络不可用时采集事件会进入本地 outbox，不阻塞编码。

## 产品闭环

```text
AI 工具资产登记
  -> 员工轻量接入
  -> 多源采集与导入
  -> 采集健康监控
  -> 指标语义层计算
  -> 工具 / 团队 / 场景多维分析
  -> 质量与交付归因
  -> 管理动作
  -> 试点复盘与下一轮推广
```

管理动作包括：

- `扩大推广`：AI-IDE / SDD 覆盖高、代码生成和采纳高、质量护栏可控
- `补充培训`：目标团队使用渗透低，但已使用人群产出和采纳明显更好
- `修复采集`：AI-IDE 覆盖率、SDD 覆盖率或代码产出异常来自采集缺口
- `批次推进`：结对编程、Co-Claw/OpenClaw 或 SDD 批次未达成人数增长目标
- `质量治理`：提效扩大后缺陷、Review、CI、发布失败上升
- `深入分析`：进入 Agent / RAG，解释工具有效、无效或不被使用的原因

完整产品口径见 [docs/operations/product-loop-playbook.md](docs/operations/product-loop-playbook.md)。

## 当前状态

当前版本定位为 `企业试点版 / 准生产基础版`。

已具备：

- Monorepo 工程骨架
- PostgreSQL 持久化事实表
- 统一事件 schema、采集 SDK、指标公式、规则包
- `collector-gateway` 采集接入服务
- `metric-platform` 指标平台、事件导入、快照回算、分析查询
- `mcp-server` MCP JSON-RPC runtime、工具调用审计、规则与知识查询工具
- `dashboard` AI 提效经营驾驶舱、团队/个人指标、会话分析、出码分析、交付与质量视图
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

### 终极目标

- 人力节省比例
- 人效提升比例
- SDD 需求交付占比

### 代码度量

- 总代码变更行数
- AI 代码生成行数
- 人均代码产出
- AI 代码生成率
- 代码产出（行/人天）
- AI 生成代码采纳率

### AI-IDE + SDD 使用

- AI-IDE 使用人数比例
- SDD 使用人数比例
- AI-IDE + SDD 需求覆盖率
- 提效预估（团队均值）
- 结对编程参与人数
- Co-Claw / OpenClaw 使用人数比例

### 团队推广运营

- 团队需求总数
- AI-IDE 开发需求数
- SDD 开发需求数
- 各团队 AI-IDE 覆盖率
- 各团队 SDD 覆盖率
- 不用 AI-IDE 开发的原因
- 不用 SDD 开发的原因
- 结对编程批次推进目标、时间窗口和完成状态

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
- `指标展示层`：AI 提效经营驾驶舱、团队视图、个人视图、会话分析、出码分析
- `产品闭环层`：工具资产、采集健康、指标解释、管理动作、试点复盘

## 仓库结构

```text
apps/
  collector-gateway/   采集接入 HTTP 服务
  cli-adapter/         CLI 标准采集入口
  cursor-adapter/      Cursor 增强采集入口
  dashboard/           前端指标与管理驾驶舱
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
- 管理侧是否能稳定看到多维指标和风险归因
- 平台侧是否能支撑权限、审计、采集健康和排障
- 看板结论是否能转化为明确管理动作

试点推进见 [docs/operations/pilot-rollout-guide.md](docs/operations/pilot-rollout-guide.md)。

## 文档入口

- 产品闭环：[docs/operations/product-loop-playbook.md](docs/operations/product-loop-playbook.md)
- 员工接入：[docs/operations/employee-onboarding-guide.md](docs/operations/employee-onboarding-guide.md)
- 平台部署：[docs/operations/production-runbook.md](docs/operations/production-runbook.md)
- 试点推进：[docs/operations/pilot-rollout-guide.md](docs/operations/pilot-rollout-guide.md)
- 演示路径：[docs/operations/dashboard-walkthrough.md](docs/operations/dashboard-walkthrough.md)
- 本地演示：[docs/operations/demo-runbook.md](docs/operations/demo-runbook.md)
- 中文计划：[docs/superpowers/plans/2026-04-23-aimetric-中文执行计划.md](docs/superpowers/plans/2026-04-23-aimetric-%E4%B8%AD%E6%96%87%E6%89%A7%E8%A1%8C%E8%AE%A1%E5%88%92.md)

## 路线图

短期优先级：

1. 前端按产品闭环继续重排，强化工具资产、趋势钻取、管理动作和采集健康
2. 补齐指标口径说明、数据来源解释和异常诊断
3. 强化员工接入中心，提供更脚本化、更低心智负担的安装体验
4. 增加更多 GitLab、缺陷系统、CI、发布平台真实连接器
5. 做代码审查、安全审查、接口契约和端到端测试收敛

中期方向：

1. SSO、租户隔离、完整 RBAC、审计和数据治理
2. Helm / K8s / 告警 / 数据保留策略
3. Agent / RAG 智能分析，用于解释趋势、风险和工具有效性
4. 经营价值指标从轻量口径逐步升级为可审计 ROI 模型
