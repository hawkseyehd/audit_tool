# QA Validation Record

## Scope

This record covers the Website Audit Tool MVP through Feature 18. It records repeatable local
test coverage and one-time public-safe connectivity validation performed on 2026-07-18. It is
not a quality assessment of the external sites and does not authorize invasive testing.

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
- Markdown escaping, required report sections, partial/empty states, and atomic persistence.
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
6. Scoring, screenshots, Markdown output, JSON output, schema validation, and cleanup.

The integration test completed in approximately five seconds on the validation machine. It
asserts that deliberate form, accessibility, and performance defects become findings; a
screenshot exists; both reports exist; required report sections are present; and raw HTML and
cookie values are absent from JSON.

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
- A crawl failure still produces partial Markdown and JSON reports.
- Audit deadline expiry produces a partial result.
- Browser contexts, browsers, Lighthouse Chrome, temporary files, fixture servers, and temporary
  output directories are closed or removed in `finally` paths covered by tests.

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
