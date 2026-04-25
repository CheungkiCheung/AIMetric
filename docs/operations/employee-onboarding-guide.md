# AIMetric 员工接入手册

本文档面向员工 / 一线开发者，目标是用尽量轻量的方式完成接入，并且不影响日常使用体验。

## 1. 员工机器需要安装什么

最小要求：

- `Node.js 20+`
- 一个可运行 `aimetric` onboarding 的本地环境
- 你日常使用的 AI 工具：
  - `Cursor`
  - `CLI`
  - `Codex`
  - `Claude Code`
  - `VS Code`
  - `JetBrains`

员工机器不需要安装：

- PostgreSQL
- Redis
- Dashboard
- metric-platform

这些都属于平台侧。

## 2. 员工实际会生成什么

接入后，工作区里会生成：

```text
.aimetric/
  config.json
  mcp.json
  outbox/
```

按不同 profile，可能还会生成：

- `.aimetric/cursor-collector.json`
- `.aimetric/codex.env`
- `.aimetric/claude-code.env`

原则：

- 默认只保存配置和环境变量名
- 不在仓库里保存真实 token
- collector 不可用时只落本地 outbox，不阻塞编码

## 3. 标准接入流程

以 `cursor` 为例：

```bash
node packages/employee-onboarding/dist/cli.js onboard \
  --workspaceDir=/path/to/repo \
  --profile=cursor \
  --projectKey=aimetric \
  --repoName=AIMetric \
  --memberId=alice
```

接入后执行：

```bash
node packages/employee-onboarding/dist/cli.js doctor --workspaceDir=/path/to/repo
node packages/employee-onboarding/dist/cli.js status --workspaceDir=/path/to/repo
```

常用 profile：

- `cursor`
- `cli`
- `vscode`
- `codex`
- `claude-code`
- `jetbrains`

## 4. 失败时会发生什么

如果采集网关暂时不可用：

- 员工原来的 AI 工具照常使用
- 事件会写入 `.aimetric/outbox`
- 后续可以手动执行：

```bash
node packages/employee-onboarding/dist/cli.js flush --workspaceDir=/path/to/repo
```

## 5. 常用自检命令

```bash
node packages/employee-onboarding/dist/cli.js status --workspaceDir=/path/to/repo
node packages/employee-onboarding/dist/cli.js doctor --workspaceDir=/path/to/repo
node packages/employee-onboarding/dist/cli.js register --workspaceDir=/path/to/repo
node packages/employee-onboarding/dist/cli.js flush --workspaceDir=/path/to/repo
```

你重点关注：

- `collector` 是否可达
- `identityKey` 是否已注册
- `outboxDepth` 是否长期大于 `0`

## 6. 对员工体验的影响

当前设计目标：

- 热路径不阻塞编码
- collector 失败时本地缓冲
- 配置尽量一次生成
- 不要求员工理解平台侧架构

也就是说，员工最理想的体验应该是：

```text
接一次，平时基本无感，出问题时只跑 doctor / flush。
```
