# AIMetric 本地 Demo Runbook

本文档把本地试点演示的动作压成一条固定流程，适合演示前照着执行。

## 1. 固定顺序

```bash
corepack pnpm install
docker compose up -d
```

导出最小环境变量：

```bash
export DATABASE_URL='postgresql://aimetric:aimetric@127.0.0.1:5432/aimetric?sslmode=disable'
export AIMETRIC_COLLECTOR_TOKEN='local-collector-token'
export METRIC_PLATFORM_ADMIN_TOKEN='local-admin-token'
export METRIC_PLATFORM_URL='http://127.0.0.1:3001'
```

然后分别启动：

```bash
corepack pnpm start:metric-platform
corepack pnpm start:collector-gateway
corepack pnpm dev:dashboard
```

再执行：

```bash
corepack pnpm demo:check
corepack pnpm demo:seed
```

最后打开 Dashboard，按 [dashboard-walkthrough.md](/Users/zhangqixiang/0_1WORK/zhongxing/AIMetric/docs/operations/dashboard-walkthrough.md) 的顺序演示。

## 2. 命令版摘要

如果你只想快速看顺序：

```bash
corepack pnpm demo:runbook
```

## 3. 常见失败点

- `demo:check` 失败：
  优先确认后端服务还没启动，或者环境变量没有导出。
- `demo:seed` 失败：
  优先确认 `METRIC_PLATFORM_ADMIN_TOKEN` 是否和本地服务一致。
- Dashboard 没数据：
  优先确认当前筛选的 `projectKey` 是否是 `aimetric`。
