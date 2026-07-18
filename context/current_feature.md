# Current Feature: Accessibility Scanner

## Status

Completed

## Branch

`feature/accessibility-scanner`

## Objective

Run bounded axe checks on selected desktop and mobile pages, normalize violations into
evidence-rich findings, tolerate page failures, and state that automation does not replace
manual WCAG review.

## Included Scope

- Prioritize successful classified pages and bound scans by the configured page limit.
- Run isolated desktop and mobile axe checks with one shared browser per audit.
- Apply crawl-scope and public-network policy to browser requests.
- Block WebSockets, downloads, and dialogs without interacting with page controls.
- Continue after page failures and close page contexts and the browser in all outcomes.
- Normalize axe violations into deterministic, schema-valid findings with bounded selectors.
- Export the required automated-testing limitation for report generation.

## Excluded Scope

- Claims of WCAG conformance or replacement of manual accessibility review.
- Form submission, authentication, or other state-changing page interactions.
- Unlimited page scans or concurrent browser contexts.

## Acceptance Criteria

- Axe failures do not stop remaining pages.
- Violations produce deterministic schema-valid findings with bounded selectors.
- Desktop and mobile modes are supported and browser resources always close.
- The manual-review disclaimer is mandatory and exported.
- All project quality and dependency gates pass.

## History

- 2026-07-18: Features 1-12 completed through commit `4e1942a`.
- 2026-07-18: Accessibility Scanner documented and started.
- 2026-07-18: Added prioritized, bounded desktop/mobile axe execution with request safety,
  per-page failure isolation, cancellation, and guaranteed browser cleanup.
- 2026-07-18: Added deterministic violation normalization, severity mapping, bounded selector
  evidence, and the mandatory manual-review disclaimer.
- 2026-07-18: Verified a real local Playwright/axe run on both viewports, formatting, linting,
  strict type checking, 171 tests, exact npm build, dependency compatibility, and a clean
  production dependency audit.
