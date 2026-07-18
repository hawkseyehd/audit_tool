# Website Audit Tool

A Node.js and TypeScript CLI that audits public business websites and turns technical evidence
into prioritized, client-ready findings.

## Shipped Capabilities

- Same-domain crawler with URL normalization, page limits, prioritization, retries, and SSRF
  protection.
- Page classification for home, contact, service, product, pricing, about, blog, form, checkout,
  booking, authentication, and unknown pages.
- Playwright browser inspection and bounded desktop/mobile screenshots.
- SEO, form, security/privacy, conversion UX, analytics, Lighthouse, and axe scanners.
- Evidence-rich normalized findings with severity, impact, and recommendations.
- Weighted category and overall scoring with top-priority fixes.
- Concise client summary PDF, evidence-rich A4 PDF, standalone HTML, and Markdown reports, plus
  stable schema-versioned JSON.
- Partial-result handling when an individual page or scanner fails.

## Requirements

- Node.js 22 or newer
- pnpm 11
- Chromium installed through Playwright

## Setup

```bash
pnpm install
pnpm browser:install
pnpm build
```

## Run An Audit

Build first, then run the compiled CLI:

```bash
node dist/cli/index.js audit https://example.com
```

Common options:

```bash
node dist/cli/index.js audit https://example.com \
  --max-pages 20 \
  --mobile \
  --desktop \
  --output ./reports/example \
  --html \
  --json \
  --markdown \
  --pdf \
  --summary-pdf \
  --no-submit-forms
```

Use `node dist/cli/index.js audit --help` for the complete command help. When no output-format
flag is specified, the summary PDF, full PDF, HTML, JSON, and Markdown are written. Supplying one
or more of `--summary-pdf`, `--pdf`, `--html`, `--json`, or `--markdown` writes only the selected
formats. Desktop is the default viewport.

## Output

Each run creates an audit-specific directory under the configured output root:

```text
reports/
  audit-<timestamp>-<uuid>/
    html/
      audit-report.html
    json/
      audit-result.json
    markdown/
      audit-report.md
    pdf/
      audit-summary.pdf
      audit-report.pdf
    screenshots/
      *.png
```

`audit-summary.pdf` is a compact decision document with the score, issue landscape, up to six
priority issues, a 30-day plan, and scope limitations. `audit-report.pdf` and the standalone HTML
report retain complete findings and available audit-local screenshot evidence. PDF rendering
disables JavaScript, blocks non-local requests, uses no remote fonts or assets, and adds
page-numbered footers. The JSON artifact is validated against the canonical `AuditResult` schema
and includes the schema version, target, scanned pages, summary, findings, evidence, and output
paths.

## Development

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --registry=https://registry.npmjs.org/ audit --prod
```

The normal test suite includes unit, integration, and CLI acceptance coverage. Browser tests use
controlled local fixture sites and do not depend on public websites.

## Safety

- Forms are not submitted by default and the MVP does not interact with page controls.
- Crawling and browser requests remain in configured domain scope and reject private-network
  targets in production adapters.
- Security checks are passive basics, not penetration testing.
- Raw page HTML and cookie values are not persisted in the canonical audit result.
- Client report rendering cannot execute audited scripts or load remote report assets.
- Concurrency, retries, redirects, response size, page count, screenshots, browser navigation,
  Lighthouse pages, and total audit duration are bounded.

## Limitations

Automated results do not prove WCAG conformance, legal/privacy compliance, field performance,
security posture, analytics correctness, or successful authenticated and transactional workflows.
Use the report as a professional first-pass audit and complete the relevant manual specialist
reviews.

## Project Records

- Product requirements: `context/PRD.md`
- Ordered features: `context/feature_list_in_order.md`
- Coding standards: `context/conding_standards.md`
- QA validation: `context/qa_validation.md`
- MVP acceptance: `context/mvp_acceptance.md`
- Post-MVP backlog: `context/post_mvp_backlog.md`
