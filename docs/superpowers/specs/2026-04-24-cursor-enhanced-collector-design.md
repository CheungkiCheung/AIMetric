# Cursor 增强采集模块设计

## 1. 目标

本设计用于建设平台中的“增强采集档”能力：在标准 `MCP + SDK` 主链路之外，为重点团队提供一个可接入、可定时扫描、可跨平台运行的 Cursor 本地数据增强采集模块。

本阶段目标是实现：

- 支持 `macOS + Windows + Linux`
- 支持 `Cursor 本地数据路径发现`
- 支持 `会话主线数据` 采集
- 支持 `定时扫描` 所需的本地游标状态
- 支持转换为 AIMetric 标准 `session.recorded` 事件
- 支持直接上报到 `collector-gateway`
- 支持平台侧幂等去重，避免定时扫描重复计数

本阶段明确不做：

- Tab 补全采集
- 编辑级 diff / patch 归因
- 常驻后台守护进程
- 公司级强制依赖本地数据库采集

## 2. 设计原则

遵循平台分层要求，本模块只作为“增强采集档”，不替代当前标准接入档。

设计原则：

- 默认路径仍是 `employee-onboarding + MCP`
- Cursor 本地数据库 / transcript 采集是可选增强模块
- 所有增强采集数据最终归一化为现有事件协议
- 员工接入保持简单，不要求员工理解 Cursor 内部存储结构
- 平台必须具备幂等能力，允许定时扫描重复发现同一会话而不重复记数

## 3. 架构位置

按平台分层，本设计新增以下模块：

### 3.1 采集平台层

新增 `apps/cursor-adapter`

职责：

- 提供 `aimetric-cursor-sync` CLI 入口
- 适配 `dryRun` / `publish`
- 输出定时任务友好的执行结果
- 调用本地 Cursor 数据解析模块
- 将结果上报到采集网关

### 3.2 数据采集层

新增 `packages/cursor-db-adapter`

职责：

- 跨平台发现 Cursor 本地数据目录
- 定位 transcript / 本地状态文件
- 解析会话主线数据
- 构建增量扫描高水位
- 生成标准化 `CursorSessionRecord`

### 3.3 平台能力层

增强 `collector-sdk` 与 `metric-platform`

职责：

- 支持为 `session.recorded` 事件附加 `ingestionKey`
- 支持平台侧唯一键幂等导入
- 保留扩展字段供后续会话分析页使用

### 3.4 指标展示层

本阶段不新增页面，但为后续“会话分析 / 出码分析”提供可复用原始字段。

## 4. 兼容路径策略

### 4.1 发现策略

第一版采用“两级发现”：

1. 自动发现默认路径
2. 允许用户显式覆盖

理由：

- Cursor 本地目录在不同平台和版本之间存在漂移
- 社区信息显示 transcript 与状态文件并不总在同一目录
- 自动发现必须存在，但不能假设唯一固定路径

### 4.2 默认路径候选

第一版按以下候选顺序扫描：

#### Transcript 根目录候选

- macOS：`~/Library/Application Support/Cursor/User/workspaceStorage`
- Windows：`%APPDATA%/Cursor/User/workspaceStorage`
- Linux：`~/.config/Cursor/User/workspaceStorage`
- macOS / Windows / Linux 通用补充：`~/.cursor/projects`

#### 本地状态目录候选

- macOS：`~/Library/Application Support/Cursor/User/globalStorage`
- Windows：`%APPDATA%/Cursor/User/globalStorage`
- Linux：`~/.config/Cursor/User/globalStorage`

说明：

- `workspaceStorage` / `globalStorage` 用于辅助工作区关联与状态信息定位
- `.cursor/projects` 优先用于发现 transcript 型会话主线
- 真正执行时采用“找到即可用”的策略，而不是要求所有路径都存在

### 4.3 显式覆盖

`cursor-adapter` 支持以下参数：

- `--cursorProjectsDir`
- `--cursorWorkspaceStorageDir`
- `--cursorGlobalStorageDir`

当显式参数存在时，优先使用显式配置。

## 5. 数据来源与最小解析范围

### 5.1 第一版支持的数据来源

第一版只支持“会话主线”：

- 会话 id
- 工作区 / 项目上下文
- 用户消息
- AI 回复
- 首末消息时间
- 消息轮次统计

### 5.2 暂不纳入的数据

以下字段在第一版只保留扩展位，不作为强依赖：

- 编辑 patch
- tab accept
- inline edit accept
- commit 归因明细
- 会话时长精确推导

### 5.3 内部记录模型

`packages/cursor-db-adapter` 产出统一内部模型：

```ts
export interface CursorSessionRecord {
  sessionId: string;
  workspaceId?: string;
  workspacePath?: string;
  projectFingerprint: string;
  transcriptPath: string;
  transcriptPathHash: string;
  firstMessageAt: string;
  lastMessageAt: string;
  userMessageCount: number;
  assistantMessageCount: number;
  conversationTurns: number;
  firstUserMessage?: string;
  lastAssistantMessage?: string;
}
```

## 6. 事件映射策略

### 6.1 统一映射到现有事件协议

为避免破坏现有主链路，第一版仍映射到现有 `session.recorded`。

映射方式：

- `eventType`：`session.recorded`
- `occurredAt`：`lastMessageAt`
- `payload.sessionId`：`sessionId`
- `payload.projectKey`：来自 `.aimetric/config.json`
- `payload.repoName`：来自 `.aimetric/config.json`
- `payload.memberId`：来自 `.aimetric/config.json`
- `payload.userMessage`：`firstUserMessage`
- `payload.assistantMessage`：`lastAssistantMessage`
- `payload.ruleVersion`：来自 `.aimetric/config.json`

第一版默认不伪造：

- `acceptedAiLines`
- `commitTotalLines`

### 6.2 扩展字段

为后续会话分析保留：

- `payload.collectorType = "cursor-db"`
- `payload.sourceSessionKind = "cursor-transcript"`
- `payload.firstMessageAt`
- `payload.lastMessageAt`
- `payload.userMessageCount`
- `payload.assistantMessageCount`
- `payload.conversationTurns`
- `payload.workspaceId`
- `payload.workspacePath`
- `payload.projectFingerprint`
- `payload.transcriptPathHash`

## 7. 幂等与定时扫描

### 7.1 本地状态文件

新增 `.aimetric/cursor-sync-state.json`

用途：

- 记录上次扫描完成时间
- 记录已处理 transcript 指纹
- 记录每个 session 的最新 `lastMessageAt`

第一版结构：

```json
{
  "version": 1,
  "lastScanCompletedAt": "2026-04-24T00:00:00.000Z",
  "sessions": {
    "cursor-session-id": {
      "lastMessageAt": "2026-04-24T00:00:00.000Z",
      "transcriptPathHash": "sha256:..."
    }
  }
}
```

### 7.2 平台幂等键

仅依赖本地状态不够，平台必须同时支持幂等。

新增 `payload.ingestionKey`，构造规则：

```text
cursor-db:<sessionId>:<lastMessageAt>:<transcriptPathHash>
```

### 7.3 平台存储增强

`metric-platform` 的 `metric_events` 表新增：

- `ingestion_key TEXT`
- 唯一约束：`UNIQUE (source, ingestion_key)`，仅当 `ingestion_key IS NOT NULL` 生效

导入策略：

- 有 `ingestion_key` 时使用 `ON CONFLICT DO NOTHING`
- 无 `ingestion_key` 时维持现有行为

这样即使：

- 定时任务重复运行
- 本地状态丢失
- 同一批事件被重复重放

也不会重复写入同一条增强采集会话。

## 8. CLI 形态

新增命令：

```bash
aimetric-cursor-sync
```

支持参数：

- `--workspaceDir`
- `--configPath`
- `--cursorProjectsDir`
- `--cursorWorkspaceStorageDir`
- `--cursorGlobalStorageDir`
- `--since`
- `--limit`
- `--publish`

行为：

- 默认 `dryRun`
- `--publish` 时直接投递到 `collector-gateway`
- 输出 JSON 摘要，便于定时任务日志采集

输出示例：

```json
{
  "published": true,
  "discoveredSessions": 8,
  "exportedSessions": 3,
  "skippedSessions": 5,
  "source": "cursor-db"
}
```

## 9. 员工接入

### 9.1 标准接入档不变

默认员工仍只需要：

- `aimetric-onboard`
- `.aimetric/config.json`
- `.aimetric/mcp.json`

### 9.2 增强接入档

当 `toolProfile = cursor` 且启用增强采集时，补充生成：

- `.aimetric/cursor-collector.json`

内容包括：

- 自动发现开关
- 默认扫描频率建议
- 显式覆盖路径
- 是否启用 publish

同时在 README 与 onboarding next steps 中补充：

- 可手动执行一次 `aimetric-cursor-sync`
- 可由系统定时任务调用

第一版不自动替员工写入系统级 crontab / launchd / Task Scheduler，只提供模板命令。

## 10. 错误处理

必须处理：

- 默认路径不存在
- 某些 transcript 文件损坏
- 某些消息记录缺少字段
- `.aimetric/config.json` 不存在
- 上报端点不可用

处理原则：

- 单文件失败不影响整个批次
- 解析失败计入 `skippedSessions`
- publish 失败返回非零退出码
- dry-run 即使存在部分失败，也要输出可诊断摘要

## 11. 测试策略

采用 TDD，至少包含：

### 11.1 `packages/cursor-db-adapter`

- 路径发现测试
- transcript 解析测试
- 增量过滤测试
- 异常 transcript 容错测试

### 11.2 `apps/cursor-adapter`

- CLI 参数解析测试
- dry-run 批次输出测试
- publish 上报测试
- 本地状态更新测试

### 11.3 `metric-platform`

- 有 `ingestionKey` 的去重导入测试
- 无 `ingestionKey` 的兼容导入测试
- 幂等导入不重复累计 `sessionCount` 的回归测试

## 12. 迭代边界

本设计完成后，下一阶段可以顺延扩展：

1. Cursor 编辑证据采集
2. Tab accept 采集
3. 会话分析 dashboard
4. 增强采集质量监控
5. 定时任务模板自动生成

本阶段不提前实现这些能力，只为它们保留稳定边界。

## 13. 外部兼容依据

本设计参考了当前公开的 Cursor 社区线索，用于确定默认路径候选与 transcript / 状态目录并存的现实前提：

- [Where are Cursor chats stored?](https://forum.cursor.com/t/where-are-cursor-chats-stored/77295/5)
- [Windows transcript path example](https://forum.cursor.com/t/the-cursor-completely-formatted-my-c-drive-while-i-was-running-the-project/156170/20)
- [Sync Cursor chats across workspaces](https://forum.cursor.com/t/sync-cursor-chats-across-workspaces/152960)
- [globalStorage / state.vscdb discussion](https://forum.cursor.com/t/taking-longer-than-expected-on-cursor-version-3-0-13/157165/5)

这些外部线索用于辅助路径策略，并不作为唯一数据契约。因此实现中必须保留：

- 默认路径扫描
- 显式路径覆盖
- 容错解析
