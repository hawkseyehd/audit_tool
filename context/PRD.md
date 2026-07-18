# Product Requirements Document: Website Audit Tool

## 1. Product Overview

### Product Name

Website Audit Tool

### Purpose

Build a Node.js and TypeScript-based tool that audits business websites, forms, and key user journeys, then generates a structured written report with findings, severity levels, evidence, and recommended fixes.

The tool should help a professional web development or digital audit team quickly evaluate client websites across business clarity, UX, forms, accessibility, SEO, performance, security basics, analytics readiness, and technical quality.

### Product Vision

Create a repeatable audit system that turns raw website scans into practical business recommendations. The tool should not only say what is technically wrong, but explain why it matters to conversions, trust, accessibility, compliance risk, and maintainability.

## 2. Goals

### Primary Goals

- Accept a website URL and run an automated audit.
- Crawl important pages within the same domain.
- Inspect performance, accessibility, SEO, forms, security basics, content signals, and conversion UX.
- Generate a human-readable audit report in Markdown.
- Store structured findings for later export, comparison, or dashboard use.
- Provide severity levels and actionable recommendations.

### Secondary Goals

- Capture screenshots for evidence.
- Support desktop and mobile viewport audits.
- Export reports as PDF or HTML in later versions.
- Allow custom audit rules per industry.
- Support authenticated or staged websites in later versions.
- Track audit history for repeat clients.

## 3. Target Users

### Primary Users

- Web development agencies
- SEO agencies
- UX auditors
- Conversion optimization teams
- Freelance web consultants
- Internal digital teams

### Secondary Users

- Small business owners who want automated website health checks
- Marketing teams evaluating lead-generation performance
- Product teams auditing app flows

## 4. Key Use Cases

### Use Case 1: Audit a Public Business Website

A team member enters a URL such as `https://examplebusiness.com`. The tool crawls the site, scans key pages, and generates a Markdown report.

### Use Case 2: Audit Lead Forms

The tool identifies forms across the site, checks labels, required fields, validation behavior, input types, autocomplete, privacy text, and submit behavior without sending real submissions unless explicitly allowed.

### Use Case 3: Audit Mobile Experience

The tool loads key pages in a mobile viewport, checks layout, navigation, CTA visibility, form usability, and performance.

### Use Case 4: Produce Client-Ready Findings

The tool converts technical results into a business-friendly report with priorities, impact, and recommended fixes.

## 5. MVP Scope

### Included in MVP

- CLI command to run an audit against a URL.
- Same-domain crawler with configurable page limit.
- Page classification for homepage, contact, service/product, blog, pricing, form, and generic pages.
- Lighthouse scan for performance, accessibility, SEO, and best practices.
- Playwright-based browser inspection.
- axe accessibility scan using `@axe-core/playwright`.
- Form detection and form-quality analysis.
- Basic SEO checks.
- Basic security header checks.
- Basic conversion UX checks.
- Markdown report generation.
- JSON output containing raw findings and summary scores.
- Screenshot capture for key pages and major findings.

### Excluded From MVP

- Full penetration testing.
- Automatic form submission with real data.
- Logged-in application audits.
- Visual regression testing.
- Historical dashboard.
- PDF generation.
- Multi-tenant SaaS user management.
- Payment processing.
- Browser extension.

## 6. Technical Stack

### Runtime

- Node.js
- TypeScript

### Core Libraries

- `playwright`: browser automation, screenshots, DOM inspection, mobile viewport testing.
- `@axe-core/playwright`: accessibility scanning.
- `lighthouse`: performance, SEO, accessibility, and best-practices audits.
- `chrome-launcher`: launching Chrome for Lighthouse programmatic runs.
- `cheerio`: static HTML parsing where browser rendering is not needed.
- `zod`: schema validation for configs and outputs.
- `commander` or `yargs`: CLI interface.
- `pino` or `winston`: logging.
- `nanoid` or `crypto.randomUUID`: audit IDs.

### Optional Later Libraries

- `puppeteer-cluster` or custom worker pool for scaling browser scans.
- `pdfkit` or Playwright PDF generation for PDF exports.
- `openai` SDK or another LLM provider for narrative report generation.
- `prisma` with PostgreSQL for stored audit history.

## 7. System Architecture

```text
CLI / API
  |
  v
Audit Orchestrator
  |
  +-- URL Normalizer
  +-- Crawler
  +-- Page Classifier
  +-- Scanner Runner
        |
        +-- Lighthouse Scanner
        +-- Accessibility Scanner
        +-- Form Scanner
        +-- SEO Scanner
        +-- Security Scanner
        +-- UX Heuristic Scanner
  |
  +-- Scoring Engine
  +-- Evidence Collector
  +-- Report Generator
  +-- Output Writer
```

## 8. Functional Requirements

### 8.1 CLI

The MVP should expose a command like:

```bash
website-audit audit https://example.com --max-pages 15 --output ./reports
```

Required CLI options:

- `url`: target website URL.
- `--max-pages`: maximum pages to crawl.
- `--output`: output directory.
- `--mobile`: enable mobile viewport scan.
- `--desktop`: enable desktop viewport scan.
- `--json`: write structured JSON output.
- `--markdown`: write Markdown report.
- `--no-submit-forms`: default behavior; do not submit forms.

### 8.2 URL Normalization

The tool must:

- Accept URLs with or without protocol.
- Default to `https://` when protocol is missing.
- Remove fragments from URLs.
- Normalize trailing slashes.
- Keep crawling limited to the original domain unless configured otherwise.

### 8.3 Crawler

The crawler must:

- Visit the starting URL.
- Extract same-domain links.
- Respect `maxPages`.
- Avoid duplicate URLs.
- Ignore mail links, phone links, file downloads, and social media links.
- Prioritize likely high-value pages:
  - Homepage
  - Contact
  - Pricing
  - Services
  - Products
  - About
  - Booking
  - Checkout
  - Signup
  - Login

The crawler should not overload target websites. MVP should use conservative concurrency, such as 2-3 pages at a time.

### 8.4 Page Classification

Each page should be classified by URL, title, headings, and detected UI patterns.

Supported page types:

- `home`
- `contact`
- `service`
- `product`
- `pricing`
- `about`
- `blog`
- `form`
- `checkout`
- `booking`
- `auth`
- `unknown`

### 8.5 Performance Scanner

The tool must run Lighthouse for key pages and capture:

- Performance score
- Largest Contentful Paint
- Cumulative Layout Shift
- Total Blocking Time
- Speed Index
- First Contentful Paint
- Unoptimized image opportunities
- Render-blocking resources
- Unused JavaScript or CSS

The scanner must convert Lighthouse results into findings with severity.

Example:

- If mobile performance score is below 50, create a `High` severity finding.
- If LCP is above accepted thresholds, create a performance finding.

### 8.6 Accessibility Scanner

The tool must use axe with Playwright to identify automatically detectable accessibility issues.

Checks should include:

- Missing form labels
- Missing button names
- Missing link names
- Color contrast failures
- Invalid ARIA
- Duplicate IDs
- Missing document language
- Heading structure issues

The report must state that automated scans do not replace full manual WCAG review.

### 8.7 Form Scanner

The tool must detect all forms and form-like flows.

Checks:

- Form count per page
- Input labels
- Placeholder-only fields
- Required fields
- Input types such as `email`, `tel`, `url`, `number`
- Autocomplete attributes
- Submit button presence
- Privacy policy or consent text near sensitive forms
- CAPTCHA or anti-spam presence
- Validation behavior where safe
- Confirmation state only when test submission is explicitly enabled

Default MVP behavior:

- Do not submit real forms.
- Do not upload files.
- Do not create accounts.
- Do not test payment forms.

### 8.8 SEO Scanner

Checks:

- Page title exists and has reasonable length.
- Meta description exists.
- Exactly one clear H1 where possible.
- Canonical URL exists.
- Robots meta tag does not block important pages.
- Images have alt text.
- Internal links are crawlable.
- Sitemap exists.
- Robots.txt exists.
- Structured data presence.
- Broken links.

### 8.9 Security and Privacy Scanner

Public-safe checks only:

- HTTPS availability.
- HTTP redirects to HTTPS.
- Mixed content.
- Security headers:
  - `strict-transport-security`
  - `content-security-policy`
  - `x-content-type-options`
  - `x-frame-options` or equivalent CSP frame policy
  - `referrer-policy`
  - `permissions-policy`
- Cookie flags:
  - `Secure`
  - `HttpOnly`
  - `SameSite`
- Privacy policy link presence.
- Cookie consent presence where relevant.

The tool must not perform invasive security testing in MVP.

### 8.10 Conversion UX Scanner

Heuristic checks:

- Primary CTA visible above the fold.
- Contact phone/email present for local/service businesses.
- Contact or booking page reachable from navigation.
- Trust signals present, such as reviews, testimonials, certifications, case studies, or client logos.
- Navigation is usable on mobile.
- Important buttons and links have clear text.
- Forms are not excessively long.
- No obvious broken layout on mobile screenshots.

These checks should be labeled as heuristic, not absolute.

### 8.11 Analytics Readiness Scanner

MVP should detect likely presence of:

- Google Analytics
- Google Tag Manager
- Meta Pixel
- LinkedIn Insight Tag
- Other common tracking scripts

The tool should flag when no analytics/tracking scripts are detected, but it should avoid claiming analytics is definitely absent because scripts may be blocked or loaded server-side.

## 9. Findings Model

Each finding must follow this structure:

```ts
type FindingSeverity = "critical" | "high" | "medium" | "low" | "info";

type FindingCategory =
  | "business"
  | "ux"
  | "forms"
  | "performance"
  | "accessibility"
  | "seo"
  | "security"
  | "privacy"
  | "analytics"
  | "technical";

interface AuditFinding {
  id: string;
  url: string;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  impact: string;
  recommendation: string;
  evidence?: {
    selector?: string;
    screenshotPath?: string;
    metric?: string;
    value?: string | number;
    expected?: string | number;
    source?: "lighthouse" | "axe" | "playwright" | "crawler" | "headers" | "heuristic";
  };
}
```

## 10. Audit Result Model

```ts
interface AuditResult {
  auditId: string;
  startedAt: string;
  completedAt: string;
  targetUrl: string;
  normalizedUrl: string;
  scannedPages: ScannedPage[];
  summary: AuditSummary;
  findings: AuditFinding[];
  outputs: {
    markdownReportPath?: string;
    jsonReportPath?: string;
    screenshotDirectory?: string;
  };
}

interface ScannedPage {
  url: string;
  title?: string;
  pageType: string;
  statusCode?: number;
  screenshotPath?: string;
}

interface AuditSummary {
  overallScore: number;
  categoryScores: Record<string, number>;
  findingCounts: Record<FindingSeverity, number>;
  topPriorities: string[];
}
```

## 11. Scoring System

### Overall Score

The overall score should be calculated from weighted category scores.

Suggested weights:

- Performance: 20%
- Accessibility: 20%
- Forms and conversion UX: 20%
- SEO: 15%
- Security/privacy basics: 15%
- Technical/content quality: 10%

### Severity Penalties

- Critical: -20 points
- High: -10 points
- Medium: -5 points
- Low: -2 points
- Info: 0 points

Scores should be capped between 0 and 100.

## 12. Report Requirements

The MVP report must be generated in Markdown.

Required sections:

- Cover/title
- Executive summary
- Overall score
- Category scores
- Top priority fixes
- Scope and scanned pages
- Findings grouped by severity
- Findings grouped by category
- Form audit summary
- Performance summary
- Accessibility summary
- SEO summary
- Security/privacy summary
- Recommended 30-day action plan
- Disclaimer and audit limitations

### Example Report Finding

```md
### High: Contact form fields are missing visible labels

Page: https://example.com/contact
Category: Forms / Accessibility

Impact:
Users relying on screen readers may not understand what each field requires. This can reduce form completion and create accessibility risk.

Recommendation:
Add visible labels for every form input and associate each label with its field using `for` and `id` attributes.

Evidence:

- Selector: `form input[name="email"]`
- Source: axe / Playwright
```

## 13. Non-Functional Requirements

### Performance

- MVP should audit up to 15 pages within 3-8 minutes, depending on Lighthouse runtime.
- Crawler concurrency should be configurable.
- Lighthouse scans may run sequentially at first for stability.

### Reliability

- One scanner failure should not fail the entire audit.
- Failed pages should be recorded with errors.
- The report should include partial results when an audit cannot complete fully.

### Security

- Do not store sensitive form values.
- Do not submit forms by default.
- Do not bypass authentication, paywalls, or access controls.
- Respect explicit audit scope.

### Compliance

- Include a disclaimer that automated accessibility checks do not prove full WCAG compliance.
- Include a disclaimer that security checks are limited and non-invasive.

## 14. Configuration

The tool should support a config file:

```ts
interface AuditConfig {
  targetUrl: string;
  maxPages: number;
  outputDir: string;
  viewports: Array<"desktop" | "mobile">;
  includeLighthouse: boolean;
  includeAccessibility: boolean;
  includeForms: boolean;
  includeSeo: boolean;
  includeSecurity: boolean;
  includeUxHeuristics: boolean;
  submitForms: false;
  allowedDomains: string[];
  crawlDelayMs: number;
}
```

## 15. Suggested Folder Structure

```text
website-audit-tool/
  src/
    cli/
      index.ts
    core/
      audit-orchestrator.ts
      config.ts
      types.ts
    crawl/
      crawler.ts
      url-normalizer.ts
      page-classifier.ts
    scanners/
      lighthouse-scanner.ts
      accessibility-scanner.ts
      form-scanner.ts
      seo-scanner.ts
      security-scanner.ts
      ux-scanner.ts
      analytics-scanner.ts
    scoring/
      scoring-engine.ts
      severity.ts
    reports/
      markdown-report.ts
      report-template.ts
    evidence/
      screenshot-service.ts
      evidence-store.ts
    utils/
      logger.ts
      errors.ts
  tests/
    unit/
    fixtures/
  reports/
  package.json
  tsconfig.json
  README.md
```

## 16. MVP Development Milestones

### Milestone 1: Project Foundation

- Initialize Node.js and TypeScript project.
- Add CLI command.
- Add config validation.
- Add output directory creation.
- Add structured logging.

### Milestone 2: Crawler

- Normalize target URL.
- Crawl same-domain links.
- Limit by max pages.
- Classify pages.
- Save crawl result as JSON.

### Milestone 3: Core Scanners

- Add Playwright page loading.
- Add screenshot capture.
- Add SEO scanner.
- Add form scanner.
- Add security header scanner.

### Milestone 4: Lighthouse and Accessibility

- Add Lighthouse scanner.
- Add axe scanner.
- Convert scanner outputs into normalized findings.

### Milestone 5: Scoring and Report

- Add severity rules.
- Add category scores.
- Add overall score.
- Generate Markdown report.

### Milestone 6: QA and Hardening

- Add tests for URL normalization.
- Add tests for scoring.
- Add tests for report generation.
- Test against 5-10 real websites with permission or public-safe scope.

## 17. Acceptance Criteria

The MVP is complete when:

- A user can run one CLI command with a target URL.
- The tool crawls at least 10 same-domain pages.
- The tool detects forms and reports common form issues.
- The tool runs Lighthouse on at least the homepage.
- The tool runs axe accessibility checks.
- The tool produces a Markdown report.
- The tool produces structured JSON output.
- Findings include severity, impact, recommendation, and evidence.
- The audit does not submit forms by default.
- The audit continues gracefully when one page or scanner fails.

## 18. Risks and Mitigations

### Risk: Lighthouse scans are slow

Mitigation: Run Lighthouse only on high-value pages in MVP, such as homepage, contact, pricing, and key landing pages.

### Risk: Automated UX checks may be subjective

Mitigation: Label these findings as heuristic and allow manual review.

### Risk: Sites block crawlers or headless browsers

Mitigation: Use polite crawling, realistic user agents, retry logic, and clear error reporting.

### Risk: Accessibility scans are incomplete

Mitigation: Clearly state that automated accessibility checks catch only part of WCAG issues.

### Risk: Form testing causes unwanted submissions

Mitigation: Never submit forms unless explicitly enabled and configured with safe test data.

## 19. Future Enhancements

- Web dashboard.
- Client/project management.
- PDF export.
- HTML report export.
- Before/after comparison reports.
- Scheduled recurring audits.
- Authenticated website audits.
- Manual review checklist mode.
- Industry-specific audit templates.
- AI-generated executive summaries.
- CRM integration for lead audit reports.
- Slack/email report delivery.
- GitHub CI integration for internal website QA.

## 20. Recommended MVP Command Examples

```bash
website-audit audit https://example.com
```

```bash
website-audit audit https://example.com --max-pages 20 --mobile --desktop --output ./reports/example
```

```bash
website-audit audit https://example.com --json --markdown
```

## 21. Product Positioning

This tool should be positioned as a professional audit assistant for web teams. It should not replace expert judgment. Its value is in speeding up discovery, standardizing audit quality, preserving evidence, and generating a strong first draft of a client-ready report.
