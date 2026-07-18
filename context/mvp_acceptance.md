# MVP Acceptance Record

## Decision

**Status: Passed**

The Website Audit Tool satisfies the MVP acceptance checklist in `PRD.md` and
`feature_list_in_order.md` as of 2026-07-18.

## Checklist Evidence

| Criterion | Status | Evidence |
| --- | --- | --- |
| One CLI command accepts a target URL | Pass | `tests/e2e/mvp-acceptance.test.ts` executes `website-audit audit <url> --max-pages 10 --output <dir> --desktop` through the production command parser and full runner; exit code is 0 and lifecycle is `completed`. |
| Crawl at least 10 same-domain pages | Pass | The acceptance result contains exactly 10 pages and asserts every page origin matches the fixture origin. |
| Detect forms and common form issues | Pass | The contact fixture contains a required placeholder-only email field without a label; normalized `forms` scanner findings are asserted. |
| Run Lighthouse on at least the homepage | Pass | The acceptance adapter records the homepage URL and produces normalized performance findings. Real Lighthouse process execution was separately validated in Features 12 and 17. |
| Run axe accessibility checks | Pass | The acceptance run uses real `@axe-core/playwright` against all selected pages and asserts normalized accessibility findings. |
| Produce a Markdown report | Pass | `audit-report.md` exists, is attached to `outputs.markdownReportPath`, and contains required report headings. |
| Produce structured JSON | Pass | `audit-result.json` exists, is attached to `outputs.jsonReportPath`, parses as JSON, and passes `auditResultSchema`. |
| Findings include severity, impact, recommendation, and evidence | Pass | The acceptance test iterates every persisted finding and asserts all required fields and evidence are present. |
| Do not submit forms by default | Pass | CLI config tests assert `submitForms: false`; the acceptance fixture records all requests and asserts no `POST` occurred. No orchestrator path performs control interaction or submission. |
| Continue when one page or scanner fails | Pass | Crawler, browser, accessibility, Lighthouse, and orchestrator tests cover page failures, scanner failures, crawl failure, deadline expiry, cleanup, and partial report generation. |

## Acceptance Run

The controlled acceptance site exposes a homepage plus contact, pricing, services, product,
about, blog, booking, checkout, and login routes. The run uses:

- Same-domain crawl with `maxPages=10`.
- Real Playwright Chromium browser inspection.
- Real axe desktop checks.
- Static SEO, form, security/privacy, UX, and analytics scanners.
- A deterministic Lighthouse adapter result for the homepage.
- Canonical scoring, Markdown output, and JSON output.

The focused acceptance test completed in approximately 9.6 seconds on the validation machine.
It is local, repeatable, isolated, and performs no public traffic.

## Safety Confirmation

- Form submission remains disabled by default and no POST request occurred.
- Browser sessions do not click controls or complete workflows.
- The security scanner performs observable passive checks, not exploitation.
- Public-network and same-domain policies remain enabled in production adapters.
- Raw HTML and cookie values are not persisted in audit JSON.
- Automated accessibility results retain the required manual-review limitation.

## Limitations

MVP acceptance does not claim WCAG conformance, penetration-test coverage, legal compliance,
field performance, production load capacity, or successful authenticated and transactional
workflows. Those require authorized specialist review beyond this MVP.
