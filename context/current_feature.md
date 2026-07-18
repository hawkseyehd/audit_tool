# Current Feature: Same-Domain Crawler

## Status

Completed

## Branch

`feature/crawler`

## Objective

Build a polite, bounded crawler that visits the normalized target, extracts and
prioritizes safe same-scope links, records page metadata and failures, and writes a stable
JSON crawl artifact for later classifiers and scanners.

## Included Scope

- Fetch public HTTP/HTTPS pages with explicit timeouts and a descriptive user agent.
- Revalidate DNS/network safety before every request and redirect.
- Follow redirects manually within configured limits and crawl scope.
- Bound response bodies and parse only HTML/XHTML content.
- Extract page title and links with Cheerio.
- Deduplicate canonical URLs before queueing.
- Respect `maxPages`, concurrency 1-3, crawl delay, retries, and total audit cancellation.
- Prioritize homepage, contact, pricing, services, products, about, booking, checkout,
  signup, and login pages.
- Continue after individual page failures and record safe error metadata.
- Produce deterministic crawl statistics and rejection counts.
- Atomically write `crawl-result.json` in the audit JSON output directory.

## Excluded Scope

- Page classification beyond temporary `unknown` page types.
- Playwright/browser rendering and screenshots.
- Lighthouse, axe, and domain scanners.
- Scoring and client-ready report generation.

## Acceptance Criteria

- The starting page is attempted first.
- No more than `maxPages` pages are attempted.
- Duplicate, rejected, external, and unsafe URLs never enter the queue.
- High-value pages are visited before lower-value pages discovered in the same batch.
- Concurrency never exceeds the validated configuration.
- Transient failures retry within limits; permanent failures do not.
- One failed page does not stop the crawl.
- Redirect destinations are revalidated before fetching.
- Crawl output validates against a stable schema and is written atomically.
- Tests use controlled fakes and local response fixtures, never public websites.
- All project quality and dependency gates pass.

## Verification Plan

1. Run crawler, extractor, HTTP adapter, priority, and output-writer tests.
2. Run formatting, linting, and strict type checking.
3. Run the full test suite.
4. Run `npm run build`.
5. Run production dependency and peer checks.

## History

- 2026-07-18: Project Foundation completed in commit `ee81681`.
- 2026-07-18: CLI Feature Set completed in commit `8eefd54`.
- 2026-07-18: URL Normalization and Crawl-Scope Safety completed in commit `3008d18`.
- 2026-07-18: Same-Domain Crawler documented and started.
- 2026-07-18: Implemented bounded HTTP fetching, redirect revalidation, streamed response
  limits, Cheerio extraction, deterministic priority batches, retry/backoff, partial
  failure recording, crawl schemas, and atomic crawl-result output.
- 2026-07-18: Connected the crawler to the CLI so audit commands persist real crawl
  metadata and report the attempted-page count.
- 2026-07-18: Verified formatting, linting, strict type checking, 85 tests, exact npm
  build, peer compatibility, and a clean production dependency audit.
