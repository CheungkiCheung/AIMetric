# AIMetric

面向文章《AI出码率70%+的背后：高德团队如何实现AI研发效率的量化与优化》的同构复现项目。

当前仓库已经完成 Phase 1 的主链路基础能力：

- `mcp-server`：`beforeEditFile`、`afterEditFile`、`recordSession` 三个主链路工具
- `collector-gateway`：采集批次接入与校验
- `metric-platform`：个人/团队快照与基础归因证据
- `dashboard`：个人出码视图与团队出码视图

## 仓库结构

- `apps/collector-gateway`：采集接入层 HTTP 服务
- `apps/metric-platform`：指标平台 HTTP 服务
- `apps/mcp-server`：MCP 主链路工具
- `apps/dashboard`：前端看板
- `packages/*`：事件模型、指标计算、规则解析、归因与采集 SDK

## 本地启动

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动基础依赖

```bash
docker compose up -d
```

当前 `docker-compose.yml` 提供：

- PostgreSQL `5432`
- Redis `6379`

### 3. 启动后端服务

```bash
pnpm start:collector-gateway
pnpm start:metric-platform
```

启动后可访问：

- `http://127.0.0.1:3000/health`
- `http://127.0.0.1:3000/ingestion`
- `http://127.0.0.1:3001/health`
- `http://127.0.0.1:3001/metrics/personal`
- `http://127.0.0.1:3001/metrics/team`

### 4. 启动前端看板

```bash
pnpm dev:dashboard
```

默认通过 `http://localhost:3001` 读取指标平台数据。

## 测试与校验

```bash
pnpm test
pnpm -r lint
```

说明：

- 仓库内包含基于本地端口监听的 HTTP 集成测试
- 在受限沙箱环境中，这类测试可能需要额外端口权限

## 当前状态

这一版仍然是 Phase 1 主链路 MVP，重点是先把文章里的核心闭环跑通：

`MCP采集 -> 采集网关 -> 归因/指标计算 -> 个人/团队看板`

后续阶段将继续补：

- 规则中心与知识库查询
- 多 IDE/CLI 适配
- 更完整的本地数据库逆向采集研究模块
- 准生产鉴权、审计、回算、可观测与部署能力
