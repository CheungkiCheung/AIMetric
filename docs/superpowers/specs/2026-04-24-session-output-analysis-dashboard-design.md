# 会话分析与出码分析展示面设计

## 1. 目标

本设计用于在现有 AIMetric dashboard 基础上，补齐文章同构中的“会话分析 / 出码分析”展示面。

本阶段的目标不是新增一套独立前端系统，而是在现有单页 dashboard 中扩出一个稳定、可筛选、可联动刷新的分析区，把当前已经落地的真实数据真正展示出来：

```text
session.recorded
  + edit.span.recorded
  + tab.accepted
  -> metric-platform 聚合分析 API
  -> dashboard 分析摘要 + 会话分析表 + 出码分析表
```

本阶段完成后，系统应具备：

- 团队管理视角优先的分析区
- 基于真实采集数据的分析摘要卡
- 基于 `session.recorded` 的会话分析表
- 基于 `edit.span.recorded + tab.accepted` 的出码分析表
- 与现有项目、成员、时间范围筛选器联动
- 与现有 dashboard 自动刷新机制保持一致

本阶段明确不做：

- 新增独立路由或多页面结构
- 基于推断口径的“会话完成度”“采纳强度”等解释性指标
- 趋势图、分布图和复杂图表
- Git commit 归因联动
- 完整消息回放、片段级 diff 展开、事件时间线

## 2. 方案比较

### 方案 A：在现有 dashboard 内新增分析区（推荐）

做法：

- 保留现有个人、团队、MCP、规则中心区块
- 在筛选区之后新增分析摘要、会话分析表、出码分析表
- 复用现有 filters、API client 和自动刷新

优点：

- 改动最连续
- 用户立即可见
- 最符合当前“先把文章展示面补齐”的节奏

缺点：

- `App.tsx` 需要继续承担部分编排职责

### 方案 B：新增 dashboard 二级路由

做法：

- 首页保留总览
- 会话分析和出码分析迁移为独立页面

优点：

- 页面职责清晰

缺点：

- 当前仓库没有路由壳子
- 第一版范围会明显扩大

### 方案 C：只补后端分析 API，不做完整展示

做法：

- 先在平台侧实现聚合 API
- 前端只做轻量占位

优点：

- 后端基础更厚

缺点：

- 用户可见价值延后
- 不符合当前“继续复现文章展示面”的优先级

## 3. 推荐方案

采用 **方案 A：在现有 dashboard 内新增分析区**。

这样系统边界清晰：

- `metric-platform` 负责基于原始事件做分析聚合
- `dashboard client` 负责分析接口访问
- `dashboard` 负责展示和筛选联动

## 4. 架构与边界

### 4.1 `metric-platform`

新增三类只读聚合能力：

- `analysis summary`
- `session analysis`
- `output analysis`

职责：

- 从现有 `metric_events` 中读取 `session.recorded`、`edit.span.recorded`、`tab.accepted`
- 以稳定的真实字段聚合结果
- 提供 dashboard 可直接消费的只读 API

本阶段不新增新事实表，不改动现有快照表。

### 4.2 `apps/dashboard`

新增分析区块，但不改变当前单页结构。

职责：

- 复用现有筛选器和自动刷新机制
- 展示分析摘要卡
- 展示会话分析表
- 展示出码分析表

### 4.3 `apps/dashboard/src/api/client.ts`

新增分析接口调用能力：

- `getAnalysisSummary`
- `getSessionAnalysisRows`
- `getOutputAnalysisRows`

要求：

- 继续复用现有 `DashboardFilters`
- 保持 fallback 能力，避免本地后端不可用时页面直接报错

## 5. 后端 API 设计

### 5.1 `GET /analysis/summary`

用途：

- 支撑分析区顶部摘要卡

请求参数：

- `projectKey`
- `memberId`
- `from`
- `to`

返回：

```ts
export interface AnalysisSummary {
  sessionCount: number;
  editSpanCount: number;
  tabAcceptedCount: number;
  tabAcceptedLines: number;
}
```

聚合来源：

- `sessionCount`：`session.recorded` 数量
- `editSpanCount`：`edit.span.recorded` 数量
- `tabAcceptedCount`：`tab.accepted` 数量
- `tabAcceptedLines`：`tab.accepted.acceptedLines` 求和

### 5.2 `GET /analysis/sessions`

用途：

- 支撑会话分析表

请求参数：

- `projectKey`
- `memberId`
- `from`
- `to`

返回：

```ts
export interface SessionAnalysisRow {
  sessionId: string;
  memberId?: string;
  projectKey: string;
  occurredAt: string;
  conversationTurns?: number;
  userMessageCount?: number;
  assistantMessageCount?: number;
  firstMessageAt?: string;
  lastMessageAt?: string;
  workspaceId?: string;
  workspacePath?: string;
  projectFingerprint?: string;
  editSpanCount: number;
  tabAcceptedCount: number;
  tabAcceptedLines: number;
}
```

聚合口径：

- 主体基于 `session.recorded`
- `occurredAt` 取会话事件时间
- `conversationTurns / userMessageCount / assistantMessageCount / firstMessageAt / lastMessageAt / workspaceId / workspacePath / projectFingerprint`
  直接从 `session.recorded.payload` 读取，不做推断
- `editSpanCount` 按 `sessionId` 关联 `edit.span.recorded`
- `tabAcceptedCount / tabAcceptedLines` 按 `sessionId` 关联 `tab.accepted`

排序：

- 默认按 `lastMessageAt` 倒序
- 若 `lastMessageAt` 缺失，则回退 `occurredAt` 倒序

### 5.3 `GET /analysis/output`

用途：

- 支撑出码分析表

请求参数：

- `projectKey`
- `memberId`
- `from`
- `to`

返回：

```ts
export interface OutputAnalysisRow {
  sessionId: string;
  memberId?: string;
  projectKey: string;
  filePath: string;
  editSpanCount: number;
  latestEditAt: string;
  tabAcceptedCount: number;
  tabAcceptedLines: number;
  latestDiffSummary: string;
}
```

聚合口径：

- 主体基于 `edit.span.recorded`
- 聚合键为 `sessionId + filePath`
- `editSpanCount` 为同键编辑证据条数
- `latestEditAt` 取最新 `edit.span.recorded.occurredAt`
- `tabAcceptedCount / tabAcceptedLines` 关联同 `sessionId + filePath` 的 `tab.accepted`
- `latestDiffSummary` 取最新 edit span 的 diff，并在后端裁剪为简短文本摘要

排序：

- 默认按 `latestEditAt` 倒序

## 6. 前端展示设计

### 6.1 分析摘要卡

位置：

- 指标筛选区下方
- 个人/团队/MCP/规则中心区块之前

展示字段：

- 会话数
- 编辑证据数
- Tab 接受次数
- Tab 接受行数

目的：

- 明确当前分析区正在观察的真实数据范围

### 6.2 会话分析表

每行展示：

- `sessionId` 短值
- 首末消息时间
- 会话轮次
- 用户消息数
- 助手消息数
- 编辑证据数
- Tab 接受次数
- Tab 接受行数
- 工作区路径或项目指纹摘要

交互约束：

- 只读
- 无分页复杂交互
- 跟随筛选器联动刷新
- 结果为空时展示空态提示

### 6.3 出码分析表

每行展示：

- `sessionId`
- `filePath`
- 编辑次数
- 最近编辑时间
- Tab 接受次数
- Tab 接受行数
- 最近 diff 摘要

交互约束：

- 只读
- 跟随筛选器联动刷新
- 路径过长做截断
- diff 只显示摘要，不展开原文

## 7. 前端组件边界

建议新增三个页面组件：

- `apps/dashboard/src/pages/analysis-summary.tsx`
- `apps/dashboard/src/pages/session-analysis-table.tsx`
- `apps/dashboard/src/pages/output-analysis-table.tsx`

`App.tsx` 只负责：

- 维护 filters
- 维护自动刷新
- 并行拉取 dashboard 与 analysis 数据
- 把结果分发到各区块组件

这样后续若拆成独立分析页，可以直接复用现有组件。

## 8. 数据契约与容错

### 8.1 只使用真实数据

第一版只展示已经采到的真实字段：

- `session.recorded`
- `edit.span.recorded`
- `tab.accepted`

不做：

- 推断完成度
- 推断 AI 采纳强度
- 推断时长

### 8.2 空字段处理

要求：

- `session.recorded` 缺少扩展字段时，相关列显示 `-`
- 没有关联编辑证据时，`editSpanCount = 0`
- 没有关联 Tab 事件时，`tabAcceptedCount = 0`、`tabAcceptedLines = 0`
- 没有任何分析结果时，摘要卡显示 0，表格显示空态

### 8.3 diff 摘要裁剪

后端负责把 `latestDiffSummary` 控制在适合表格展示的长度，避免前端直接处理长 diff。

建议：

- 截到固定字符数
- 保留开头上下文
- 移除过长空白

## 9. 测试策略

### 9.1 `metric-platform`

至少补充：

- analysis summary 聚合测试
- session analysis 聚合测试
- output analysis 聚合测试
- HTTP 分析接口测试

### 9.2 `dashboard client`

至少补充：

- 三个分析接口的 URL 构造与返回解析测试
- fallback 行为测试

### 9.3 `dashboard`

至少补充：

- 分析区标题与摘要卡渲染测试
- 会话分析表渲染测试
- 出码分析表渲染测试
- 筛选变化触发分析区重新拉取测试

## 10. 迭代边界

本设计完成后，可以顺延扩展：

1. 会话分析独立页面
2. 出码分析独立页面
3. 趋势图与分布图
4. Git commit 归因联动
5. 事件时间线与完整 diff 回放

本阶段不提前实现这些能力，只保证：

- 真实数据可查询
- 团队管理视角可见
- 分析展示面与现有 dashboard 风格一致

## 11. 设计自检结论

本 spec 已做快速自检：

- 无 `TBD / TODO / placeholder`
- 页面结构、API 口径、组件边界一致
- 范围控制在单次实现计划可落地的程度
- 对“真实数据优先、团队管理视角优先、单页扩展”的约束已明确固定
