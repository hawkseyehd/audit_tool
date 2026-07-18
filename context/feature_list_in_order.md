# Website Audit Tool Feature Breakdown

This file converts the PRD into an implementation-focused feature list. Build the features in order so each step creates usable foundations for the next one.

## 1. Project Foundation

### 1.1 Initialize Node.js and TypeScript project

- Create `package.json`.
- Add TypeScript configuration.
- Add source, test, and report folders.
- Add build, test, and CLI scripts.

### 1.2 Add core dependencies

- Add `playwright` for browser automation.
- Add `@axe-core/playwright` for accessibility scans.
- Add `lighthouse` and `chrome-launcher` for performance and best-practices audits.
- Add `cheerio` for HTML parsing.
- Add `zod` for config and output validation.
- Add `commander` or `yargs` for CLI commands.
- Add `pino` or `winston` for structured logging.

### 1.3 Define core data models

- Add `AuditFinding`.
- Add `AuditResult`.
- Add `ScannedPage`.
- Add `AuditSummary`.
- Add `AuditConfig`.
- Add severity and category types.

### 1.4 Add configuration validation

- Validate target URL.
- Validate max page count.
- Validate output directory.
- Validate selected viewports.
- Validate enabled scanners.
- Ensure `submitForms` defaults to `false`.

### 1.5 Add output directory management

- Create an audit-specific output folder.
- Create subfolders for screenshots, JSON, and Markdown reports.
- Generate a unique audit ID for each run.

## 2. CLI Feature Set

### 2.1 Add audit command

- Support a command like `website-audit audit https://example.com`.
- Accept a required target URL.
- Connect CLI inputs to the validated audit config.

### 2.2 Add CLI options

- `--max-pages` to limit crawling.
- `--output` to choose the output directory.
- `--mobile` to enable mobile scanning.
- `--desktop` to enable desktop scanning.
- `--json` to write structured JSON output.
- `--markdown` to write a Markdown report.
- `--no-submit-forms` to preserve safe default form behavior.

### 2.3 Add CLI logging and errors

- Print audit start and completion messages.
- Show scanned page count.
- Show report output paths.
- Return useful errors for invalid URLs, failed config, or blocked output paths.

## 3. URL Normalization

### 3.1 Accept flexible URLs

- Accept URLs with `https://`.
- Accept URLs with `http://`.
- Accept URLs without a protocol.
- Default missing protocols to `https://`.

### 3.2 Normalize URLs for crawling

- Remove URL fragments.
- Normalize trailing slashes.
- Normalize duplicate URLs.
- Keep crawl scope limited to the original domain.

### 3.3 Filter unsupported links

- Ignore `mailto:` links.
- Ignore `tel:` links.
- Ignore downloadable files.
- Ignore social media links.
- Ignore external domains unless explicitly allowed.

## 4. Same-Domain Crawler

### 4.1 Visit the starting page

- Load the normalized target URL.
- Record status code, final URL, title, and errors.
- Extract same-domain links.

### 4.2 Crawl additional pages

- Respect `maxPages`.
- Avoid duplicate URLs.
- Use conservative concurrency of 2-3 pages.
- Add crawl delay support.
- Continue gracefully when one page fails.

### 4.3 Prioritize high-value pages

- Homepage.
- Contact.
- Pricing.
- Services.
- Products.
- About.
- Booking.
- Checkout.
- Signup.
- Login.

### 4.4 Save crawl results

- Store scanned page metadata.
- Store failed page metadata and errors.
- Write crawl output to JSON for later scanners and reports.

## 5. Page Classification

### 5.1 Classify pages by signals

- Use URL path.
- Use page title.
- Use headings.
- Use detected forms, checkout patterns, booking patterns, and auth patterns.

### 5.2 Support MVP page types

- `home`.
- `contact`.
- `service`.
- `product`.
- `pricing`.
- `about`.
- `blog`.
- `form`.
- `checkout`.
- `booking`.
- `auth`.
- `unknown`.

### 5.3 Store classification

- Add page type to each scanned page.
- Use page type to choose scanner priority.
- Use page type in report grouping.

## 6. Browser Inspection and Evidence

### 6.1 Add Playwright page loading

- Launch browser safely.
- Load pages with desktop viewport.
- Load pages with mobile viewport when enabled.
- Capture page errors and timeouts.

### 6.2 Add screenshot capture

- Capture screenshots for key pages.
- Capture mobile screenshots when mobile audit is enabled.
- Capture evidence screenshots for major findings where possible.
- Store screenshot paths in findings.

### 6.3 Add evidence model support

- Store selector evidence.
- Store metric evidence.
- Store expected versus actual values.
- Store source scanner name.

## 7. SEO Scanner

### 7.1 Add metadata checks

- Check page title exists.
- Check title has reasonable length.
- Check meta description exists.
- Check canonical URL exists.
- Check robots meta tag does not block important pages.

### 7.2 Add content structure checks

- Check for one clear H1 where possible.
- Check heading structure.
- Check image alt text.
- Check internal links are crawlable.
- Check structured data presence.

### 7.3 Add site-level SEO checks

- Check `robots.txt` exists.
- Check sitemap exists.
- Check for broken internal links.

### 7.4 Convert SEO issues to findings

- Assign severity.
- Add business impact.
- Add recommendation.
- Add page URL and evidence.

## 8. Form Scanner

### 8.1 Detect forms and form-like flows

- Detect native `form` elements.
- Detect inputs outside forms.
- Detect contact, booking, signup, checkout, and lead-generation forms.
- Count forms per page.

### 8.2 Check form field quality

- Check visible labels.
- Check associated `for` and `id` attributes.
- Flag placeholder-only fields.
- Check required fields.
- Check appropriate input types such as `email`, `tel`, `url`, and `number`.
- Check autocomplete attributes.

### 8.3 Check submission readiness safely

- Check submit button presence.
- Check privacy policy or consent text near sensitive forms.
- Check CAPTCHA or anti-spam presence.
- Check validation behavior only where safe.
- Do not submit real forms by default.
- Do not upload files.
- Do not create accounts.
- Do not test payment forms.

### 8.4 Convert form issues to findings

- Assign severity.
- Explain conversion and accessibility impact.
- Add selector evidence where possible.
- Include form summary in report output.

## 9. Security and Privacy Scanner

### 9.1 Check HTTPS basics

- Check HTTPS availability.
- Check HTTP redirects to HTTPS.
- Check for mixed content.

### 9.2 Check security headers

- `strict-transport-security`.
- `content-security-policy`.
- `x-content-type-options`.
- `x-frame-options` or equivalent CSP frame policy.
- `referrer-policy`.
- `permissions-policy`.

### 9.3 Check cookies and privacy signals

- Check cookie `Secure` flag.
- Check cookie `HttpOnly` flag.
- Check cookie `SameSite` flag.
- Check privacy policy link presence.
- Check cookie consent presence where relevant.

### 9.4 Keep checks public-safe

- Do not perform penetration testing.
- Do not bypass authentication.
- Do not test paywalls or access controls.
- Record limitations clearly in the report.

## 10. Conversion UX Scanner

### 10.1 Check primary conversion signals

- Check whether primary CTA is visible above the fold.
- Check whether contact phone or email is present for local/service businesses.
- Check whether contact or booking page is reachable from navigation.

### 10.2 Check trust and clarity

- Detect reviews.
- Detect testimonials.
- Detect certifications.
- Detect case studies.
- Detect client logos.
- Check important buttons and links have clear text.

### 10.3 Check mobile usability heuristics

- Check navigation usability on mobile.
- Check CTA visibility on mobile.
- Check form usability on mobile.
- Flag obvious broken layout in screenshots.

### 10.4 Label UX findings correctly

- Mark UX checks as heuristic.
- Avoid absolute claims where human review is required.
- Explain likely business impact.

## 11. Analytics Readiness Scanner

### 11.1 Detect common tracking tools

- Google Analytics.
- Google Tag Manager.
- Meta Pixel.
- LinkedIn Insight Tag.
- Other common tracking scripts.

### 11.2 Report analytics confidence carefully

- Flag when no common analytics scripts are detected.
- Avoid claiming analytics is definitely absent.
- Mention scripts may be blocked, delayed, or loaded server-side.

## 12. Lighthouse Performance Scanner

### 12.1 Run Lighthouse on key pages

- Start with homepage.
- Add high-value pages such as contact, pricing, and landing pages.
- Run sequentially first for stability.
- Support mobile and desktop modes.

### 12.2 Capture Lighthouse metrics

- Performance score.
- Largest Contentful Paint.
- Cumulative Layout Shift.
- Total Blocking Time.
- Speed Index.
- First Contentful Paint.

### 12.3 Capture Lighthouse opportunities

- Unoptimized image opportunities.
- Render-blocking resources.
- Unused JavaScript.
- Unused CSS.

### 12.4 Convert Lighthouse results to findings

- Create high severity finding when mobile performance score is below 50.
- Create performance findings when LCP exceeds accepted thresholds.
- Map metrics to severity, impact, and recommendations.

## 13. Accessibility Scanner

### 13.1 Run axe with Playwright

- Scan key pages.
- Support desktop viewport.
- Support mobile viewport when enabled.
- Continue audit if axe fails on one page.

### 13.2 Detect common accessibility issues

- Missing form labels.
- Missing button names.
- Missing link names.
- Color contrast failures.
- Invalid ARIA.
- Duplicate IDs.
- Missing document language.
- Heading structure issues.

### 13.3 Convert axe results to findings

- Normalize axe violations into `AuditFinding`.
- Include selector evidence.
- Include severity mapping.
- Include recommendations.

### 13.4 Add accessibility limitation note

- State that automated scans do not replace full manual WCAG review.
- Include this disclaimer in the Markdown report.

## 14. Scoring Engine

### 14.1 Add severity penalties

- Critical: -20 points.
- High: -10 points.
- Medium: -5 points.
- Low: -2 points.
- Info: 0 points.

### 14.2 Add weighted category scores

- Performance: 20%.
- Accessibility: 20%.
- Forms and conversion UX: 20%.
- SEO: 15%.
- Security/privacy basics: 15%.
- Technical/content quality: 10%.

### 14.3 Calculate audit summary

- Calculate category scores.
- Calculate overall score.
- Cap scores between 0 and 100.
- Count findings by severity.
- Select top priority fixes.

## 15. Markdown Report Generator

### 15.1 Generate required report sections

- Cover/title.
- Executive summary.
- Overall score.
- Category scores.
- Top priority fixes.
- Scope and scanned pages.
- Findings grouped by severity.
- Findings grouped by category.
- Form audit summary.
- Performance summary.
- Accessibility summary.
- SEO summary.
- Security/privacy summary.
- Recommended 30-day action plan.
- Disclaimer and audit limitations.

### 15.2 Make findings client-ready

- Use business-friendly titles.
- Explain impact on conversions, trust, accessibility, compliance risk, or maintainability.
- Include specific recommendations.
- Include evidence when available.

### 15.3 Write report output

- Save Markdown report to the output folder.
- Store report path in `AuditResult.outputs.markdownReportPath`.

## 16. JSON Output Writer

### 16.1 Write structured audit result

- Save full `AuditResult` as JSON.
- Include scanned pages.
- Include summary.
- Include normalized findings.
- Include output paths.

### 16.2 Prepare JSON for future use

- Keep schema stable.
- Support later comparison reports.
- Support future dashboard import.
- Support future exports.

## 17. Audit Orchestrator

### 17.1 Coordinate full audit flow

- Parse and validate config.
- Normalize target URL.
- Crawl pages.
- Classify pages.
- Run selected scanners.
- Collect evidence.
- Score findings.
- Generate reports.
- Write outputs.

### 17.2 Handle partial failures

- Record failed pages.
- Record scanner errors.
- Continue when one scanner fails.
- Include partial results in the final report.

### 17.3 Respect audit safety

- Do not submit forms unless explicitly enabled.
- Do not perform invasive security testing.
- Respect domain scope.
- Use polite crawling and conservative concurrency.

## 18. Testing and QA

### 18.1 Add unit tests

- URL normalization tests.
- Scoring tests.
- Report generation tests.
- Config validation tests.
- Page classification tests.

### 18.2 Add scanner tests where practical

- SEO scanner fixture tests.
- Form scanner fixture tests.
- Security header scanner tests.
- Accessibility result normalization tests.

### 18.3 Run real-site validation safely

- Test against 5-10 public websites with permission or public-safe scope.
- Verify crawling does not overload sites.
- Verify reports are useful and readable.
- Verify failures do not stop the entire audit.

## 19. MVP Acceptance Checklist

- User can run one CLI command with a target URL.
- Tool crawls at least 10 same-domain pages.
- Tool detects forms and reports common form issues.
- Tool runs Lighthouse on at least the homepage.
- Tool runs axe accessibility checks.
- Tool produces a Markdown report.
- Tool produces structured JSON output.
- Findings include severity, impact, recommendation, and evidence.
- Audit does not submit forms by default.
- Audit continues gracefully when one page or scanner fails.

## 20. Post-MVP Feature Backlog

### 20.1 Report exports

- PDF export.
- HTML report export.
- Before/after comparison reports.

### 20.2 Audit history and dashboard

- Web dashboard.
- Client/project management.
- Stored audit history.
- Repeat audit comparison.
- Scheduled recurring audits.

### 20.3 Advanced audit modes

- Authenticated website audits.
- Staged website audits.
- Manual review checklist mode.
- Industry-specific audit rules and templates.
- Visual regression testing.

### 20.4 Integrations

- Slack report delivery.
- Email report delivery.
- CRM integration for lead audit reports.
- GitHub CI integration for internal website QA.

### 20.5 Narrative enhancements

- AI-generated executive summaries.
- Industry-specific business recommendations.
- Custom client-ready report tone.
