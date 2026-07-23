# Current Feature: Audit History and Report Management

## Status

Complete

## Branch

`feature/audit-history-reports`

## Feature

Feature 27 from `context/feature_list_in_order.md`.

## Objective

Persist canonical audit history and report artifact metadata, then let users review and access
reports from workspace and client views without exposing or accepting unrestricted filesystem
paths in the renderer.

## Included Scope

- Persist one canonical result record for every completed or partially completed audit job.
- Retain immutable scope, client, website, audit schema, scores, finding counts, canonical JSON,
  completion state, and retention timestamps.
- Persist one report artifact record per requested format with safe filename, status, creation,
  verification, and retention metadata.
- Support available, missing, generation-failed, and expired artifact states without hiding the
  completed audit.
- Add database-backed workspace and client audit history queries with client search, lifecycle,
  result-state, and date filtering plus pagination.
- Add database-backed workspace and client report queries with status and format filtering plus
  pagination.
- Resolve open, reveal, and export operations from trusted artifact IDs in the Electron main
  process.
- Validate every stored source path against the application-owned audit directory before access.
- Use the native save dialog for export and never accept a destination path from renderer input.
- Add sender-validated IPC and narrow preload methods for history, artifact listing, open, reveal,
  and export.
- Build Impeccable workspace and client audit/report views with loading, empty, partial, failed,
  missing, generation-failed, success, and cancelled-export states.
- Preserve Feature 26 background execution, exact immutable scope, CLI behavior, and all crawler
  and browser safety constraints.

## Excluded Scope

- Full Release 2A installer acceptance and clean-machine validation, implemented in Feature 28.
- Prospect and campaign data, implemented in Features 29 through 33.
- Arbitrary report deletion or configurable retention policy editing.

## Acceptance Criteria

- Completed and partially completed jobs persist canonical result history independently of client
  or page edits.
- Requested report formats persist as explicit artifact records, including failed or missing
  generation states.
- Renderer contracts never expose application-owned report filesystem paths.
- Open and reveal accept only artifact IDs and reject missing, failed, expired, out-of-root, or
  symlink-escaped files.
- Export uses a native user-selected destination and never accepts a renderer-provided path.
- Workspace and client audit tables filter by client, status, date, and result state.
- Workspace and client report views list every supported format with useful access states.
- Existing completed jobs without result records are handled safely and remain visible.
- Strict persistence, path-safety, IPC, renderer, artifact-action, and historical-retention tests
  cover the workflow.
- All project quality, packaging, smoke, Impeccable, and visual gates pass.

## History

- 2026-07-24: Feature started after Feature 26 passed 259 tests, formatting, linting, strict type
  checking, Prisma validation, CLI build, Electron packaging, packaged-ASAR database and utility
  worker smoke, clean Impeccable detection, and compact and standard visual review.
- 2026-07-24: Added transactional canonical result and report artifact persistence, database-backed
  workspace and client history, secure identifier-only report actions, native export, and
  Impeccable audit and report views.
- 2026-07-24: Feature completed after Prisma generation and validation, formatting, zero-warning
  linting, strict CLI and Electron type checking, 55 test files with 267 passing tests, production
  CLI build, Electron Forge packaging, packaged-ASAR database and worker smoke, clean Impeccable
  detection, and standard and compact visual review of audit history and report management.
