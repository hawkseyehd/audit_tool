# Client Report Design System

## Direction

The report uses a restrained consultancy-document visual lane. It should feel prepared by a
careful expert: structured, legible, and confident, with enough visual hierarchy to help a client
understand the audit quickly.

## Identity

- Report title: `Audit Report`.
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

## Core Components

- Score ring: overall score with a written rating.
- Severity summary: labeled counts for critical through informational findings.
- Category score table: score, rating, and progress indicator.
- Priority list: ranked actions from the canonical audit summary.
- Scope table: scanned pages, page type, HTTP status, and inspection state.
- Finding record: severity, category, title, URL, description, impact, recommendation, and evidence.
- Action plan: immediate, near-term, and follow-up phases derived from severity.
- Limitation panel: automated-review boundaries and manual accessibility disclaimer.

## Content Rules

- Treat every audited title, URL, selector, finding, and evidence value as untrusted text.
- Preserve canonical scores and finding meaning; presentation cannot invent or reinterpret data.
- Use explicit empty states for sections with no findings or pages.
- Use UTC audit timestamps with a human-readable date and time.
- Keep complete technical details in the client report, even when the executive area is concise.

## Print Behavior

- Print backgrounds are enabled.
- Links remain visible and clickable.
- A compact footer shows `Audit Report`, the site name, the audit ID, and `Page X of Y`.
- Avoid orphaned headings, clipped content, blank trailing pages, and split status labels.
