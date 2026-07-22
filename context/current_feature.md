# Current Feature: Client Management

## Status

Complete

## Branch

`feature/client-management`

## Feature

Feature 23 from `context/feature_list_in_order.md`.

## Objective

Add a persistent client directory and client workspace where practitioners can safely create,
find, update, pause, archive, and review managed business records.

## Included Scope

- Add normalized client, website, tag, and activity persistence models.
- Validate business names, website URLs, public contact fields, addresses, category, notes, tags,
  owner, and lifecycle states with Zod.
- Prevent duplicate clients by normalized domain and return the existing client identity.
- Add database-backed client search, status filtering, sorting, and pagination.
- Add typed, sender-validated client IPC and preload methods.
- Build the Impeccable client directory with useful loading, empty, failure, and filtered states.
- Add accessible create and edit workflows with inline validation and unsaved-change protection.
- Add client Profile, Website Pages, Audits, Reports, and Activity views.
- Add active, paused, and archived lifecycle actions.
- Require explicit typed confirmation before permanent deletion of records without retained audit
  or report history.
- Add focused schema, normalization, persistence, IPC-contract, renderer, and visual tests.

## Excluded Scope

- Website page discovery and inventory population, implemented in Feature 24.
- Audit scopes, execution, history, and report artifacts, implemented in Features 25 through 27.
- Prospect import or promotion, implemented in Release 2B.

## Acceptance Criteria

- A valid business name and website URL create exactly one client and website record.
- Equivalent normalized domains are rejected with a clear duplicate-client reference.
- Client lists use database-backed search, lifecycle filters, sorting, and bounded pagination.
- Edits preserve stable IDs and activity history.
- Archived clients are hidden from the default active view and remain available by filter.
- Permanent deletion requires explicit confirmation and refuses retained-history conflicts.
- Renderer requests and responses are strict, typed, and validated on both sides of preload.
- The client UI is keyboard accessible and visually verified at compact and standard windows.
- The existing CLI and Feature 22 desktop foundation remain operational.
- All project quality gates pass.

## History

- 2026-07-23: Feature started after Feature 22 passed 222 tests and desktop visual QA.
- 2026-07-23: Added persistent client, website, tag, and activity models with normalized-domain
  duplicate prevention, database-backed directory queries, lifecycle actions, typed IPC, and an
  Impeccable client workspace.
- 2026-07-23: Feature completed after 231 tests across 47 files, formatting, linting, strict CLI
  and desktop type checking, the CLI build, Windows Electron packaging, compiled desktop smoke,
  standard and compact visual review, clean Impeccable scans, and the production dependency audit
  all passed.
