# Current Feature: Client Business Summary PDF

## Status

Completed

## Branch

`feature/client-business-summary`

## Objective

Add a separate, client-only `Website Improvement Summary` PDF that explains every identified
improvement through its likely business effect and remains no longer than three A4 pages.

## Included Scope

- Generate `pdf/client-summary.pdf` alongside the existing summary and technical report.
- Keep the document to exactly three logical A4 pages for empty, typical, and high-volume audits.
- Show the website name, overall score with a plain-language verdict, and pages reviewed.
- Group every finding deterministically into four client-facing business outcomes:
  enquiries and conversion, visibility and acquisition, trust and access, and measurement and
  operations.
- Highlight the most important business risks using canonical finding impact and recommendation
  content without inventing claims.
- Represent smaller findings through business-outcome aggregates so none are silently omitted.
- Replace severity-led scheduling with an issue-driven order of work: act now, improve next, and
  strengthen over time.
- Show one discreet completeness note only when one or more recorded pages contain an inspection
  error.
- Remove audit IDs, timestamps, scanner names, evidence details, technical scope tables,
  certification language, and references to other report files.
- Reuse the secured batched Playwright renderer and existing report design tokens.
- Add schema, configuration, CLI, receipt, orchestration, tests, and documentation support.
- Use the project-local Impeccable skill and PDF render-and-inspect workflow.

## Excluded Scope

- Replacing or removing `audit-summary.pdf` or `audit-report.pdf`.
- Agency branding, custom client branding, logos, hosted assets, or screenshots.
- AI-authored narrative, quantified commercial forecasts, or changes to canonical findings and
  scoring.
- Audit methodology, execution history, technical evidence, and implementation-level detail.

## Acceptance Criteria

- Default audits write `pdf/client-summary.pdf` in addition to existing outputs.
- `--client-summary-pdf` writes only the client business summary.
- The title is `Website Improvement Summary` and the detected website name is prominent.
- Pages reviewed is visible, while audit ID, timestamps, scanner details, technical limitations,
  and other report references are absent.
- Every finding contributes to exactly one business-outcome group and the displayed total matches
  the canonical finding count.
- Priority content is deterministic, safely escaped, bounded, and phrased from canonical impact
  and recommendation fields.
- The final PDF has exactly three A4 pages, including empty and high-volume fixtures.
- Partial coverage is communicated in one plain-language sentence without exposing audit
  mechanics.
- PDF rendering remains script-disabled, network-blocked, tagged, signature-validated, atomic,
  and cleanup-safe.
- All pages pass visual inspection without clipping, overlap, blank pages, or broken pagination.
- Formatting, linting, type checking, unit, integration, end-to-end, build, and dependency gates
  pass.

## History

- 2026-07-21: Feature approved with pages reviewed retained as the sole client-visible scope
  metric.
- 2026-07-21: Implemented and validated the default and selective CLI output, deterministic
  business-outcome mapping, exact three-page layout, secured PDF rendering, and regression
  coverage. Representative, empty, and maximum-valid-content PDFs each rendered as three tagged,
  nonblank A4 pages.
