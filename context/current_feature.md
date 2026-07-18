# Current Feature: Scoring Engine

## Status

Completed

## Branch

`feature/scoring-engine`

## Objective

Calculate deterministic category and overall audit scores from normalized findings using the
PRD severity penalties and category weights, then produce schema-valid finding counts and
client-ready top priorities.

## Included Scope

- Apply the exact Critical, High, Medium, Low, and Info penalties from the PRD.
- Map every canonical finding category into one of six weighted score groups.
- Clamp category and overall scores between 0 and 100.
- Count findings by severity, including informational findings.
- Select deterministic, deduplicated top priority titles from actionable findings.
- Keep scoring pure and independent from browser, network, CLI, and filesystem code.

## Excluded Scope

- Persisting or presenting scores in Markdown or JSON reports.
- Scanner orchestration or scanner failure policy.
- Dynamic, user-configurable weights outside the PRD.

## Acceptance Criteria

- Severity penalties and category weights match the PRD exactly.
- Every finding category contributes to exactly one score group.
- Empty findings produce 100 scores, zero counts, and no priorities.
- Heavy penalties cannot produce negative scores.
- Summary output passes the canonical `auditSummarySchema`.
- All project quality and dependency gates pass.

## History

- 2026-07-18: Features 1-13 completed through commit `2d4716b`.
- 2026-07-18: Scoring Engine documented and started.
- 2026-07-18: Added the exact PRD penalties and six weighted category groups, with every
  canonical finding category mapped exactly once.
- 2026-07-18: Added pure category and overall score calculation, 0-100 clamping, severity
  counts, and deterministic deduplicated top-priority selection.
- 2026-07-18: Verified formatting, linting, strict type checking, 177 tests, exact npm build,
  and a clean production dependency audit.
