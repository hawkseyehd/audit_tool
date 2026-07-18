# Current Feature: Page Classification

## Status

Completed

## Branch

`feature/page-classification`

## Objective

Classify every crawled page with deterministic, explainable rules based on its URL,
metadata, headings, forms, and high-value UI patterns. Make those classifications usable
for scanner ordering and later report grouping.

## Included Scope

- Extract bounded classification signals during the crawler's existing Cheerio parse.
- Inspect URL paths, titles, headings, forms, controls, and interactive labels.
- Detect checkout, booking, and authentication patterns without submitting forms or
  retaining field values.
- Support every MVP page type defined in the PRD.
- Return a classification score, confidence, and non-sensitive matched-signal reasons.
- Store the selected page type on successful and failed crawl records.
- Provide deterministic page ordering for downstream scanners.
- Export stable classifier types and functions through the public package entry point.

## Excluded Scope

- Playwright rendering, screenshots, and client-side UI inspection.
- SEO, forms, security, UX, performance, and accessibility findings.
- Final report grouping and report generation.
- Machine-learned or remote classification services.

## Acceptance Criteria

- Root URLs classify as `home`.
- URL, title, and heading signals contribute independently to classification.
- Form-only pages classify as `form` when no more specific type wins.
- Password controls identify auth flows.
- Payment controls identify checkout flows.
- Date/time controls and booking language identify booking flows.
- Ambiguous pages resolve with documented deterministic precedence.
- Empty or unmatched pages classify as `unknown`.
- Extracted signals are bounded and never include entered field values.
- Every successful crawl record stores its classification.
- Failed pages receive the best URL-only classification available.
- Downstream scanner ordering is stable and does not mutate its input.
- All project quality and dependency gates pass.

## Verification Plan

1. Run classifier tests covering all page types, ambiguity, and UI signals.
2. Run extractor and crawler integration tests for classification storage.
3. Run formatting, linting, and strict type checking.
4. Run the full test suite and exact npm build.
5. Run production dependency and peer checks.

## History

- 2026-07-18: Project Foundation completed in commit `ee81681`.
- 2026-07-18: CLI Feature Set completed in commit `8eefd54`.
- 2026-07-18: URL Normalization and Crawl-Scope Safety completed in commit `3008d18`.
- 2026-07-18: Same-Domain Crawler completed in commit `ff859c1`.
- 2026-07-18: Page Classification documented and started.
- 2026-07-18: Implemented deterministic page classification from URL paths, titles,
  headings, form metadata, payment controls, scheduling controls, password controls, and
  interactive labels.
- 2026-07-18: Connected bounded DOM signal extraction and page-type storage to successful
  and failed crawler records, and added stable downstream scanner ordering.
- 2026-07-18: Added an LF repository policy for reproducible formatting on Windows.
- 2026-07-18: Verified repository formatting, linting, strict type checking, 109 tests,
  exact npm build, dependency compatibility, and a clean production dependency audit.
