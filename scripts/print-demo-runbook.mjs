const runbook = [
  '1. 安装依赖: corepack pnpm install',
  '2. 启动基础依赖: docker compose up -d',
  '3. 导出环境变量: DATABASE_URL / AIMETRIC_COLLECTOR_TOKEN / METRIC_PLATFORM_ADMIN_TOKEN / METRIC_PLATFORM_URL',
  '4. 启动指标平台: corepack pnpm start:metric-platform',
  '5. 启动采集网关: corepack pnpm start:collector-gateway',
  '6. 启动前端看板: corepack pnpm dev:dashboard',
  '7. 检查 demo 健康: corepack pnpm demo:check',
  '8. 导入演示数据: corepack pnpm demo:seed',
  '9. 打开 Dashboard，按 docs/operations/dashboard-walkthrough.md 的顺序演示',
];

console.log(runbook.join('\n'));
