# Current Feature: URL Normalization and Crawl-Scope Safety

## Status

Completed

## Branch

`feature/url-normalization`

## Objective

Create the canonical URL boundary used by the crawler and scanners. It must normalize
equivalent URLs, reject unsupported or unsafe targets, filter non-page links, and enforce
the configured crawl scope before network or browser navigation.

## Included Scope

- Accept HTTP and HTTPS URLs with or without a protocol.
- Default missing protocols to HTTPS.
- Remove fragments and normalize host casing, default ports, path trailing slashes, and
  query ordering.
- Preserve root paths and meaningful query values.
- Deduplicate canonical URLs while preserving discovery order.
- Resolve relative links against a base page.
- Reject credentials and unsupported schemes.
- Reject mail, telephone, JavaScript, data, and file links.
- Reject downloadable/non-page resources and known social-media destinations.
- Restrict candidates to the target hostname, matching explicit port, and configured
  allowed domains.
- Block localhost, private, loopback, link-local, reserved, multicast, and cloud-metadata
  destinations through literal-IP and DNS resolution checks.
- Expose structured rejection reasons for crawler diagnostics.

## Excluded Scope

- Fetching pages or parsing HTML.
- Crawl queues, priorities, concurrency, delays, retries, and persistence.
- Redirect following; later network code must revalidate every redirect with this module.
- Page classification, browser inspection, and scanners.

## Acceptance Criteria

- Equivalent URL forms produce one canonical URL.
- Fragments never affect deduplication.
- Relative same-scope page links are accepted.
- Unsupported, external, social, and downloadable links have explicit rejection reasons.
- Explicit ports cannot escape the original target scope.
- Private and sensitive network destinations are rejected before navigation.
- DNS results are injectable and fully testable without public network access.
- Unit tests cover normalization, filtering, scope, deduplication, and SSRF boundaries.
- All project quality and dependency gates pass.

## Verification Plan

1. Run focused URL and network-safety tests.
2. Run formatting and linting.
3. Run strict TypeScript checks.
4. Run the full test suite.
5. Run `npm run build`.
6. Run production dependency and peer checks.

## History

- 2026-07-18: Project Foundation completed in commit `ee81681`.
- 2026-07-18: CLI Feature Set completed in commit `8eefd54`.
- 2026-07-18: URL Normalization and Crawl-Scope Safety documented and started.
- 2026-07-18: Implemented canonical target/discovered URL normalization, stable
  deduplication, structured crawl-candidate decisions, hostname and port scope, and
  DNS-injectable public-network enforcement.
- 2026-07-18: Verified formatting, linting, strict type checking, 73 tests, pnpm and npm
  builds, peer compatibility, and a clean production dependency audit.
