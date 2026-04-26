# Session Output Analysis Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a session analysis and output analysis section inside the existing AIMetric dashboard using already-collected `session.recorded`, `edit.span.recorded`, and `tab.accepted` events.

**Architecture:** Extend `metric-platform` with three read-only aggregation APIs backed by the existing `metric_events` table, then extend the dashboard client and single-page dashboard to render one analysis summary block plus two analysis tables that reuse the current filters and auto-refresh flow. Keep the implementation query-first and UI-lightweight so the feature stays aligned with the current enterprise product architecture.

**Tech Stack:** TypeScript, Vitest, existing Node HTTP server in `apps/metric-platform`, existing React dashboard, existing AIMetric event schema and PostgreSQL repository abstractions.

---

## File Structure

### New Files

- `apps/dashboard/src/pages/analysis-summary.tsx`
- `apps/dashboard/src/pages/session-analysis-table.tsx`
- `apps/dashboard/src/pages/output-analysis-table.tsx`

### Modified Files

- `apps/metric-platform/src/database/postgres-event.repository.ts`
- `apps/metric-platform/src/database/postgres-event.repository.spec.ts`
- `apps/metric-platform/src/app.module.ts`
- `apps/metric-platform/src/app.module.spec.ts`
- `apps/metric-platform/src/main.ts`
- `apps/metric-platform/src/main.spec.ts`
- `apps/dashboard/src/api/client.ts`
- `apps/dashboard/src/api/client.spec.ts`
- `apps/dashboard/src/App.tsx`
- `apps/dashboard/src/App.test.tsx`
- `README.md`
- `docs/superpowers/plans/2026-04-23-aimetric-中文执行计划.md`

### Responsibility Map

- `apps/metric-platform/src/database/postgres-event.repository.ts`: Define analysis record types and perform summary/session/output aggregation over `metric_events`.
- `apps/metric-platform/src/app.module.ts`: Expose repository-backed analysis methods.
- `apps/metric-platform/src/main.ts`: Add `GET /analysis/summary`, `GET /analysis/sessions`, `GET /analysis/output`.
- `apps/dashboard/src/api/client.ts`: Add typed dashboard client methods and fallbacks for analysis APIs.
- `apps/dashboard/src/pages/analysis-summary.tsx`: Render the four-card analysis summary.
- `apps/dashboard/src/pages/session-analysis-table.tsx`: Render the session analysis table.
- `apps/dashboard/src/pages/output-analysis-table.tsx`: Render the output analysis table.
- `apps/dashboard/src/App.tsx`: Load analysis data alongside existing dashboard data and render the new analysis section.

## Task 1: Add Platform Analysis Aggregations

**Files:**
- Modify: `apps/metric-platform/src/database/postgres-event.repository.ts`
- Modify: `apps/metric-platform/src/database/postgres-event.repository.spec.ts`
- Modify: `apps/metric-platform/src/app.module.ts`
- Modify: `apps/metric-platform/src/app.module.spec.ts`
- Modify: `apps/metric-platform/src/main.ts`
- Modify: `apps/metric-platform/src/main.spec.ts`

- [ ] **Step 1: Write the failing repository tests**

```ts
it('builds analysis summary aggregates from metric events', async () => {
  const summary = await repository.buildAnalysisSummary({
    projectKey: 'aimetric',
    from: '2026-04-24T00:00:00.000Z',
    to: '2026-04-25T00:00:00.000Z',
  });

  expect(summary).toEqual({
    sessionCount: 2,
    editSpanCount: 3,
    tabAcceptedCount: 4,
    tabAcceptedLines: 9,
  });
});

it('builds session analysis rows with edit and tab aggregates', async () => {
  const rows = await repository.listSessionAnalysisRows({
    projectKey: 'aimetric',
  });

  expect(rows).toEqual([
    expect.objectContaining({
      sessionId: 'sess_1',
      conversationTurns: 3,
      editSpanCount: 2,
      tabAcceptedCount: 2,
      tabAcceptedLines: 5,
    }),
  ]);
});

it('builds output analysis rows grouped by session and file path', async () => {
  const rows = await repository.listOutputAnalysisRows({
    projectKey: 'aimetric',
  });

  expect(rows).toEqual([
    expect.objectContaining({
      sessionId: 'sess_1',
      filePath: '/repo/src/demo.ts',
      editSpanCount: 2,
      tabAcceptedCount: 2,
      tabAcceptedLines: 5,
      latestDiffSummary: expect.any(String),
    }),
  ]);
});
```

- [ ] **Step 2: Run repository tests to verify they fail**

Run: `./node_modules/.bin/vitest run apps/metric-platform/src/database/postgres-event.repository.spec.ts`

Expected: FAIL because the new analysis methods do not exist.

- [ ] **Step 3: Add the minimal repository interfaces and queries**

```ts
export interface AnalysisSummaryRecord {
  sessionCount: number;
  editSpanCount: number;
  tabAcceptedCount: number;
  tabAcceptedLines: number;
}

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

```ts
async buildAnalysisSummary(filters: MetricSnapshotFilters = {}): Promise<AnalysisSummaryRecord> {
  // one query per event type or one CTE-backed query; keep the first implementation straightforward
}

async listSessionAnalysisRows(filters: MetricSnapshotFilters = {}): Promise<SessionAnalysisRow[]> {
  // session.recorded base rows + subqueries or left joins for edit/tab counts
}

async listOutputAnalysisRows(filters: MetricSnapshotFilters = {}): Promise<OutputAnalysisRow[]> {
  // edit.span.recorded grouped by session_id + payload->>'filePath'
}
```

- [ ] **Step 4: Add the minimal AppModule and HTTP surface**

```ts
buildAnalysisSummary(filters: MetricSnapshotFilters = {}) {
  return this.metricEventRepository.buildAnalysisSummary(filters);
}

listSessionAnalysisRows(filters: MetricSnapshotFilters = {}) {
  return this.metricEventRepository.listSessionAnalysisRows(filters);
}

listOutputAnalysisRows(filters: MetricSnapshotFilters = {}) {
  return this.metricEventRepository.listOutputAnalysisRows(filters);
}
```

```ts
if (method === 'GET' && url.pathname === '/analysis/summary') {
  writeJson(response, 200, await appModule.buildAnalysisSummary(getMetricSnapshotFilters(url)));
  return;
}

if (method === 'GET' && url.pathname === '/analysis/sessions') {
  writeJson(response, 200, await appModule.listSessionAnalysisRows(getMetricSnapshotFilters(url)));
  return;
}

if (method === 'GET' && url.pathname === '/analysis/output') {
  writeJson(response, 200, await appModule.listOutputAnalysisRows(getMetricSnapshotFilters(url)));
  return;
}
```

- [ ] **Step 5: Run focused platform tests to verify they pass**

Run: `./node_modules/.bin/vitest run apps/metric-platform/src/database/postgres-event.repository.spec.ts apps/metric-platform/src/app.module.spec.ts apps/metric-platform/src/main.spec.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/metric-platform/src/database/postgres-event.repository.ts \
  apps/metric-platform/src/database/postgres-event.repository.spec.ts \
  apps/metric-platform/src/app.module.ts \
  apps/metric-platform/src/app.module.spec.ts \
  apps/metric-platform/src/main.ts \
  apps/metric-platform/src/main.spec.ts
git commit -m "feat: add dashboard analysis APIs"
```

## Task 2: Extend Dashboard Client With Analysis APIs

**Files:**
- Modify: `apps/dashboard/src/api/client.ts`
- Modify: `apps/dashboard/src/api/client.spec.ts`

- [ ] **Step 1: Write the failing client tests**

```ts
it('fetches analysis summary through the dashboard client', async () => {
  const client = createDashboardClient('http://localhost:3001');
  await client.getAnalysisSummary({ projectKey: 'aimetric' });

  expect(fetch).toHaveBeenCalledWith(
    'http://localhost:3001/analysis/summary?projectKey=aimetric',
  );
});

it('passes filters to session and output analysis endpoints', async () => {
  const client = createDashboardClient('http://localhost:3001');
  await client.getSessionAnalysisRows({ projectKey: 'aimetric', memberId: 'alice' });
  await client.getOutputAnalysisRows({ projectKey: 'aimetric', memberId: 'alice' });

  expect(fetch).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Run the client test to verify it fails**

Run: `./node_modules/.bin/vitest run apps/dashboard/src/api/client.spec.ts`

Expected: FAIL because the analysis client methods do not exist.

- [ ] **Step 3: Add typed client interfaces, fallbacks, and methods**

```ts
export interface AnalysisSummary {
  sessionCount: number;
  editSpanCount: number;
  tabAcceptedCount: number;
  tabAcceptedLines: number;
}

export interface SessionAnalysisRow { /* same shape as platform response */ }
export interface OutputAnalysisRow { /* same shape as platform response */ }
```

```ts
getAnalysisSummary: (filters) =>
  fetchJson<AnalysisSummary>(
    buildMetricUrl(baseUrl, '/analysis/summary', filters),
    fallbackAnalysisSummary,
  ),
getSessionAnalysisRows: (filters) =>
  fetchJson<SessionAnalysisRow[]>(
    buildMetricUrl(baseUrl, '/analysis/sessions', filters),
    [],
  ),
getOutputAnalysisRows: (filters) =>
  fetchJson<OutputAnalysisRow[]>(
    buildMetricUrl(baseUrl, '/analysis/output', filters),
    [],
  ),
```

- [ ] **Step 4: Run the client test to verify it passes**

Run: `./node_modules/.bin/vitest run apps/dashboard/src/api/client.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/api/client.ts apps/dashboard/src/api/client.spec.ts
git commit -m "feat: add dashboard analysis client"
```

## Task 3: Render Analysis Summary and Tables In The Dashboard

**Files:**
- Create: `apps/dashboard/src/pages/analysis-summary.tsx`
- Create: `apps/dashboard/src/pages/session-analysis-table.tsx`
- Create: `apps/dashboard/src/pages/output-analysis-table.tsx`
- Modify: `apps/dashboard/src/App.tsx`
- Modify: `apps/dashboard/src/App.test.tsx`

- [ ] **Step 1: Write the failing dashboard test**

```tsx
it('renders the analysis summary and analysis tables', async () => {
  render(<App client={clientWithAnalysisData} />);

  expect(await screen.findByText('会话分析')).toBeInTheDocument();
  expect(screen.getByText('出码分析')).toBeInTheDocument();
  expect(screen.getByText('编辑证据数')).toBeInTheDocument();
  expect(screen.getByText('/repo/src/demo.ts')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the dashboard test to verify it fails**

Run: `./node_modules/.bin/vitest run apps/dashboard/src/App.test.tsx`

Expected: FAIL because the analysis section is not rendered.

- [ ] **Step 3: Add minimal read-only analysis components**

```tsx
export const AnalysisSummary = ({ summary }: { summary: AnalysisSummary }) => (
  <section aria-label="分析摘要">
    {/* render four compact cards */}
  </section>
);
```

```tsx
export const SessionAnalysisTable = ({ rows }: { rows: SessionAnalysisRow[] }) => (
  <section aria-label="会话分析">
    {/* render a lightweight table; empty state when rows.length === 0 */}
  </section>
);
```

```tsx
export const OutputAnalysisTable = ({ rows }: { rows: OutputAnalysisRow[] }) => (
  <section aria-label="出码分析">
    {/* render sessionId + filePath grouped results */}
  </section>
);
```

- [ ] **Step 4: Load and wire analysis data in `App.tsx`**

```tsx
const [analysisSummary, setAnalysisSummary] = useState<AnalysisSummary | null>(null);
const [sessionAnalysisRows, setSessionAnalysisRows] = useState<SessionAnalysisRow[]>([]);
const [outputAnalysisRows, setOutputAnalysisRows] = useState<OutputAnalysisRow[]>([]);
```

```tsx
const [
  personal,
  team,
  auditMetrics,
  versions,
  rollout,
  rolloutEvaluation,
  analysisSummary,
  sessionAnalysisRows,
  outputAnalysisRows,
] = await Promise.all([
  client.getPersonalSnapshot(nextFilters),
  client.getTeamSnapshot(nextFilters),
  client.getMcpAuditMetrics(nextFilters),
  client.getRuleVersions(projectKey),
  client.getRuleRollout(projectKey),
  client.getRuleRolloutEvaluation(projectKey, nextFilters.memberId),
  client.getAnalysisSummary(nextFilters),
  client.getSessionAnalysisRows(nextFilters),
  client.getOutputAnalysisRows(nextFilters),
]);
```

- [ ] **Step 5: Run dashboard tests to verify they pass**

Run: `./node_modules/.bin/vitest run apps/dashboard/src/App.test.tsx apps/dashboard/src/api/client.spec.ts`

Expected: PASS.

- [ ] **Step 6: Build the dashboard**

Run: `/bin/zsh -lc "COREPACK_HOME=/tmp/corepack NODE_TLS_REJECT_UNAUTHORIZED=0 corepack pnpm --filter @aimetric/dashboard build"`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/src/App.tsx \
  apps/dashboard/src/App.test.tsx \
  apps/dashboard/src/pages/analysis-summary.tsx \
  apps/dashboard/src/pages/session-analysis-table.tsx \
  apps/dashboard/src/pages/output-analysis-table.tsx
git commit -m "feat: add session and output analysis dashboard"
```

## Task 4: Update Docs And Run Full Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-04-23-aimetric-中文执行计划.md`

- [ ] **Step 1: Update README and progress notes**

```md
- `metric-platform` 已新增分析 API：`/analysis/summary`、`/analysis/sessions`、`/analysis/output`
- `dashboard` 已新增会话分析与出码分析展示区
- `企业试点版平台能力`：约 `91%` 完成
```

- [ ] **Step 2: Run full verification**

Run: `/bin/zsh -lc "COREPACK_HOME=/tmp/corepack NODE_TLS_REJECT_UNAUTHORIZED=0 corepack pnpm -r lint"`

Expected: PASS.

Run: `/bin/zsh -lc "COREPACK_HOME=/tmp/corepack NODE_TLS_REJECT_UNAUTHORIZED=0 corepack pnpm -r build"`

Expected: PASS.

Run: `/bin/zsh -lc "COREPACK_HOME=/tmp/corepack NODE_TLS_REJECT_UNAUTHORIZED=0 corepack pnpm -r test"`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add README.md docs/superpowers/plans/2026-04-23-aimetric-中文执行计划.md
git commit -m "docs: update analysis dashboard progress"
```

## Self-Review

- Spec coverage: covered summary API, session analysis API, output analysis API, dashboard client, analysis summary, session table, output table, docs, and verification.
- Placeholder scan: no `TBD`, no “do the usual” placeholders, no undefined method names left unresolved.
- Type consistency: plan uses `AnalysisSummary`, `SessionAnalysisRow`, `OutputAnalysisRow` consistently across platform and dashboard tasks.
