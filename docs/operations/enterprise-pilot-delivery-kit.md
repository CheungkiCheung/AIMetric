# AIMetric 企业试点交付包

本文档是 AIMetric 给企业试点团队的总入口。它把平台部署、员工轻量接入、管理者看板使用、指标验收和试点复盘串成一条可执行交付链路，避免只看单个 README 或单个页面时丢失上下文。

适用对象：

- `提效管理者`：判断 AI-IDE、SDD、结对编程和内部 AI 工具是否真正铺开，是否形成有效产出和管理动作。
- `技术管理者`：判断 AI 是否进入真实需求、PR、CI、发布、缺陷链路，以及速度和质量是否平衡。
- `平台管理员`：负责部署、token、identity mapping、viewer scope、采集健康和排障。
- `员工 / 一线开发者`：只做轻量接入，正常使用现有 AI 工具，异常时用 `doctor / status / flush` 自助排障。

## 1. 交付目标

企业试点阶段先验证四件事：

1. `采得到`：员工侧 AI 工具、MCP、CLI、Cursor、Codex、Claude Code 等信号能进入 collector。
2. `不中断`：collector 不可用时员工端写入本地 outbox，不阻塞正常编码。
3. `看得清`：提效管理者能看到 AI-IDE / SDD 覆盖、代码产出、AI 采纳、批次推进和质量护栏。
4. `能行动`：看板结论能转成扩大推广、补充培训、修复采集、质量治理、暂停推广或深入分析。

试点阶段暂不把精准 ROI、个人绩效排名、全组织强制推广作为目标。

## 2. 交付件清单

### 2.1 平台侧交付件

- `collector-gateway`：统一采集入口，接收员工端和适配器事件。
- `metric-platform`：事件导入、指标快照、规则中心、分析 API 和管理审计。
- `dashboard`：面向提效管理者、技术管理者和平台管理员的多页面驾驶舱。
- `PostgreSQL`：事实表、快照表、需求 / PR / CI / 发布 / 事故 / 缺陷数据。
- `Redis`：预留队列、缓存和限流扩展位。
- `production-runbook.md`：准生产部署、鉴权、健康检查、队列、outbox 和审计说明。

### 2.2 员工侧交付件

- `employee-onboarding`：生成 `.aimetric/config.json`、`.aimetric/mcp.json` 和工具 profile 配置。
- `collector-sdk`：提供事件构建、发布、本地 outbox、flush 能力。
- `cli-adapter`：CLI 标准采集入口。
- `cursor-adapter`：Cursor 增强采集入口。
- `employee-onboarding-guide.md`：员工机器需要安装什么、生成什么、怎么自检。

### 2.3 管理侧交付件

- `AI 提效经营驾驶舱`：提效管理者第一入口。
- `治理与采集`：平台管理员看采集健康、viewer scope、identity mapping、规则中心。
- `交付质量`：技术管理者看需求、PR、CI、发布、事故、缺陷归因。
- `证据分析`：查看个人 / 团队出码、会话分析、出码分析。
- `指标语义层`：解释六类核心维度、指标口径、数据来源和计算结果。
- `dashboard-walkthrough.md`：固定演示路径。

## 3. 最小试点范围

建议第一批不要超过：

- `1-2` 个团队
- `10-30` 名研发
- `1-2` 个核心项目
- 至少两类 AI 工具

推荐组合：

- `Cursor + Codex`
- `Cursor + Claude Code`
- `CLI Agent + VS Code`
- `AI-IDE + SDD`

这样既能验证多工具采集，也能验证 AI-IDE 与 SDD 在需求侧的覆盖。

## 4. 上线前准备清单

### 4.1 平台管理员

- 已准备 PostgreSQL 和 Redis。
- 已配置 `DATABASE_URL`。
- 已配置 `AIMETRIC_COLLECTOR_TOKEN`。
- 已配置 `METRIC_PLATFORM_COLLECTOR_TOKEN`。
- 已配置 `METRIC_PLATFORM_ADMIN_TOKEN`。
- 准生产 / 生产环境已设置 `AIMETRIC_REQUIRE_AUTH=true`。
- 已确认 Dashboard 不持有管理端 token，管理类接口通过后端网关 / BFF / SSO 登录态代理。
- 已确认 `/health`、`/ready`、`/metrics`、`/ingestion/health` 可访问。

### 4.2 提效管理者

- 已确认本轮试点工具清单。
- 已确认参与团队、项目和成员范围。
- 已确认首批重点指标。
- 已确认不把个人 AI 使用数据直接作为绩效评价。
- 已确认每周复盘节奏和管理动作责任人。

### 4.3 技术管理者

- 已确认需求系统、PR/MR、CI、发布、事故、缺陷系统的数据来源。
- 已确认团队 / 项目 / 成员映射。
- 已确认需求、PR、缺陷和发布失败的关联规则。
- 已确认指标解释人，避免看板数据和团队实际语义错位。

### 4.4 员工

- 已安装 `Node.js 20+`。
- 已拿到 collector endpoint。
- 已拿到 collector token 的环境变量配置方式。
- 已完成 onboarding。
- 已能运行 `doctor / status / flush`。

员工机器不需要安装 PostgreSQL、Redis、Dashboard 或 metric-platform。

## 5. 本地演示启动流程

```bash
corepack pnpm install
docker compose up -d
```

导出本地演示变量：

```bash
export DATABASE_URL='postgresql://aimetric:aimetric@127.0.0.1:5432/aimetric?sslmode=disable'
export AIMETRIC_COLLECTOR_TOKEN='local-collector-token'
export METRIC_PLATFORM_COLLECTOR_TOKEN='local-platform-collector-token'
export METRIC_PLATFORM_ADMIN_TOKEN='local-admin-token'
export METRIC_PLATFORM_URL='http://127.0.0.1:3001'
```

启动服务：

```bash
corepack pnpm start:metric-platform
corepack pnpm start:collector-gateway
corepack pnpm dev:dashboard
```

联调演示数据：

```bash
corepack pnpm demo:check
corepack pnpm demo:seed
```

打开 Dashboard 后，按 `dashboard-walkthrough.md` 的顺序演示。

## 6. 员工接入流程

员工侧目标是“一次接入，平时基本无感”。

```bash
node packages/employee-onboarding/dist/cli.js onboard \
  --workspaceDir=/path/to/repo \
  --profile=cursor \
  --projectKey=aimetric \
  --repoName=AIMetric \
  --memberId=alice
```

接入后自检：

```bash
node packages/employee-onboarding/dist/cli.js doctor --workspaceDir=/path/to/repo
node packages/employee-onboarding/dist/cli.js status --workspaceDir=/path/to/repo
```

collector 不可用时：

```bash
node packages/employee-onboarding/dist/cli.js flush --workspaceDir=/path/to/repo
```

员工端会生成：

```text
.aimetric/
  config.json
  mcp.json
  outbox/
```

原则：

- 配置里只保存 token 环境变量名，不保存真实 token。
- 网络失败时事件进入 `.aimetric/outbox`。
- outbox flush 按写入顺序恢复投递。
- 采集失败不阻断员工正常编码。

## 7. 管理者看板验收路径

第一轮验收建议按顺序看：

1. `AI 提效经营驾驶舱`
2. `工具资产与接入状态`
3. `终极目标`
4. `AI-IDE + SDD 使用`
5. `代码度量`
6. `团队覆盖矩阵`
7. `结对编程批次`
8. `质量护栏`
9. `管理动作板`
10. `治理与采集`
11. `交付质量`
12. `证据分析`
13. `指标语义层`

每个页面都要回答一个管理问题，而不是只确认页面能打开。

## 8. 首批指标验收清单

### 使用渗透

- AI-IDE 使用人数比例
- SDD 使用人数比例
- 各团队 AI-IDE 覆盖率
- 各团队 SDD 覆盖率
- AI-IDE + SDD 需求覆盖率
- 活跃人数、会话数、轮次、使用时长

### 有效产出

- 总代码变更行数
- AI 代码生成行数
- 人均代码产出
- AI 代码生成率
- 代码产出（行/人天）
- AI 生成代码采纳率
- AI 触达 PR 占比

### 团队推广运营

- 团队需求总数
- AI-IDE 开发需求数
- SDD 开发需求数
- 结对编程参与人数
- 批次推进目标
- 批次时间窗口
- 批次完成状态
- Co-Claw / OpenClaw 使用人数比例
- 不用 AI-IDE / SDD 的原因

### 交付与质量护栏

- 需求到 PR 时间
- PR 周转时间
- Lead Time
- CI 通过率
- Review 退回率
- 缺陷率
- 逃逸缺陷率
- 变更失败率
- 回滚率
- AI 参与需求缺陷率
- AI 触达 PR 逃逸缺陷率
- 发布失败关联缺陷数
- 事故关联缺陷数

### 终极目标

- 人力节省比例
- 人效提升比例
- SDD 需求交付占比

试点阶段可以展示终极目标趋势，但不建议过早承诺精确财务 ROI。

## 9. 每周复盘模板

建议每周用同一组问题复盘：

- 哪些工具已接入，哪些只是接入就绪。
- 哪些团队采集稳定，哪些存在 outbox 积压、token 失效或 identity mapping 缺失。
- AI-IDE 覆盖率、SDD 覆盖率、AI-IDE + SDD 需求覆盖率是否提升。
- AI 代码生成、采纳和人均产出是否形成有效产出。
- AI 是否进入真实需求和 PR，而不是停留在会话。
- 质量护栏是否出现 Review、CI、缺陷、发布失败或事故风险。
- 下周动作是扩大推广、补充培训、修复采集、质量治理、暂停推广还是深入分析。

## 10. 试点成功标准

建议用下面标准判断是否进入下一轮扩大：

- 员工侧：接入简单、体验无明显阻塞、能自助 doctor / status / flush。
- 平台侧：采集健康稳定、outbox 不长期积压、鉴权和审计可控。
- 管理侧：能看清团队差异、工具差异、需求覆盖、代码产出、采纳和质量护栏。
- 组织侧：每周能沉淀明确管理动作，而不是只停留在看板观察。

## 11. 相关文档

- 产品闭环：`docs/operations/product-loop-playbook.md`
- 员工接入：`docs/operations/employee-onboarding-guide.md`
- 平台部署：`docs/operations/production-runbook.md`
- 试点推进：`docs/operations/pilot-rollout-guide.md`
- 演示路径：`docs/operations/dashboard-walkthrough.md`
- 本地演示：`docs/operations/demo-runbook.md`
