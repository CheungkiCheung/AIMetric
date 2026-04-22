# AIMetric Article-Congruent System Design

**Date:** 2026-04-22
**Status:** Draft for review
**Goal:** Reconstruct the architecture described in the article "AI出码率70%+的背后：高德团队如何实现AI研发效率的量化与优化" as a near-production internal platform, preserving the article's module boundaries, terminology, and layered design while using a pragmatic implementation stack.

## 1. Design Principles

This design follows six principles that are directly derived from the article and the intended deployment target:

1. **Article congruence first**
   The system keeps the same top-level layers and key terminology from the article: `采集平台层`, `数据采集层`, `平台能力层`, and `指标展示层`.
2. **Final code submission is the ground truth**
   All core metrics, especially `AI出码率`, are defined against code that actually reaches version control commits, not temporary workspace content.
3. **MCP-standardized collection is the production mainline**
   The primary collection path is based on MCP tools and rule injection, matching the article's later-stage direction.
4. **Richer local collection remains an optional extension**
   Tool-specific local database reverse collection is preserved as a research/enhancement path rather than the platform default.
5. **Simple employee onboarding**
   Normal employees should be able to access the system by installing a single plugin and signing in once.
6. **Prepared for engineering rollout**
   Security, isolation, auditability, observability, replay, and extensibility are required from the first implementation plan.

## 2. Reconstruction Scope

The target system is not a demo dashboard. It is an internal engineering platform that:

- collects AI coding interaction data from IDE and CLI workflows
- records pre-edit and post-edit file evidence
- links AI-assisted editing evidence to Git commit outcomes
- calculates personal, team, project, and tool metrics
- injects business rules and knowledge retrieval behavior into coding sessions
- provides dashboards and analysis views for operational improvement
- supports later expansion to more tools, more metrics, and more collection signals

The system is expected to reproduce the *architecture and operational intent* of the article, not the exact internal implementation details of the original team.

## 3. Target Architecture

### 3.1 Layered Architecture

The system preserves the article's four main layers and adds a fifth cross-cutting support layer required for a near-production deployment.

#### A. 采集平台层

This is the entry surface for different AI coding environments.

Supported entry types:

- Cursor-like editors
- Qoder-like editors
- AoneIDE-like enterprise IDEs
- general VS Code family IDEs
- CLI agents and coding assistants

Responsibilities:

- identify the running tool type and version
- provide a unified client SDK surface
- initialize login, project binding, and runtime context
- bootstrap rule injection and MCP configuration
- submit collection events to the collection gateway

This layer does not calculate business metrics. It only normalizes access points.

#### B. 数据采集层

This is the core operational layer of the platform and the closest match to the article's central implementation concerns.

Modules:

- IDE/CLI adapters
- rule injection engine
- MCP tool integration
- session collection
- file edit collection
- tab completion collection
- usage activity collection
- local buffer and upload manager
- optional local database reverse collectors

Responsibilities:

- create a normalized `Session`
- inject mandatory rules and scenario-specific rules
- force MCP tool execution when edits happen
- record edit-before and edit-after states
- record tool invocations and session summaries
- stage raw events locally and upload them reliably

Two collection paths coexist:

- **Mainline path:** MCP-standardized collection
- **Extension path:** local database reverse collection adapters for specific tools

#### C. 平台能力层

This is the service backbone that receives raw events and turns them into evidence and metrics.

Modules:

- collection gateway service
- event persistence service
- rule management service
- knowledge retrieval service
- Git attribution service
- metric calculation service
- scheduled jobs and replay jobs
- metric query APIs
- admin and operations APIs

Responsibilities:

- persist raw session, edit, and tool events
- manage rule bundles and rollout versions
- retrieve business and technical knowledge via MCP-backed lookups
- compute commit-linked evidence
- build metric snapshots for dashboards
- expose filtered APIs for personal, team, project, and tool views

#### D. 指标展示层

This layer provides the analytical surfaces highlighted in the article.

Views:

- personal coding metric dashboard
- team coding metric dashboard
- session analytics view
- code output analytics view
- tool comparison views
- rule effectiveness views

Responsibilities:

- visualize metrics at different aggregation levels
- support filtering by time, team, project, repo, tool, and rule version
- identify ineffective AI usage scenarios
- provide operational feedback loops for optimization

#### E. 工程化支撑层

This layer is not emphasized in the article but is required for rollout.

Capabilities:

- authentication and SSO
- RBAC and organization isolation
- audit trail
- observability
- configuration management
- deployment pipeline
- replay and data repair

## 4. Recommended Repository Layout

The implementation should use a single repository with multiple deployable apps and reusable packages. This keeps the first delivery coherent while still allowing strong module boundaries.

```text
apps/
  collector-gateway/
  metric-platform/
  mcp-server/
  dashboard/

packages/
  event-schema/
  collector-sdk/
  metric-core/
  rule-engine/
  git-attribution/
  shared/

adapters/
  cursor/
  cli/

docs/
  architecture/
  metrics/
  operations/
  superpowers/
    specs/
    plans/
```

### 4.1 App Responsibilities

#### `apps/collector-gateway`

- receives client batches from plugins and CLI collectors
- authenticates upload requests
- validates event schema versions
- persists raw events or enqueues them for asynchronous processing
- returns ingestion status to clients

#### `apps/metric-platform`

- hosts metric query APIs
- hosts rule management APIs
- hosts knowledge configuration APIs
- runs scheduled jobs for attribution and metric snapshots
- exposes admin and operations APIs

#### `apps/mcp-server`

- exposes MCP tools required by the collection design
- provides `beforeEditFile`, `afterEditFile`, and `recordSession`
- provides document and rule lookup tools
- returns normalized tool execution payloads

#### `apps/dashboard`

- provides personal, team, project, and tool analytics views
- supports filtering, comparison, and trend visualization
- provides rule effectiveness and operational insight pages

### 4.2 Package Responsibilities

#### `packages/event-schema`

- defines request/response DTOs
- defines event payloads and schema versions
- centralizes validation rules and shared types

#### `packages/collector-sdk`

- provides plugin/CLI-side upload clients
- manages local buffer logic
- handles retry, dedupe, and authentication token usage

#### `packages/metric-core`

- defines metrics and their formulas
- defines filters and aggregation rules
- provides snapshot builders

#### `packages/rule-engine`

- defines rule bundle models
- matches project and scene conditions
- resolves mandatory and on-demand rule sets

#### `packages/git-attribution`

- links file edit events to Git commits
- computes accepted AI contribution evidence
- provides attribution and evidence generation logic

#### `packages/shared`

- centralizes config loading
- centralizes logging and tracing helpers
- centralizes auth guards, errors, and shared utilities

## 5. End-to-End Data Flow

### 5.1 Session Initialization

When a user starts an AI-assisted coding action, the collection side creates a `Session`.

The session records:

- organization
- team
- project
- repository
- branch
- user
- tool type
- tool version
- session type
- working directory
- start time

Session types include:

- `chat`
- `edit`
- `tab-complete`
- `agent-task`

### 5.2 Rule Injection

After session creation, the adapter resolves a `RuleBundle` using:

- project type
- tool type
- scene type
- rule version

Two rule classes are injected:

#### Mandatory rules

These are always applied:

- base development norms
- core API and comment constraints
- style and collaboration rules
- MCP tool invocation requirements

#### On-demand rules

These are applied only when relevant:

- architecture guidance
- business process guidance
- special module instructions
- API documents
- knowledge base content

This preserves the article's "知识库外置 + 动态查询" strategy and prevents prompt overload.

### 5.3 MCP Collection Mainline

For editable AI sessions, the system enforces MCP tool use around file changes.

Required MCP tools:

- `beforeEditFile`
- `afterEditFile`
- `recordSession`
- `queryKnowledge` or equivalent document retrieval tool

Expected sequence:

1. `beforeEditFile`
   Records target file path, current session, and pre-edit file state.
2. user/AI editing occurs
3. `afterEditFile`
   Records post-edit file state, metadata, and a normalized diff.
4. `recordSession`
   Records session-level messages, result state, and tool execution summary.

This creates an `EditSpan`, which becomes the basic evidence unit for later attribution.

### 5.4 Local Buffer and Upload

The client side must not block editor interactions on every remote write. Instead, collection events are:

- written into a local buffer
- grouped into upload batches
- retried on failure
- deduplicated via stable batch keys
- uploaded asynchronously

The server stores raw events first and only computes evidence and metrics later.

### 5.5 Evidence Attribution

Background jobs merge:

- sessions
- edit spans
- session messages
- Git commit history
- commit file diffs

The result is a set of evidence objects that answer:

- which AI-originated edits were accepted
- which accepted edits entered final commits
- how many lines were effectively contributed by AI

### 5.6 Metric Snapshot Generation

Metric snapshot jobs aggregate evidence into:

- personal snapshots
- team snapshots
- project snapshots
- tool snapshots
- distribution snapshots

These power dashboards and operational analysis.

## 6. Domain Model

The system should separate three layers of truth:

1. raw facts
2. attribution evidence
3. presentation snapshots

### 6.1 Core Domain Objects

#### `Session`

Represents one AI interaction loop.

Fields:

- id
- org_id
- team_id
- project_id
- repo_id
- user_id
- tool_type
- tool_version
- session_type
- started_at
- ended_at
- status

#### `EditSpan`

Represents one pre-edit/post-edit pair linked to a session.

Fields:

- id
- session_id
- file_path
- edit_kind
- before_hash
- after_hash
- before_content_ref
- after_content_ref
- diff_ref
- captured_at

#### `CodeContribution`

Represents a candidate AI contribution segment before final commit acceptance is confirmed.

Fields:

- id
- session_id
- edit_span_id
- file_path
- contributed_lines
- contribution_method
- confidence

#### `CommitEvidence`

Represents evidence linking accepted AI edits to a real Git commit.

Fields:

- id
- commit_sha
- session_id
- file_path
- accepted_ai_lines
- total_commit_lines
- evidence_type
- attribution_version

#### `RuleBundle`

Represents the resolved rule set for a session.

Fields:

- id
- project_scope
- scene_scope
- mandatory_rules
- on_demand_rules
- rule_version

#### `MetricSnapshot`

Represents an aggregated result for one time window and one scope.

Fields:

- id
- snapshot_type
- scope_id
- window_start
- window_end
- metrics_json
- metric_version

## 7. Data Storage Model

### 7.1 Raw Fact Layer

Required storage entities:

- `sessions`
- `session_messages`
- `tool_invocations`
- `file_edit_events`
- `tab_completion_events`
- `usage_activity_events`
- `upload_batches`

Purpose:

- preserve unmodified original facts
- support replay, audit, and recalculation

### 7.2 Attribution Evidence Layer

Required storage entities:

- `git_commits`
- `commit_file_changes`
- `code_contributions`
- `commit_evidences`
- `session_commit_links`
- `rule_execution_records`

Purpose:

- prove accepted AI contribution
- connect workspace evidence to final commits

### 7.3 Snapshot Layer

Required storage entities:

- `metric_snapshots_personal`
- `metric_snapshots_team`
- `metric_snapshots_project`
- `metric_snapshots_tool`
- `metric_snapshots_distribution`

Purpose:

- speed up dashboard queries
- support time-window comparisons
- support distribution and filtered views

### 7.4 Infrastructure Storage Choices

Recommended storage choices:

- `PostgreSQL`
  for primary transactional data, facts, evidence, rules, and snapshots
- `Redis`
  for dedupe keys, short-lived cache, upload coordination, and job state
- `Object storage or file archive`
  for large content blobs such as message archives, large diffs, and snapshot exports

## 8. Metric System

Metrics are grouped into four classes.

### 8.1 Core Outcome Metrics

- `AI采纳行数`
- `commit提交行数`
- `AI出码率`

Formula:

`AI出码率 = AI采纳行数 / commit代码总行数`

Definitions:

- `AI采纳行数`: lines generated with AI assistance and accepted into final committed code
- `commit代码总行数`: lines included in effective commits during the selected time window

### 8.2 Session Interaction Metrics

- session count
- session acceptance rate
- average interaction rounds
- accepted lines per session
- session completion rate

### 8.3 Usage Time Metrics

- daily active usage time
- active days
- tool usage frequency
- average sessions per active day

### 8.4 Tab Completion Metrics

- tab trigger count
- tab accept count
- tab acceptance rate
- tab accepted lines
- tab output ratio

### 8.5 Filtering and Distribution

To support the article's operational analysis goals, metrics must also support:

- personal vs team aggregation
- project type filtering
- tool type comparison
- rule version comparison
- filtered vs unfiltered outputs
- percentile and distribution views

Filtering examples:

- exclude merge commits
- exclude robot accounts
- exclude generated files
- exclude test-only paths when needed
- exclude low-value file types by policy

## 9. Employee Installation and Onboarding Strategy

This is a critical success factor and must be treated as a first-class design constraint.

### 9.1 Standard Access Tier

This is the default path for most employees.

Expected user steps:

1. install one plugin
2. sign in once with enterprise identity
3. bind the current project automatically or with one lightweight confirmation
4. start using AI coding tools

The plugin must automatically:

- inject rule bundles
- inject MCP configuration
- initialize collection SDK state
- manage upload authentication
- perform silent version updates when possible

Employee-side requirements in this tier:

- no database setup
- no manual MCP editing
- no manual metric configuration
- no need to understand system internals

### 9.2 Enhanced Collection Tier

This is only for pilot groups, power users, or research environments.

Capabilities may include:

- local database reverse collection adapters
- extended diagnostics
- richer local inspection tools
- experimental collection paths

This tier must never be the mandatory path for company-wide rollout.

### 9.3 Product Requirement

The platform must optimize for:

- **simple employee access**
- **high collection completeness**
- **future data expansion**

The design answer is:

- use the plugin + MCP path as the default operational model
- use tool-specific deeper collectors as optional enhancement modules
- normalize all collected data into the same event schema and evidence pipeline

## 10. Security and Access Control

The system handles sensitive engineering behavior data and must be built with strict scope control.

### 10.1 Authentication

Use:

- enterprise SSO or OAuth2 login for users
- short-lived tokens for plugin and CLI uploads
- signed service-to-service credentials internally

### 10.2 Authorization

Use RBAC with at least:

- platform admin
- team admin
- normal developer

Access scope must be bounded by:

- organization
- team
- project
- repository

Default posture:

- least privilege
- personal metrics visible to the user by default
- team-level access explicitly granted

## 11. Audit and Compliance

Audit logging is required for:

- dashboard access to scoped data
- rule changes and rollouts
- configuration changes
- replay jobs
- data repair jobs
- admin operations
- MCP tool failures affecting collection integrity

Audit logs must be separated from ordinary application logs.

## 12. Reliability and Replay

Because MCP calls and uploads can fail, the system must assume imperfect collection.

Required mechanisms:

- local buffering
- batch retry
- idempotent ingestion
- dead-letter handling for failed processing
- immutable raw event retention
- replay and backfill jobs
- metric recalculation by time window and scope

This is necessary to protect metric integrity over time.

## 13. Observability

The platform must support operational diagnosis across clients, ingestion, computation, and dashboards.

Required telemetry:

- structured logs
- metrics
- traces
- alert rules

Key operational signals:

- event ingestion throughput
- event drop rate
- retry rate
- MCP execution success rate
- session completeness rate
- Git attribution success rate
- snapshot calculation duration
- dashboard query latency

## 14. Extensibility

The architecture must support growth in three main directions:

1. more tools
2. more metrics
3. more collection signals

Required design decisions:

- adapters are plugin-like modules
- event schema is versioned
- metrics are defined in centralized calculation modules
- rules are templated and versioned
- MCP tools are registered and discoverable

This allows future additions such as:

- more IDE adapters
- more CLI integrations
- more session analytics
- more rule effectiveness analytics
- new signals beyond file edits and tab usage

## 15. Testing Strategy

This system is a measurement platform, so statistical correctness matters as much as software correctness.

### 15.1 Unit Tests

Cover:

- rule matching
- metric formulas
- diff parsing
- attribution helpers
- schema validators

### 15.2 Integration Tests

Cover:

- ingestion APIs
- MCP tool execution path
- event persistence
- job execution
- metric snapshot generation

### 15.3 Contract Tests

Cover:

- plugin/CLI SDK compatibility with backend schemas
- MCP payload compatibility

### 15.4 End-to-End Tests

Cover:

- simulated AI session
- simulated file edits
- event upload
- Git attribution
- dashboard result visibility

### 15.5 Metric Regression Tests

Cover:

- fixed sample repositories
- fixed commit histories
- fixed expected output for AI accepted lines and output ratios

This protects long-term metric consistency.

## 16. Deployment and Environments

Required environments:

- `dev`
- `staging`
- `prod`

Deployment approach:

- containerized applications
- environment-driven configuration
- staged rule rollout
- staged metric version rollout

The first implementation should support local dockerized development and a clean path to Kubernetes later.

## 17. Recommended Technology Stack

This stack prioritizes stability, modularity, and type reuse across client, MCP, and platform services.

- backend platform: `TypeScript + NestJS`
- dashboard: `React + Ant Design`
- primary database: `PostgreSQL`
- cache and coordination: `Redis`
- jobs: `BullMQ`
- MCP server: `TypeScript`
- collector SDK and adapters: `TypeScript`
- observability: `OpenTelemetry + Prometheus/Grafana`
- deployment: `Docker Compose` for local and staging bootstrap

This stack keeps the architecture clean while avoiding premature infrastructure complexity.

## 18. Implementation Phases

The design is full-scope, but delivery still needs phases.

### Phase 1: Mainline Closed Loop

- MCP collection mainline
- session and edit event persistence
- basic Git attribution
- core metrics
- personal and team dashboards

### Phase 2: Rules and Knowledge

- mandatory and on-demand rule bundles
- knowledge query MCP
- project rule templates
- rule versioning and rollout

### Phase 3: Multi-Entry and Enhanced Collection

- tab completion collection
- more IDE and CLI adapters
- research-grade local database reverse collector
- richer session analytics

### Phase 4: Near-Production Hardening

- RBAC
- audit logging
- observability
- replay and repair workflows
- deployment and ops documentation

## 19. Open Reconstruction Assumptions

The article does not publish exact private implementation details. This design makes the following explicit assumptions:

- exact internal storage schema from the original team is unknown and must be reconstructed
- exact rule text is unknown and must be re-authored from platform requirements
- exact private IDE implementations are unknown and must be represented via adapter abstractions
- exact original dashboard visuals are unknown and only the functional view classes are reconstructed

These assumptions do not change the architectural intent of the reconstruction.

## 20. Final Recommendation

Build AIMetric as an article-congruent internal engineering platform with:

- a four-layer article-matching architecture
- MCP-standardized collection as the production mainline
- optional deeper local collection as a research extension
- commit-based attribution as the statistical truth foundation
- lightweight employee onboarding through a single plugin
- explicit support for security, audit, observability, replay, and future metric expansion

This gives the project the highest fidelity to the article while still making it viable as a system that can be engineered, operated, and expanded over time.
