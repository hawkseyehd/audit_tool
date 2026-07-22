# Coding Standards

## 1. Purpose

This document defines the mandatory engineering standards for the Website Audit Tool. It applies to application code, tests, scripts, configuration, generated output schemas, and documentation.

The words **must**, **must not**, **should**, and **may** are intentional:

- **Must**: required for approval.
- **Must not**: prohibited.
- **Should**: expected unless a documented reason justifies an exception.
- **May**: optional.

When this guide does not cover a situation, follow the existing project pattern, choose the simplest maintainable solution, and document any important tradeoff.

## 2. Core Engineering Principles

Every change must be:

- Correct: it satisfies the requirement and handles known edge cases.
- Readable: another engineer can understand it without hidden context.
- Focused: it solves one clear problem without unrelated refactoring.
- Testable: business logic can be verified without unnecessary browser or network access.
- Secure: all external input is treated as untrusted.
- Observable: failures contain enough context to diagnose them.
- Reproducible: the same validated input produces stable structured output where external conditions permit.
- Backward-compatible: public CLI behavior and report schemas are not changed accidentally.

Prefer explicit, boring code over clever code. Optimize for maintainers first and machines second unless measurements prove that performance work is needed.

## 3. Project Structure

Use clear ownership boundaries. A recommended structure is:

```text
src/
  cli/             # Commands, flags, terminal output, exit codes
  config/          # Defaults, environment loading, Zod validation
  core/            # Shared domain types and audit orchestration
  crawler/         # URL discovery, filtering, prioritization
  classifiers/     # Page classification
  scanners/        # SEO, forms, security, UX, analytics, a11y, Lighthouse
  scoring/         # Severity and score calculations
  evidence/        # Screenshots and supporting evidence
  reports/         # Markdown and JSON generation
  infrastructure/  # Browser, filesystem, HTTP, logging adapters
  utils/           # Small domain-independent helpers only
tests/
  unit/
  integration/
  fixtures/
  e2e/
```

Rules:

- Keep domain logic independent from CLI, filesystem, browser, and network code.
- A scanner must own its checks and map results into shared finding models.
- Shared utilities must be genuinely reusable and must not become a miscellaneous dumping ground.
- Avoid circular dependencies. Dependencies should point from entry points and infrastructure toward domain contracts, not the reverse.
- Keep one primary responsibility per module.
- Split a file when it mixes responsibilities or becomes difficult to navigate; do not split only to satisfy an arbitrary line count.
- Expose a small public API from each module. Do not export internal helpers without a consumer.

## 4. TypeScript Standards

### 4.1 Compiler Configuration

- Enable TypeScript strict mode.
- Enable checks that prevent unsafe indexed access and accidental optional-property behavior where supported.
- Do not suppress compiler errors to make a build pass.
- Use a supported Node.js target and module system consistently across source, tests, and tooling.
- Keep production code free of test-only globals and types.

Recommended compiler options include:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### 4.2 Type Safety

- Do not use `any`. Use `unknown`, validate or narrow it, then continue with a known type.
- Do not use unsafe type assertions to bypass validation.
- Prefer discriminated unions for states and result variants.
- Represent a closed set of values with string literal unions or `as const` objects.
- Use `interface` for extensible object contracts and `type` for unions, aliases, and compositions. Consistency within a module matters most.
- Model optional data accurately. Do not use empty strings or magic numbers to represent missing values.
- Mark data immutable with `readonly` when mutation is not required.
- Use `satisfies` when checking an object against a contract while preserving narrow inference.
- Add explicit return types to exported functions and public methods.
- Allow inference for obvious local variables and short private helpers.
- Never use non-null assertions unless an invariant has been checked immediately before it and cannot be expressed more safely.
- Validate all data that crosses a trust boundary, including CLI input, environment variables, HTTP data, parsed HTML-derived values used structurally, configuration files, and persisted JSON.

Example:

```ts
const severityValues = ["critical", "high", "medium", "low", "info"] as const;

export type Severity = (typeof severityValues)[number];

export interface AuditFinding {
  readonly id: string;
  readonly category: FindingCategory;
  readonly severity: Severity;
  readonly title: string;
  readonly description: string;
  readonly recommendation: string;
  readonly pageUrl?: string;
}
```

### 4.3 Functions and Classes

- A function should do one conceptual job.
- Prefer pure functions for normalization, classification, scoring, and result transformation.
- Keep parameter lists small. Use a typed options object when several values belong together.
- Do not use boolean parameters whose meaning is unclear at the call site; use named options.
- Prefer early returns to deep nesting.
- Use classes only when lifecycle, state, or dependency ownership makes them useful.
- Prefer composition over inheritance.
- Inject clocks, ID generators, filesystem access, HTTP clients, and browser adapters when deterministic tests need control over them.
- Do not mutate function arguments unless the contract explicitly requires it.

## 5. Naming Standards

- Use `camelCase` for variables, functions, and object properties.
- Use `PascalCase` for types, interfaces, classes, schemas, and components.
- Use `UPPER_SNAKE_CASE` only for true constants shared as fixed configuration.
- Use kebab-case for ordinary source filenames, such as `url-normalizer.ts`.
- Use `.test.ts` for tests and `.fixture.ts` only for typed fixture modules.
- Name booleans as questions or states: `isExternal`, `hasForm`, `shouldCaptureScreenshot`.
- Name collections with plural nouns: `pages`, `findings`, `normalizedUrls`.
- Use domain language from the PRD consistently: `AuditFinding`, `ScannedPage`, `PageType`, and `Severity`.
- Include units in names when ambiguity is possible: `timeoutMs`, `delayMs`, `sizeBytes`.
- Avoid abbreviations except universally understood terms such as `url`, `http`, `html`, and `id`.
- Avoid vague names such as `data`, `item`, `obj`, `temp`, `handle`, and `process` when a domain-specific name is available.
- Do not prefix interfaces with `I` or types with `T`.

## 6. Formatting and Static Analysis

- Use the repository's formatter and linter; do not hand-format around them.
- Formatting and linting must pass before review.
- Do not disable a lint rule for an entire file when a narrow exception is enough.
- Every lint suppression must include a short reason.
- Remove unused imports, variables, exports, and dead code.
- Do not commit commented-out code. Version control already preserves history.
- Use comments to explain why a non-obvious decision exists, not what an obvious line does.
- Keep TODO comments actionable and traceable: include an issue reference or enough context to resolve them.
- Use ASCII text in source unless Unicode is required by a test, content rule, or user-facing output.

### 6.1 UI and Frontend Standard

- The project-local Impeccable skill at `.agents/skills/impeccable/SKILL.md` must be used for the
  entire application UI.
- This requirement applies to every page, layout, application shell, component, form, table,
  navigation element, interaction, responsive adaptation, state, visual audit, and polish pass.
- Before UI work, run the skill's required project-context setup and load its product-interface
  register and any applicable command reference.
- Follow `PRODUCT.md`, `DESIGN.md`, and the active PRD together with the Impeccable instructions.
- UI work is incomplete until loading, empty, error, partial, disabled, permission, success, and
  destructive states relevant to the workflow are implemented.
- UI work must be keyboard accessible, responsive, contrast-safe, and verified visually at
  representative compact, standard, and wide desktop window sizes. Mobile viewports are required
  only for surfaces that explicitly target mobile devices.
- Do not substitute generic generated UI patterns for the project-local skill or bypass its
  required review and visual-QA workflow.

## 7. Imports and Dependencies

- Group imports consistently: Node built-ins, third-party packages, project modules, then type-only imports where the formatter permits.
- Use `import type` for imports used only as types.
- Do not use deep imports into another package's private internals.
- Avoid barrel files that create circular dependencies or hide ownership.
- Add a dependency only when its value is greater than its maintenance, security, and bundle cost.
- Check license, maintenance status, known vulnerabilities, Node.js compatibility, and type quality before adding a package.
- Pin dependencies through the lockfile and commit the lockfile.
- Do not edit generated dependency files manually.
- Keep production and development dependencies correctly separated.
- Remove dependencies that no longer have a runtime or tooling use.

## 8. Validation and Configuration

- Define runtime schemas with Zod for configuration and serialized output.
- Derive TypeScript types from schemas when practical to prevent drift.
- Apply defaults in one configuration module, not throughout the codebase.
- Validate configuration once at the system boundary and pass typed config inward.
- Reject invalid values with actionable messages that name the option and expected format.
- Set safe limits for page counts, timeouts, concurrency, screenshot sizes, redirects, and retries.
- `submitForms` must default to `false` and may only become `true` through explicit user configuration.
- Never hide behavior-changing defaults in scanner implementations.
- Environment variables must be documented and validated at startup.
- Secrets must come from the environment or an approved secret store, never source code or committed configuration.

## 9. Error Handling

- Never swallow an error silently.
- Catch errors only when adding context, translating them into a domain error, recovering, or cleaning up resources.
- Preserve the original error as `cause` when wrapping it.
- Use typed domain errors for expected failures such as invalid input, navigation timeout, blocked page, scan failure, and output failure.
- Distinguish a page-level failure from an audit-level failure. One failed page should not normally terminate the entire audit.
- Do not expose stack traces or secrets in normal CLI output.
- Log enough structured context to diagnose failures: audit ID, scanner, page URL, operation, duration, and error type.
- Return meaningful process exit codes from the CLI.
- Use `try/finally` to close browsers, pages, Chrome processes, file handles, and temporary resources.
- Abort or time out network and browser operations; no external operation may wait forever.

Example:

```ts
try {
  return await scanner.scan(page, context);
} catch (error: unknown) {
  throw new ScannerError("SEO scan failed", {
    cause: error,
    scanner: "seo",
    pageUrl: page.url,
  });
}
```

## 10. Logging and Observability

- Use the selected structured logger; do not scatter `console.log` through domain code.
- CLI presentation and diagnostic logging are separate concerns.
- Use consistent log levels: `debug` for diagnostic detail, `info` for lifecycle events, `warn` for recoverable problems, and `error` for failed operations.
- Include an `auditId` in every audit-related log record.
- Record scanner and page durations so slow work can be identified.
- Redact passwords, tokens, authorization headers, cookies, submitted field values, and personal data.
- Avoid logging full HTML or response bodies by default.
- Error logs must be useful without requiring the failing action to be rerun.

## 11. Async and Concurrency

- Always handle returned promises; no floating promises.
- Use `async`/`await` for readable control flow.
- Do not use `forEach` with async callbacks.
- Bound concurrency for crawling and scanning; the MVP target is 2-3 pages concurrently.
- Make rate limits, delays, retry counts, and timeouts configurable within safe bounds.
- Retry only transient and idempotent operations.
- Use capped exponential backoff with jitter when retries are appropriate.
- Do not retry validation errors, permission failures, or deterministic scanner defects.
- Support cancellation with `AbortSignal` where long-running operations allow it.
- Ensure cleanup happens after cancellation and partial failure.
- Avoid shared mutable state between concurrent scans.

## 12. URL, HTTP, and Crawler Safety

- Use the platform `URL` API for parsing, resolving, and normalizing URLs. Do not parse URLs with regular expressions.
- Normalize URLs in one canonical module.
- Remove fragments before deduplication.
- Define and test the trailing-slash and query-parameter policy.
- Compare normalized hostnames and ports when enforcing same-origin or same-domain rules.
- Reject unsupported schemes such as `file:`, `data:`, `javascript:`, `mailto:`, and `tel:`.
- Filter downloads and known non-page resources before navigation.
- Limit redirects and revalidate the destination after every redirect.
- Prevent unintended access to localhost, loopback, link-local, private network, and cloud metadata addresses unless an explicit trusted mode allows them.
- Recheck resolved addresses to reduce DNS rebinding risk.
- Do not bypass TLS validation in production behavior.
- Apply request, response-size, navigation, and total-audit limits.
- Identify the tool with an appropriate user agent where applicable.
- Avoid aggressive traffic and honor configured crawl delays.
- Robots policy must be explicit, documented, and tested.

## 13. Browser Automation Standards

- Create browser contexts with explicit viewport, locale, user agent, permissions, and timeout settings.
- Keep desktop and mobile runs isolated when their state could affect results.
- Close every page, context, browser, and Lighthouse Chrome process in `finally` blocks.
- Block unexpected downloads and dialogs.
- Do not persist cookies, local storage, or authenticated state unless the feature explicitly requires it.
- Do not execute destructive actions on audited sites.
- Do not submit forms by default.
- When form submission is explicitly enabled, use clearly synthetic data and require a narrowly scoped implementation.
- Use stable semantic locators where interaction is required. Avoid selectors tied to generated class names.
- Wait for a meaningful page state with bounded timeouts; do not rely on arbitrary fixed sleeps.
- Treat page-provided content as untrusted.
- Store screenshots under the current audit directory with sanitized, collision-resistant filenames.
- Screenshots and evidence must not contain secrets or personal information when avoidable.

## 14. Scanner Design

Each scanner must:

- Implement a shared scanner contract.
- Declare a stable scanner name and supported scope.
- Accept validated context and return structured results.
- Remain independent of CLI formatting and report rendering.
- Produce deterministic findings for the same captured evidence.
- Continue gracefully when an individual check cannot run.
- Include evidence, impact, and an actionable recommendation.
- Avoid duplicate findings for the same root cause on the same page.
- Use stable rule IDs so reports can be compared over time.
- Have focused unit tests for every rule and integration tests for important browser behavior.

A finding should contain, where applicable:

- Stable rule ID.
- Category and severity.
- Short title.
- Plain-language description.
- Business or user impact.
- Affected URL.
- Selector, metric, header, or screenshot evidence.
- Expected and actual values.
- Concrete recommendation.
- Scanner name and audit timestamp.

Scanner-specific raw output must not leak directly into the shared report model. Map external library results through an adapter so dependency upgrades do not silently change the public schema.

## 15. Scoring Standards

- Keep scoring logic centralized and independent from report presentation.
- Define category weights and severity penalties as named, documented configuration.
- Validate that configured weights form the expected total.
- Clamp scores to the documented range.
- Use deterministic rounding rules.
- Do not count the same root issue multiple times merely because multiple tools detected it.
- Make unavailable scans visible; do not treat missing data as a perfect score.
- Add regression tests with fixed findings and expected category and overall scores.
- Treat weight or formula changes as public behavior changes requiring review and release notes.

## 16. Data and Report Contracts

- Define one canonical domain model for findings, pages, summaries, and audit results.
- Version persisted JSON schemas from the first public release.
- Validate JSON output before writing it.
- Generate Markdown from structured results, never by scraping logs.
- Keep report ordering deterministic: priority, category, page, then stable rule ID.
- Escape or sanitize untrusted page content before including it in Markdown or HTML-capable output.
- Use relative evidence links that remain valid inside the audit output directory.
- Write reports atomically where practical so interrupted runs do not leave a valid-looking partial file.
- Include tool version, schema version, audit ID, target, timestamps, configuration summary, and scan limitations.
- Use ISO 8601 timestamps in UTC for serialized data.
- Do not persist secrets, cookies, authorization data, or form field values.
- Keep raw dependency output separate from stable public output and apply storage limits.

## 17. Security and Privacy

- Follow least privilege for filesystem, browser permissions, network access, and credentials.
- Treat target URLs, page content, HTTP headers, redirects, filenames, and CLI arguments as untrusted.
- Prevent path traversal by resolving output paths and verifying they remain inside the selected audit directory.
- Sanitize user-controlled values used in filenames.
- Never build shell commands by concatenating untrusted input.
- Prefer library APIs over spawning shell processes.
- If a process must be spawned, pass arguments as an array and validate each argument.
- Never use `eval`, `new Function`, or dynamic code execution with external content.
- Protect against SSRF as described in the crawler standards.
- Do not collect more personal data than the audit requires.
- Redact sensitive evidence and define a retention policy for screenshots and raw reports.
- Keep dependencies patched and review security advisories.
- Do not claim penetration-testing coverage; the MVP performs basic security checks only.
- Security findings must be evidence-based and avoid overstating certainty.

## 18. Performance and Resource Management

- Measure before optimizing.
- Avoid launching a new browser when contexts or pages can be safely reused.
- Bound queues, in-memory HTML, screenshots, Lighthouse artifacts, logs, and raw results.
- Stream or incrementally write large artifacts when it improves memory safety.
- Avoid repeated parsing, navigation, or scanning of the same normalized URL.
- Cache only data with a clear validity period and invalidation rule.
- Track duration per page and scanner.
- Set performance budgets for representative audits and detect significant regressions.
- Ensure partial failures do not leak Chrome processes or temporary files.

## 19. Testing Standards

### 19.1 Test Layers

- Unit tests: pure logic such as URL normalization, classification, rule mapping, scoring, and formatting.
- Integration tests: filesystem output, HTTP behavior, browser adapters, scanner integration, and schema validation.
- End-to-end tests: CLI execution against controlled local fixture sites.
- Contract tests: stable JSON output and scanner adapters.
- Regression tests: every fixed bug should gain a test that would have caught it.

### 19.2 Test Quality

- Use Arrange, Act, Assert or an equally clear structure.
- Name tests by behavior and expected result.
- Test success, boundary values, invalid input, timeouts, partial failure, and cleanup.
- Keep tests deterministic and isolated.
- Do not depend on public websites in the normal test suite.
- Use local fixture servers and committed fixtures for network and browser tests.
- Freeze or inject time, randomness, and IDs when snapshots or exact outputs depend on them.
- Avoid broad snapshots. Prefer focused assertions on meaningful behavior.
- Do not weaken assertions merely to make a failing test pass.
- Ensure test cleanup runs even when assertions fail.
- Parallel tests must not share writable paths, ports, browser state, or mutable fixtures.
- Coverage is a diagnostic, not the goal. Critical branches and safety behavior must be covered even when the overall percentage is high.

Required edge cases include:

- URL without a protocol.
- Fragments, trailing slashes, redirects, and duplicate URLs.
- External, unsupported, private-network, and downloadable URLs.
- Empty pages, malformed HTML, non-HTML responses, and large responses.
- Browser timeout, inaccessible page, failed scanner, and interrupted audit.
- Missing headers, missing metadata, malformed forms, and duplicate findings.
- Output path traversal and invalid configuration.
- Browser and Chrome process cleanup after success and failure.
- Stable JSON schema and Markdown ordering.

## 20. Documentation Standards

- Every public module and exported API must have a clear purpose discoverable from naming, types, or concise documentation.
- Use TSDoc for exported APIs when types alone do not explain behavior, side effects, errors, units, or constraints.
- Keep README setup, commands, examples, supported Node.js version, and output behavior current.
- Document every CLI option, default, environment variable, exit code, and safety limitation.
- Record significant architecture decisions in short ADRs.
- Update documentation in the same change as behavior.
- Examples must be runnable and must not contain real credentials or personal data.
- Do not duplicate the same rule in several documents; link to the source of truth.

## 21. Git and Change Management

- Keep commits focused and reviewable.
- Write imperative commit subjects that explain the outcome, such as `Add same-domain URL filtering`.
- Do not mix formatting-only changes with behavioral changes unless necessary.
- Never commit secrets, `.env` files, local audit output, browser binaries, coverage folders, build output, or editor-specific files.
- Review the staged diff before committing.
- Rebase or merge according to the team's chosen workflow; do not rewrite shared history without agreement.
- Use semantic versioning for released packages.
- Maintain a changelog for user-visible behavior.
- Mark breaking CLI or schema changes clearly and provide migration guidance.

## 22. Code Review Standards

The author must provide:

- A clear summary of the change and its reason.
- Testing performed and relevant results.
- Screenshots or report samples when output presentation changes.
- Security, compatibility, or performance implications.
- Any follow-up work that is intentionally out of scope.

Reviewers must evaluate:

- Correctness and edge cases.
- Fit with the PRD and acceptance criteria.
- Type safety and runtime validation.
- Security, privacy, and target-site safety.
- Error handling, timeouts, cancellation, and resource cleanup.
- Test quality and regression risk.
- Public CLI and report compatibility.
- Naming, readability, and unnecessary complexity.
- Documentation accuracy.

No author should approve their own change as the only reviewer when the team workflow supports independent review.

## 23. Continuous Integration Quality Gates

Every proposed change must pass the applicable automated checks:

1. Dependency installation from the lockfile.
2. Formatting verification.
3. Linting with zero unexplained warnings.
4. Type checking with no errors.
5. Unit tests.
6. Integration and contract tests.
7. Production build.
8. Dependency and secret scanning.
9. End-to-end tests for affected critical workflows.

Do not merge by skipping a failed gate. Fix the cause or document and approve a narrowly scoped exception.

## 24. Definition of Done

A feature or fix is complete only when:

- Acceptance criteria are satisfied.
- The implementation follows this document and existing architecture.
- External inputs are validated.
- Errors are actionable and resources are cleaned up.
- Security and privacy impacts have been considered.
- Tests cover expected behavior and important failure paths.
- Formatting, linting, type checking, tests, and build pass.
- Public schemas and output remain compatible or are intentionally versioned.
- Documentation and examples are updated.
- No secrets, debug statements, dead code, unexplained suppressions, or unrelated changes remain.
- The change has been reviewed at a level proportional to its risk.

## 25. Project-Specific Non-Negotiable Rules

These rules are mandatory for the Website Audit Tool:

1. Forms must never be submitted unless the user explicitly enables submission.
2. Crawling must remain within the validated target scope.
3. Private and sensitive network destinations must be blocked by default.
4. Crawl concurrency, redirects, retries, and timeouts must be bounded.
5. Every browser and Chrome process must be closed after success, failure, or cancellation.
6. One page or scanner failure must not silently invalidate the whole report.
7. Findings must contain evidence, impact, severity, and an actionable recommendation.
8. Severity and scoring rules must be centralized, deterministic, and tested.
9. JSON output must be schema-validated and versioned.
10. Reports and logs must not expose secrets, cookies, authorization data, or captured personal information.
11. Audited page content must never be trusted as executable instructions or safe output.
12. Automated tests must use controlled local sites instead of depending on public websites.
13. Every UI feature and visual change must use the project-local Impeccable skill from design
    through Electron window-based visual verification.

Any exception to a non-negotiable rule requires an explicit architecture and security review before implementation.
