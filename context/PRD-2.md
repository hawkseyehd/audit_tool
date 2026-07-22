# Product Requirements Document 2: Client Workspace and Business Discovery

## 1. Document Purpose

This document defines the next product phase for Website Audit Tool. It extends the existing
command-line audit engine into a professional desktop application for managing clients, discovering
website pages, selecting audit scope, running audits, retaining reports, and building a qualified
prospect pipeline from authorized public business-data sources.

PRD-2 does not replace `PRD.md`. The original PRD remains the source of truth for crawling,
scanning, scoring, evidence, report generation, and audit safety. This document defines the
workspace and discovery capabilities around that engine.

## 2. Product Direction

### 2.1 Vision

Create one operational workspace where an agency or audit practitioner can:

1. Create and manage a client.
2. Discover the client's eligible website pages.
3. Select the exact pages to audit.
4. Run and monitor the audit.
5. Review audit history and download reports.
6. Discover businesses in a selected market.
7. Qualify discovered businesses as prospects.
8. Promote selected prospects into managed clients.

### 2.2 Product Principle

Prospects and clients are separate records.

- A **prospect** is a business discovered from an approved source and not yet accepted into the
  managed client workspace.
- A **client** is a business intentionally created or promoted for active management and auditing.

Scraped or imported businesses must never be added directly to the client list without an
explicit promotion action.

## 3. Goals

### 3.1 Primary Goals

- Provide a professional desktop UI for client and audit management.
- Let users create a client from a business name and website URL.
- Discover and store eligible same-domain website pages before an audit is run.
- Let users search, filter, include, and exclude pages from an audit scope.
- Run the existing audit engine as a background job using the saved page selection.
- Preserve audit history, selected scope, status, findings, and generated reports per client.
- Discover public businesses by supported location and category criteria.
- Normalize, deduplicate, qualify, and promote selected prospects into clients.

### 3.2 Secondary Goals

- Show page changes between website rediscovery runs.
- Support notes, tags, ownership, and lifecycle statuses.
- Provide transparent opportunity signals before a complete audit is run.
- Prepare the architecture for future teams, scheduling, comparison reports, and integrations.

### 3.3 Non-Goals

- Automatic outreach, email campaigns, calling, or form submission.
- Collecting private, sensitive, or unnecessary personal information.
- Scraping a provider that prohibits automated collection.
- Bypassing authentication, CAPTCHAs, access controls, robots rules, or rate limits.
- Automatically treating a prospect-level signal as a completed audit result.
- Multi-tenant billing, subscriptions, or payment processing in the first release.
- Replacing the existing evidence, scoring, or report-generation engine.

## 4. Target Users

### 4.1 Primary Users

- Website audit practitioners.
- Web development and digital agencies.
- SEO, UX, accessibility, and conversion consultants.
- Business-development teams qualifying organizations with public websites.

### 4.2 Initial Access Model

The first release is a local, single-organization desktop workspace. It does not require a login
or separately operated server. Persisted records must still carry stable IDs and ownership-ready
fields so future shared-workspace support does not require replacing core domain models.

## 5. Release Boundaries

### Release 2A: Client Audit Workspace

- Application shell and persistent storage.
- Client creation and management.
- Website page discovery and page inventory.
- Selectable and versioned audit scopes.
- Background audit execution and progress.
- Audit history and report export or opening.

### Release 2B: Business Discovery and Prospect Pipeline

- Discovery campaigns by supported geography and business category.
- Approved provider adapters.
- Prospect normalization, deduplication, and provenance.
- Website verification and bounded enrichment.
- Qualification workflow and promotion to client.
- Suppression, deletion, and compliance controls.

Release 2B must not begin until the core client-to-audit workflow in Release 2A is accepted.

## 6. Information Architecture

The primary application navigation should contain:

- **Overview**: recent audits, active jobs, failures, and report activity.
- **Prospects**: discovery results, qualification, filtering, and promotion.
- **Clients**: managed client directory and client records.
- **Audits**: queued, running, completed, failed, and cancelled jobs.
- **Reports**: generated client summaries, audit summaries, and full reports.
- **Settings**: workspace defaults, audit limits, discovery providers, and retention controls.

The interface must feel like an operational tool: compact, calm, predictable, and optimized for
searching, comparing, selecting, and taking repeated actions. UI design and implementation must
use the project-local Impeccable skill.

## 7. Client Management Requirements

### 7.1 Client Creation

A user must be able to create a client with:

- Business name.
- Website URL.
- Optional public business phone number.
- Optional public business email.
- Optional address, locality, region, country, and postal code.
- Optional business category, tags, notes, and internal owner.

The system must normalize and validate the website URL before saving. Duplicate normalized
domains must generate a clear warning and link to the existing client or prospect.

### 7.2 Client Lifecycle

Supported client states:

- `active`
- `paused`
- `archived`

Archived clients remain available for audit and report history but are hidden from default active
views. Permanent deletion must require an explicit destructive confirmation and follow the
configured retention policy.

### 7.3 Client Detail

Each client record should provide these views:

- **Profile**: business information, ownership, notes, and tags.
- **Website Pages**: discovered pages, classifications, availability, and audit selection.
- **Audits**: historical and active audit runs.
- **Reports**: generated report files and generation status.
- **Activity**: significant client, discovery, scope, audit, and report events.

## 8. Website Page Discovery

### 8.1 Discovery Run

After client creation, the user can start a lightweight website discovery run. This run must reuse
the existing safe crawler and URL normalization rules without running the complete scanner suite.

The discovery run must:

- Remain within the validated target scope.
- Respect configured page, timeout, response-size, redirect, retry, delay, and concurrency limits.
- Never submit forms or interact with transactional controls.
- Discover eligible same-domain pages.
- Normalize and deduplicate URLs.
- Classify pages using the existing page types.
- Record HTTP status or a safe failure state.
- Record page title when available.
- Record discovery time and source.

### 8.2 Page Inventory

Each stored page should include:

- Stable page ID.
- Client and website ID.
- Normalized URL and latest observed URL.
- Page title.
- Page type.
- Latest status code or failure state.
- First discovered and last observed timestamps.
- Current availability state.
- Selection recommendation and reason.
- User inclusion or exclusion state.

### 8.3 Rediscovery

A new discovery run must not silently replace the existing inventory. It must calculate and show:

- New pages.
- Previously known pages.
- Pages no longer observed.
- Pages with changed title, classification, URL, or availability.
- Previously selected pages.

Historical audit scopes must remain unchanged when the current page inventory changes.

## 9. Page Selection and Audit Scope

### 9.1 Page Selection UI

The Website Pages view must provide:

- Search by title or URL.
- Filters for page type, status, availability, and selection state.
- Checkbox selection with an indeterminate select-all state.
- Select all visible pages.
- Clear current selection.
- Select recommended pages.
- Exclude common low-value archive, tag, pagination, and duplicate-content pages.
- A visible selected-page count.
- Clear reasons when a page is unavailable or ineligible.

Selection must remain stable when filters or pagination change.

### 9.2 Recommended Selection

The system should prioritize representative high-value pages, including:

- Homepage.
- Contact.
- Services and products.
- Pricing.
- Booking or enquiry pages.
- About.
- Important forms.
- Representative content pages when useful.

Recommendations are defaults only. The user remains in control of the final audit scope.

### 9.3 Immutable Audit Scope

Starting an audit must create an immutable scope snapshot containing:

- Client and website identity.
- Exact selected page IDs and normalized URLs.
- Relevant audit configuration.
- Requested report formats.
- Requesting user or system actor.
- Creation timestamp.

Later page rediscovery or client edits must not modify a historical audit scope.

## 10. Audit Execution and Monitoring

### 10.1 Background Jobs

The Electron main process must not execute a full audit on its event loop. It must create a durable
local job and run the existing audit engine in an Electron utility process through typed,
validated messages.

Supported audit job states:

- `queued`
- `discovering`
- `scanning`
- `generating-reports`
- `completed`
- `partially-completed`
- `failed`
- `cancelled`

### 10.2 Progress and Failure Handling

The UI must show:

- Current state.
- Pages completed and total pages in scope.
- Current high-level stage without exposing secrets or raw internal logs.
- Start and completion time for internal operational views.
- Recoverable warnings and failed-page counts.
- Cancellation availability when safe.

One page or scanner failure must continue to produce partial results according to the original
audit-engine rules.

### 10.3 Audit Results

A completed audit must retain:

- Immutable scope snapshot.
- Canonical structured audit result.
- Summary scores and finding counts.
- Generated report metadata and paths.
- Safe failure and warning information.
- Artifact creation and retention timestamps.

## 11. Report Management

Users must be able to access the existing report formats from the client, audit, and report views:

- `client-summary.pdf`
- `audit-summary.pdf`
- `audit-report.pdf`
- Standalone HTML report.
- Markdown report.
- Canonical JSON result.

Report open, reveal, and export actions must resolve artifacts from trusted database identifiers.
Artifact paths must not be accepted directly from untrusted renderer input.

## 12. Prospect and Business Discovery

### 12.1 Discovery Campaign

A user can create a campaign using supported criteria:

- Country.
- State or region.
- City or locality.
- Optional supported geographic radius.
- Business category or keywords.
- Maximum result count.
- Required fields, such as a public website.
- Exclusion rules.
- Approved discovery provider.

Campaign execution must be bounded, cancellable, observable, and resumable where the provider
supports safe continuation.

### 12.2 Approved Provider Adapters

Business discovery must use provider-specific adapters with explicit terms and rate-limit review.
An adapter must define:

- Supported search criteria.
- Authentication and secret requirements.
- Pagination and result limits.
- Retry and backoff behavior.
- Field provenance.
- Terms or license restrictions relevant to storage and reuse.
- Test doubles that prevent network dependence in the normal test suite.

The application must not implement unauthorized scraping of search engines, map products,
directories, or social networks.

### 12.3 Prospect Record

A prospect may contain:

- Business name.
- Normalized website and domain.
- Business category.
- Public address and service area.
- Public business phone and email when permitted.
- Public social profile URLs when permitted.
- Source provider, source record ID, and source URL.
- First discovered, last verified, and source-updated timestamps.
- Website availability and discovered-page count.
- Qualification state, notes, tags, and owner.
- Data-confidence and duplicate-review state.

The system must not attempt to collect "all possible data." Only documented fields with a valid
business purpose, allowed source, provenance, and retention policy may be stored.

### 12.4 Prospect Lifecycle

Supported prospect states:

- `new`
- `reviewing`
- `qualified`
- `not-qualified`
- `promoted`
- `suppressed`

Promotion must be explicit. It must create or link a client while preserving the original
prospect provenance and preventing duplicate clients.

## 13. Website Verification and Opportunity Signals

The system may perform a lightweight, bounded website verification for a prospect after the
source record is saved. This process may determine:

- Website reachability.
- HTTPS availability.
- Normalized final domain.
- Homepage title.
- Approximate eligible-page count within a strict discovery limit.
- Obvious safe signals suitable for qualification.

Any pre-audit indicator must be labeled an **opportunity signal**, not an audit finding or audit
score. It must remain traceable to the observed data and must not claim legal, accessibility,
security, or performance compliance.

## 14. Deduplication and Data Quality

The system must detect possible duplicates using normalized values such as:

- Website domain.
- Provider record ID.
- Public phone number.
- Normalized business name and address.

Exact normalized-domain matches should be blocked or linked automatically where safe. Fuzzy
matches must be presented for human review and must not be merged automatically.

Every imported or enriched field must retain source provenance and last-verified time. New data
must not overwrite user-edited values silently.

## 15. Suggested Data Model

The detailed schema will be defined during implementation, but the minimum entities are:

- `Workspace`
- `User`
- `Client`
- `Website`
- `WebsitePage`
- `PageDiscoveryRun`
- `AuditScope`
- `AuditJob`
- `AuditResultRecord`
- `ReportArtifact`
- `Prospect`
- `DiscoveryCampaign`
- `DiscoverySourceRecord`
- `ActivityEvent`
- `SuppressionRecord`

Database records must use stable generated IDs, UTC timestamps, explicit lifecycle states, and
runtime-validated boundaries. Audit results must retain their existing schema version.

## 16. System Architecture

The approved stack and detailed process boundaries are defined in
`context/desktop_app_stack.md`.

```text
Electron Main Process
  |
  +-- Application lifecycle, SQLite/Prisma, artifacts, and typed IPC
  +-- Preload / contextBridge
  |       |
  |       v
  |   Sandboxed React and TypeScript Renderer
  |
  +-- Electron Utility Process
          +-- Existing crawler and audit orchestrator
          +-- Playwright, Lighthouse, and report generators
          +-- Approved provider adapters
```

The initial stack is Electron, React, TypeScript, Electron Forge with Webpack, SQLite, Prisma,
Zod, Pino, and Electron `utilityProcess`. The application must not require a local HTTP API,
PostgreSQL, Redis, or a separately installed Node.js runtime.

The existing CLI must remain usable. Electron lifecycle, persistence, IPC, and renderer concerns
must not be added directly to crawler, scanner, scoring, or report domain modules.

## 17. UI and Interaction Requirements

The project-local Impeccable skill at `.agents/skills/impeccable/SKILL.md` is mandatory for the
whole PRD-2 user interface. It must be used for every screen, component, workflow, state,
responsive adaptation, accessibility pass, visual critique, implementation, and Electron
window-based visual verification. A UI feature is not complete when only its default window state has been
implemented.

- Use a restrained application shell with predictable navigation and compact information density.
- Use tables for clients, prospects, website pages, audits, and reports where comparison matters.
- Use standard checkboxes for page selection and bulk actions.
- Use filters, search, status labels, and saved selection state.
- Use icons for familiar actions and provide tooltips for unfamiliar icon-only controls.
- Avoid nested cards, marketing-style hero sections, decorative gradients, and oversized type.
- Provide loading skeletons, useful empty states, retry states, permission states, and partial-data
  states.
- All controls must support keyboard access, visible focus, readable contrast, and appropriate
  accessible names.
- Destructive actions must be visually and behaviorally distinct from ordinary commands.
- Audit progress must remain understandable after renderer reload, window recreation, or
  application restart where recovery is supported.
- The desktop UI must remain usable at representative compact, standard, and wide resizable
  window sizes and under operating-system display scaling.

## 18. Security, Privacy, and Compliance

- Validate every IPC sender, channel, argument, identifier, state transition, and resolved path.
- Keep database, filesystem, shell, job, and provider capabilities outside the renderer process.
- Store provider secrets in environment configuration or an approved secret store.
- Protect persisted secrets and never expose them through renderer state or logs.
- Never accept renderer-provided filesystem paths for unrestricted access.
- Keep `nodeIntegration` disabled and keep context isolation and renderer sandboxing enabled.
- Expose only purpose-specific typed capabilities through preload and `contextBridge`.
- Preserve SSRF protection for client and prospect website requests.
- Block private and sensitive network targets by default.
- Bound all discovery, crawl, enrichment, and audit jobs.
- Record provider provenance, collection time, and permitted retention information.
- Support suppression, deletion, and do-not-contact states.
- Do not collect unnecessary personal data or infer sensitive traits.
- Do not send outreach or submit forms automatically.
- Maintain activity records for promotion, deletion, suppression, audit creation, and report access.

## 19. Non-Functional Requirements

### 19.1 Reliability

- Jobs must survive renderer reloads and recover safely after application restarts where possible.
- Duplicate job submissions must be prevented through idempotency controls.
- Partial failures must remain visible and recoverable.
- Browser, network, and worker resources must close after success, failure, timeout, or
  cancellation.

### 19.2 Performance

- Client, prospect, page, audit, and report lists must use database-backed pagination.
- Search and common filters must use indexed normalized fields.
- Page discovery and audit work must run outside the renderer and Electron main event loop.
- UI interaction should remain responsive while jobs run.

### 19.3 Observability

- Use structured logs with job, client, audit, campaign, and workspace IDs where applicable.
- Record job attempts, durations, state changes, and failure classifications.
- Do not expose secrets, authorization data, raw cookies, or unnecessary personal data in logs.

### 19.4 Accessibility

- Meet WCAG 2.2 AA expectations for the application UI where applicable.
- Use semantic tables, labels, headings, status messages, and keyboard-operable controls.
- Do not communicate selection, status, or severity through color alone.

## 20. Testing Requirements

- Unit tests for schemas, normalization, lifecycle transitions, recommendation logic,
  deduplication, IPC validation, and path-access policies.
- Integration tests for SQLite persistence, IPC, page discovery, immutable scopes, utility-process
  transitions, report access, prospect import, and promotion.
- End-to-end tests for client creation through report export or opening.
- End-to-end tests for discovery campaign through prospect promotion.
- Controlled local website fixtures for page discovery and audit execution.
- Provider adapters must use deterministic test doubles in normal tests.
- Accessibility, responsive-layout, loading, empty, error, and permission states must be tested.
- Destructive and privacy-sensitive operations require explicit regression coverage.

## 21. Acceptance Criteria

### 21.1 Release 2A Acceptance

- A user can create a client with a valid website URL.
- The system discovers and stores eligible same-domain website pages safely.
- The user can search, filter, select, exclude, and save pages for an audit.
- Starting an audit creates an immutable scope containing exactly the selected pages.
- The audit runs as a background job and remains observable after a page refresh.
- Partial failures do not remove successful results.
- Completed reports can be opened, revealed, or exported from the associated client and audit.
- Historical audit scope and reports remain unchanged after website rediscovery.
- The existing CLI remains operational.

### 21.2 Release 2B Acceptance

- A user can create a bounded campaign using a supported provider, location, and category.
- Imported prospects retain source provenance and collection timestamps.
- Duplicate domains are prevented or presented for review.
- Prospect website verification preserves SSRF and crawl safety controls.
- A user can qualify, suppress, or explicitly promote a prospect.
- Promotion creates or links one client without losing prospect provenance.
- No prospect is added to Clients automatically.
- No outreach, form submission, prohibited scraping, or sensitive-data inference occurs.

## 22. Risks and Mitigations

### Risk: Client and prospect records become mixed

Mitigation: Maintain separate entities, routes, permissions, states, and explicit promotion.

### Risk: Page rediscovery changes historical audits

Mitigation: Create immutable audit scopes and retain page-inventory history.

### Risk: Long audits freeze or destabilize the desktop UI

Mitigation: Run durable jobs in Electron utility processes with persisted progress, cancellation,
and crash recovery.

### Risk: Provider terms prohibit collection or retention

Mitigation: Require provider-specific review and adapters before enabling a source.

### Risk: Duplicate and outdated businesses reduce usefulness

Mitigation: Normalize domains, preserve provenance, track verification dates, and require review
for fuzzy matches.

### Risk: Prospect signals are mistaken for completed audits

Mitigation: Use separate terminology, models, views, and labels for opportunity signals.

### Risk: Discovery traffic overloads websites or providers

Mitigation: Enforce strict result limits, concurrency, delays, retries, timeouts, and cancellation.

## 23. Open Product Decisions

These decisions must be resolved before implementation reaches the affected feature:

- Approved business-discovery providers and their permitted data fields.
- Geographic search behavior, including whether radius search is provider-dependent.
- Report and screenshot retention periods.
- Backup, restore, and corruption-recovery UX for the local SQLite database.
- Code-signing certificate ownership and automatic-update hosting.
- Whether cloud synchronization or multi-user collaboration belongs in a later PRD.

## 24. Recommended Delivery Sequence

1. Application and persistence foundation.
2. Client management.
3. Website page discovery and inventory.
4. Page selection and immutable audit scopes.
5. Background audit jobs and progress.
6. Audit history and report access.
7. Release 2A acceptance and hardening.
8. Prospect data model and lifecycle.
9. Discovery campaigns and approved provider adapters.
10. Website verification, provenance, and deduplication.
11. Prospect qualification and client promotion.
12. Release 2B compliance, acceptance, and hardening.
