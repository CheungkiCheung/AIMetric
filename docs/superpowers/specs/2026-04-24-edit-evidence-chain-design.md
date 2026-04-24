# 编辑证据链与 Cursor 会话关联设计

## 1. 目标

本设计用于在现有 AIMetric 主链路之上，补齐文章同构中的“编辑证据采集”能力。

本阶段的目标不是直接做强归因算法，而是先打通一条稳定、可查询、可关联、可回放的原始证据链：

```text
Cursor 增强会话主线
  -> MCP beforeEditFile / afterEditFile
  -> 文件级 edit span evidence
  -> metric-platform 原始证据查询
```

本阶段完成后，系统应具备：

- 以文件级为粒度的编辑证据 span
- 与 Cursor 增强会话通过 `sessionId` 的稳定关联
- 通过现有采集主链路上传 `edit.span.recorded`
- 在平台侧持久化并按条件查询编辑证据
- 为后续 Git 归因与会话分析预留扩展边界

本阶段明确不做：

- 片段级 edit chunk 切分
- Cursor 本地深层编辑记录逆向
- 新 Dashboard 页面
- 基于 edit span 的最终 AI 采纳归因计算

## 2. 方案比较

### 方案 A：工具各自上报编辑证据

做法：

- `afterEditFile` 自己读配置并直接发 HTTP
- `recordSession` 保持现状
- 新工具如果也要上报事件，再分别实现一次

优点：

- 实现最快

缺点：

- 上传逻辑分散在多个工具里
- 后续新增工具事件时容易重复造轮子
- 不利于统一失败处理与测试

### 方案 B：MCP Runtime 统一桥接工具结果事件（推荐）

做法：

- 工具只产出结构化结果和标准事件
- MCP runtime 统一识别 `event` / `events`
- runtime 负责把工具事件送入 collector-gateway

优点：

- 事件采集通道集中
- `recordSession` 和未来 `afterEditFile`、其他工具都能复用
- 更贴近文章中的“标准化采集主链路”

缺点：

- 需要对 runtime 增加一个小型事件桥

### 方案 C：直接写平台专用编辑证据 API

做法：

- `afterEditFile` 直接调用新的 `metric-platform` 编辑证据 API

优点：

- 看似简单直接

缺点：

- 绕开现有 collector-gateway 和事件主链路
- 不符合当前文章同构架构方向
- 后续会造成双采集通道

## 3. 推荐方案

采用 **方案 B：MCP Runtime 统一桥接工具结果事件**。

这样系统边界清晰：

- 工具负责产出证据
- runtime 负责桥接上传
- collector-gateway 负责统一入口
- metric-platform 负责持久化与查询

## 4. 架构与边界

### 4.1 `packages/edit-evidence`

新增 `packages/edit-evidence`

职责：

- 定义文件级 `EditSpanEvidence`
- 生成稳定 `editSpanId`
- 生成 `beforeSnapshotHash` / `afterSnapshotHash`
- 标准化 diff
- 构建标准 `edit.span.recorded` 事件 payload

该包不负责：

- 读取配置
- 发 HTTP
- 写数据库

### 4.2 `apps/mcp-server`

增强：

- `beforeEditFile`
- `afterEditFile`
- `runtime`

职责：

- `beforeEditFile` 产出稳定 pre-edit 快照信息
- `afterEditFile` 基于 before/after 内容生成完整 `EditSpanEvidence`
- runtime 识别工具结果中的 `event` / `events` 并桥接上传

### 4.3 `metric-platform`

增强：

- 编辑证据持久化
- 编辑证据查询 API

职责：

- 继续通过统一事件导入入口接收数据
- 将 `edit.span.recorded` 与现有 `session.recorded` 一起持久化
- 提供按 `sessionId / filePath / 时间范围` 查询 edit span 证据

### 4.4 `cursor-adapter / cursor-db-adapter`

保持当前职责：

- 会话主线采集
- transcript 解析
- 增量扫描

新增关系：

- 编辑证据通过 `sessionId` 关联到 Cursor 会话
- 不要求本阶段反向从 Cursor 本地数据恢复编辑记录

## 5. 数据模型

### 5.1 文件级编辑证据模型

新增统一模型：

```ts
export interface EditSpanEvidence {
  editSpanId: string;
  sessionId: string;
  filePath: string;
  occurredAt: string;
  toolName: 'beforeEditFile/afterEditFile';
  toolProfile?: string;
  beforeSnapshotHash: string;
  afterSnapshotHash: string;
  diff: string;
  projectFingerprint?: string;
  workspacePath?: string;
}
```

说明：

- `editSpanId` 用于稳定标识一条文件级编辑证据
- `sessionId` 是和 Cursor 会话主线关联的主键
- `diff` 保留原始文件级差异
- `projectFingerprint / workspacePath` 仅作为辅助诊断信息

### 5.2 `editSpanId` 规则

使用稳定哈希：

```text
sha256(sessionId:filePath:beforeSnapshotHash:afterSnapshotHash)
```

这样能够：

- 避免重复采集
- 保证同样的 before/after 编辑对生成同一个 span id

### 5.3 平台事件类型

新增标准事件：

```text
eventType = "edit.span.recorded"
```

说明：

- 不复用 `session.recorded`
- 不混入 `mcp.tool.called`
- 单独作为“原始编辑证据事件”

## 6. 关联键设计

### 6.1 主关联键

主关联键采用：

- `sessionId`

理由：

- 现有 `recordSession`
- 现有 `beforeEditFile / afterEditFile`
- 新增 Cursor 增强会话采集

都已经共享这个上下文键或可以稳定补齐这个键。

### 6.2 辅助关联字段

为后续诊断保留：

- `workspacePath`
- `projectFingerprint`
- `filePath`
- `occurredAt`

这些字段不作为第一主键，只用于：

- sessionId 丢失时排查
- 后续会话分析页
- 后续 Git 归因辅助

## 7. 采集与上传数据流

### 7.1 Before 阶段

`beforeEditFile` 返回：

```json
{
  "sessionId": "sess_1",
  "filePath": "/repo/src/a.ts",
  "beforeSnapshotHash": "sha256:...",
  "capturedAt": "2026-04-24T00:00:00.000Z"
}
```

本阶段不要求 before 工具单独上传事件。

### 7.2 After 阶段

`afterEditFile` 输入：

- `sessionId`
- `filePath`
- `beforeContent`
- `afterContent`

`afterEditFile` 输出：

- `EditSpanEvidence`
- 对应的标准事件 `edit.span.recorded`

示例：

```json
{
  "editSpanId": "sha256:...",
  "sessionId": "sess_1",
  "filePath": "/repo/src/a.ts",
  "beforeSnapshotHash": "sha256:...",
  "afterSnapshotHash": "sha256:...",
  "diff": "--- /repo/src/a.ts\n+++ /repo/src/a.ts\n-const a = 1;\n+const a = 2;",
  "event": {
    "eventType": "edit.span.recorded",
    "payload": {
      "sessionId": "sess_1",
      "projectKey": "aimetric",
      "repoName": "AIMetric",
      "memberId": "alice",
      "editSpanId": "sha256:...",
      "filePath": "/repo/src/a.ts",
      "beforeSnapshotHash": "sha256:...",
      "afterSnapshotHash": "sha256:...",
      "diff": "--- ...",
      "toolProfile": "cursor"
    }
  }
}
```

### 7.3 Runtime 桥接

新增 runtime 规则：

- 如果工具结果包含 `event`
- 或工具结果包含 `events`

则 runtime 在工具调用成功后统一桥接上传。

这条桥接逻辑应复用现有：

- `.aimetric/config.json`
- collector endpoint
- 通用批次结构

这样 `recordSession` 和 `afterEditFile` 都能走同一条工具事件上报路径。

## 8. 平台持久化设计

### 8.1 第一版存储策略

第一版不新增独立物理表，先复用现有 `metric_events` 事实表。

原因：

- 当前平台已经对任意事件类型做统一持久化
- `payload JSONB` 足以承接 edit span 证据字段
- 本阶段重点是打通证据链，不是做最终分表优化

### 8.2 查询接口

新增：

```text
GET /evidence/edits
```

支持参数：

- `projectKey`
- `memberId`
- `sessionId`
- `filePath`
- `from`
- `to`

返回：

- `editSpanId`
- `sessionId`
- `filePath`
- `occurredAt`
- `diff`
- `beforeSnapshotHash`
- `afterSnapshotHash`
- `toolProfile`

### 8.3 与会话主线的关系

平台不在这一阶段做新的聚合表。

采用查询期关联：

- `session.recorded`
- `edit.span.recorded`

都通过 `sessionId` 在查询层拼装。

## 9. 错误处理

必须处理：

- `afterEditFile` 输入缺字段
- `beforeContent` 与 `afterContent` 相同
- 工具结果有事件但 runtime 上传失败
- 编辑证据写入成功但会话主线尚未到达

处理原则：

- 工具本身返回证据结果，不因为平台不可达而丢失本地结构化结果
- runtime 上传失败仍保留 `mcp.tool.called` 失败审计
- 平台允许“先有 edit span，后有 session 主线”
- 对相同 `editSpanId` 的重复上报应具备幂等能力

## 10. 测试策略

### 10.1 `packages/edit-evidence`

- 生成稳定 `editSpanId`
- 根据 before/after 生成标准 diff
- 同样输入生成同样 evidence

### 10.2 `apps/mcp-server`

- `beforeEditFile` 返回 pre-edit 快照
- `afterEditFile` 返回完整 `EditSpanEvidence`
- runtime 自动桥接 `event` / `events`
- 没有配置时不上传，但工具结果仍正常返回

### 10.3 `metric-platform`

- `edit.span.recorded` 可导入
- `GET /evidence/edits` 可查询
- 同一 `editSpanId` 重复导入不重复记数

## 11. 迭代顺序

推荐按以下顺序执行：

1. 新增 `packages/edit-evidence`
2. 强化 `beforeEditFile / afterEditFile`
3. 在 MCP runtime 新增工具结果事件桥
4. 在 `metric-platform` 新增编辑证据查询能力
5. 更新 README 与中文计划

## 12. 后续扩展

本设计完成后，可以顺延扩展：

1. 基于 edit span 的 Git 归因预处理
2. Cursor 更深层编辑记录逆向
3. Tab accept 事件
4. 会话分析 dashboard
5. 编辑证据质量与缺失率监控

本阶段不提前实现这些能力，只保证证据链边界稳定。
