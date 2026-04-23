# AIMetric

AIMetric 是对文章《AI出码率70%+的背后：高德团队如何实现AI研发效率的量化与优化》的同构复现项目。当前版本优先复现文章中的 Phase 1 主链路：MCP 标准化采集、采集网关、归因证据、指标计算、个人/团队看板。

## 当前完成度

按最初的全量规划估算：

- `Phase 1 主链路 MVP`：约 `100%` 完成
- `全量文章同构系统`：约 `73%` 完成

已完成：

- Monorepo 工程骨架
- 事件 schema、指标公式、规则包、采集 SDK
- MCP 主链路工具：`beforeEditFile`、`afterEditFile`、`recordSession`
- `collector-gateway` 采集接入服务
- `metric-platform` 事件导入、PostgreSQL 持久化、基础归因、个人/团队指标快照、快照表、手动/定时回算
- `rule-engine` 项目规则包解析、文章同构术语与知识引用
- `rule-engine` 项目规则版本目录、文件化规则模板与激活版本 manifest
- `mcp-server` 新增 `getProjectRules`、`listRuleVersions`、`getRuleTemplate`、`validateRuleTemplate`、`setActiveRuleVersion`、`getRuleRollout`、`setRuleRollout`、`evaluateRuleRollout`、`searchKnowledge` 基础工具
- `mcp-server` 新增最小 MCP JSON-RPC runtime，支持 `initialize`、`tools/list`、`tools/call` 与 stdio 启动入口
- `mcp-server` 新增工具调用审计与失败补偿，支持 `aimetric/audit/list` 查询调用记录
- `mcp-server` 支持将工具调用审计落盘到 `.aimetric/audit-events.jsonl`，并上传为 `mcp.tool.called` 采集事件
- `metric-platform` 新增 MCP 审计质量指标 API：`GET /metrics/mcp-audit`
- `metric-platform` 新增规则中心 API：`/rules/project`、`/rules/versions`、`/rules/template`、`/rules/validate`、`/rules/active`、`/rules/rollout`
- `rule-engine` 支持规则灰度发布策略持久化，可配置候选版本、灰度比例和定向成员
- `rule-engine` 支持灰度命中计算，按定向成员和稳定百分比桶选择规则版本
- `metric-platform` 新增知识库查询 API：`GET /knowledge/search`
- `dashboard` 新增 MCP 采集质量视图，展示工具成功率、失败率和平均耗时
- `dashboard` 新增规则中心管理视图，展示生效版本、版本库存、灰度候选版本、灰度比例和命中规则版本
- `employee-onboarding` 员工接入原型，可生成 `.aimetric/config.json` 与 `.aimetric/mcp.json`
- `collector-sdk` 可读取 `.aimetric/config.json` 并生成标准 `IngestionBatch`
- `mcp-server recordSession` 可读取员工接入配置并补齐项目、成员、仓库、规则版本
- `dashboard` 个人出码视图、团队出码视图、自动刷新、项目/成员/时间范围筛选
- 本地 `docker-compose.yml`，包含 PostgreSQL 和 Redis
- 基础 README、设计文档、Phase 1 执行计划

未完成：

- 多 IDE/CLI 适配器扩展
- 规则灰度页面内写操作
- Cursor 本地数据库逆向采集研究模块
- RBAC、审计、可观测、回算、生产部署等准生产能力

## 架构分层

项目按文章里的四层架构复现：

- `采集平台层`：Cursor / CLI / IDE 入口，当前先以 SDK 与 MCP 工具为主
- `数据采集层`：MCP 工具、采集 SDK、采集网关
- `平台能力层`：指标平台、归因证据、指标计算、PostgreSQL 事实表
- `指标展示层`：个人出码视图、团队出码视图

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
  dashboard/           前端指标看板
  mcp-server/          MCP 主链路工具与 stdio runtime
  metric-platform/     指标平台 HTTP 服务

packages/
  collector-sdk/       采集端本地缓冲与客户端 SDK
  event-schema/        统一事件模型
  git-attribution/     Git/AI 归因证据构建
  metric-core/         指标公式
  rule-engine/         规则包解析
  employee-onboarding/ 员工接入配置生成原型

docs/
  superpowers/specs/   系统设计文档
  superpowers/plans/   Phase 1 执行计划
```

## 本地启动

### 1. 安装依赖

当前仓库使用 `pnpm` workspace。如果本机没有全局 `pnpm`，可以用 `corepack`。

```bash
corepack pnpm install
```

### 2. 启动基础依赖

```bash
docker compose up -d
```

当前 `docker-compose.yml` 提供：

- PostgreSQL：`127.0.0.1:5432`
- Redis：`127.0.0.1:6379`

### 3. 启动后端服务

```bash
corepack pnpm start:collector-gateway
corepack pnpm start:metric-platform
```

默认端口：

- `collector-gateway`：`http://127.0.0.1:3000`
- `metric-platform`：`http://127.0.0.1:3001`

### 4. 启动前端看板

```bash
corepack pnpm dev:dashboard
```

前端默认从 `http://localhost:3001` 读取指标平台数据。

## API 示例

### 健康检查

```bash
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3001/health
```

### 上报采集批次

```bash
curl -X POST http://127.0.0.1:3000/ingestion \
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
```

支持按项目、成员、时间范围筛选：

```bash
curl 'http://127.0.0.1:3001/metrics/personal?projectKey=proj&memberId=alice&from=2026-04-23T00:00:00.000Z&to=2026-04-24T00:00:00.000Z'
curl 'http://127.0.0.1:3001/metrics/team?projectKey=proj&from=2026-04-23T00:00:00.000Z&to=2026-04-24T00:00:00.000Z'
```

### 回算与查询指标快照

```bash
curl -X POST http://127.0.0.1:3001/metrics/recalculate \
  -H 'content-type: application/json' \
  -d '{
    "projectKey": "proj",
    "from": "2026-04-23T00:00:00.000Z",
    "to": "2026-04-24T00:00:00.000Z"
  }'

curl 'http://127.0.0.1:3001/metrics/snapshots?projectKey=proj&from=2026-04-23T00:00:00.000Z&to=2026-04-24T00:00:00.000Z'
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
  --repoName=AIMetric
```

执行后会生成：

```text
.aimetric/config.json
.aimetric/mcp.json
```

后续插件/CLI 可以复用这两个文件，自动读取采集端点、员工身份、仓库名、当前激活规则版本和 MCP 工具列表。

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

1. 规则灰度页面内启停和比例调整
2. 多 IDE/CLI 采集适配器
3. 准生产能力：RBAC、审计、可观测、部署文档
