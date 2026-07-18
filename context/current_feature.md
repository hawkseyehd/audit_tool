# Current Feature: Audit Orchestrator

## Status

Completed

## Branch

`feature/audit-orchestrator`

## Objective

Coordinate the complete validated audit lifecycle from URL normalization through polite crawl,
browser evidence, selected scanners, scoring, and configured report outputs while preserving
partial results when an individual page or scanner fails.

## Included Scope

- Validate config, normalize the target, create one audit workspace, and enforce an audit deadline.
- Retain successful crawl response data in memory for static scanners without persisting raw HTML.
- Run browser inspection and every enabled scanner using existing safety boundaries.
- Never submit forms or perform invasive security interactions.
- Convert scanner and orchestration failures into informational, non-penalizing findings.
- Merge browser evidence and page errors into canonical scanned-page records.
- Calculate the audit summary and write configured Markdown and JSON outputs in dependency order.
- Make the production CLI use the completed orchestrator.

## Excluded Scope

- Authenticated browsing, form submission, active exploitation, or destructive workflows.
- Dashboard UI, remote job queues, or distributed scan execution.
- Post-MVP comparison, PDF, scheduling, and CMS integrations.

## Acceptance Criteria

- One CLI command can produce a complete canonical audit result and requested reports.
- Disabled scanners and outputs do not run.
- One scanner failure does not prevent later scanners, scoring, or report generation.
- Crawl scope, public-network policy, conservative concurrency, and no-submit defaults remain intact.
- Raw page HTML and cookie values are not persisted in crawl or audit artifacts.
- Audit results and both output formats pass their canonical schemas.
- All project quality and dependency gates pass.

## History

- 2026-07-18: Features 1-16 completed through commit `20f8070`.
- 2026-07-18: Audit Orchestrator documented and started.
- 2026-07-18: Added an in-memory crawl response handoff for static scanners with an explicit
  header allowlist; raw HTML and cookie values remain absent from persisted crawl artifacts.
- 2026-07-18: Added the complete deadline-bound audit lifecycle, selected scanner execution,
  operational failure findings, browser evidence merge, scoring, and ordered report writes.
- 2026-07-18: Updated the production CLI to use the complete orchestrator while retaining the
  earlier focused runners.
- 2026-07-18: Completed a controlled real local run through HTTP crawl, Chromium inspection,
  axe, Lighthouse, SEO resources, all static scanners, scoring, Markdown, and JSON in 14.7 seconds.
- 2026-07-18: Verified formatting, linting, strict type checking, 191 tests, exact npm build,
  and a clean production dependency audit.
