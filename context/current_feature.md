# Current Feature: Browser Inspection and Evidence

## Status

Completed

## Branch

`feature/browser-inspection`

## Objective

Build a public-safe Playwright inspection layer that loads classified crawl pages in
explicit desktop and mobile environments, captures bounded runtime errors and viewport
screenshots, and produces reusable evidence for later scanners.

## Included Scope

- Launch one headless browser per inspection run and close it in all outcomes.
- Use a fresh, explicitly configured browser context for every page and viewport.
- Enforce crawl scope on top-level navigations and public-network safety on all HTTP(S)
  browser requests.
- Block downloads, dismiss dialogs, avoid form interaction, and avoid persistent state.
- Load pages to `domcontentloaded` with configured navigation timeouts.
- Capture final URL, status, title, console errors, page errors, and duration.
- Inspect desktop and mobile viewports selected by configuration.
- Capture viewport screenshots for prioritized pages within a bounded per-viewport budget.
- Generate sanitized, deterministic, collision-resistant screenshot paths relative to the
  audit directory.
- Continue after individual page or viewport failures.
- Write a validated browser-inspection JSON artifact atomically.
- Add evidence factories for screenshot, selector, metric, expected, and actual values.
- Connect browser inspection to the CLI audit lifecycle.

## Excluded Scope

- Clicking controls, submitting forms, uploading files, or creating accounts.
- Authenticated browser sessions or persisted browser storage.
- Lighthouse, axe, and scanner-specific findings.
- Full-page visual regression capture.
- Final scoring and client-ready reports.

## Acceptance Criteria

- Browser, context, and page resources close after success, failure, and cancellation.
- Desktop and mobile inspections use explicit, isolated context settings.
- Unsafe subresource requests and out-of-scope main-frame redirects are blocked.
- Dialogs and downloads cannot interrupt or mutate the audited site.
- Navigation and runtime errors are bounded, sanitized, and recorded per viewport.
- One failed inspection does not stop remaining pages or viewports.
- Screenshots are limited, use safe filenames, and remain inside the audit directory.
- Screenshot references use portable relative paths.
- Failed crawler pages are skipped and counted.
- Inspection output validates against a stable schema.
- Evidence output validates against the core audit evidence schema.
- Tests use controlled adapters and local fixtures, never public websites.
- All project quality and dependency gates pass.

## Verification Plan

1. Run screenshot-path, evidence, schema, inspector, adapter, writer, and CLI-runner tests.
2. Run a controlled local Playwright smoke test when a browser runtime is available.
3. Run formatting, linting, and strict type checking.
4. Run the full test suite and exact npm build.
5. Run production dependency and peer checks.

## History

- 2026-07-18: Project Foundation completed in commit `ee81681`.
- 2026-07-18: CLI Feature Set completed in commit `8eefd54`.
- 2026-07-18: URL Normalization and Crawl-Scope Safety completed in commit `3008d18`.
- 2026-07-18: Same-Domain Crawler completed in commit `ff859c1`.
- 2026-07-18: Page Classification completed in commit `aa092f7`.
- 2026-07-18: Browser Inspection and Evidence documented and started.
- 2026-07-18: Implemented isolated desktop/mobile Playwright contexts, bounded navigation,
  dialog dismissal, download cancellation, WebSocket blocking, and guaranteed cleanup.
- 2026-07-18: Added crawl-scope enforcement for top-level browser navigation and
  public-network validation for all HTTP(S) browser requests.
- 2026-07-18: Added prioritized viewport screenshots with safe relative paths, bounded
  runtime errors, stable schemas, evidence factories, and atomic inspection output.
- 2026-07-18: Connected browser inspection and its artifact paths to the CLI lifecycle.
- 2026-07-18: Installed and launched Playwright's pinned Chromium runtime and completed a
  controlled local adapter smoke test covering status, title, errors, dialogs, screenshots,
  and cleanup.
- 2026-07-18: Verified repository formatting, linting, strict type checking, 129 tests,
  exact npm build, dependency compatibility, and a clean production dependency audit.
