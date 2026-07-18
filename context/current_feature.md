# Current Feature: Security and Privacy Scanner

## Status

Completed

## Branch

`feature/security-privacy-scanner`

## Objective

Assess public HTTPS, response-header, cookie-flag, mixed-content, and privacy signals using
non-invasive evidence only, then produce carefully scoped findings without claiming a
penetration test or legal compliance review.

## Included Scope

- Capture HTTPS and optional HTTP-to-HTTPS redirect evidence.
- Check mixed-content references in HTTPS page markup.
- Check HSTS, CSP, content-type protection, frame protection, referrer policy, and
  permissions policy.
- Parse discrete Set-Cookie headers and check Secure, HttpOnly, and SameSite flags.
- Detect privacy-policy links and common consent-interface signals.
- Emit deterministic, schema-valid security and privacy findings with limitations.

## Excluded Scope

- Penetration testing, vulnerability exploitation, port scanning, or payload injection.
- Authentication bypass, paywall testing, or access-control testing.
- TLS cipher/certificate-chain analysis beyond observed HTTPS use.
- Legal conclusions about privacy or cookie compliance.

## Acceptance Criteria

- Scanner remains read-only and public-safe.
- Header matching is case-insensitive and evidence-based.
- Cookie values are never retained in snapshots or findings.
- Mixed-content evidence is bounded.
- Missing headers account for equivalent frame protection in CSP.
- Findings explain automated-audit limitations and avoid absolute compliance claims.
- Tests use controlled headers and HTML fixtures.
- All project quality and dependency gates pass.

## History

- 2026-07-18: Project Foundation completed in commit `ee81681`.
- 2026-07-18: CLI Feature Set completed in commit `8eefd54`.
- 2026-07-18: URL Normalization and Crawl-Scope Safety completed in commit `3008d18`.
- 2026-07-18: Same-Domain Crawler completed in commit `ff859c1`.
- 2026-07-18: Page Classification completed in commit `aa092f7`.
- 2026-07-18: Browser Inspection and Evidence completed in commit `13ef0bd`.
- 2026-07-18: SEO Scanner completed in commit `b0ba224`.
- 2026-07-18: Form Scanner completed in commit `f5d3c96`.
- 2026-07-18: Security and Privacy Scanner documented and started.
- 2026-07-18: Added bounded HTTPS, response-header, cookie-flag, mixed-content, privacy-link,
  and consent-signal extraction that never retains cookie values.
- 2026-07-18: Implemented deterministic security and privacy findings with CSP frame-policy
  equivalence and explicit non-invasive, non-compliance limitations.
- 2026-07-18: Verified repository formatting, linting, strict type checking, 152 tests,
  exact npm build, dependency compatibility, and a clean production dependency audit.
