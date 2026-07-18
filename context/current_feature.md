# Current Feature: Form Scanner

## Status

Completed

## Branch

`feature/form-scanner`

## Objective

Detect form and form-like flows from static HTML, assess field quality and submission
readiness without interacting with the site, and emit evidence-based findings focused on
accessibility, conversion confidence, and safe implementation basics.

## Included Scope

- Detect native forms and form controls outside forms.
- Classify contact, booking, signup, checkout, lead, and generic form intent.
- Extract bounded, non-sensitive field and form facts without retaining values.
- Check visible and programmatic labels, placeholder-only fields, required state,
  semantic input types, and autocomplete attributes.
- Check submit controls, native-validation bypass, privacy/consent text, and CAPTCHA or
  anti-spam signals.
- Aggregate form counts and normalize issues into validated `forms` findings.
- Preserve the hard safety boundary: no clicks, submissions, uploads, accounts, or payment
  tests.

## Excluded Scope

- Submitting any form or synthetic data.
- Testing server-side delivery, payment processing, authentication, or CAPTCHA completion.
- JavaScript-only controls not represented in supplied DOM evidence.
- Legal conclusions about consent or privacy compliance.

## Acceptance Criteria

- Extraction is bounded and never stores field values.
- Native forms and orphan controls are counted.
- Common conversion-flow types are classified deterministically.
- Label, type, autocomplete, submit, validation, privacy, and anti-spam checks are covered.
- Payment, account, upload, and other sensitive flows are never exercised.
- Findings include severity, business impact, recommendation, URL, and selector evidence.
- Finding IDs and ordering are deterministic and schema-valid.
- Tests use static fixtures and prove field values are not retained.
- All project quality and dependency gates pass.

## Verification Plan

1. Run extraction tests for form types, fields, labels, and safety boundaries.
2. Run each finding rule against focused fixtures.
3. Run formatting, linting, strict type checking, and the full test suite.
4. Run exact npm build, dependency compatibility, and production security checks.

## History

- 2026-07-18: Project Foundation completed in commit `ee81681`.
- 2026-07-18: CLI Feature Set completed in commit `8eefd54`.
- 2026-07-18: URL Normalization and Crawl-Scope Safety completed in commit `3008d18`.
- 2026-07-18: Same-Domain Crawler completed in commit `ff859c1`.
- 2026-07-18: Page Classification completed in commit `aa092f7`.
- 2026-07-18: Browser Inspection and Evidence completed in commit `13ef0bd`.
- 2026-07-18: SEO Scanner completed in commit `b0ba224`.
- 2026-07-18: Form Scanner documented and started.
- 2026-07-18: Added bounded, value-free extraction for native forms, orphan controls,
  field semantics, label state, required/autocomplete state, and form readiness signals.
- 2026-07-18: Added deterministic classification for contact, booking, signup, checkout,
  lead, and generic flows.
- 2026-07-18: Implemented schema-validated findings for labels, placeholders, input types,
  autocomplete, submit controls, validation bypass, privacy, anti-spam, and sensitive-flow
  manual-review limitations without submitting any data.
- 2026-07-18: Verified repository formatting, linting, strict type checking, 148 tests,
  exact npm build, dependency compatibility, and a clean production dependency audit.
