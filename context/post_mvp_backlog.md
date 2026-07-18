# Post-MVP Backlog

## Status

The MVP is complete and accepted. The items below are deferred product work, not unfinished MVP
requirements. Each item must receive its own PRD, branch, threat review, tests, and acceptance
criteria before implementation.

## Definition Of Ready

A backlog item is ready for implementation only when it has:

- A named user, problem statement, supported workflow, and explicit exclusions.
- Data models, schema/versioning impact, retention rules, and migration strategy where applicable.
- UX flows and responsive states for any interface work; all UI design and implementation must
  use the project-local Impeccable skill.
- Security and privacy review covering credentials, tenant boundaries, authorization, secrets,
  external content, delivery destinations, and audit logs as applicable.
- Provider/API choices, rate limits, retry/idempotency behavior, failure policy, and test doubles
  for integrations.
- Measurable acceptance criteria, observability, cleanup, and rollback expectations.
- A dependency and maintenance review before adding packages or hosted infrastructure.

## Recommended Sequence

### Wave 1: Portable Reports And Review

#### PM-01 HTML report export

Depends on the canonical `AuditResult` and Markdown report semantics. Define accessible HTML
structure, standalone asset policy, print behavior, escaping, theming, and parity tests.

#### PM-02 PDF export

Depends on PM-01. Select a deterministic HTML-to-PDF runtime, define page layout, headers,
footers, link behavior, screenshot handling, font licensing, and visual regression checks.

#### PM-03 Before/after comparison engine

Depends on stable audit schemas. Define target identity, rule matching, score deltas, resolved/new/
unchanged finding states, incompatible schema handling, and comparison output contracts.

#### PM-04 Manual review checklist mode

Define checklist ownership, evidence capture, pass/fail/not-applicable states, reviewer identity,
manual WCAG boundaries, export behavior, and merge rules with automated findings.

### Wave 2: History And Product Workspace

#### PM-05 Stored audit history

Define storage technology, tenant model, retention/deletion, encryption, artifact limits, schema
migrations, backup/restore, and access logging before persisting client data.

#### PM-06 Client and project management

Depends on PM-05. Define tenant isolation, roles, permissions, client/project lifecycle, ownership
transfer, deletion, and personally identifiable information policy.

#### PM-07 Repeat audit comparison

Depends on PM-03, PM-05, and PM-06. Define baseline selection, trend calculations, noise handling,
regression thresholds, and user-visible comparison states.

#### PM-08 Web dashboard

Depends on PM-05 through PM-07. Requires a dedicated frontend PRD and Impeccable-driven design
for navigation, dense audit tables, filtering, comparison, empty/error/loading states,
accessibility, responsive behavior, and performance budgets.

#### PM-09 Scheduled recurring audits

Depends on PM-05 through PM-08. Define scheduler ownership, time zones, concurrency quotas,
robots/politeness policy, retries, cancellation, duplicate suppression, cost limits, alerts, and
credential rotation. Scheduled scans must never bypass public-network or scope controls.

### Wave 3: Advanced Audit Modes

#### PM-10 Staged website audits

Define authorized non-public targets, allowlist administration, environment labels, certificate
policy, data retention, and safeguards that preserve SSRF controls rather than disabling them.

#### PM-11 Authenticated website audits

Depends on PM-10. Define supported authentication methods, secret vaulting, least privilege,
session isolation, MFA constraints, logout/cleanup, redaction, prohibited actions, and explicit
authorization. Credentials must never enter reports, logs, screenshots, or persisted HTML.

#### PM-12 Industry-specific rules and templates

Define supported industries, qualified rule ownership, evidence standards, versioned rule packs,
false-positive review, legal disclaimers, and test fixtures. Templates must not imply legal or
regulatory certification.

#### PM-13 Visual regression testing

Depends on stored history. Define baseline approval, viewport/browser matrix, masking of dynamic
regions, perceptual thresholds, artifact retention, deterministic fonts/animations, and manual
review workflow.

### Wave 4: Delivery And Engineering Integrations

#### PM-14 GitHub CI integration

Define action/CLI packaging, exit thresholds, annotation format, fork/secret behavior, artifact
upload, caching, timeout budgets, and pinned dependency provenance.

#### PM-15 Slack report delivery

Define workspace installation, OAuth scopes, channel authorization, message size, private report
links, retries, revocation, and delivery audit logs. Do not send sensitive evidence by default.

#### PM-16 Email report delivery

Define provider, sender authentication, recipient consent, attachment/link policy, bounce handling,
suppression, retries, encryption expectations, and delivery logs.

#### PM-17 CRM lead-audit integration

Depends on PM-06. Define supported CRM, field mapping, tenant authorization, deduplication,
idempotency, consent and retention, rate limits, deletion propagation, and partial-failure recovery.

### Wave 5: Narrative Enhancements

#### PM-18 AI-generated executive summaries

Define model/provider, approved data boundary, prompt-injection defense for website content,
redaction, grounding exclusively in normalized findings, cost/token limits, timeout/fallback,
human review, and disclosure. Generated text must never invent evidence or change scores.

#### PM-19 Industry-specific business recommendations

Depends on PM-12 and PM-18. Define qualified recommendation sources, industry context inputs,
confidence and citation behavior, prohibited legal/financial claims, and reviewer approval.

#### PM-20 Custom client-ready report tone

Depends on PM-18. Define constrained tone presets, terminology controls, brand inputs, accessibility,
invariant factual content, and regression tests proving that tone changes do not alter evidence,
severity, recommendations, scores, or limitations.

## Backlog Completion Rule

This backlog is complete as a planning artifact when every PRD idea has a stable item and clear
readiness boundary. Individual PM items remain intentionally unimplemented until separately
approved and specified; they must not be bundled into one feature because their security,
storage, UI, provider, and operational requirements differ materially.
