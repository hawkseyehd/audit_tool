# Current Feature: HTML Report Export

## Status

Completed

## Branch

`feature/html-report`

## Objective

Implement PM-01 as a deterministic, accessible, standalone HTML client report that preserves the
canonical audit semantics and becomes the presentation source for the PDF export.

## Included Scope

- Add a self-contained HTML report with no external runtime assets.
- Use semantic, accessible document structure and complete report details.
- Escape all website and scanner-controlled text before rendering.
- Add deterministic report ordering, explicit empty states, and print styles.
- Add an HTML output directory, schema path, configuration option, CLI flag, and receipt output.
- Preserve the existing default behavior while adding HTML to the default output set.
- Use the project-local Impeccable skill and documented report design system.

## Excluded Scope

- PDF file generation, which remains PM-02 and follows this dependency.
- Agency branding, custom themes, hosted assets, JavaScript, or interactive dashboard behavior.
- AI-authored narrative or changes to canonical scoring and finding semantics.

## Acceptance Criteria

- A complete audit writes `html/audit-report.html` by default.
- The HTML is standalone, UTF-8, semantically structured, and usable without network access.
- Every canonical finding detail and evidence field is represented.
- Untrusted audited content cannot inject markup, scripts, styles, or report structure.
- Long URLs and content remain readable in screen and print layouts.
- CLI selection and default output behavior cover HTML without regressing JSON or Markdown.
- Unit, integration, formatting, linting, type checking, build, and dependency gates pass.

## History

- 2026-07-18: PM-01 approved as the required presentation dependency for client PDF export.
- 2026-07-18: Neutral report identity, A4 print target, and Impeccable design direction confirmed.
- 2026-07-18: Implemented standalone semantic HTML with complete findings, deterministic ordering,
  audit-local screenshots, responsive and print styles, strict escaping, and atomic output writes.
- 2026-07-18: Added HTML output schema, configuration, CLI selection, receipts, orchestration,
  integration coverage, and end-to-end acceptance coverage.
- 2026-07-18: Verified formatting, linting, strict type checking, 197 tests, the exact Node 22
  production build, and a production dependency audit with no known vulnerabilities.
