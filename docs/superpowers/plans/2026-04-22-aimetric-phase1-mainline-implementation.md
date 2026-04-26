# AIMetric Phase 1 Mainline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working Phase 1 closed loop for AIMetric: MCP-based collection, raw event ingestion, Git-linked attribution, core metric computation, and a basic personal/team dashboard.

**Architecture:** Use a pnpm monorepo with four deployable apps (`collector-gateway`, `metric-platform`, `mcp-server`, `dashboard`) and shared packages for schemas, collector SDK, rule resolution, and metric computation. Phase 1 prioritizes the MCP-standardized mainline path and leaves local database reverse collection for later phases.

**Tech Stack:** TypeScript, pnpm workspaces, NestJS, React, PostgreSQL, Redis, BullMQ, Prisma, Jest, React Testing Library, Docker Compose

---

## Scope Split

The full enterprise platform spans multiple independent subsystems. To keep implementation testable and shippable, this plan covers the first executable sub-project:

- monorepo foundation
- shared domain packages
- MCP server mainline tools
- collector gateway ingestion
- metric platform with attribution and snapshots
- dashboard for personal/team metrics
- local development runtime and end-to-end verification

Follow-up plans should cover:

- Phase 2 rules and knowledge retrieval
- Phase 3 multi-entry expansion and enhanced collection
- Phase 4 hardening and operations

## Target File Structure

### Files to Create

- `package.json`
- `pnpm-workspace.yaml`
- `tsconfig.base.json`
- `.gitignore`
- `.editorconfig`
- `docker-compose.yml`
- `README.md`
- `apps/collector-gateway/package.json`
- `apps/collector-gateway/tsconfig.json`
- `apps/collector-gateway/src/main.ts`
- `apps/collector-gateway/src/app.module.ts`
- `apps/collector-gateway/src/ingestion/ingestion.controller.ts`
- `apps/collector-gateway/src/ingestion/ingestion.service.ts`
- `apps/collector-gateway/src/ingestion/ingestion.service.spec.ts`
- `apps/metric-platform/package.json`
- `apps/metric-platform/tsconfig.json`
- `apps/metric-platform/prisma/schema.prisma`
- `apps/metric-platform/src/main.ts`
- `apps/metric-platform/src/app.module.ts`
- `apps/metric-platform/src/database/prisma.service.ts`
- `apps/metric-platform/src/metrics/metrics.service.ts`
- `apps/metric-platform/src/metrics/metrics.service.spec.ts`
- `apps/metric-platform/src/metrics/metrics.controller.ts`
- `apps/metric-platform/src/attribution/attribution.service.ts`
- `apps/metric-platform/src/attribution/attribution.service.spec.ts`
- `apps/mcp-server/package.json`
- `apps/mcp-server/tsconfig.json`
- `apps/mcp-server/src/index.ts`
- `apps/mcp-server/src/tools/before-edit-file.tool.ts`
- `apps/mcp-server/src/tools/after-edit-file.tool.ts`
- `apps/mcp-server/src/tools/record-session.tool.ts`
- `apps/mcp-server/src/tools/tools.spec.ts`
- `apps/dashboard/package.json`
- `apps/dashboard/tsconfig.json`
- `apps/dashboard/vite.config.ts`
- `apps/dashboard/src/main.tsx`
- `apps/dashboard/src/App.tsx`
- `apps/dashboard/src/api/client.ts`
- `apps/dashboard/src/components/metric-card.tsx`
- `apps/dashboard/src/pages/personal-dashboard.tsx`
- `apps/dashboard/src/pages/team-dashboard.tsx`
- `apps/dashboard/src/App.test.tsx`
- `packages/event-schema/package.json`
- `packages/event-schema/tsconfig.json`
- `packages/event-schema/src/index.ts`
- `packages/event-schema/src/events.ts`
- `packages/event-schema/src/events.spec.ts`
- `packages/collector-sdk/package.json`
- `packages/collector-sdk/tsconfig.json`
- `packages/collector-sdk/src/index.ts`
- `packages/collector-sdk/src/buffer.ts`
- `packages/collector-sdk/src/client.ts`
- `packages/collector-sdk/src/client.spec.ts`
- `packages/metric-core/package.json`
- `packages/metric-core/tsconfig.json`
- `packages/metric-core/src/index.ts`
- `packages/metric-core/src/formulas.ts`
- `packages/metric-core/src/formulas.spec.ts`
- `packages/rule-engine/package.json`
- `packages/rule-engine/tsconfig.json`
- `packages/rule-engine/src/index.ts`
- `packages/rule-engine/src/rule-bundle.ts`
- `packages/rule-engine/src/rule-bundle.spec.ts`
- `packages/git-attribution/package.json`
- `packages/git-attribution/tsconfig.json`
- `packages/git-attribution/src/index.ts`
- `packages/git-attribution/src/line-attribution.ts`
- `packages/git-attribution/src/line-attribution.spec.ts`

### Files to Modify Later During Execution

- `README.md`
- `apps/metric-platform/prisma/schema.prisma`
- `docker-compose.yml`

## Task 1: Monorepo Foundation and Shared Contracts

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.editorconfig`
- Create: `packages/event-schema/src/events.spec.ts`
- Create: `packages/event-schema/src/events.ts`
- Create: `packages/event-schema/src/index.ts`
- Create: `packages/event-schema/package.json`
- Create: `packages/event-schema/tsconfig.json`
- Create: `packages/metric-core/src/formulas.spec.ts`
- Create: `packages/metric-core/src/formulas.ts`
- Create: `packages/rule-engine/src/rule-bundle.spec.ts`
- Create: `packages/rule-engine/src/rule-bundle.ts`

- [ ] **Step 1: Write the failing shared-domain tests**

```typescript
// packages/event-schema/src/events.spec.ts
import { describe, expect, it } from '@jest/globals';
import { IngestionBatchSchema } from './events';

describe('IngestionBatchSchema', () => {
  it('accepts a minimal valid ingestion batch', () => {
    const parsed = IngestionBatchSchema.parse({
      schemaVersion: 'v1',
      source: 'cursor',
      events: [
        {
          eventType: 'session.started',
          occurredAt: '2026-04-22T00:00:00.000Z',
          payload: {
            sessionId: 'sess_1',
            projectKey: 'proj',
            repoName: 'repo',
          },
        },
      ],
    });

    expect(parsed.events).toHaveLength(1);
  });
});
```

```typescript
// packages/metric-core/src/formulas.spec.ts
import { describe, expect, it } from '@jest/globals';
import { calculateAiOutputRate } from './formulas';

describe('calculateAiOutputRate', () => {
  it('returns accepted_ai_lines divided by commit_total_lines', () => {
    expect(calculateAiOutputRate(7, 10)).toBe(0.7);
  });

  it('returns 0 when commit_total_lines is 0', () => {
    expect(calculateAiOutputRate(7, 0)).toBe(0);
  });
});
```

```typescript
// packages/rule-engine/src/rule-bundle.spec.ts
import { describe, expect, it } from '@jest/globals';
import { resolveRuleBundle } from './rule-bundle';

describe('resolveRuleBundle', () => {
  it('returns mandatory rules for any scene and adds on-demand rules for matching scenes', () => {
    const bundle = resolveRuleBundle({
      projectType: 'web',
      toolType: 'cursor',
      sceneType: 'api-change',
    });

    expect(bundle.mandatoryRules).toContain('mcp.before-after-recording');
    expect(bundle.onDemandRules).toContain('knowledge.api-doc');
  });
});
```

- [ ] **Step 2: Run the tests to verify RED**

Run:

```bash
pnpm --filter @aimetric/event-schema test
pnpm --filter @aimetric/metric-core test
pnpm --filter @aimetric/rule-engine test
```

Expected:

- commands fail because the workspace and packages do not exist yet

- [ ] **Step 3: Write the minimal monorepo and shared package implementation**

```json
// package.json
{
  "name": "aimetric",
  "private": true,
  "packageManager": "pnpm@10.0.0",
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint"
  }
}
```

```yaml
# pnpm-workspace.yaml
packages:
  - apps/*
  - packages/*
```

```typescript
// packages/event-schema/src/events.ts
import { z } from 'zod';

export const IngestionEventSchema = z.object({
  eventType: z.string(),
  occurredAt: z.string().datetime(),
  payload: z.object({
    sessionId: z.string(),
    projectKey: z.string(),
    repoName: z.string(),
  }).passthrough(),
});

export const IngestionBatchSchema = z.object({
  schemaVersion: z.literal('v1'),
  source: z.string(),
  events: z.array(IngestionEventSchema).min(1),
});

export type IngestionBatch = z.infer<typeof IngestionBatchSchema>;
```

```typescript
// packages/metric-core/src/formulas.ts
export function calculateAiOutputRate(
  acceptedAiLines: number,
  commitTotalLines: number,
): number {
  if (commitTotalLines <= 0) {
    return 0;
  }

  return acceptedAiLines / commitTotalLines;
}
```

```typescript
// packages/rule-engine/src/rule-bundle.ts
type RuleContext = {
  projectType: string;
  toolType: string;
  sceneType: string;
};

export function resolveRuleBundle(context: RuleContext) {
  const mandatoryRules = [
    'core.style',
    'core.comments',
    'mcp.before-after-recording',
  ];

  const onDemandRules =
    context.sceneType === 'api-change' ? ['knowledge.api-doc'] : [];

  return {
    mandatoryRules,
    onDemandRules,
  };
}
```

- [ ] **Step 4: Run the tests to verify GREEN**

Run:

```bash
pnpm install
pnpm --filter @aimetric/event-schema test
pnpm --filter @aimetric/metric-core test
pnpm --filter @aimetric/rule-engine test
```

Expected:

- all three package tests pass

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore .editorconfig packages
git commit -m "feat: bootstrap workspace and shared contracts"
```

## Task 2: MCP Server Mainline Tools

**Files:**
- Create: `apps/mcp-server/package.json`
- Create: `apps/mcp-server/tsconfig.json`
- Create: `apps/mcp-server/src/index.ts`
- Create: `apps/mcp-server/src/tools/before-edit-file.tool.ts`
- Create: `apps/mcp-server/src/tools/after-edit-file.tool.ts`
- Create: `apps/mcp-server/src/tools/record-session.tool.ts`
- Create: `apps/mcp-server/src/tools/tools.spec.ts`

- [ ] **Step 1: Write the failing MCP tool tests**

```typescript
// apps/mcp-server/src/tools/tools.spec.ts
import { describe, expect, it } from '@jest/globals';
import { beforeEditFile } from './before-edit-file.tool';
import { afterEditFile } from './after-edit-file.tool';

describe('beforeEditFile', () => {
  it('captures a stable pre-edit snapshot', async () => {
    const result = await beforeEditFile({
      sessionId: 'sess_1',
      filePath: '/tmp/demo.ts',
      content: 'const a = 1;',
    });

    expect(result.filePath).toBe('/tmp/demo.ts');
    expect(result.snapshotHash).toBeDefined();
  });
});

describe('afterEditFile', () => {
  it('produces a normalized diff payload', async () => {
    const result = await afterEditFile({
      sessionId: 'sess_1',
      filePath: '/tmp/demo.ts',
      beforeContent: 'const a = 1;',
      afterContent: 'const a = 2;',
    });

    expect(result.diff).toContain('-const a = 1;');
    expect(result.diff).toContain('+const a = 2;');
  });
});
```

- [ ] **Step 2: Run the tests to verify RED**

Run:

```bash
pnpm --filter @aimetric/mcp-server test
```

Expected:

- test command fails because the app does not exist yet

- [ ] **Step 3: Write the minimal MCP server implementation**

```typescript
// apps/mcp-server/src/tools/before-edit-file.tool.ts
import { createHash } from 'node:crypto';

export async function beforeEditFile(input: {
  sessionId: string;
  filePath: string;
  content: string;
}) {
  return {
    sessionId: input.sessionId,
    filePath: input.filePath,
    snapshotHash: createHash('sha256').update(input.content).digest('hex'),
    content: input.content,
  };
}
```

```typescript
// apps/mcp-server/src/tools/after-edit-file.tool.ts
export async function afterEditFile(input: {
  sessionId: string;
  filePath: string;
  beforeContent: string;
  afterContent: string;
}) {
  const diff = [
    `--- ${input.filePath}`,
    `+++ ${input.filePath}`,
    `-${input.beforeContent}`,
    `+${input.afterContent}`,
  ].join('\n');

  return {
    sessionId: input.sessionId,
    filePath: input.filePath,
    diff,
  };
}
```

```typescript
// apps/mcp-server/src/tools/record-session.tool.ts
export async function recordSession(input: {
  sessionId: string;
  userMessage: string;
  assistantMessage: string;
}) {
  return {
    sessionId: input.sessionId,
    summary: `${input.userMessage}\n${input.assistantMessage}`,
  };
}
```

- [ ] **Step 4: Run the tests to verify GREEN**

Run:

```bash
pnpm --filter @aimetric/mcp-server test
```

Expected:

- MCP tool tests pass

- [ ] **Step 5: Commit**

```bash
git add apps/mcp-server
git commit -m "feat: add MCP server mainline tools"
```

## Task 3: Collector Gateway Ingestion

**Files:**
- Create: `apps/collector-gateway/package.json`
- Create: `apps/collector-gateway/tsconfig.json`
- Create: `apps/collector-gateway/src/main.ts`
- Create: `apps/collector-gateway/src/app.module.ts`
- Create: `apps/collector-gateway/src/ingestion/ingestion.controller.ts`
- Create: `apps/collector-gateway/src/ingestion/ingestion.service.ts`
- Create: `apps/collector-gateway/src/ingestion/ingestion.service.spec.ts`
- Create: `packages/collector-sdk/src/client.ts`
- Create: `packages/collector-sdk/src/buffer.ts`
- Create: `packages/collector-sdk/src/client.spec.ts`

- [ ] **Step 1: Write the failing ingestion tests**

```typescript
// apps/collector-gateway/src/ingestion/ingestion.service.spec.ts
import { describe, expect, it } from '@jest/globals';
import { IngestionService } from './ingestion.service';

describe('IngestionService', () => {
  it('accepts a valid batch and returns accepted event count', async () => {
    const service = new IngestionService();

    const result = await service.ingest({
      schemaVersion: 'v1',
      source: 'cursor',
      events: [
        {
          eventType: 'session.started',
          occurredAt: '2026-04-22T00:00:00.000Z',
          payload: {
            sessionId: 'sess_1',
            projectKey: 'proj',
            repoName: 'repo',
          },
        },
      ],
    });

    expect(result.accepted).toBe(1);
  });
});
```

```typescript
// packages/collector-sdk/src/client.spec.ts
import { describe, expect, it } from '@jest/globals';
import { LocalEventBuffer } from './buffer';

describe('LocalEventBuffer', () => {
  it('stores and flushes buffered events in FIFO order', () => {
    const buffer = new LocalEventBuffer();
    buffer.push({ id: '1' });
    buffer.push({ id: '2' });

    expect(buffer.flush()).toEqual([{ id: '1' }, { id: '2' }]);
  });
});
```

- [ ] **Step 2: Run the tests to verify RED**

Run:

```bash
pnpm --filter @aimetric/collector-gateway test
pnpm --filter @aimetric/collector-sdk test
```

Expected:

- tests fail because service and SDK implementations do not exist yet

- [ ] **Step 3: Write the minimal ingestion implementation**

```typescript
// apps/collector-gateway/src/ingestion/ingestion.service.ts
import { IngestionBatchSchema } from '@aimetric/event-schema';

export class IngestionService {
  async ingest(input: unknown) {
    const parsed = IngestionBatchSchema.parse(input);

    return {
      accepted: parsed.events.length,
      schemaVersion: parsed.schemaVersion,
    };
  }
}
```

```typescript
// packages/collector-sdk/src/buffer.ts
export class LocalEventBuffer<T = unknown> {
  private readonly queue: T[] = [];

  push(event: T) {
    this.queue.push(event);
  }

  flush() {
    return this.queue.splice(0, this.queue.length);
  }
}
```

- [ ] **Step 4: Run the tests to verify GREEN**

Run:

```bash
pnpm --filter @aimetric/collector-gateway test
pnpm --filter @aimetric/collector-sdk test
```

Expected:

- both test suites pass

- [ ] **Step 5: Commit**

```bash
git add apps/collector-gateway packages/collector-sdk
git commit -m "feat: add collector ingestion mainline"
```

## Task 4: Metric Platform Persistence and Core Metrics API

**Files:**
- Create: `apps/metric-platform/package.json`
- Create: `apps/metric-platform/tsconfig.json`
- Create: `apps/metric-platform/prisma/schema.prisma`
- Create: `apps/metric-platform/src/main.ts`
- Create: `apps/metric-platform/src/app.module.ts`
- Create: `apps/metric-platform/src/database/prisma.service.ts`
- Create: `apps/metric-platform/src/metrics/metrics.service.ts`
- Create: `apps/metric-platform/src/metrics/metrics.service.spec.ts`
- Create: `apps/metric-platform/src/metrics/metrics.controller.ts`

- [ ] **Step 1: Write the failing metric aggregation tests**

```typescript
// apps/metric-platform/src/metrics/metrics.service.spec.ts
import { describe, expect, it } from '@jest/globals';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  it('builds a personal snapshot from accepted AI lines and commit total lines', async () => {
    const service = new MetricsService();

    const snapshot = await service.buildPersonalSnapshot({
      acceptedAiLines: 35,
      commitTotalLines: 50,
      sessionCount: 4,
    });

    expect(snapshot.aiOutputRate).toBe(0.7);
    expect(snapshot.sessionCount).toBe(4);
  });
});
```

- [ ] **Step 2: Run the tests to verify RED**

Run:

```bash
pnpm --filter @aimetric/metric-platform test
```

Expected:

- test fails because the app and service do not exist yet

- [ ] **Step 3: Write the minimal metric platform implementation**

```typescript
// apps/metric-platform/src/metrics/metrics.service.ts
import { calculateAiOutputRate } from '@aimetric/metric-core';

export class MetricsService {
  async buildPersonalSnapshot(input: {
    acceptedAiLines: number;
    commitTotalLines: number;
    sessionCount: number;
  }) {
    return {
      acceptedAiLines: input.acceptedAiLines,
      commitTotalLines: input.commitTotalLines,
      aiOutputRate: calculateAiOutputRate(
        input.acceptedAiLines,
        input.commitTotalLines,
      ),
      sessionCount: input.sessionCount,
    };
  }
}
```

```prisma
// apps/metric-platform/prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Session {
  id          String   @id
  projectKey  String
  repoName    String
  toolType    String
  sessionType String
  startedAt   DateTime
}
```

- [ ] **Step 4: Run the tests to verify GREEN**

Run:

```bash
pnpm --filter @aimetric/metric-platform test
```

Expected:

- metric platform tests pass

- [ ] **Step 5: Commit**

```bash
git add apps/metric-platform
git commit -m "feat: add metric platform snapshot service"
```

## Task 5: Git Attribution Evidence

**Files:**
- Create: `packages/git-attribution/src/line-attribution.ts`
- Create: `packages/git-attribution/src/line-attribution.spec.ts`
- Create: `apps/metric-platform/src/attribution/attribution.service.ts`
- Create: `apps/metric-platform/src/attribution/attribution.service.spec.ts`

- [ ] **Step 1: Write the failing attribution tests**

```typescript
// packages/git-attribution/src/line-attribution.spec.ts
import { describe, expect, it } from '@jest/globals';
import { buildCommitEvidence } from './line-attribution';

describe('buildCommitEvidence', () => {
  it('counts accepted AI lines that appear in a commit patch', () => {
    const evidence = buildCommitEvidence({
      aiLines: ['const a = 2;', 'const b = 3;'],
      commitLines: ['const a = 2;', 'const c = 4;'],
    });

    expect(evidence.acceptedAiLines).toBe(1);
    expect(evidence.commitTotalLines).toBe(2);
  });
});
```

- [ ] **Step 2: Run the tests to verify RED**

Run:

```bash
pnpm --filter @aimetric/git-attribution test
```

Expected:

- test fails because attribution logic is missing

- [ ] **Step 3: Write the minimal attribution implementation**

```typescript
// packages/git-attribution/src/line-attribution.ts
export function buildCommitEvidence(input: {
  aiLines: string[];
  commitLines: string[];
}) {
  const acceptedAiLines = input.aiLines.filter((line) =>
    input.commitLines.includes(line),
  ).length;

  return {
    acceptedAiLines,
    commitTotalLines: input.commitLines.length,
  };
}
```

- [ ] **Step 4: Run the tests to verify GREEN**

Run:

```bash
pnpm --filter @aimetric/git-attribution test
```

Expected:

- attribution tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/git-attribution apps/metric-platform/src/attribution
git commit -m "feat: add git attribution evidence builder"
```

## Task 6: Basic Dashboard

**Files:**
- Create: `apps/dashboard/package.json`
- Create: `apps/dashboard/tsconfig.json`
- Create: `apps/dashboard/vite.config.ts`
- Create: `apps/dashboard/src/main.tsx`
- Create: `apps/dashboard/src/App.tsx`
- Create: `apps/dashboard/src/api/client.ts`
- Create: `apps/dashboard/src/components/metric-card.tsx`
- Create: `apps/dashboard/src/pages/personal-dashboard.tsx`
- Create: `apps/dashboard/src/pages/team-dashboard.tsx`
- Create: `apps/dashboard/src/App.test.tsx`

- [ ] **Step 1: Write the failing dashboard test**

```tsx
// apps/dashboard/src/App.test.tsx
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders personal and team metric sections', () => {
  render(<App />);

  expect(screen.getByText('Personal Metrics')).toBeInTheDocument();
  expect(screen.getByText('Team Metrics')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify RED**

Run:

```bash
pnpm --filter @aimetric/dashboard test
```

Expected:

- test fails because the dashboard app does not exist yet

- [ ] **Step 3: Write the minimal dashboard implementation**

```tsx
// apps/dashboard/src/App.tsx
export default function App() {
  return (
    <main>
      <section>
        <h1>Personal Metrics</h1>
      </section>
      <section>
        <h1>Team Metrics</h1>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Run the test to verify GREEN**

Run:

```bash
pnpm --filter @aimetric/dashboard test
```

Expected:

- dashboard test passes

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard
git commit -m "feat: add dashboard shell for personal and team metrics"
```

## Task 7: Local Runtime and End-to-End Verification

**Files:**
- Create: `docker-compose.yml`
- Create: `README.md`

- [ ] **Step 1: Write the failing end-to-end verification checklist**

```md
1. Start PostgreSQL and Redis
2. Start `metric-platform`
3. Start `collector-gateway`
4. Start `mcp-server`
5. POST one ingestion batch
6. Fetch one personal metric snapshot
7. Open dashboard and confirm both sections render
```

- [ ] **Step 2: Run the system before implementation to verify RED**

Run:

```bash
docker compose up -d
pnpm dev
```

Expected:

- runtime fails because containers, scripts, and apps are incomplete

- [ ] **Step 3: Write the minimal runtime configuration**

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: aimetric
      POSTGRES_PASSWORD: aimetric
      POSTGRES_DB: aimetric
    ports:
      - "5432:5432"

  redis:
    image: redis:7
    ports:
      - "6379:6379"
```

```md
// README.md
# AIMetric

## Phase 1

Run:

```bash
pnpm install
docker compose up -d
pnpm test
```
```

- [ ] **Step 4: Run verification to confirm GREEN**

Run:

```bash
pnpm install
docker compose up -d
pnpm test
```

Expected:

- all package and app tests pass
- local dependencies start successfully

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml README.md
git commit -m "feat: add phase 1 local runtime and verification"
```

## Spec Coverage Check

- Phase 1 covers the article's MCP standardized collection mainline.
- Phase 1 covers raw fact collection, evidence attribution, core metric snapshots, and dashboard visibility.
- Phase 1 intentionally does **not** yet cover:
  - rule management UI and rollout controls
  - knowledge query MCP details
  - tab completion analytics
  - local database reverse collectors
  - RBAC, audit, and production hardening

Those belong to follow-up plans and should not be mixed into this first executable slice.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-22-aimetric-phase1-mainline-implementation.md`.

Because the user already asked to start execution, proceed with **Inline Execution** on this plan beginning at **Task 1** unless the user requests changes to the plan.
