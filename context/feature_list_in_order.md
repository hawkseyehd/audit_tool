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
- Concise client summary PDF export.
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

## 21. Client Business Summary PDF

### 21.1 Generate a client-only business handout

- Write `pdf/client-summary.pdf` by default without replacing existing reports.
- Keep the document to exactly three A4 pages.
- Show the website name, pages reviewed, website health, and improvements identified.
- Explain all findings through their effect on enquiries, visibility, trust, access,
  measurement, or operations.
- Present a focused order of work: act now, improve next, and strengthen over time.

### 21.2 Keep content relevant to the client

- Omit audit IDs, dates, durations, methodology, scanner details, evidence, and technical scope.
- Omit references to other report files.
- Use deterministic canonical findings without invented claims or financial forecasts.
- Include one plain-language completeness note only when recorded page coverage is partial.

### 21.3 Preserve report quality and safety

- Reuse the secured batched Playwright PDF renderer.
- Escape all website-derived content and bound variable-length prose.
- Support default and `--client-summary-pdf`-only CLI output modes.
- Verify exactly three nonblank A4 pages through automated and visual QA.

## PRD-2: Client Workspace and Business Discovery

Features 22 through 33 implement `context/PRD-2.md`. Complete Release 2A before beginning the
business-discovery work in Release 2B.

The approved desktop stack and process boundaries are defined in
`context/desktop_app_stack.md`.

Every UI task in Features 22 through 33 must use the project-local Impeccable skill for design,
implementation, accessibility, responsive behavior, complete interaction states, critique,
polish, and Electron window-based visual verification.

## 22. Application and Persistence Foundation

### 22.1 Establish the Electron desktop architecture

- Add Electron main, preload, sandboxed renderer, and utility-process entry points.
- Add a React and TypeScript renderer without coupling UI concerns to scanner modules.
- Add Electron Forge using the TypeScript and Webpack template.
- Preserve the existing CLI as a supported entry point.
- Define application-data, artifact, temporary-file, and packaged-resource boundaries.

### 22.2 Add persistent storage

- Add SQLite with Prisma ORM and a typed database access layer.
- Add migration, seed, and test-database workflows.
- Define stable IDs, UTC timestamps, lifecycle states, and ownership-ready fields.
- Store writable data under Electron's operating-system application-data directory.
- Validate all IPC and persistence boundaries.

### 22.3 Add the operational application shell

- Add Overview, Prospects, Clients, Audits, Reports, and Settings navigation.
- Add accessible responsive navigation and page structure.
- Define reusable tokens and components through the project-local Impeccable skill.
- Add loading, empty, error, and permission states.

### 22.4 Add secure desktop process boundaries

- Keep renderer `nodeIntegration` disabled with context isolation and sandboxing enabled.
- Expose narrow typed APIs through preload and `contextBridge`.
- Validate IPC senders, arguments, identifiers, state transitions, and resolved paths.
- Prevent renderer access to Prisma, filesystem, shell, secrets, and raw Electron APIs.

## 23. Client Management

### 23.1 Define client and website records

- Add client, website, tags, notes, owner, and lifecycle schemas.
- Normalize and validate website URLs.
- Warn on duplicate normalized domains.

### 23.2 Build the client directory

- Add search, filtering, status, pagination, and sorting.
- Show active, paused, and archived states.
- Add useful loading, empty, and failure states.

### 23.3 Build client creation and editing

- Create clients with business name and website URL.
- Support optional public contact, address, category, tags, notes, and owner fields.
- Add validation, conflict handling, and unsaved-change protection.

### 23.4 Build the client detail workspace

- Add Profile, Website Pages, Audits, Reports, and Activity views.
- Preserve audit and report history when client details change.
- Add safe archive and retention-aware deletion workflows.

## 24. Website Page Discovery and Inventory

### 24.1 Add lightweight discovery jobs

- Reuse the safe crawler without running the full scanner suite.
- Preserve domain, SSRF, timeout, response-size, retry, delay, and concurrency limits.
- Never submit forms or interact with transactional controls.

### 24.2 Persist discovered pages

- Store normalized URL, title, page type, status, availability, and observation timestamps.
- Record recommendation state and reason.
- Keep stable page identity across rediscovery where possible.

### 24.3 Add page rediscovery and comparison

- Identify new, changed, unavailable, and no-longer-observed pages.
- Preserve user selections and historical scopes.
- Require review before applying ambiguous URL matches.

### 24.4 Build the Website Pages view

- Add search and filters for title, URL, page type, status, availability, and selection.
- Show discovery state, page changes, and actionable failure messages.
- Support database-backed pagination for large websites.

## 25. Page Selection and Immutable Audit Scopes

### 25.1 Add page-selection controls

- Add accessible row checkboxes and indeterminate select-all behavior.
- Support select visible, select recommended, clear selection, include, and exclude actions.
- Keep selection stable across search, filters, and pagination.
- Show selected, eligible, and unavailable page counts.

### 25.2 Add recommended page selection

- Prioritize homepage, contact, service, product, pricing, booking, form, and representative pages.
- Exclude obvious archives, pagination, duplicate content, and ineligible resources by default.
- Display the reason for every recommendation or exclusion.

### 25.3 Create immutable audit scopes

- Snapshot exact selected page IDs and normalized URLs.
- Snapshot relevant audit configuration and requested report formats.
- Prevent later rediscovery or client edits from changing historical scopes.
- Validate that selected pages remain inside the allowed target scope.

## 26. Background Audit Jobs and Progress

### 26.1 Add durable audit jobs

- Create queued jobs outside the renderer and Electron main event loop.
- Reuse the existing audit engine through an Electron utility-process adapter.
- Prevent duplicate submission through idempotency controls.
- Support safe cancellation and cleanup.

### 26.2 Add audit lifecycle states

- Support queued, discovering, scanning, generating reports, completed, partial, failed, and
  cancelled states.
- Persist progress, attempts, warnings, and classified failures.
- Continue after recoverable page or scanner failures.

### 26.3 Build audit monitoring UI

- Show stage, progress, selected-page count, warnings, and completion state.
- Keep progress understandable after refresh or reconnection.
- Add retry or recovery actions only where the operation is safe and idempotent.

## 27. Audit History and Report Management

### 27.1 Persist audit history

- Store canonical results, immutable scope, score summaries, and artifact metadata.
- Associate every audit with one client and website.
- Preserve historical results when client or page records change.

### 27.2 Build audit history views

- Add client-level and workspace-level audit tables.
- Filter by client, status, date, and result state.
- Show partial and failed runs clearly without hiding successful work.

### 27.3 Add secured report access

- List all generated report formats.
- Resolve report open, reveal, and export actions from trusted client and audit identifiers.
- Never accept an unrestricted filesystem path from renderer input.
- Add missing, expired, and generation-failed states.

## 28. Release 2A Integration and Acceptance

### 28.1 Test the client-to-report workflow

- Cover client creation, page discovery, selection, immutable scope, audit execution, and report
  export or opening end to end.
- Verify historical scopes survive rediscovery.
- Verify the existing CLI remains operational.

### 28.2 Harden and package the desktop application

- Test accessibility, resizable window layouts, display scaling, keyboard workflows, permissions,
  and destructive actions.
- Test worker restart, cancellation, partial failure, and cleanup behavior.
- Build a signed-ready Squirrel.Windows installer and test it on a clean Windows environment.
- Verify packaged Chromium, Playwright, Lighthouse, Prisma, and PDF generation.
- Run formatting, lint, type checking, tests, build, dependency, and visual QA gates.

## 29. Prospect Data Foundation

### 29.1 Define prospect and campaign schemas

- Keep prospects separate from clients.
- Add prospect lifecycle, ownership, tags, notes, confidence, and provenance.
- Add campaign criteria, limits, state, provider, and continuation data.

### 29.2 Build the prospect workspace

- Add searchable, filterable, paginated prospect tables.
- Support new, reviewing, qualified, not-qualified, promoted, and suppressed states.
- Show source, website availability, confidence, and last-verified time.

### 29.3 Add suppression and retention controls

- Support suppression, deletion, and do-not-contact states.
- Prevent suppressed records from being re-imported silently.
- Apply documented retention policies.

## 30. Discovery Campaigns and Provider Adapters

### 30.1 Build campaign creation

- Select supported country, state or region, city, category, keywords, result limit, and required
  fields.
- Make radius search available only when the selected provider supports it.
- Validate campaign limits before execution.

### 30.2 Add approved provider adapters

- Document provider terms, allowed fields, authentication, limits, pagination, and retention.
- Use Playwright to read rendered public Google Maps business cards and detail pages without a
  Maps, Places, business-data, search, directory, geocoding, or prospect API.
- Import prospects with and without websites. Preserve a displayed website when available and
  retain displayed public business phone, email, address, and associated company-profile URLs.
- Exclude personal profiles and individual contact details.
- Extract only displayed public business fields from page content and preserve the source URL.
- Add bounded pacing, navigation limits, cancellation, browser cleanup, and safe continuation.
- Add deterministic provider test doubles.
- Do not call hidden service endpoints, submit forms, bypass CAPTCHAs, evade access controls,
  rotate identities, or import social networks and directories as prospects.

### 30.3 Add campaign execution and monitoring

- Run campaigns as durable background jobs.
- Show result count, progress, warnings, provider limits, and cancellation state.
- Preserve source record IDs, URLs, and collection timestamps.

## 31. Prospect Enrichment, Verification, and Deduplication

**Status:** Complete (2026-07-31)

### 31.1 Normalize imported business data

- Normalize domain, business name, phone, address, category, and source identifiers.
- Keep imported values separate from user-edited values.
- Store provenance and last-verified time per supported field.

### 31.2 Add safe website verification

- Verify reachability, HTTPS, final domain, homepage title, and bounded page count.
- Preserve SSRF, private-network, scope, timeout, retry, and concurrency controls.
- Label pre-audit observations as opportunity signals rather than audit findings.

### 31.3 Add duplicate detection

- Block or link exact normalized-domain and provider-record duplicates.
- Compare normalized phone, name, and address where available.
- Present fuzzy matches for human review instead of merging automatically.

## 32. Prospect Qualification and Client Promotion

**Status:** Complete (2026-07-31)

### 32.1 Add prospect review workflows

- Support notes, tags, ownership, qualification state, and suppression.
- Show data confidence, provenance, verification state, and duplicate warnings.
- Keep opportunity signals distinct from completed audit scores.

### 32.2 Add explicit client promotion

- Promote only through a deliberate user command.
- Create or link exactly one client.
- Preserve prospect provenance and activity history.
- Prevent duplicate clients by normalized domain.

### 32.3 Connect promoted clients to page discovery

- Carry approved public business details into the client record.
- Offer page discovery as the next action.
- Do not start a full audit automatically.

## 33. Release 2B Compliance and Acceptance

**Status:** Complete (2026-07-31)

### 33.1 Validate provider and privacy controls

- Verify approved-source terms, field allowlists, provenance, suppression, and retention.
- Verify secrets and authorization data never enter logs or reports.
- Verify the system does not collect unnecessary sensitive personal data.

### 33.2 Test the campaign-to-client workflow

- Cover campaign creation, provider import, normalization, deduplication, qualification,
  suppression, and client promotion end to end.
- Verify no prospect becomes a client automatically.
- Verify no outreach or form submission occurs.

### 33.3 Complete production hardening

- Test accessibility, responsive behavior, large datasets, pagination, cancellation, retries, and
  worker cleanup.
- Complete threat review, dependency review, performance testing, and disaster-recovery checks.
- Run all project quality gates and record final acceptance evidence.
