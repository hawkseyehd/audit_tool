# Current Feature: Client Summary PDF

## Status

Completed

## Branch

`feature/pdf-summary-report`

## Objective

Add a compact, deterministic `Audit Summary` PDF for client decision-makers while preserving the
existing evidence-rich `Audit Report` as the technical record.

## Included Scope

- Generate `pdf/audit-summary.pdf` automatically alongside the full report.
- Keep the summary bounded to a concise 3-5 page target for representative audits.
- Lead with the website name, overall score, rating, scope, and issue counts.
- Explain the audit outcome in plain language using canonical scores and finding counts.
- Show no more than six priority issues with business impact and a recommended next step.
- Summarize every finding through severity and category counts, including findings not shown in
  the priority list.
- Provide a deterministic 30-day action plan and compact scope and limitations statement.
- Reference `audit-report.pdf` for detailed evidence, affected URLs, screenshots, and remediation.
- Reuse one secured Playwright session when both PDFs are requested.
- Add configuration, CLI selection, schemas, orchestration, receipts, tests, and documentation.
- Use the project-local Impeccable skill and the PDF render-and-inspect verification workflow.

## Excluded Scope

- Agency or client branding, custom themes, logos, and hosted assets.
- AI-authored narrative, inferred business claims, or changes to canonical scoring and findings.
- Screenshots and complete technical evidence in the summary PDF.
- PDF signing, encryption, email delivery, and archival storage.

## Acceptance Criteria

- A default audit writes both `pdf/audit-summary.pdf` and `pdf/audit-report.pdf`.
- `--summary-pdf` writes the summary without retaining full HTML or full PDF output.
- The title is `Audit Summary` and the detected website title is shown with hostname fallback.
- The report remains concise regardless of total finding count and clearly accounts for all
  findings through aggregate counts.
- Priority issues are deterministic, severity-aware, safely escaped, and capped at six.
- Empty and partial audit states remain clear and honest.
- PDF rendering disables JavaScript, blocks non-local requests, validates signatures, and cleans
  temporary artifacts on failure.
- Representative pages pass visual inspection at A4 dimensions without clipping, overlap, blank
  pages, or broken pagination.
- Unit, integration, formatting, linting, type checking, build, and dependency gates pass.

## History

- 2026-07-18: PM-02 full PDF report completed and merged as commit `b1805f9` on main.
- 2026-07-18: Client summary PDF extension started from the approved report design system.
- 2026-07-18: Implemented deterministic 3-5 page summary generation, six-issue priority cap,
  complete issue accounting, plain-language outcome states, 30-day plan, scope, and limitations.
- 2026-07-18: Added `--summary-pdf`, default output, schema and receipt paths, secured batched PDF
  rendering, atomic signature validation, cleanup, selective output, and documentation.
- 2026-07-18: Rendered and inspected all five pages of a representative client sample. Confirmed
  A4 dimensions, tagged output, no JavaScript, nonblank pages, stable footers, and no clipping,
  overlap, or broken pagination.
- 2026-07-18: Verified formatting, linting, strict type checking, 208 tests across 41 files, the
  exact Node 22 production build, and a production dependency audit with no known vulnerabilities.
