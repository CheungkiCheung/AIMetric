# AIMetric

AIMetric 是对文章《AI出码率70%+的背后：高德团队如何实现AI研发效率的量化与优化》的同构复现项目。当前版本优先复现文章中的 Phase 1 主链路：MCP 标准化采集、采集网关、归因证据、指标计算、个人/团队看板。

## 当前完成度

按最初的全量规划估算：

- `Phase 1 主链路 MVP`：约 `90%` 完成
- `全量文章同构系统`：约 `35%` 完成

已完成：

- Monorepo 工程骨架
- 事件 schema、指标公式、规则包、采集 SDK
- MCP 主链路工具：`beforeEditFile`、`afterEditFile`、`recordSession`
- `collector-gateway` 采集接入服务
- `metric-platform` 事件导入、PostgreSQL 持久化、基础归因、个人/团队指标快照
- `dashboard` 个人出码视图和团队出码视图
- 本地 `docker-compose.yml`，包含 PostgreSQL 和 Redis
- 基础 README、设计文档、Phase 1 执行计划

未完成：

- 指标快照表和定时回算任务
- 规则中心与知识库查询 MCP
- 多 IDE/CLI 适配器扩展
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
  mcp-server/          MCP 主链路工具
  metric-platform/     指标平台 HTTP 服务

packages/
  collector-sdk/       采集端本地缓冲与客户端 SDK
  event-schema/        统一事件模型
  git-attribution/     Git/AI 归因证据构建
  metric-core/         指标公式
  rule-engine/         规则包解析

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

## 下一步路线

建议优先级：

1. 指标快照表和定时回算任务
2. Dashboard 自动刷新、时间范围筛选、项目/成员筛选
3. 规则中心与文档查询 MCP
4. 多 IDE/CLI 采集适配器
5. 准生产能力：RBAC、审计、可观测、回算、部署文档
