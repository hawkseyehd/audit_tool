# Current Feature: Website Page Discovery and Inventory

## Status

Complete

## Branch

`feature/page-discovery`

## Feature

Feature 24 from `context/feature_list_in_order.md`.

## Objective

Let a practitioner safely discover a client's public website pages, preserve a durable current
inventory, understand rediscovery changes, and review the result inside the client workspace.

## Included Scope

- Reuse the existing safe crawler without running browser inspection or scanner suites.
- Persist bounded discovery runs and stable website-page records.
- Store normalized and observed URLs, title, page type, response/failure state, timestamps,
  availability, recommendation state and reason, and future-compatible selection state.
- Compare rediscovery with the existing inventory and classify new, changed, unavailable, and
  no-longer-observed pages without changing historical scope data.
- Add typed and sender-validated discovery and inventory IPC methods.
- Add database-backed page search, filters, sorting, and pagination.
- Build the Website Pages client tab with useful empty, running, failure, partial, and ready states.
- Visually verify standard and compact desktop windows using the project-local Impeccable skill.
- Preserve all Feature 23 client behavior and the existing CLI.

## Excluded Scope

- Page checkbox selection, recommendation bulk actions, and immutable audit scopes, implemented in
  Feature 25.
- Full audit execution and progress jobs, implemented in Feature 26.
- Historical audit and report artifact management, implemented in Feature 27.

## Acceptance Criteria

- Discovery remains within the validated website scope and all existing crawl safety bounds.
- A discovery run never executes scanners, submits forms, or interacts with page controls.
- Equivalent normalized URLs map to stable page records across rediscovery.
- Rediscovery records new, changed, unavailable, and no-longer-observed counts.
- Previously stored selection state and stable page IDs survive rediscovery.
- Page inventory queries are database-backed, validated, filtered, sorted, and paginated.
- The Website Pages tab clearly exposes state, counts, timestamps, changes, and safe failures.
- Strict renderer, preload, IPC, repository, and crawler-adapter tests cover the workflow.
- The existing CLI and client management workspace remain operational.
- All project quality gates pass.

## History

- 2026-07-23: Feature started after Feature 23 passed 231 tests and desktop visual QA.
- 2026-07-23: Added safe discovery runs, stable page inventory persistence, exact-URL rediscovery
  comparison, interruption recovery, database-backed filters, typed IPC, and the Impeccable Website
  Pages workspace.
- 2026-07-23: Feature completed after 238 tests across 49 files, formatting, linting, strict CLI and
  desktop type checking, Prisma validation, the CLI build, Windows Electron packaging, compiled
  desktop smoke, full-page standard and compact visual review, clean Impeccable scans, and the
  production dependency audit all passed.
