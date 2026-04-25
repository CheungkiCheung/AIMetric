# AIMetric

AIMetric 是一个面向企业落地的 AI 研发效能平台，用来统一采集研发工具链信号，沉淀多维度效能事实，并为提效管理者、技术管理者和平台管理员提供分析、治理与决策支持。

当前版本重点解决四件事：

- 让员工侧以轻量方式接入 `Cursor / CLI / Codex / Claude Code / VS Code / JetBrains`
- 让平台侧统一采集 AI 使用、会话、出码、需求、PR、CI、发布、事故、缺陷等多维事实
- 让管理侧按 `使用渗透 / 有效产出 / 交付效率 / 质量风险 / 业务价值` 观察提效结果
- 为后续 `Agent / RAG` 智能分析保留统一证据链和指标语义层

## 你可以把它当成什么

- 对内试点版：可用于企业内部 AI 研发提效试点
- 管理平台骨架：可继续补 SSO、租户隔离、K8s、告警、数据治理
- 企业产品底座：可继续扩展更多 AI 工具、指标与管理场景

## 角色入口

- 员工接入：
  看 [docs/operations/employee-onboarding-guide.md](/Users/zhangqixiang/0_1WORK/zhongxing/AIMetric/docs/operations/employee-onboarding-guide.md)
- 平台部署 / 运维：
  看 [docs/operations/production-runbook.md](/Users/zhangqixiang/0_1WORK/zhongxing/AIMetric/docs/operations/production-runbook.md)
- 试点推进 / 管理者落地：
  看 [docs/operations/pilot-rollout-guide.md](/Users/zhangqixiang/0_1WORK/zhongxing/AIMetric/docs/operations/pilot-rollout-guide.md)
- 管理者演示路径：
  看 [docs/operations/dashboard-walkthrough.md](/Users/zhangqixiang/0_1WORK/zhongxing/AIMetric/docs/operations/dashboard-walkthrough.md)
- 本地演示 Runbook：
  看 [docs/operations/demo-runbook.md](/Users/zhangqixiang/0_1WORK/zhongxing/AIMetric/docs/operations/demo-runbook.md)
- 全量中文计划：
  看 [docs/superpowers/plans/2026-04-23-aimetric-中文执行计划.md](/Users/zhangqixiang/0_1WORK/zhongxing/AIMetric/docs/superpowers/plans/2026-04-23-aimetric-%E4%B8%AD%E6%96%87%E6%89%A7%E8%A1%8C%E8%AE%A1%E5%88%92.md)

## 当前完成度

按最初的全量规划估算：

- `Phase 1 主链路 MVP`：约 `100%` 完成
- `企业试点版平台能力`：约 `98%` 完成

已完成：

- Monorepo 工程骨架
- 事件 schema、指标公式、规则包、采集 SDK
- MCP 主链路工具：`beforeEditFile`、`afterEditFile`、`recordSession`
- `collector-gateway` 采集接入服务
- `metric-platform` 事件导入、PostgreSQL 持久化、基础归因、个人/团队指标快照、快照表、手动/定时回算
- `rule-engine` 项目规则包解析、规则模板与知识引用
- `rule-engine` 项目规则版本目录、文件化规则模板与激活版本 manifest
- `mcp-server` 新增 `getProjectRules`、`listRuleVersions`、`getRuleTemplate`、`validateRuleTemplate`、`setActiveRuleVersion`、`getRuleRollout`、`setRuleRollout`、`evaluateRuleRollout`、`searchKnowledge` 基础工具
- `mcp-server` 新增最小 MCP JSON-RPC runtime，支持 `initialize`、`tools/list`、`tools/call` 与 stdio 启动入口
- `mcp-server` 新增工具调用审计与失败补偿，支持 `aimetric/audit/list` 查询调用记录
- `mcp-server` 支持将工具调用审计落盘到 `.aimetric/audit-events.jsonl`，并上传为 `mcp.tool.called` 采集事件
- `mcp-server` 的 `afterEditFile` 现在会生成文件级 `edit span evidence`，并通过 runtime 自动桥接成 `edit.span.recorded`
- `metric-platform` 新增 MCP 审计质量指标 API：`GET /metrics/mcp-audit`
- `metric-platform` 新增编辑证据查询 API：`GET /evidence/edits`
- `metric-platform` 新增规则中心 API：`/rules/project`、`/rules/versions`、`/rules/template`、`/rules/validate`、`/rules/active`、`/rules/rollout`
- `rule-engine` 支持规则灰度发布策略持久化，可配置候选版本、灰度比例和定向成员
- `rule-engine` 支持灰度命中计算，按定向成员和稳定百分比桶选择规则版本
- `metric-platform` 新增知识库查询 API：`GET /knowledge/search`
- `dashboard` 新增 MCP 采集质量视图，展示工具成功率、失败率和平均耗时
- `dashboard` 新增规则中心管理视图，支持页面内启停灰度、调整比例、维护定向成员，并展示命中规则版本
- `dashboard` 新增分析摘要、会话分析、出码分析视图，展示真实会话主线、编辑证据与 Tab 接受聚合
- `employee-onboarding` 员工接入原型，可生成 `.aimetric/config.json` 与 `.aimetric/mcp.json`
- `employee-onboarding` 会写入 `collector.authTokenEnv`，只保存环境变量名，不保存真实 token
- `employee-onboarding` 支持 `cursor / cli / vscode` 三种标准接入档，并生成对应适配文件
- `cli-adapter` 已提供标准 CLI 会话采集入口，可直接上报 `session.recorded` 批次
- `cursor-adapter` 已提供 Cursor 增强采集入口，支持 transcript 扫描、增量状态和 `cursor-db` 上报
- `cursor-db-adapter` 已提供跨平台路径发现、会话主线 transcript 解析、`state.vscdb` 状态库发现与定时扫描状态管理
- `metric-platform` 已支持 `ingestion_key` 幂等去重，保障定时扫描不重复记数
- `edit-evidence` 已提供文件级 `edit span` 证据建模、快照 hash、diff 与幂等键生成
- `collector-sdk`、`cursor-db-adapter`、`cursor-adapter` 已支持 `tab.accepted` 增强事件采集
- `metric-platform` 已新增 Tab 补全事件查询 API：`GET /evidence/tab-completions`
- `metric-platform` 已新增分析查询 API：`GET /analysis/summary`、`GET /analysis/sessions`、`GET /analysis/output`
- `cursor-adapter` 现在会把 `estimatedActiveMinutes`、`workspaceStorage/globalStorage state.vscdb` 证据摘要一起写入 `session.recorded`
- `collector-sdk` 可读取 `.aimetric/config.json` 并生成标准 `IngestionBatch`
- `collector-sdk` 提供带 Bearer Token 的统一采集批次发布入口
- `collector-gateway` 支持通过 `AIMETRIC_COLLECTOR_TOKEN` 或启动参数开启采集端 Bearer Token 鉴权
- `metric-platform` 支持通过 `METRIC_PLATFORM_ADMIN_TOKEN` 开启管理端 Bearer Token 鉴权
- `metric-platform` 新增管理审计查询 API：`GET /admin/audit`
- `collector-gateway` 与 `metric-platform` 已提供 `/ready` 和 Prometheus 文本 `/metrics`
- `mcp-server recordSession` 可读取员工接入配置并补齐项目、成员、仓库、规则版本
- `dashboard` 个人出码视图、团队出码视图、会话分析、出码分析、自动刷新、项目/成员/时间范围筛选
- 本地 `docker-compose.yml`，包含 PostgreSQL 和 Redis
- 准生产运维手册：[production-runbook.md](docs/operations/production-runbook.md)
- 基础 README、设计文档、Phase 1 执行计划
- 企业指标语义层、组织治理、viewer scope 授权、身份映射
- `GitHub / GitLab PR`、`Jira / TAPD`、`GitHub Actions / GitLab CI`、发布、事故、缺陷主线接入
- 缺陷归因分析：`AI 参与需求缺陷率`、`AI 触达 PR 逃逸缺陷率`、`发布失败关联缺陷数`、`事故关联缺陷数`
- 业务价值轻量指标：`critical_requirement_cycle_time`

未完成：

- Cursor 更深层 SQLite 键级别编辑/Tab/本地数据库细粒度逆向采集
- 企业级 SSO、持久化审计、完整 Kubernetes Helm Chart 等生产集成

## 架构分层

项目按企业级产品能力分层：

- `采集平台层`：Cursor / CLI / IDE 入口，当前先以 SDK 与 MCP 工具为主
- `数据采集层`：MCP 工具、采集 SDK、采集网关
- `平台能力层`：指标平台、归因证据、指标计算、PostgreSQL 事实表
- `证据关联层`：会话主线、编辑证据、后续 Git 归因与分析查询
- `指标展示层`：提效管理驾驶舱、个人出码视图、团队出码视图、会话分析、出码分析

当前主链路：

```text
MCP 工具 / SDK
  -> collector-gateway
  -> metric-platform /events/import
  -> 指标计算与快照
  -> dashboard
```

## 仓库结构

```text
apps/
  collector-gateway/   采集接入 HTTP 服务
  cli-adapter/         CLI 标准采集入口
  cursor-adapter/      Cursor 增强采集入口
  dashboard/           前端指标看板
  mcp-server/          MCP 主链路工具与 stdio runtime
  metric-platform/     指标平台 HTTP 服务

packages/
  collector-sdk/       采集端本地缓冲与客户端 SDK
  cursor-db-adapter/   Cursor transcript/状态发现与增量解析
  edit-evidence/       文件级 edit span 证据建模
  event-schema/        统一事件模型
  git-attribution/     Git/AI 归因证据构建
  metric-core/         指标公式
  rule-engine/         规则包解析
  employee-onboarding/ 员工接入配置生成原型

docs/
  superpowers/specs/   系统设计文档
  superpowers/plans/   Phase 1 执行计划
```

## 快速开始

### 1. 安装依赖

当前仓库使用 `pnpm` workspace。如果本机没有全局 `pnpm`，可以用 `corepack`。

```bash
corepack pnpm install
```

### 2. 准备环境变量

复制根目录环境样例：

```bash
cp .env.example .env.local
```

最小必填项：

- `DATABASE_URL`
- `METRIC_PLATFORM_URL`
- `AIMETRIC_COLLECTOR_TOKEN`
- `METRIC_PLATFORM_ADMIN_TOKEN`

### 3. 启动基础依赖

```bash
docker compose up -d
```

当前 `docker-compose.yml` 提供：

- PostgreSQL：`127.0.0.1:5432`
- Redis：`127.0.0.1:6379`

### 4. 启动后端服务

```bash
export DATABASE_URL='postgresql://aimetric:aimetric@127.0.0.1:5432/aimetric?sslmode=disable'
export AIMETRIC_COLLECTOR_TOKEN='local-collector-token'
export METRIC_PLATFORM_ADMIN_TOKEN='local-admin-token'
export METRIC_PLATFORM_URL='http://127.0.0.1:3001'

corepack pnpm start:metric-platform
corepack pnpm start:collector-gateway
```

默认端口：

- `collector-gateway`：`http://127.0.0.1:3000`
- `metric-platform`：`http://127.0.0.1:3001`

### 5. 启动前端看板

```bash
corepack pnpm dev:dashboard
```

前端默认从 `http://localhost:3001` 读取指标平台数据。

### 6. 打开试点流程

建议本地按这个顺序体验：

1. 用 `aimetric onboard` 生成员工侧配置
2. 用 `aimetric doctor` 检查接入状态
3. 用 `corepack pnpm demo:check` 检查 demo 所需服务和关键接口
4. 用 `corepack pnpm demo:seed` 导入一批需求 / PR / CI / 发布 / 缺陷示例数据
5. 打开 Dashboard 查看个人、团队、需求、PR、CI、发布、事故、缺陷与归因视图

## 本地启动

### 1. 启动基础依赖

```bash
docker compose up -d
```

当前 `docker-compose.yml` 提供：

- PostgreSQL：`127.0.0.1:5432`
- Redis：`127.0.0.1:6379`

### 2. 启动后端服务

```bash
corepack pnpm start:collector-gateway
corepack pnpm start:metric-platform
```

如需开启采集端身份认证，在启动 `collector-gateway` 前设置：

```bash
export AIMETRIC_COLLECTOR_TOKEN='replace-with-your-secret'
```

如需开启管理端鉴权，在启动 `metric-platform` 前设置：

```bash
export METRIC_PLATFORM_ADMIN_TOKEN='replace-with-admin-secret'
```

默认端口：

- `collector-gateway`：`http://127.0.0.1:3000`
- `metric-platform`：`http://127.0.0.1:3001`

### 3. 启动前端看板

```bash
corepack pnpm dev:dashboard
```

前端默认从 `http://localhost:3001` 读取指标平台数据。

## 员工接入最小示例

员工机器通常只需要：

- 一个 `Node.js` 运行时
- 一个 `aimetric` onboarding 命令入口
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

如果 collector 暂时不可达：

- 员工命令不会直接阻断
- 事件会缓存在 `.aimetric/outbox`
- 后续可执行 `aimetric flush`

## 试点建议

建议按三层推进：

1. 小范围试点：
   先选 `1-2` 个团队、`10-30` 名研发，跑通采集、权限、指标和管理看板
2. 角色校准：
   让员工、技术管理者、提效管理者分别确认他们最关心的面板和口径
3. 再扩大范围：
   扩到多团队后，再考虑 `SSO / K8s / 告警 / 数据保留 / Agent-RAG`

如果需要一套固定演示路径：

```bash
corepack pnpm demo:runbook
corepack pnpm demo:check
corepack pnpm demo:seed
```

如果 `demo:check` 失败，说明本地服务或关键接口还没准备好；命令会直接返回非 `0`，方便联调前快速发现问题。

然后按 [docs/operations/dashboard-walkthrough.md](/Users/zhangqixiang/0_1WORK/zhongxing/AIMetric/docs/operations/dashboard-walkthrough.md) 里的顺序进行演示。

## API 示例

### 健康检查

```bash
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/ready
curl http://127.0.0.1:3000/metrics
curl http://127.0.0.1:3001/health
curl http://127.0.0.1:3001/ready
curl http://127.0.0.1:3001/metrics
```

### 上报采集批次

```bash
curl -X POST http://127.0.0.1:3000/ingestion \
  -H 'authorization: Bearer replace-with-your-secret' \
  -H 'content-type: application/json' \
  -d '{
    "schemaVersion": "v1",
    "source": "cursor",
    "events": [
      {
        "eventType": "session.recorded",
        "occurredAt": "2026-04-23T00:00:00.000Z",
        "payload": {
          "sessionId": "sess_1",
          "projectKey": "proj",
          "repoName": "repo",
          "memberId": "alice",
          "acceptedAiLines": 44,
          "commitTotalLines": 55
        }
      }
    ]
  }'
```

### 查询指标

```bash
curl http://127.0.0.1:3001/metrics/personal
curl http://127.0.0.1:3001/metrics/team
curl http://127.0.0.1:3001/evidence/edits
curl http://127.0.0.1:3001/evidence/tab-completions
curl http://127.0.0.1:3001/analysis/summary
curl http://127.0.0.1:3001/analysis/sessions
curl http://127.0.0.1:3001/analysis/output
```

支持按项目、成员、时间范围筛选：

```bash
curl 'http://127.0.0.1:3001/metrics/personal?projectKey=proj&memberId=alice&from=2026-04-23T00:00:00.000Z&to=2026-04-24T00:00:00.000Z'
curl 'http://127.0.0.1:3001/metrics/team?projectKey=proj&from=2026-04-23T00:00:00.000Z&to=2026-04-24T00:00:00.000Z'
curl 'http://127.0.0.1:3001/evidence/edits?projectKey=proj&sessionId=sess_1&filePath=/repo/src/demo.ts'
curl 'http://127.0.0.1:3001/evidence/tab-completions?projectKey=proj&sessionId=sess_1&filePath=/repo/src/demo.ts'
curl 'http://127.0.0.1:3001/analysis/summary?projectKey=proj&memberId=alice'
curl 'http://127.0.0.1:3001/analysis/sessions?projectKey=proj&memberId=alice'
curl 'http://127.0.0.1:3001/analysis/output?projectKey=proj&memberId=alice'
```

### 回算与查询指标快照

```bash
curl -X POST http://127.0.0.1:3001/metrics/recalculate \
  -H 'authorization: Bearer replace-with-admin-secret' \
  -H 'content-type: application/json' \
  -d '{
    "projectKey": "proj",
    "from": "2026-04-23T00:00:00.000Z",
    "to": "2026-04-24T00:00:00.000Z"
  }'

curl 'http://127.0.0.1:3001/metrics/snapshots?projectKey=proj&from=2026-04-23T00:00:00.000Z&to=2026-04-24T00:00:00.000Z'
```

### 查询管理审计

```bash
curl http://127.0.0.1:3001/admin/audit \
  -H 'authorization: Bearer replace-with-admin-secret'
```

如需启动指标平台时自动定时回算，可设置：

```bash
METRIC_SNAPSHOT_RECALCULATION_INTERVAL_MS=60000 corepack pnpm start:metric-platform
```

## 测试与校验

```bash
corepack pnpm test
corepack pnpm -r lint
```

## 当前建议的收尾边界

如果你要把这版作为“企业试点前版本”，现在已经足够：

- 员工端轻量接入
- 多工具采集主链路
- 多维指标与管理视图
- 组织治理与权限
- 需求、PR、CI、发布、事故、缺陷主线
- 缺陷归因与关键需求周期

下一阶段更适合切到：

- 试点联调与真实接入
- Agent / RAG 智能分析
- 更强的生产化部署能力

补充说明：

- 仓库内包含本地 HTTP 集成测试
- 在某些沙箱环境中，本地端口监听测试可能需要额外权限
- PostgreSQL 真实持久化测试默认跳过，需要设置 `RUN_DB_TESTS=1`

### PostgreSQL 持久化验证

```bash
DATABASE_URL='postgresql://aimetric:aimetric@127.0.0.1:5432/aimetric?schema=public' \
RUN_DB_TESTS=1 \
./node_modules/.bin/vitest run apps/metric-platform/src/database/postgres-event.repository.spec.ts
```

事件事实表 SQL 位于：

```text
apps/metric-platform/sql/schema.sql
```

## 已提交里程碑

- `docs: add AIMetric article-congruent system design spec`
- `feat: bootstrap workspace and shared contracts`
- `feat: add mcp server mainline tools`
- `feat: add collector ingestion mainline`
- `feat: add metric platform snapshot service`
- `feat: add git attribution evidence builder`
- `feat: add dashboard and team metric views`
- `feat: add phase1 local runtime and http entrypoints`
- `feat: wire collector ingestion into metric snapshots`

## 规则与知识工具

当前已经提供基础版规则/知识查询能力：

```text
getProjectRules(projectKey, toolType, sceneType)
listRuleVersions(projectKey)
getRuleTemplate(projectKey, version)
validateRuleTemplate(projectKey, version)
setActiveRuleVersion(projectKey, version)
getRuleRollout(projectKey)
setRuleRollout(projectKey, enabled, candidateVersion, percentage, includedMembers)
evaluateRuleRollout(projectKey, memberId)
searchKnowledge(query, limit)
```

当前规则版本和灰度策略由 `packages/rule-engine/src/templates/<project>/manifest.json` 控制，模板正文来自同目录下的版本文件；知识库直接使用仓库内 `docs/` 文档做轻量检索，便于后续继续升级为真正的规则中心和知识库查询 MCP。

## 员工接入原型

当前提供基础 CLI 原型，用于在员工项目目录生成 AIMetric 接入配置：

```bash
corepack pnpm --filter @aimetric/employee-onboarding build
node packages/employee-onboarding/dist/cli.js \
  --workspaceDir=/path/to/employee/project \
  --projectKey=aimetric \
  --memberId=alice \
  --repoName=AIMetric \
  --toolProfile=cursor
```

执行后会生成：

```text
.aimetric/config.json
.aimetric/mcp.json
```

不同 `toolProfile` 还会额外生成：

- `cursor`：`.cursor/mcp.json`
- `cursor` 增强档：`.aimetric/cursor-collector.json`
- `vscode`：`.vscode/mcp.json`
- `cli`：`.aimetric/cli.env`

后续插件/CLI 可以复用这两个文件，自动读取采集端点、员工身份、仓库名、当前激活规则版本和 MCP 工具列表。

如果员工使用纯 CLI 工作流，现在还可以直接接入 `cli-adapter`：

```bash
corepack pnpm --filter @aimetric/cli-adapter build
node apps/cli-adapter/dist/cli.js \
  --workspaceDir=/path/to/employee/project \
  --sessionId=cli_sess_1 \
  --acceptedAiLines=12 \
  --commitTotalLines=20 \
  --userMessage='实现 CLI 适配器' \
  --assistantMessage='已完成实现' \
  --publish
```

说明：

- 默认是 `dryRun`，会打印标准 `IngestionBatch`
- 加 `--publish` 后会直接把批次投递到 `.aimetric/config.json` 中配置的 `collector.endpoint`
- 这意味着员工最少只要生成一次 `.aimetric/config.json`，后续 CLI 采集和 MCP 采集都能复用同一套身份与规则上下文

如果重点团队希望打开 Cursor 增强采集，现在还可以直接接入 `cursor-adapter`：

```bash
corepack pnpm --filter @aimetric/cursor-adapter build
node apps/cursor-adapter/dist/cli.js \
  --workspaceDir=/path/to/employee/project \
  --publish
```

说明：

- 默认员工仍只需要标准 onboarding，不需要理解 Cursor 本地目录结构
- `cursor-adapter` 只面向重点团队或研究场景，用于补齐会话主线数据
- `.aimetric/cursor-collector.json` 会作为增强采集配置模板生成在员工项目内
- 定时任务可以直接重复调用这个命令，平台会依赖 `ingestionKey` 做幂等去重

当前 `collector-sdk` 和 `recordSession` 已能读取 `.aimetric/config.json`，将员工身份、项目、仓库和规则版本写入 `session.recorded` 事件。

`.aimetric/mcp.json` 会生成通用 MCP 客户端配置：

```json
{
  "mcpServers": {
    "aimetric": {
      "command": "aimetric-mcp-server",
      "env": {
        "AIMETRIC_WORKSPACE_DIR": "/path/to/employee/project"
      }
    }
  }
}
```

本地开发可先构建并启动 MCP stdio runtime：

```bash
corepack pnpm --filter @aimetric/mcp-server build
corepack pnpm --filter @aimetric/mcp-server start
```

runtime 会记录 `tools/call` 调用审计，包括工具名、请求 id、成功/失败、耗时和错误原因。工具内部异常会返回 `isError: true`，避免 MCP 进程直接崩溃；本地可通过 `aimetric/audit/list` 查询当前进程内审计事件。

当 `AIMETRIC_WORKSPACE_DIR` 指向员工工作区时，runtime 会自动：

- 将审计事件追加到 `.aimetric/audit-events.jsonl`
- 读取 `.aimetric/config.json` 中的 collector endpoint
- 上传 `mcp.tool.called` 标准采集事件到 collector-gateway

## 下一步路线

建议优先级：

1. 多 IDE/CLI 采集适配器
2. Cursor 更深层编辑/Tab/本地数据库逆向采集
3. 准生产能力：RBAC、审计、可观测、部署文档
