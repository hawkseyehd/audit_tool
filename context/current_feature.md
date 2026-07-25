# Current Feature: Discovery Campaigns and Provider Adapters

## Status

Complete

## Branch

`feature/discovery-campaigns`

## Feature

Feature 30 from `context/feature_list_in_order.md`.

## Objective

Let a user create, execute, monitor, cancel, and safely resume a bounded business-discovery
campaign through the approved DataForSEO Business Listings API, then import permitted public
records into the separate prospect workspace with complete provenance.

## Included Scope

- Add validated campaign creation for country, region, locality, category, keywords, optional
  coordinate radius, result limit, required website, required fields, and exclusions.
- Integrate DataForSEO Business Listings Search Live through a provider-specific adapter.
- Keep DataForSEO credentials in `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD`; never expose them
  to renderer contracts, persisted records, logs, or errors.
- Execute provider requests in the Electron utility process with strict timeouts, pacing, bounded
  retries, exponential backoff, cancellation, and continuation tokens.
- Persist campaign lifecycle, result/import/suppression counts, warnings, failures, progress,
  continuation, and timestamps after each completed provider page.
- Recover interrupted queued or running campaigns into a resumable paused state at startup.
- Preserve provider record IDs, source URLs, collection time, source update time, permitted fields,
  field-level provenance, and retention metadata on every imported prospect.
- Add sender-validated campaign IPC and a narrow preload API.
- Build and visually verify an Impeccable campaign creation, history, progress, warning,
  credential-missing, cancellation, failure, empty, and resume experience.
- Add deterministic provider and campaign execution tests without live paid API requests.

## Excluded Scope

- Scraping Google Search, Google Maps, directories, social networks, or any provider page.
- Storing ratings, reviews, photos, hours, descriptions, or fields outside the approved policy.
- Prospect website verification and opportunity signals from Feature 31.
- Prospect scoring, promotion, or duplicate resolution from Feature 32.
- Provider credential-entry UI, outreach, form submission, or automatic client creation.

## Acceptance Criteria

- A configured user can create a bounded DataForSEO campaign by supported geography and category.
- Radius controls appear only for providers that support them and require valid coordinates.
- Invalid, excessive, or unsupported campaign criteria are rejected before any paid request.
- Campaigns remain observable through queued, running, completed, failed, paused, and cancelled
  states and can be cancelled or resumed where continuation is available.
- Provider calls run outside the renderer and main event loop with bounded requests and cleanup.
- Imported prospects retain approved source provenance and collection timestamps.
- Suppressed records are counted and never silently re-imported.
- Credentials and authorization headers never reach renderer state, persistence, or logs.
- Existing prospect, client, audit, report, package, and CLI behavior remains operational.
- Formatting, lint, type checking, tests, build, Impeccable detection, accessibility, and visual
  checks pass.

## History

- 2026-07-25: Feature started after Feature 29 completed on
  `feature/prospect-data-foundation`.
- 2026-07-25: DataForSEO Business Listings API approved by the project owner for Feature 30.
- 2026-07-25: Added validated campaign creation, DataForSEO field-minimizing adapter, utility
  worker execution, bounded retry and pacing, cancellation, safe continuation, durable progress,
  suppression-aware imports, and the Impeccable campaign monitor.
- 2026-07-25: Passed Prisma validation, formatting, zero-warning linting, strict CLI and desktop
  type checking, 282 tests across 62 files, the CLI production build, Windows x64 Electron
  packaging, packaged ASAR smoke, axe scans, Impeccable detection, and desktop visual review.
