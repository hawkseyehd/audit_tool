# Prospect Retention Policy

## Scope

This policy applies to prospect records and discovery-source provenance stored by the desktop
application. It does not define audit-report or screenshot retention.

## Provider-Defined Retention

- Every imported source record must include a documented retention policy and a bounded retention
  period from 1 to 3,650 days.
- The application calculates and stores `retainedUntil` from the source collection time and the
  permitted retention period.
- A provider adapter must not import fields or assign a retention period until its terms and field
  allowlist have been reviewed.
- Re-importing an existing provider record does not silently overwrite user-edited qualification
  data.

## Expiry And Deletion

- Expired, unpromoted prospect records are deleted during database initialization and may also be
  removed by an explicit retention-maintenance operation.
- Promoted prospect provenance is not removed by automatic expiry. Its lifecycle is tied to the
  managed client and requires a separate retention decision.
- Users may explicitly delete an unpromoted prospect before expiry after exact business-name
  confirmation.

## Suppression

- Suppression creates durable normalized domain and provider-record match keys.
- Suppression records survive prospect deletion so a later import cannot silently recreate the
  business.
- Do-not-contact is an explicit property of a suppression record and never triggers outreach.
- Suppression records do not expire by default. A future compliance workflow may set an explicit
  expiry only when policy permits it.
