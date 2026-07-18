# Current Feature: Lighthouse Performance Scanner

## Status

Completed

## Branch

`feature/lighthouse-scanner`

## Objective

Run bounded, sequential Lighthouse performance audits on prioritized pages and selected
viewports, normalize core metrics and opportunities, and emit evidence-based findings while
guaranteeing Chrome cleanup.

## Included Scope

- Prioritize homepage and high-value classified pages.
- Bound the number of Lighthouse pages and run sequentially for stability.
- Support mobile and desktop modes.
- Capture performance score, LCP, CLS, TBT, Speed Index, and FCP.
- Capture image, render-blocking, unused JavaScript, and unused CSS opportunities.
- Continue after individual Lighthouse failures and close Chrome in all outcomes.
- Convert thresholds into validated performance findings.

## Excluded Scope

- Lab metrics presented as field data or guaranteed real-user performance.
- Unlimited page runs or parallel Lighthouse processes.
- Persisting full Lighthouse reports in the normalized scanner result.

## Acceptance Criteria

- Mobile score below 50 creates a high-severity finding.
- LCP and other metrics use documented lab thresholds.
- Raw normalized metrics remain available as evidence.
- Runs are ordered, bounded, cancellable between pages, and failure-tolerant.
- Chrome closes after success and failure.
- All project quality and dependency gates pass.

## History

- 2026-07-18: Features 1-11 completed through commit `f4d5baf`.
- 2026-07-18: Lighthouse Performance Scanner documented and started.
- 2026-07-18: Added bounded, prioritized sequential desktop/mobile Lighthouse execution,
  normalized metrics and opportunities, partial failures, cancellation, and Chrome cleanup.
- 2026-07-18: Added threshold-based performance findings and completed a controlled real
  Lighthouse smoke run with a 99 score and normalized LCP evidence.
- 2026-07-18: Verified formatting, linting, strict type checking, 165 tests, exact npm
  build, dependency compatibility, and a clean production dependency audit.
