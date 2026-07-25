# Current Feature: Prospect Data Foundation

## Status

Complete

## Branch

`feature/prospect-data-foundation`

## Feature

Feature 29 from `context/feature_list_in_order.md`.

## Objective

Establish a separate, provenance-aware prospect and campaign data model, then provide a
searchable desktop prospect workspace with lifecycle, qualification, suppression, deletion, and
provider-defined retention controls.

## Included Scope

- Add durable Prospect, DiscoveryCampaign, DiscoverySourceRecord, ProspectTag,
  ProspectActivity, and SuppressionRecord models and runtime migrations.
- Store campaign criteria, limits, lifecycle state, provider, continuation, and failure metadata
  without executing provider requests.
- Store prospect ownership, tags, notes, confidence, public business fields, website availability,
  verification timestamps, duplicate-review state, source provenance, and retention deadlines.
- Reject source imports that match durable domain or provider-record suppression keys.
- Support new, reviewing, qualified, not-qualified, promoted, and suppressed lifecycle states.
- Support editable qualification metadata, suppression with optional do-not-contact status,
  exact-name-confirmed deletion, and expiry cleanup that preserves promoted provenance.
- Add database-backed search, lifecycle, website-availability, confidence, owner, sorting, and
  pagination controls.
- Add sender-validated IPC and a narrow preload API for prospect operations.
- Build and visually verify an Impeccable prospect table, detail editor, activity history,
  destructive controls, and loading, empty, error, and disabled states.

## Excluded Scope

- Campaign creation UI, provider authentication, network adapters, campaign execution, radius
  capability negotiation, retries, and continuation processing from Feature 30.
- Prospect website verification and opportunity signals from Feature 31.
- Prospect scoring, promotion into clients, and duplicate resolution from Feature 32.
- Automatic outreach, form submission, or collection from unauthorized sources.

## Acceptance Criteria

- Prospects and clients are separate database records and UI destinations.
- Campaign and source schemas retain validated criteria, limits, provenance, and retention data.
- Prospect lists are database-paginated and support documented search and filters.
- Qualification metadata and supported non-promotion lifecycle states persist with activity.
- Suppression creates durable match records, can mark do-not-contact, and blocks re-import after
  prospect deletion.
- Retention cleanup deletes expired unpromoted prospects while retaining suppression tombstones.
- Renderer inputs are runtime validated and all privileged operations remain in Electron main.
- Existing client, audit, report, package, and CLI behavior remains operational.
- Formatting, lint, type checking, tests, build, Impeccable detection, accessibility, and visual
  checks pass.

## History

- 2026-07-25: Feature started after Release 2A acceptance completed and was pushed to `main`.
- 2026-07-25: Added separate prospect and campaign persistence, provenance-aware imports,
  qualification lifecycle controls, durable suppression and do-not-contact handling,
  provider-defined retention cleanup, and the Impeccable prospect workspace.
- 2026-07-25: Passed Prisma validation, formatting, zero-warning linting, strict CLI and desktop
  type checking, 276 tests across 60 files, the CLI production build, Windows x64 Electron
  packaging, packaged ASAR smoke, axe scans, Impeccable detection, and desktop visual review.
