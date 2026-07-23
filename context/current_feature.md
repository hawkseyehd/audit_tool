# Current Feature: Background Audit Jobs and Progress

## Status

Complete

## Branch

`feature/background-audit-jobs`

## Feature

Feature 26 from `context/feature_list_in_order.md`.

## Objective

Run immutable audit scopes as durable, cancellable background jobs in the Electron utility process
while keeping the renderer and main event loop responsive and making progress understandable after
renderer reloads or application recovery.

## Included Scope

- Persist one idempotent audit job per immutable scope with stable ownership and timestamps.
- Support queued, discovering, scanning, generating-reports, completed, partially-completed,
  failed, and cancelled lifecycle states.
- Persist page progress, attempts, warning counts, failed-page counts, cancellation requests, and
  classified failures.
- Recover interrupted work safely after application restart and resume queued work.
- Run the existing audit orchestrator in the Electron utility process against the scope's exact
  normalized URLs.
- Add typed utility-process messages for execution, progress, completion, cancellation, and
  shutdown.
- Add external cancellation and high-level progress support to the audit orchestrator without
  changing existing CLI behavior.
- Add a main-process audit job manager with serial dispatch, worker-exit recovery, and cleanup.
- Add sender-validated IPC and narrow preload methods for starting, listing, reading, and
  cancelling jobs.
- Add Impeccable client-level and workspace-level audit monitoring views with reconnect-safe
  polling and accessible lifecycle states.
- Preserve Feature 25 scope immutability and all existing crawler, scanner, report, and CLI safety.

## Excluded Scope

- Full audit history filtering and report artifact open, reveal, and export workflows, implemented
  in Feature 27.
- Release 2A installer acceptance and clean-machine validation, implemented in Feature 28.

## Acceptance Criteria

- Starting the same immutable scope repeatedly returns one job and never duplicates execution.
- Audit work executes outside the renderer and Electron main event loop.
- The utility process receives only validated scope data, configuration, and application-owned
  output locations.
- Only the exact scope URLs are crawled and scanned.
- Job lifecycle transitions are validated and persisted with actionable failure classifications.
- Renderer reload or window recreation can reconstruct current progress from SQLite.
- Interrupted active jobs recover safely to queued work after application restart.
- Cancellation aborts active audit work and closes browser, Lighthouse, and temporary resources.
- Recoverable page or scanner failures produce a partially-completed job instead of hiding
  successful work.
- Client and workspace monitoring UIs cover loading, empty, running, partial, failed, completed,
  cancellation, and worker-unavailable states.
- Strict persistence, protocol, IPC, renderer, cancellation, recovery, and exact-scope tests cover
  the workflow.
- All project quality, packaging, smoke, Impeccable, and visual gates pass.

## History

- 2026-07-24: Feature started after Feature 25 and the Electron development-entry regression fix
  passed 245 tests, packaging, packaged smoke, and renderer-level launch verification.
- 2026-07-24: Added durable idempotent audit jobs, validated lifecycle transitions, exact immutable
  scope execution, persisted progress and warnings, safe retries and cancellation, restart
  recovery, utility-process orchestration, and bounded shutdown cleanup.
- 2026-07-24: Added sender-validated audit IPC, a narrow preload API, deliberate audit start from
  the locked scope, and Impeccable workspace and client audit monitors with compact-window
  behavior, useful failures, warnings, progress, cancellation, and retry actions.
- 2026-07-24: Corrected Electron Forge production packaging for pnpm, Playwright, Lighthouse, and
  Prisma by using the required hoisted dependency layout, runtime externals, dynamic Lighthouse
  loading, pruned module packaging, and a deterministic isolated packaged-ASAR smoke harness.
- 2026-07-24: Feature completed after the full test suite, formatting, linting, strict CLI and
  desktop type checking, Prisma schema validation, production build, Windows Electron packaging,
  packaged-ASAR database and utility-worker smoke, clean Impeccable detection, and standard and
  compact visual review passed.
