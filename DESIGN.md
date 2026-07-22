# Client Report Design System

## Direction

The report uses a restrained consultancy-document visual lane. It should feel prepared by a
careful expert: structured, legible, and confident, with enough visual hierarchy to help a client
understand the audit quickly.

## Identity

- Full report title: `Audit Report`.
- Audit summary title: `Audit Summary`.
- Client business summary title: `Website Improvement Summary`.
- Site name: the first useful scanned page title; otherwise the target hostname.
- No logo or agency brand in the first version.
- A4 is the canonical print format.

## Color Tokens

- Paper: `#ffffff`.
- Canvas: `#eef2f7` for screen-only report surroundings.
- Ink: `#152033`.
- Muted ink: `#5d697a`.
- Rule: `#d8e0ea`.
- Primary cobalt: `#1f5fbf`.
- Primary tint: `#eaf2ff`.
- Critical: `#b42318` with `#feeceb` tint.
- High: `#c2410c` with `#fff0e6` tint.
- Medium: `#a15c00` with `#fff6d8` tint.
- Low: `#176b52` with `#e8f7f1` tint.
- Informational: `#36618f` with `#edf4fb` tint.

All colored status treatments include a text label and maintain print-readable contrast.

## Typography

- System sans-serif stack for deterministic rendering and no font licensing dependency.
- Body copy: 10pt in PDF, 1.5 line height.
- Report title: 30pt on the cover only.
- Section title: 18pt.
- Subsection title: 12pt.
- Labels and metadata: 8-9pt with normal letter spacing.
- Long URLs and identifiers may wrap anywhere without clipping.

## Layout

- A4 pages with a 16mm content margin plus print header and footer space.
- Cover prioritizes title, site identity, score, audit date, target URL, and audit ID.
- Executive summary precedes detailed evidence.
- Repeated findings are individual bordered records, not nested cards.
- Dense tables use repeating headers and avoid row splits where practical.
- Findings, screenshots, and recommendations may flow across pages without fixed-height shells.
- The audit summary uses 3-5 logical pages: decision snapshot, issue landscape, up to two priority
  pages, and a compact action and scope page.
- The audit summary caps priority issues at six and omits screenshots, selectors, long URLs, and
  full evidence so the document remains bounded regardless of audit size.
- The client business summary is exactly three logical pages: business snapshot, complete
  business-impact account, and recommended order of work.
- The client business summary uses full-width rows and compact status labels. It does not use
  numbered section scaffolding or decorative side stripes.

## Core Components

- Score ring: overall score with a written rating.
- Severity summary: labeled counts for critical through informational findings.
- Category score table: score, rating, and progress indicator.
- Priority list: ranked actions from the canonical audit summary.
- Scope table: scanned pages, page type, HTTP status, and inspection state.
- Finding record: severity, category, title, URL, description, impact, recommendation, and evidence.
- Action plan: immediate, near-term, and follow-up phases derived from severity.
- Limitation panel: automated-review boundaries and manual accessibility disclaimer.
- Business outcome group: enquiries and conversion, visibility and acquisition, trust and access,
  or measurement and operations.
- Client action phases: act now, improve next, and strengthen over time.

## Content Rules

- Treat every audited title, URL, selector, finding, and evidence value as untrusted text.
- Preserve canonical scores and finding meaning; presentation cannot invent or reinterpret data.
- Use explicit empty states for sections with no findings or pages.
- Use UTC audit timestamps with a human-readable date and time.
- Keep complete technical details in the full audit report, even when its executive area is
  concise.
- Keep both summaries written for general business decision-makers. Use canonical counts, scores,
  impact, and recommendations without inventing narrative or business claims.
- Account for every finding in the audit summary through aggregate category and severity counts,
  then direct readers to `audit-report.pdf` for complete evidence and remediation detail.
- Account for every finding exactly once in the client business summary through deterministic
  business-outcome groups.
- In the client business summary, retain only pages reviewed as a scope signal. Omit audit IDs,
  dates, durations, scanner names, evidence, methodology, certification language, technical scope
  tables, and references to other report files.

## Print Behavior

- Print backgrounds are enabled.
- Links remain visible and clickable.
- Full and audit-summary footers show the document title, site name, audit ID, and `Page X of Y`.
- The client business summary footer shows only its title, the site name, and `Page X of Y`.
- Avoid orphaned headings, clipped content, blank trailing pages, and split status labels.
