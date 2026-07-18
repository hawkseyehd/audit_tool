# Current Feature: SEO Scanner

## Status

Completed

## Branch

`feature/seo-scanner`

## Objective

Create a deterministic SEO scanner that extracts bounded page facts, checks metadata and
document structure, verifies public site resources, identifies known broken internal
links, and emits client-ready findings with concrete evidence.

## Included Scope

- Add a shared typed scanner contract for current and future scanners.
- Extract bounded SEO facts from static HTML without retaining raw page content.
- Check title presence and length.
- Check meta-description presence and length.
- Check canonical-link presence, validity, and origin consistency.
- Check robots directives on high-value pages.
- Check H1 count and heading-level progression.
- Check image alternative-text presence.
- Check placeholder and non-crawlable internal links.
- Check JSON-LD structured-data presence and syntax.
- Fetch `robots.txt` and sitemap candidates with timeouts, redirect scope checks, response
  bounds, and public-network validation.
- Detect known broken internal links from crawl status and failure evidence.
- Convert every issue into a validated SEO `AuditFinding` with severity, impact,
  recommendation, page URL, and evidence.

## Excluded Scope

- Keyword research, backlink analysis, ranking data, or search-console integrations.
- JavaScript-rendered metadata beyond facts supplied by the browser layer.
- Deep schema.org semantic validation.
- External-link crawling.
- Automatic content rewriting.
- Final scoring and report rendering.

## Acceptance Criteria

- Page extraction is bounded and never stores complete HTML or user-entered values.
- All MVP metadata and content-structure checks are implemented.
- Important pages with `noindex` produce high-severity findings.
- Missing optional structured data is described without overstating certainty.
- Site-resource requests remain in scope and reject private-network targets.
- Redirects are bounded and revalidated.
- Broken-link findings rely only on known crawl outcomes.
- Finding IDs and ordering are deterministic.
- Findings validate against the canonical audit-finding schema.
- One page or resource failure does not suppress other SEO findings.
- Tests use HTML fixtures and injected HTTP adapters, never public websites.
- All project quality and dependency gates pass.

## Verification Plan

1. Run snapshot extraction and each page-rule test.
2. Run resource-discovery, redirect, safety, and response-bound tests.
3. Run broken-link and finding-schema tests.
4. Run formatting, linting, strict type checking, and the full test suite.
5. Run exact npm build, dependency compatibility, and production security checks.

## History

- 2026-07-18: Project Foundation completed in commit `ee81681`.
- 2026-07-18: CLI Feature Set completed in commit `8eefd54`.
- 2026-07-18: URL Normalization and Crawl-Scope Safety completed in commit `3008d18`.
- 2026-07-18: Same-Domain Crawler completed in commit `ff859c1`.
- 2026-07-18: Page Classification completed in commit `aa092f7`.
- 2026-07-18: Browser Inspection and Evidence completed in commit `13ef0bd`.
- 2026-07-18: SEO Scanner documented and started.
- 2026-07-18: Added a reusable scanner contract and bounded SEO snapshot extraction for
  metadata, canonical links, robots directives, headings, images, internal links, and
  JSON-LD syntax.
- 2026-07-18: Implemented deterministic page-level SEO rules, known broken-link checks,
  site-resource checks, stable finding IDs, and schema-validated business-facing findings.
- 2026-07-18: Added public-safe robots.txt and sitemap discovery with redirect scope,
  request timeout, response bounds, cancellation, and network-safety enforcement.
- 2026-07-18: Verified repository formatting, linting, strict type checking, 142 tests,
  exact npm build, dependency compatibility, and a clean production dependency audit.
