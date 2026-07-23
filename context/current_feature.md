# Current Feature: Page Selection and Immutable Audit Scopes

## Status

Complete

## Branch

`feature/page-selection-scopes`

## Feature

Feature 25 from `context/feature_list_in_order.md`.

## Objective

Let practitioners choose an exact, reviewable set of eligible website pages and lock that choice
into an immutable audit scope that cannot be changed by later rediscovery or client edits.

## Included Scope

- Add durable include, exclude, clear, visible-page, and recommended-page selection operations.
- Add accessible row checkboxes and indeterminate select-all behavior.
- Keep selection stable across search, filters, pagination, and rediscovery.
- Show selected, eligible, unavailable, and excluded counts with clear ineligibility reasons.
- Apply deterministic recommendations for representative pages while excluding obvious archives,
  account, transaction, duplicate-content, and unavailable pages by default.
- Persist immutable audit scope and scope-page snapshots with target identity, selected page IDs and
  normalized URLs, relevant configuration, report formats, actor, and creation time.
- Validate every selected page against the client's current website and allowed target scope.
- Make retained audit scopes prevent permanent client deletion.
- Add typed and sender-validated selection and scope IPC methods.
- Extend the Impeccable Website Pages workspace with efficient selection and scope actions.
- Preserve Feature 24 discovery behavior and the existing CLI.

## Excluded Scope

- Executing the immutable scope as a background audit job, implemented in Feature 26.
- Audit history and report artifact management, implemented in Feature 27.

## Acceptance Criteria

- Selection changes are database-backed and remain stable across filters and pagination.
- Include operations refuse unavailable, no-longer-observed, or out-of-scope pages.
- Select recommended chooses only current, eligible, representative pages and records reasons.
- Bulk selection requests are bounded, validated, and scoped to one client website.
- Creating a scope snapshots exact selected page IDs and normalized URLs plus validated settings.
- Rediscovery and client edits cannot modify an existing scope snapshot.
- Historical scopes remain readable and block destructive client deletion.
- The selection UI is keyboard accessible and visually verified at compact and standard windows.
- Strict persistence, contract, renderer, and scope-immutability tests cover the workflow.
- All project quality gates pass.

## History

- 2026-07-23: Feature started after Feature 24 passed 238 tests and desktop visual QA.
- 2026-07-23: Added durable include, exclude, reset, visible, and recommended selection actions,
  indeterminate checkbox behavior, immutable scope snapshots, URL-scope validation, and
  retention-aware deletion.
- 2026-07-23: Feature completed after 244 tests across 50 files, formatting, linting, strict CLI and
  desktop type checking, Prisma validation, the CLI build, Windows Electron packaging, compiled
  scope-lock smoke, full-page standard and compact visual review, clean Impeccable scans, and the
  production dependency audit all passed.
