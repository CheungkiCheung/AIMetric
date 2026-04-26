# Cursor Enhanced Collector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cross-platform Cursor enhanced collector that can discover local Cursor session data, incrementally export session mainline records as AIMetric `session.recorded` events, and avoid duplicate ingestion during scheduled scans.

**Architecture:** Add a focused `packages/cursor-db-adapter` package for path discovery, transcript parsing, and sync state; add an `apps/cursor-adapter` CLI to orchestrate dry-run and publish flows; extend `collector-sdk`, `metric-platform`, and `employee-onboarding` so the enhanced collector plugs into the existing enterprise product layers without changing the standard MCP-first rollout path.

**Tech Stack:** TypeScript, Vitest, Node.js fs/path APIs, existing AIMetric collector SDK, PostgreSQL repository, pnpm workspace.

---

## File Structure

### New Files

- `packages/cursor-db-adapter/package.json`
- `packages/cursor-db-adapter/tsconfig.json`
- `packages/cursor-db-adapter/src/index.ts`
- `packages/cursor-db-adapter/src/discovery.ts`
- `packages/cursor-db-adapter/src/discovery.spec.ts`
- `packages/cursor-db-adapter/src/transcript.ts`
- `packages/cursor-db-adapter/src/transcript.spec.ts`
- `packages/cursor-db-adapter/src/sync-state.ts`
- `packages/cursor-db-adapter/src/sync-state.spec.ts`
- `apps/cursor-adapter/package.json`
- `apps/cursor-adapter/tsconfig.json`
- `apps/cursor-adapter/src/index.ts`
- `apps/cursor-adapter/src/cursor-sync.ts`
- `apps/cursor-adapter/src/cursor-sync.spec.ts`
- `apps/cursor-adapter/src/cli.ts`

### Modified Files

- `packages/collector-sdk/src/client.ts`
- `packages/collector-sdk/src/client.spec.ts`
- `packages/employee-onboarding/src/onboarding.ts`
- `packages/employee-onboarding/src/onboarding.spec.ts`
- `packages/employee-onboarding/src/cli.ts`
- `apps/metric-platform/src/database/postgres-event.repository.ts`
- `apps/metric-platform/src/database/postgres-event.repository.spec.ts`
- `apps/metric-platform/src/main.spec.ts`
- `apps/metric-platform/sql/schema.sql`
- `README.md`
- `docs/superpowers/plans/2026-04-23-aimetric-中文执行计划.md`

### Responsibility Map

- `packages/cursor-db-adapter/src/discovery.ts`: Cross-platform default path candidates plus explicit override normalization.
- `packages/cursor-db-adapter/src/transcript.ts`: Parse transcript-like JSON/JSONL records into `CursorSessionRecord`.
- `packages/cursor-db-adapter/src/sync-state.ts`: Read, diff, and write `.aimetric/cursor-sync-state.json`.
- `apps/cursor-adapter/src/cursor-sync.ts`: Orchestrate discovery, parsing, incremental filtering, batch building, and optional publish.
- `apps/cursor-adapter/src/cli.ts`: Parse CLI flags and print deterministic JSON output.
- `packages/collector-sdk/src/client.ts`: Support `ingestionKey` and extra metadata in `session.recorded`.
- `apps/metric-platform/src/database/postgres-event.repository.ts`: Persist optional `ingestion_key` and dedupe on conflict.
- `packages/employee-onboarding/src/onboarding.ts`: Emit `.aimetric/cursor-collector.json` and enhanced next steps for Cursor profile.

### Task 1: Add Event Idempotency Support To Existing Ingestion Flow

**Files:**
- Modify: `packages/collector-sdk/src/client.ts`
- Modify: `packages/collector-sdk/src/client.spec.ts`
- Modify: `apps/metric-platform/src/database/postgres-event.repository.ts`
- Modify: `apps/metric-platform/src/database/postgres-event.repository.spec.ts`
- Modify: `apps/metric-platform/src/main.spec.ts`
- Modify: `apps/metric-platform/sql/schema.sql`

- [ ] **Step 1: Write the failing collector SDK test**

```ts
it('records ingestionKey and extra session metadata when provided', () => {
  const client = CollectorClient.fromConfig({
    projectKey: 'aimetric',
    memberId: 'alice',
    repoName: 'AIMetric',
    toolProfile: 'cursor',
    collector: { endpoint: 'http://127.0.0.1:3000/ingestion', source: 'cursor-db' },
    metricPlatform: { endpoint: 'http://127.0.0.1:3001' },
    rules: {
      version: 'v2',
      must: [],
      should: [],
      onDemand: [],
      knowledgeRefs: [],
    },
    mcp: { tools: [], environment: {} },
  }, {
    now: () => '2026-04-24T00:00:00.000Z',
  });

  client.recordSession({
    sessionId: 'cursor-session-1',
    ingestionKey: 'cursor-db:cursor-session-1:2026-04-24T00:00:00.000Z:abc',
    metadata: {
      collectorType: 'cursor-db',
      conversationTurns: 3,
    },
  });

  expect(client.flushBatch().events[0]?.payload).toMatchObject({
    sessionId: 'cursor-session-1',
    ingestionKey: 'cursor-db:cursor-session-1:2026-04-24T00:00:00.000Z:abc',
    collectorType: 'cursor-db',
    conversationTurns: 3,
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run packages/collector-sdk/src/client.spec.ts`

Expected: FAIL because `ingestionKey` and `metadata` are not supported in `SessionRecordedInput`.

- [ ] **Step 3: Write the minimal collector SDK implementation**

```ts
export interface SessionRecordedInput {
  sessionId: string;
  acceptedAiLines?: number;
  commitTotalLines?: number;
  userMessage?: string;
  assistantMessage?: string;
  ingestionKey?: string;
  metadata?: Record<string, unknown>;
}

client.recordSession({
  // existing fields...
  ...(input.ingestionKey !== undefined ? { ingestionKey: input.ingestionKey } : {}),
  ...(input.metadata ?? {}),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/vitest run packages/collector-sdk/src/client.spec.ts`

Expected: PASS.

- [ ] **Step 5: Write the failing repository dedupe test**

```ts
it('skips duplicate cursor-db events when source and ingestion_key match', async () => {
  const repository = new PostgresMetricEventRepository(poolLikeDatabase);

  const batch = {
    schemaVersion: 'v1' as const,
    source: 'cursor-db',
    events: [
      {
        eventType: 'session.recorded',
        occurredAt: '2026-04-24T00:00:00.000Z',
        payload: {
          sessionId: 'cursor-session-1',
          projectKey: 'aimetric',
          repoName: 'AIMetric',
          memberId: 'alice',
          ingestionKey: 'cursor-db:cursor-session-1:2026-04-24T00:00:00.000Z:abc',
        },
      },
    ],
  };

  await repository.saveIngestionBatch(batch);
  await repository.saveIngestionBatch(batch);

  await expect(repository.listRecordedMetricEvents({
    projectKey: 'aimetric',
  })).resolves.toEqual([
    expect.objectContaining({
      memberId: 'alice',
      sessionCount: 1,
    }),
  ]);
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run apps/metric-platform/src/database/postgres-event.repository.spec.ts`

Expected: FAIL because duplicate rows are still inserted.

- [ ] **Step 7: Write the minimal repository implementation**

```sql
ALTER TABLE metric_events
ADD COLUMN IF NOT EXISTS ingestion_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS metric_events_source_ingestion_key_unique
ON metric_events (source, ingestion_key)
WHERE ingestion_key IS NOT NULL;
```

```ts
INSERT INTO metric_events (
  schema_version,
  source,
  event_type,
  occurred_at,
  session_id,
  project_key,
  repo_name,
  member_id,
  accepted_ai_lines,
  commit_total_lines,
  ingestion_key,
  payload
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
ON CONFLICT (source, ingestion_key)
WHERE ingestion_key IS NOT NULL
DO NOTHING
```

- [ ] **Step 8: Run repository tests to verify they pass**

Run: `./node_modules/.bin/vitest run apps/metric-platform/src/database/postgres-event.repository.spec.ts`

Expected: PASS.

- [ ] **Step 9: Run HTTP integration regression tests**

Run: `./node_modules/.bin/vitest run apps/metric-platform/src/main.spec.ts`

Expected: PASS, including existing `/events/import` behavior.

- [ ] **Step 10: Commit**

```bash
git add packages/collector-sdk/src/client.ts packages/collector-sdk/src/client.spec.ts apps/metric-platform/src/database/postgres-event.repository.ts apps/metric-platform/src/database/postgres-event.repository.spec.ts apps/metric-platform/src/main.spec.ts apps/metric-platform/sql/schema.sql
git commit -m "feat: add ingestion idempotency for session events"
```

### Task 2: Build The Cursor Database Adapter Package

**Files:**
- Create: `packages/cursor-db-adapter/package.json`
- Create: `packages/cursor-db-adapter/tsconfig.json`
- Create: `packages/cursor-db-adapter/src/index.ts`
- Create: `packages/cursor-db-adapter/src/discovery.ts`
- Create: `packages/cursor-db-adapter/src/discovery.spec.ts`
- Create: `packages/cursor-db-adapter/src/transcript.ts`
- Create: `packages/cursor-db-adapter/src/transcript.spec.ts`
- Create: `packages/cursor-db-adapter/src/sync-state.ts`
- Create: `packages/cursor-db-adapter/src/sync-state.spec.ts`

- [ ] **Step 1: Write the failing discovery test**

```ts
it('returns explicit Cursor directories before platform defaults', () => {
  expect(resolveCursorDataRoots({
    platform: 'darwin',
    homeDir: '/Users/alice',
    overrides: {
      cursorProjectsDir: '/tmp/projects',
    },
  })).toEqual({
    cursorProjectsDir: '/tmp/projects',
    workspaceStorageDir: '/Users/alice/Library/Application Support/Cursor/User/workspaceStorage',
    globalStorageDir: '/Users/alice/Library/Application Support/Cursor/User/globalStorage',
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run packages/cursor-db-adapter/src/discovery.spec.ts`

Expected: FAIL because `resolveCursorDataRoots` does not exist.

- [ ] **Step 3: Write the minimal discovery implementation**

```ts
export function resolveCursorDataRoots(input: ResolveCursorDataRootsInput): CursorDataRoots {
  const base =
    input.platform === 'win32'
      ? join(input.appDataDir ?? join(input.homeDir, 'AppData', 'Roaming'), 'Cursor', 'User')
      : input.platform === 'darwin'
        ? join(input.homeDir, 'Library', 'Application Support', 'Cursor', 'User')
        : join(input.homeDir, '.config', 'Cursor', 'User');

  return {
    cursorProjectsDir: input.overrides.cursorProjectsDir ?? join(input.homeDir, '.cursor', 'projects'),
    workspaceStorageDir: input.overrides.cursorWorkspaceStorageDir ?? join(base, 'workspaceStorage'),
    globalStorageDir: input.overrides.cursorGlobalStorageDir ?? join(base, 'globalStorage'),
  };
}
```

- [ ] **Step 4: Run discovery tests to verify they pass**

Run: `./node_modules/.bin/vitest run packages/cursor-db-adapter/src/discovery.spec.ts`

Expected: PASS.

- [ ] **Step 5: Write the failing transcript parsing test**

```ts
it('builds a CursorSessionRecord from transcript jsonl lines', async () => {
  const session = await parseCursorTranscript([
    JSON.stringify({
      sessionId: 'cursor-session-1',
      timestamp: '2026-04-24T00:00:00.000Z',
      role: 'user',
      text: 'Implement the collector',
      workspaceId: 'workspace-1',
      workspacePath: '/repo',
    }),
    JSON.stringify({
      sessionId: 'cursor-session-1',
      timestamp: '2026-04-24T00:05:00.000Z',
      role: 'assistant',
      text: 'Collector implemented',
    }),
  ], '/tmp/transcript.jsonl');

  expect(session).toMatchObject({
    sessionId: 'cursor-session-1',
    workspaceId: 'workspace-1',
    workspacePath: '/repo',
    firstMessageAt: '2026-04-24T00:00:00.000Z',
    lastMessageAt: '2026-04-24T00:05:00.000Z',
    userMessageCount: 1,
    assistantMessageCount: 1,
    conversationTurns: 1,
    firstUserMessage: 'Implement the collector',
    lastAssistantMessage: 'Collector implemented',
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run packages/cursor-db-adapter/src/transcript.spec.ts`

Expected: FAIL because parser does not exist.

- [ ] **Step 7: Write the minimal transcript parser**

```ts
const messages = lines
  .map((line) => JSON.parse(line) as CursorTranscriptMessage)
  .filter((message) => typeof message.timestamp === 'string');

return {
  sessionId,
  workspaceId,
  workspacePath,
  projectFingerprint: createHash('sha256').update(workspacePath ?? transcriptPath).digest('hex'),
  transcriptPath,
  transcriptPathHash: createHash('sha256').update(transcriptPath).digest('hex'),
  firstMessageAt,
  lastMessageAt,
  userMessageCount,
  assistantMessageCount,
  conversationTurns: Math.min(userMessageCount, assistantMessageCount || userMessageCount),
  firstUserMessage,
  lastAssistantMessage,
};
```

- [ ] **Step 8: Run transcript tests to verify they pass**

Run: `./node_modules/.bin/vitest run packages/cursor-db-adapter/src/transcript.spec.ts`

Expected: PASS.

- [ ] **Step 9: Write the failing sync state test**

```ts
it('marks a session as exportable when lastMessageAt changed', () => {
  const state = {
    version: 1,
    lastScanCompletedAt: '2026-04-24T00:00:00.000Z',
    sessions: {
      'cursor-session-1': {
        lastMessageAt: '2026-04-24T00:05:00.000Z',
        transcriptPathHash: 'hash-a',
      },
    },
  };

  expect(filterExportableSessions(state, [
    {
      sessionId: 'cursor-session-1',
      lastMessageAt: '2026-04-24T00:06:00.000Z',
      transcriptPathHash: 'hash-a',
    } as CursorSessionRecord,
  ])).toHaveLength(1);
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run packages/cursor-db-adapter/src/sync-state.spec.ts`

Expected: FAIL because state helpers do not exist.

- [ ] **Step 11: Write the minimal sync state implementation**

```ts
export function filterExportableSessions(
  state: CursorSyncState,
  sessions: CursorSessionRecord[],
): CursorSessionRecord[] {
  return sessions.filter((session) => {
    const current = state.sessions[session.sessionId];
    return (
      !current ||
      current.lastMessageAt !== session.lastMessageAt ||
      current.transcriptPathHash !== session.transcriptPathHash
    );
  });
}
```

- [ ] **Step 12: Run all package tests**

Run: `./node_modules/.bin/vitest run packages/cursor-db-adapter/src/discovery.spec.ts packages/cursor-db-adapter/src/transcript.spec.ts packages/cursor-db-adapter/src/sync-state.spec.ts`

Expected: PASS.

- [ ] **Step 13: Commit**

```bash
git add packages/cursor-db-adapter
git commit -m "feat: add cursor transcript adapter package"
```

### Task 3: Add The Cursor Sync CLI Application

**Files:**
- Create: `apps/cursor-adapter/package.json`
- Create: `apps/cursor-adapter/tsconfig.json`
- Create: `apps/cursor-adapter/src/index.ts`
- Create: `apps/cursor-adapter/src/cursor-sync.ts`
- Create: `apps/cursor-adapter/src/cursor-sync.spec.ts`
- Create: `apps/cursor-adapter/src/cli.ts`

- [ ] **Step 1: Write the failing cursor sync test**

```ts
it('builds a publishable cursor-db batch from exportable sessions', async () => {
  const result = await syncCursorSessions({
    workspaceDir,
    dryRun: true,
    now: () => '2026-04-24T00:10:00.000Z',
    cursorProjectsDir,
  });

  expect(result).toMatchObject({
    published: false,
    discoveredSessions: 1,
    exportedSessions: 1,
    skippedSessions: 0,
    source: 'cursor-db',
  });
  expect(result.batch?.events[0]?.payload).toMatchObject({
    sessionId: 'cursor-session-1',
    collectorType: 'cursor-db',
    ingestionKey: expect.stringContaining('cursor-db:cursor-session-1'),
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run apps/cursor-adapter/src/cursor-sync.spec.ts`

Expected: FAIL because `syncCursorSessions` does not exist.

- [ ] **Step 3: Write the minimal sync implementation**

```ts
const config = await loadAimMetricConfig({
  workspaceDir: input.workspaceDir,
  configPath: input.configPath,
});
const roots = resolveCursorDataRoots({
  platform: input.platform ?? process.platform,
  homeDir: input.homeDir ?? homedir(),
  appDataDir: input.appDataDir,
  overrides: {
    cursorProjectsDir: input.cursorProjectsDir,
    cursorWorkspaceStorageDir: input.cursorWorkspaceStorageDir,
    cursorGlobalStorageDir: input.cursorGlobalStorageDir,
  },
});
const discoveredSessions = await collectCursorSessions(roots.cursorProjectsDir);
const exportableSessions = filterExportableSessions(state, discoveredSessions);
const client = CollectorClient.fromConfig({
  ...config,
  collector: { ...config.collector, source: 'cursor-db' },
}, { now: input.now });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/vitest run apps/cursor-adapter/src/cursor-sync.spec.ts`

Expected: PASS.

- [ ] **Step 5: Add the failing publish test**

```ts
it('posts the cursor-db batch and persists sync state when publish is enabled', async () => {
  const result = await syncCursorSessions({
    workspaceDir,
    dryRun: false,
    cursorProjectsDir,
    now: () => '2026-04-24T00:10:00.000Z',
  });

  expect(fetchCalls[0]?.url).toBe('http://127.0.0.1:3000/ingestion');
  expect(result.published).toBe(true);
  expect(readFileSync(join(workspaceDir, '.aimetric', 'cursor-sync-state.json'), 'utf8'))
    .toContain('cursor-session-1');
});
```

- [ ] **Step 6: Run publish test to verify it fails**

Run: `./node_modules/.bin/vitest run apps/cursor-adapter/src/cursor-sync.spec.ts`

Expected: FAIL because publish and state persistence are not implemented.

- [ ] **Step 7: Write the minimal publish and CLI implementation**

```ts
if (!(input.dryRun ?? true)) {
  await fetch(config.collector.endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(batch),
  });
  await writeCursorSyncState(statePath, buildNextCursorSyncState(previousState, exportableSessions, now()));
}
```

```ts
const parsed = parseCursorSyncArgs(process.argv.slice(2));
const result = await syncCursorSessions(parsed);
console.log(JSON.stringify(result, null, 2));
```

- [ ] **Step 8: Run app tests to verify they pass**

Run: `./node_modules/.bin/vitest run apps/cursor-adapter/src/cursor-sync.spec.ts`

Expected: PASS.

- [ ] **Step 9: Build the new app**

Run: `/bin/zsh -lc "COREPACK_HOME=/tmp/corepack NODE_TLS_REJECT_UNAUTHORIZED=0 corepack pnpm --filter @aimetric/cursor-adapter build"`

Expected: PASS and `apps/cursor-adapter/dist/cli.js` generated.

- [ ] **Step 10: Commit**

```bash
git add apps/cursor-adapter
git commit -m "feat: add cursor sync adapter"
```

### Task 4: Extend Employee Onboarding For Cursor Enhanced Collection

**Files:**
- Modify: `packages/employee-onboarding/src/onboarding.ts`
- Modify: `packages/employee-onboarding/src/onboarding.spec.ts`
- Modify: `packages/employee-onboarding/src/cli.ts`

- [ ] **Step 1: Write the failing onboarding test**

```ts
it('writes a cursor collector config for cursor onboarding', async () => {
  const result = await writeEmployeeOnboardingFiles({
    workspaceDir,
    projectKey: 'aimetric',
    memberId: 'alice',
    repoName: 'AIMetric',
    toolProfile: 'cursor',
  });

  const collectorConfigPath = join(workspaceDir, '.aimetric', 'cursor-collector.json');
  const collectorConfig = JSON.parse(readFileSync(collectorConfigPath, 'utf8'));

  expect(result.adapterPaths).toContain(join(workspaceDir, '.cursor', 'mcp.json'));
  expect(result.adapterPaths).toContain(collectorConfigPath);
  expect(collectorConfig.publish).toBe(false);
  expect(collectorConfig.discovery.cursorProjectsDir).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run packages/employee-onboarding/src/onboarding.spec.ts`

Expected: FAIL because `cursor-collector.json` is not written.

- [ ] **Step 3: Write the minimal onboarding implementation**

```ts
if (input.toolProfile === 'cursor') {
  const cursorCollectorConfigPath = join(input.workspaceDir, '.aimetric', 'cursor-collector.json');
  await writeFile(cursorCollectorConfigPath, `${JSON.stringify({
    enabled: true,
    publish: false,
    discovery: {
      cursorProjectsDir: null,
      cursorWorkspaceStorageDir: null,
      cursorGlobalStorageDir: null,
    },
    schedule: {
      suggestedCron: '*/15 * * * *',
    },
  }, null, 2)}\n`, 'utf8');

  return [cursorConfigPath, cursorCollectorConfigPath];
}
```

- [ ] **Step 4: Run onboarding tests to verify they pass**

Run: `./node_modules/.bin/vitest run packages/employee-onboarding/src/onboarding.spec.ts`

Expected: PASS.

- [ ] **Step 5: Add CLI surface verification**

```ts
expect(result.nextSteps).toContain('Optionally run aimetric-cursor-sync for enhanced Cursor session collection');
```

- [ ] **Step 6: Run onboarding tests again**

Run: `./node_modules/.bin/vitest run packages/employee-onboarding/src/onboarding.spec.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/employee-onboarding/src/onboarding.ts packages/employee-onboarding/src/onboarding.spec.ts packages/employee-onboarding/src/cli.ts
git commit -m "feat: add cursor enhanced onboarding artifacts"
```

### Task 5: Update Product Docs And Verify The Whole Workspace

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-04-23-aimetric-中文执行计划.md`

- [ ] **Step 1: Update README with the enhanced collector path**

```md
- `cursor-adapter`：Cursor 增强采集入口，支持 transcript 扫描、增量状态和 `cursor-db` 上报

```bash
corepack pnpm --filter @aimetric/cursor-adapter build
node apps/cursor-adapter/dist/cli.js --workspaceDir=/path/to/project --publish
```
```

- [ ] **Step 2: Update the Chinese execution plan progress**

```md
- `企业试点版平台能力`：约 `83%` 完成
- 已新增 `Cursor 增强采集模块`，支持跨平台路径发现、会话主线采集、定时扫描幂等和 onboarding 增强档
```

- [ ] **Step 3: Run focused test suites**

Run:

```bash
./node_modules/.bin/vitest run packages/collector-sdk/src/client.spec.ts
./node_modules/.bin/vitest run packages/cursor-db-adapter/src/discovery.spec.ts packages/cursor-db-adapter/src/transcript.spec.ts packages/cursor-db-adapter/src/sync-state.spec.ts
./node_modules/.bin/vitest run apps/cursor-adapter/src/cursor-sync.spec.ts
./node_modules/.bin/vitest run packages/employee-onboarding/src/onboarding.spec.ts
./node_modules/.bin/vitest run apps/metric-platform/src/database/postgres-event.repository.spec.ts
```

Expected: all PASS.

- [ ] **Step 4: Run workspace lint**

Run: `/bin/zsh -lc "COREPACK_HOME=/tmp/corepack NODE_TLS_REJECT_UNAUTHORIZED=0 corepack pnpm -r lint"`

Expected: PASS.

- [ ] **Step 5: Run workspace build**

Run: `/bin/zsh -lc "COREPACK_HOME=/tmp/corepack NODE_TLS_REJECT_UNAUTHORIZED=0 corepack pnpm -r build"`

Expected: PASS.

- [ ] **Step 6: Run workspace tests**

Run: `/bin/zsh -lc "COREPACK_HOME=/tmp/corepack NODE_TLS_REJECT_UNAUTHORIZED=0 corepack pnpm -r test"`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add README.md docs/superpowers/plans/2026-04-23-aimetric-中文执行计划.md
git commit -m "docs: add cursor enhanced collector usage"
```

## Self-Review

- Spec coverage: path discovery, transcript parsing, incremental sync state, CLI export, platform dedupe, onboarding enhancement, and docs rollout each map to a dedicated task.
- Placeholder scan: no `TODO`, `TBD`, or “similar to above” shortcuts remain; every task includes concrete files, code, and commands.
- Type consistency: `CursorSessionRecord`, `ingestionKey`, `metadata`, and `cursor-collector.json` names are consistent across all tasks.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-24-cursor-enhanced-collector-implementation.md`.

Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

The user has already asked for continuous execution in this session, so continue with **Inline Execution**.
