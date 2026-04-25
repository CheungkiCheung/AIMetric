# AIMetric 准生产运维手册

本文档用于把 AIMetric 从本地 MVP 运行方式推进到可继续工程化落地的准生产形态。

## 1. 服务组成

准生产最小部署包含：

- `collector-gateway`：采集端统一入口，接收员工侧 MCP、CLI、Cursor 增强采集事件。
- `metric-platform`：事件导入、指标聚合、规则中心、知识查询、分析 API。
- `dashboard`：指标展示层，可由静态资源服务或前端平台托管。
- `PostgreSQL`：事件事实表与指标快照表。
- `Redis`：预留队列、限流和缓存扩展位，当前 compose 已提供。

## 2. 必要环境变量

生产或准生产环境必须由部署系统注入密钥，不应写入仓库。

```bash
export DATABASE_URL='postgresql://aimetric:aimetric@postgres:5432/aimetric?schema=public'
export AIMETRIC_COLLECTOR_TOKEN='replace-with-collector-token'
export METRIC_PLATFORM_ADMIN_TOKEN='replace-with-admin-token'
export METRIC_PLATFORM_URL='http://metric-platform:3001'
export METRIC_SNAPSHOT_RECALCULATION_INTERVAL_MS=60000
export INGESTION_DELIVERY_MODE='sync'
```

变量说明：

- `AIMETRIC_COLLECTOR_TOKEN`：采集端 Bearer Token。开启后，`collector-gateway /ingestion` 会拒绝未授权请求。
- `METRIC_PLATFORM_ADMIN_TOKEN`：管理端 Bearer Token。开启后，规则变更、回算、管理审计查询需要鉴权。
- `DATABASE_URL`：PostgreSQL 连接串。
- `METRIC_PLATFORM_URL`：`collector-gateway` 转发事件到 `metric-platform` 的地址。
- `METRIC_SNAPSHOT_RECALCULATION_INTERVAL_MS`：指标快照自动回算周期。
- `INGESTION_DELIVERY_MODE`：采集投递模式，默认 `sync`；设置为 `queue` 时，`collector-gateway` 先接收并入队，再由 flush worker / 手动 flush 投递到 `metric-platform`。

## 3. 本地准生产启动

```bash
corepack pnpm install
docker compose up -d

export AIMETRIC_COLLECTOR_TOKEN='local-collector-token'
export METRIC_PLATFORM_ADMIN_TOKEN='local-admin-token'

corepack pnpm start:metric-platform
corepack pnpm start:collector-gateway
corepack pnpm dev:dashboard
```

采集端请求示例：

```bash
curl -X POST http://127.0.0.1:3000/ingestion \
  -H 'authorization: Bearer local-collector-token' \
  -H 'content-type: application/json' \
  -d '{"schemaVersion":"v1","source":"cursor","events":[]}'
```

管理端请求示例：

```bash
curl -X POST http://127.0.0.1:3001/metrics/recalculate \
  -H 'authorization: Bearer local-admin-token' \
  -H 'x-aimetric-actor: platform-admin' \
  -H 'content-type: application/json' \
  -d '{"projectKey":"aimetric"}'
```

## 4. 健康检查与可观测

两个后端服务都提供：

```bash
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/ready
curl http://127.0.0.1:3000/metrics
curl http://127.0.0.1:3000/ingestion/health

curl http://127.0.0.1:3001/health
curl http://127.0.0.1:3001/ready
curl http://127.0.0.1:3001/metrics
```

Prometheus 可抓取：

- `aimetric_collector_gateway_uptime_seconds`
- `aimetric_collector_gateway_requests_total`
- `aimetric_collector_gateway_ingestion_queue_depth`
- `aimetric_collector_gateway_ingestion_dead_letter_depth`
- `aimetric_collector_gateway_ingestion_forwarded_total`
- `aimetric_collector_gateway_ingestion_failed_forward_total`
- `aimetric_metric_platform_uptime_seconds`
- `aimetric_metric_platform_requests_total`
- `aimetric_metric_platform_admin_audit_events_total`

## 4.1 采集队列模式

第一版队列模式使用 collector-gateway 进程内队列，用于验证异步采集协议、健康指标、重试和 DLQ 行为。准生产多副本部署前，应替换为 Redis Stream / BullMQ。

开启方式：

```bash
export INGESTION_DELIVERY_MODE='queue'
corepack pnpm start:collector-gateway
```

查看采集队列健康：

```bash
curl http://127.0.0.1:3000/ingestion/health
```

手动触发队列 flush：

```bash
curl -X POST http://127.0.0.1:3000/ingestion/flush
```

排障判断：

- `queueDepth` 持续增长：检查 `METRIC_PLATFORM_URL`、网络连通性和 `metric-platform /events/import`。
- `deadLetterDepth` 大于 0：说明批次多次投递失败，应先修复下游，再基于 DLQ 内容设计重放工具。
- `failedForwardTotal` 增长：说明存在下游不可用、HTTP 非 2xx 或网络异常。
- 当前内存队列重启会丢失，不能作为最终企业级持久队列。

## 5. 管理审计

开启 `METRIC_PLATFORM_ADMIN_TOKEN` 后，以下管理操作会写入轻量审计记录：

- `POST /metrics/recalculate`
- `POST /rules/active`
- `POST /rules/rollout`

查询审计：

```bash
curl http://127.0.0.1:3001/admin/audit \
  -H 'authorization: Bearer local-admin-token'
```

审计字段：

- `action`：管理动作。
- `actor`：来自 `x-aimetric-actor`，缺省为 `admin`。
- `occurredAt`：服务端时间。
- `status`：当前记录成功动作。

## 6. 数据回算与修复

常规回算：

```bash
curl -X POST http://127.0.0.1:3001/metrics/recalculate \
  -H 'authorization: Bearer local-admin-token' \
  -H 'content-type: application/json' \
  -d '{
    "projectKey": "aimetric",
    "from": "2026-04-23T00:00:00.000Z",
    "to": "2026-04-24T00:00:00.000Z"
  }'
```

修复建议流程：

- 先确认 `metric_events` 中事实事件存在且 `ingestion_key` 没有重复冲突。
- 对受影响项目和时间范围执行 `POST /metrics/recalculate`。
- 通过 `GET /metrics/snapshots`、`GET /analysis/summary`、`GET /analysis/sessions` 验证聚合结果。
- 若发现采集端重复上报，优先检查 `.aimetric/cursor-sync-state.json` 和平台 `ingestion_key`。

## 7. Kubernetes 部署骨架

示例 Secret：

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: aimetric-secrets
type: Opaque
stringData:
  DATABASE_URL: postgresql://aimetric:aimetric@postgres:5432/aimetric?schema=public
  AIMETRIC_COLLECTOR_TOKEN: replace-with-collector-token
  METRIC_PLATFORM_ADMIN_TOKEN: replace-with-admin-token
```

示例 Deployment 环境变量：

```yaml
envFrom:
  - secretRef:
      name: aimetric-secrets
env:
  - name: METRIC_PLATFORM_URL
    value: http://metric-platform:3001
  - name: METRIC_SNAPSHOT_RECALCULATION_INTERVAL_MS
    value: "60000"
```

探针建议：

```yaml
readinessProbe:
  httpGet:
    path: /ready
    port: 3001
livenessProbe:
  httpGet:
    path: /health
    port: 3001
```

Prometheus 抓取建议：

```yaml
metadata:
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/path: /metrics
    prometheus.io/port: "3001"
```

## 8. 员工接入密钥发放

员工配置文件只保存：

```json
{
  "collector": {
    "authTokenEnv": "AIMETRIC_COLLECTOR_TOKEN"
  }
}
```

真实 token 由企业终端管理、CI/CD secret、shell profile 或插件安全存储注入。

## 9. 排障清单

- `401 Unauthorized ingestion request`：检查员工侧是否设置 `AIMETRIC_COLLECTOR_TOKEN`，以及 token 是否与网关一致。
- `401 Unauthorized admin request`：检查管理请求是否携带 `Authorization: Bearer <token>`。
- `forwarded: false`：检查 `collector-gateway` 的 `METRIC_PLATFORM_URL` 是否可达。
- Dashboard 无数据：先查 `GET /analysis/summary`，再查 `GET /metrics/snapshots`。
- Cursor 增强采集无新增：检查 transcript 目录、`.aimetric/cursor-sync-state.json` 和状态库发现路径。
