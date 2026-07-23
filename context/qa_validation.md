# QA Validation Record

## Scope

This record covers the Website Audit Tool MVP through PM-02 and the client business summary
extension. It records repeatable local test coverage, report-layout validation, and one-time
public-safe connectivity validation performed on 2026-07-18. It is not a quality assessment of
the external sites and does not authorize invasive testing.

## Automated Coverage Inventory

The normal Vitest suite is deterministic and uses local inputs only. It covers:

- URL normalization, deduplication, crawl scope, blocked protocols, redirects, DNS rebinding,
  private-network rejection, and download/social-link filtering.
- Config defaults, strict validation, safety limits, output flags, and no-submit behavior.
- Page classification and scan prioritization.
- HTTP crawl concurrency, retry limits, response-size limits, failure isolation, and ephemeral
  scanner-resource handoff.
- Playwright request safety, browser cleanup, screenshots, failure capture, and cancellation.
- SEO, form, security/privacy, conversion UX, analytics, Lighthouse, and accessibility scanners.
- Exact scoring penalties, category weights, clamping, counts, and deterministic priorities.
- Markdown and HTML escaping, required report sections, partial/empty states, and atomic
  persistence.
- A4 full and summary PDF rendering, output signature validation, disabled JavaScript, blocked
  non-local renderer requests, temporary-artifact cleanup, batching, and selective/default CLI
  output behavior.
- Three-page client business summary generation, complete finding-to-outcome accounting,
  client-only content exclusions, bounded variable text, partial-coverage messaging, and
  default/selective output behavior.
- Stable JSON serialization, canonical schema validation, and atomic persistence.
- Full orchestration, disabled scanners, scanner failures, crawl failures, deadlines, scoring,
  output ordering, and CLI completion receipts.

## Local Integration Validation

`tests/integration/full-audit.test.ts` starts a controlled two-page HTTP site and runs:

1. Same-domain crawl with `maxPages=2`, `concurrency=1`, and a crawl delay.
2. Real Playwright Chromium inspection on desktop and mobile.
3. Real axe execution on desktop and mobile.
4. Static SEO, form, security/privacy, UX, and analytics scanners.
5. A deterministic Lighthouse adapter result; the real Lighthouse process path was separately
   validated in Features 12 and 17.
6. Scoring, screenshots, PDF, HTML, Markdown, JSON, schema validation, and cleanup.

The integration test completed in approximately five seconds on the validation machine. It
asserts that deliberate form, accessibility, and performance defects become findings; a
screenshot exists; all report formats exist; required report sections are present; PDF output has
a valid signature; and raw HTML and cookie values are absent from JSON.

Feature 17 also completed a controlled real local run through the actual Lighthouse process in
14.7 seconds. That run produced one scanned page, 10 findings, an overall score of 90.95, and
both output formats.

## Public-Safe Validation

Five reference pages were crawled sequentially outside the normal test suite. Each run used
`maxPages=1`, `concurrency=1`, `maxRetries=0`, a 20-second navigation timeout, and no browser,
Lighthouse, axe, form interaction, or report generation.

| Target | Result | Duration |
| --- | --- | ---: |
| `https://example.com/` | HTTP 200, 1/1 page successful | 176 ms |
| `https://example.org/` | HTTP 200, 1/1 page successful | 155 ms |
| `https://example.net/` | HTTP 200, 1/1 page successful | 1,040 ms |
| `https://www.iana.org/` | HTTP 200, 1/1 page successful | 248 ms |
| `https://www.w3.org/` | HTTP 200, 1/1 page successful | 152 ms |

This validation confirms basic public HTTPS connectivity, response handling, classification,
and the one-page crawl bound. It does not claim that these sites passed an audit.

## Report Review

The PM-02 client PDF sample was rendered from a representative audit with five scanned pages, ten
findings across every severity, a page failure, long URLs, and screenshot evidence. Poppler
rendered all 15 A4 pages to PNG and every page was inspected for clipping, overlap, pagination,
footer consistency, tables, evidence, empty space, and final-page behavior. Structural inspection
confirmed tagged output, no JavaScript, 16 link annotations, non-empty extractable text on every
page, complete required sections, and the title `Audit Report - Northstar Dental Studio`.

The client summary extension was rendered from a representative audit with eight findings across
all severities and six highlighted priorities. Poppler rendered all five A4 pages and every page
was inspected after the final matrix readability adjustment. The final document has consistent
footers, no clipping, overlap, or blank pages, and clear decision snapshot, issue landscape,
priority, action plan, scope, and limitation sections. Structural inspection confirmed tagged
output, no JavaScript, non-empty extractable text on every page, A4 dimensions, and the title
`Audit Summary - Northstar Digital`.

The client business summary was rendered from a representative high-volume result with 11 pages
reviewed, 37 findings, all ten finding categories, all four actionable severities, and one partial
page. Poppler rendered exactly three A4 pages and every page was inspected at full resolution.
The final document has no clipping, overlap, blank pages, broken wrapping, or footer issues and
uses clear business snapshot, business impact, and recommended-work pages.

The three-page physical contract was also checked against an empty result and a maximum-valid-text
stress result. Both produced exactly three nonblank tagged A4 pages. Structural inspection with
Poppler and pypdf confirmed the title, A4 dimensions, extractable text, tagged output, no
JavaScript, pages reviewed, and the absence of visible audit IDs, timestamps, scanner details,
methodology, certification language, and references to other reports.

The final regression suite completed 215 tests across 42 files after the client business summary
and its long-content bounds were applied. Formatting, lint, strict type checking, and the Node 22
production build passed. The pnpm 11 production dependency audit reported no known
vulnerabilities.

## Desktop Foundation Validation

Feature 22 adds seven focused tests across desktop contracts, SQLite persistence, and the React
renderer. The database test initializes an application-owned SQLite file, closes it, reopens it,
and confirms the original workspace metadata is retained. Renderer tests cover loading, ready,
empty, navigation, service status, failure, and retry behavior through the typed preload contract.

Electron Forge produced an unpacked Windows x64 application with ASAR packaging and security
fuses. The bundled Electron application was launched through Playwright with the real main,
preload, renderer, Prisma, SQLite, and utility-process bundles. Both local services reported
`ready`, the workspace schema was initialized, and the utility worker completed its bounded ping
handshake and shutdown.

The Impeccable layout and type detectors returned no findings. Playwright screenshots at
1280 x 820 and 900 x 700 were inspected at full resolution. The standard and compact navigation,
status labels, content rows, loading treatment, focus targets, typography, clipping, overflow,
and responsive reflow were visually clean.

The complete Feature 22 regression gate passed 222 tests across 45 files. Formatting, linting,
strict CLI and desktop type checking, the CLI production build, the fused Electron package,
the compiled Electron smoke test, and the pnpm production dependency audit all passed. The
dependency audit reported no known vulnerabilities.

## Client Management Validation

Feature 23 adds repository, contract, database, and renderer coverage for normalized client
creation, duplicate-domain prevention, tag normalization, search, lifecycle filtering, updates,
activity history, typed deletion confirmation, empty states, form validation, profile navigation,
archive actions, and the duplicate-client recovery path.

The compiled Electron application creates or reuses a representative client through the typed
preload API, opens the client directory, and renders the persisted record from SQLite. Playwright
captures the directory at 1280 x 820 and 900 x 700. Both images were inspected at full resolution;
the table, filters, active status, responsive sidebar, typography, whitespace, and row actions are
clear with no clipping or overlap. The Impeccable layout and type detectors returned no findings.

The complete Feature 23 regression gate passed 231 tests across 47 files. Formatting, zero-warning
linting, strict CLI and desktop type checking, the CLI production build, Windows x64 Electron
packaging, and the compiled Electron smoke test all passed. The smoke run reported one persisted
client and both the database and worker services as ready. The pnpm production dependency audit
reported no known vulnerabilities.

## Website Page Discovery Validation

Feature 24 adds focused repository, crawler-adapter, contract, and renderer coverage. Tests verify
that discovery disables scanners, outputs, form submission, and browser interaction while retaining
the crawler's domain, SSRF, timeout, response-size, redirect, retry, delay, concurrency, and page
limits. Rediscovery tests confirm exact normalized URLs retain stable page IDs, titles and
availability produce visible changes, new URLs remain distinct, absent URLs become not observed,
and existing selection state is preserved.

The persistence suite also covers unavailable pages, partial and failed runs, overlapping-run
rejection, bounded job input, database-backed title and URL search, page-type and availability
filters, pagination contracts, and interrupted-run recovery. Renderer tests cover useful empty
state discovery, persisted results, run summaries, HTTP state, and recoverable discovery failures.

The compiled Electron application loaded three representative persisted pages from SQLite and
rendered the Website Pages tab at 1280 x 820 and 900 x 700. Full-page captures were inspected at
full resolution. Summary counts, partial-run warning, filters, row hierarchy, status and change
labels, failure messaging, responsive client actions, horizontal table access, typography, and
spacing were clear with no overlap or clipping. The Impeccable layout and type detectors returned
no findings.

The complete Feature 24 regression gate passed 238 tests across 49 files. Formatting, zero-warning
linting, strict CLI and desktop type checking, Prisma schema validation, the CLI production build,
Windows x64 Electron packaging, and the compiled Electron smoke test all passed. The database and
worker services reported ready, and the pnpm production dependency audit reported no known
vulnerabilities.

## Page Selection and Scope Validation

Feature 25 adds focused selection, scope, contract, renderer, and retention coverage. Tests verify
individual include and reset actions, explicit exclusion, visible-page and recommended selection,
bounded unique page IDs, preservation of manual exclusions, refusal of foreign and unavailable
pages, selected and eligible counts, and no-submit scope configuration validation.

Scope tests copy exact page IDs, normalized URLs, page types, client and website identity, target,
configuration, report formats, actor, and timestamp. They then delete the mutable page inventory
and rename the current client and website. The stored scope remains byte-for-byte readable and
retained scope history prevents permanent client deletion. Additional tests reject stale,
unavailable, and out-of-domain selections before a snapshot is written.

The compiled Electron application loaded a representative inventory, exposed an indeterminate
visible-page checkbox, retained one selected page, and created a real immutable scope through the
preload, IPC, repository, and SQLite layers. Full-page captures at 1280 x 820 and 900 x 700 were
inspected at full resolution. Counts, checkbox states, disabled unavailable pages, bulk commands,
scope confirmation, responsive wrapping, row hierarchy, horizontal table access, and keyboard
focus targets were clear with no overlap or clipping. The Impeccable layout and type detectors
returned no findings.

The complete Feature 25 regression gate passed 245 tests across 51 files. Formatting, zero-warning
linting, strict CLI and desktop type checking, Prisma schema validation, the CLI production build,
Windows x64 Electron packaging, compiled scope-lock smoke, and the production dependency audit all
passed. The database and worker services reported ready, and no known production vulnerabilities
were found. A generated-entry regression test and renderer-level development launch check confirm
Electron 43 resolves Forge's `.webpack/main` entry and displays the real workspace instead of its
native missing-module dialog.

The Markdown report was checked for the complete PRD section list, readable empty and partial
states, business-oriented impact and recommendation text, evidence labels, page failures,
category and severity navigation, a 30-day action plan, and explicit audit limitations.
Untrusted Markdown-like input is escaped by regression tests.

The JSON report is two-space formatted, newline-terminated, schema-versioned, and round-trips
through `auditResultSchema` without transformation. The persisted object exactly matches the
returned object and contains final output paths.

## Failure and Cleanup Evidence

- Individual crawl page failures remain in `scannedPages` while the crawl continues.
- Accessibility and Lighthouse page failures do not stop later pages.
- Scanner and browser failures become informational operational findings and do not lower score.
- A crawl failure still produces partial summary PDF, full PDF, HTML, Markdown, and JSON reports.
- Audit deadline expiry produces a partial result.
- Browser contexts, browsers, Lighthouse Chrome, PDF renderer contexts, temporary files, fixture
  servers, and temporary output directories are closed or removed in `finally` paths covered by
  tests.

## Regression Commands

```powershell
pnpm exec prettier --check .
pnpm exec eslint . --max-warnings 0
pnpm exec tsc --noEmit --pretty false
pnpm exec vitest run
node 'C:\nodejs\node_modules\npm\bin\npm-cli.js' run build
pnpm --registry=https://registry.npmjs.org/ audit --prod
```

## Remaining Manual Review

Automated validation does not replace manual WCAG review, real-device UX testing, authorized
analytics verification, legal/privacy review, penetration testing, or production load testing.
Those activities require appropriate expertise, authorization, environments, and test data.
