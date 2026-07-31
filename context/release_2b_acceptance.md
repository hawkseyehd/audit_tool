# Release 2B Acceptance

## Status

Accepted on 2026-07-31.

## Functional Evidence

- Campaign creation, approved-source import, source-record deduplication, provenance, qualification,
  explicit promotion, suppression, and interrupted-campaign recovery are covered in one
  deterministic Release 2B workflow.
- No client exists before the deliberate promotion command.
- Promotion creates or links exactly one client and retains the original prospect and source
  records.
- Promotion does not start page discovery, an audit, outreach, or form submission.
- Exact domain conflicts require explicit linking. Fuzzy candidates remain review-only.
- A 120-record prospect fixture verifies database filtering, stable sorting, and pagination.

## Compliance Review

- The Playwright provider retains only documented public business fields and source provenance.
- Provider credentials are not required and no discovery API is called.
- Suppression persists independently and prevents silent re-import.
- Retention metadata and last-verified timestamps remain attached to source records.
- Existing logger, crawler, scanner, IPC, and report tests verify redaction of authorization,
  cookie, and secret values.
- No personal profiles, sensitive-trait inference, automatic outreach, form submission, CAPTCHA
  bypass, access-control evasion, or private-network targeting is implemented.

## Threat Review

| Boundary | Control and evidence |
| --- | --- |
| Renderer to main | Purpose-specific preload API, Zod validation, trusted sender and main-frame checks |
| Network targets | URL normalization, same-domain scope, SSRF and private-network blocking |
| Browser work | Bounded pages, redirects, retries, response size, timeouts, cancellation, and cleanup |
| Provider collection | Rendered public fields only, explicit allowlist, provenance, retention, suppression |
| Promotion | Qualified state required, explicit command, idempotency, normalized-domain conflict handling |
| Files and reports | Trusted database identifiers resolve paths; renderer does not provide arbitrary paths |
| Electron runtime | Context isolation, sandboxing, disabled Node integration, hardened Electron fuses |

No unresolved critical or high-risk threat was identified within the documented local,
single-organization Release 2B scope.

## Quality Gates

- Formatting: passed.
- ESLint with zero warnings: passed.
- Strict CLI and desktop TypeScript: passed.
- Prisma schema validation and generation: passed.
- Tests: 289 passed across 63 files.
- Production build: passed.
- Production dependency audit: no known vulnerabilities.
- Impeccable detector: no findings.
- Windows x64 package inspection: passed with ASAR, Prisma, Lighthouse, Playwright, bundled Chromium,
  Squirrel installer, and required worker entries present.
- Accessibility and responsive smoke: passed for overview, clients, page inventory, prospects,
  prospect detail, campaigns, campaign form, audits, and reports at 1280 x 820 and 900 x 700.
- Keyboard focus reached a visible interactive control.

## Recovery and Cleanup

- Interrupted audit jobs recover into the durable queue with a warning.
- Interrupted discovery campaigns recover into a paused, resumable state.
- Duplicate active work is rejected.
- Audit and discovery cancellation and retry paths are covered.
- Browser, inspection, scanner, worker, and temporary-directory cleanup paths are covered for
  success, failure, timeout, and cancellation.

## Release Notes

The Windows package contains a bundled Chromium runtime and is therefore large. Package inspection
recorded a 359 MB ASAR and 722 MB browser resource. The development-bundle smoke was used for
Playwright instrumentation after package inspection; the actual packaged executable was also
confirmed to launch, while its hardened fuses prevent loading the packaged ASAR through the
development Electron binary.
