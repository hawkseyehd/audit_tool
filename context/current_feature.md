# Current Feature: Testing and QA

## Status

Completed

## Branch

`feature/testing-qa`

## Objective

Harden the completed MVP with repeatable local integration coverage, a requirements-based test
inventory, low-impact public-safe validation, and documented evidence that outputs remain useful
and partial failures do not terminate an audit.

## Included Scope

- Confirm required URL, config, classification, scanner, scoring, and report unit coverage.
- Add a controlled local fixture server and real browser/axe orchestration integration test.
- Validate crawl, screenshots, scanner integration, scoring, Markdown, JSON, and cleanup together.
- Run one-request crawl checks against five public-safe pages outside the normal test suite.
- Document validation scope, results, performance, limitations, and regression commands.
- Re-run all static, test, build, and dependency gates.

## Excluded Scope

- Making public websites part of the repeatable automated test suite.
- Load, penetration, authenticated, destructive, or form-submission testing.
- Arbitrary public-site Lighthouse runs or claims of third-party site quality.

## Acceptance Criteria

- Normal tests remain deterministic and depend only on local controlled fixtures.
- Real Chromium and axe behavior is exercised in a repeatable integration test.
- Five public-safe targets receive at most one crawl request each during manual validation.
- Reports remain schema-valid, readable, evidence-rich, and explicit about partial results.
- Every required QA area has test or documented validation evidence.
- All project quality and dependency gates pass.

## History

- 2026-07-18: Features 1-17 completed through commit `08ff4c2`.
- 2026-07-18: Testing and QA documented and started.
- 2026-07-18: Added a controlled two-page fixture site and repeatable integration test covering
  real Chromium and axe on desktop/mobile, all static scanners, scoring, screenshots, reports,
  schema validation, sensitive-data exclusion, and cleanup.
- 2026-07-18: Completed sequential one-page, no-retry crawler validation against five public-safe
  reference sites; all five returned HTTP 200 with one successful page.
- 2026-07-18: Documented the automated coverage inventory, local and public-safe results, report
  review, failure/cleanup evidence, regression commands, and remaining manual review.
- 2026-07-18: Verified formatting, linting, strict type checking, 192 tests, exact npm build,
  and a clean production dependency audit.
