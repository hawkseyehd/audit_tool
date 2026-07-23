# Current Feature: Release 2A Integration and Acceptance

## Status

Complete

## Branch

`feature/release-2a-acceptance`

## Feature

Feature 28 from `context/feature_list_in_order.md`.

## Objective

Prove the complete client-to-report desktop workflow, harden its operational boundaries, and
produce a signed-ready Windows installer whose packaged runtime includes every required audit and
report dependency.

## Included Scope

- Cover client creation, page discovery, durable selection, immutable scope, background audit
  execution, canonical history, and secure report access as one integrated workflow.
- Verify historical scopes remain unchanged after rediscovery and client edits.
- Verify the existing CLI remains buildable and operational.
- Test keyboard workflows, accessible names, resizable layouts, compact navigation, display
  scaling, loading, failure, permission, and destructive-action states.
- Test worker restart, cancellation, partial completion, application shutdown, and browser cleanup.
- Produce a Squirrel.Windows installer configured for signing without storing signing secrets.
- Inspect packaged ASAR contents for Playwright, Chromium integration, Lighthouse, Prisma, and PDF
  generation support.
- Add deterministic package and installer acceptance scripts with machine-readable evidence.
- Run formatting, lint, strict type checking, tests, dependency review, production build,
  packaging, installer creation, packaged smoke, Impeccable detection, and visual QA.

## Excluded Scope

- Purchasing or applying a production code-signing certificate.
- Testing on a separate physical clean Windows machine that is not connected to this workspace.
- Prospect, campaign, provider, enrichment, qualification, or promotion features from Release 2B.

## Acceptance Criteria

- The client-to-report workflow passes end to end using deterministic local fixtures.
- Rediscovery and client edits cannot mutate a previously locked scope.
- Cancellation, partial failures, worker interruption, and shutdown leave durable, understandable
  states and no project-owned browser or Electron processes.
- Renderer and preload accessibility checks cover keyboard reachability and usable names.
- Standard and compact packaged screens remain readable without incoherent overlap.
- The packaged runtime starts from ASAR with database and worker services ready.
- The packaged runtime contains all production scanner, Prisma, Playwright, Lighthouse, and report
  dependencies.
- Squirrel.Windows setup artifacts are generated and signing configuration remains environment
  driven.
- The CLI build and smoke command remain operational.
- All project quality and acceptance gates pass with recorded evidence.

## History

- 2026-07-24: Feature completed with the deterministic client-to-report workflow, immutable-scope
  rediscovery coverage, packaged-browser environment configuration, project-managed Chromium,
  signed-ready Squirrel configuration, package-content inspection, and machine-readable release
  evidence.
- 2026-07-24: Final gates passed Prisma validation, formatting, zero-warning linting, strict CLI
  and Electron type checking, 58 test files with 271 passing tests, production CLI build and help
  smoke, production dependency audit with no known vulnerabilities, clean Impeccable detection,
  and standard and compact visual review.
- 2026-07-24: The final Squirrel package passed ASAR startup with ready database and worker
  services, keyboard reachability, 125% display scaling, five live axe scans, report-history
  rendering, and installer inspection. Packaged Chromium generated a valid PDF and completed a
  Lighthouse run with a score of 100 against a deterministic local target.
- 2026-07-24: Feature started after Feature 27 passed Prisma validation, formatting, zero-warning
  linting, strict CLI and Electron type checking, 55 test files with 267 passing tests, production
  CLI build, Electron packaging, packaged-ASAR smoke, clean Impeccable detection, and standard and
  compact audit-history and report-library visual review.
