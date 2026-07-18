# Current Feature: CLI Feature Set

## Status

Completed

## Branch

`feature/cli`

## Objective

Provide the `website-audit audit <url>` command, validate its options through the
canonical audit configuration, and connect it to an injectable audit runner that later
features can replace with the full orchestrator.

## Included Scope

- Add the `website-audit` executable entry point.
- Add the `audit <url>` command.
- Support `--max-pages`, `--output`, `--mobile`, `--desktop`, `--json`, `--markdown`,
  and `--no-submit-forms`.
- Default to desktop when no viewport flag is supplied.
- Default to JSON and Markdown when no output-format flag is supplied.
- Keep form submission disabled in the MVP CLI.
- Validate all CLI input with Commander and the canonical Zod config schema.
- Print clear start, initialized/completed, scanned-page, and output-path messages.
- Return useful exit codes and errors for invalid arguments, invalid configuration, and
  runner failures.
- Add a foundation runner that creates a safe audit output workspace without pretending
  crawling or scanning has occurred.

## Excluded Scope

- URL normalization beyond configuration validation.
- Crawling, page classification, browser navigation, screenshots, or scanners.
- Scoring and report file generation.
- Form submission enablement.

## Acceptance Criteria

- `website-audit audit https://example.com` validates and initializes an audit workspace.
- All required CLI options appear in help output.
- Invalid URLs and numeric options return exit code 2 with actionable messages.
- Runtime failures return exit code 1 without exposing stack traces.
- The runner receives a fully validated `AuditConfig`.
- Form submission remains `false` for every supported CLI invocation.
- CLI behavior is covered by focused unit tests.
- Formatting, linting, type checking, tests, dependency checks, and build pass.

## Verification Plan

1. Run CLI unit tests and a built-CLI smoke test.
2. Run formatting verification.
3. Run linting.
4. Run strict TypeScript checks.
5. Run the full test suite.
6. Run `npm run build`.

## History

- 2026-07-18: Project Foundation completed in commit `ee81681`.
- 2026-07-18: CLI feature documented and started.
- 2026-07-18: Implemented the Commander CLI, required flags, validated configuration
  mapping, structured lifecycle logging, safe foundation runner, and executable entry
  point.
- 2026-07-18: Verified 34 tests, linting, formatting, strict type checking, pnpm and npm
  builds, a built-command smoke test, and a clean production dependency audit.
