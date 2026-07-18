# Current Feature: Conversion UX Scanner

## Status

Completed

## Branch

`feature/conversion-ux-scanner`

## Objective

Detect conversion, contact, navigation, trust, control-label, and mobile-usability signals
and emit carefully labeled heuristic findings that support, rather than replace, human UX
review.

## Included Scope

- Extract bounded CTA, contact, navigation, trust, and control-label facts.
- Accept optional rendered desktop/mobile observations from the browser layer.
- Check primary CTA presence and above-fold visibility evidence.
- Check phone/email presence on service-oriented pages.
- Check contact or booking reachability from navigation.
- Detect reviews, testimonials, certifications, case studies, and client-logo signals.
- Check vague interactive labels.
- Check mobile navigation, CTA, form usability, and horizontal-overflow observations.
- Emit deterministic `ux` findings explicitly described as heuristic.

## Excluded Scope

- Automated redesign, conversion guarantees, or subjective aesthetic scoring.
- Clicking CTAs, opening menus, or submitting forms.
- Claims that static or screenshot evidence proves complete usability.

## Acceptance Criteria

- Extraction is bounded and retains no entered data.
- Rendered observations remain optional and evidence-specific.
- Every finding states its heuristic nature and likely business impact.
- Findings avoid absolute claims where manual review is required.
- IDs, ordering, and evidence are deterministic and schema-valid.
- All project quality and dependency gates pass.

## History

- 2026-07-18: Features 1-9 completed through commit `f2645de`.
- 2026-07-18: Conversion UX Scanner documented and started.
- 2026-07-18: Added bounded extraction for CTA, contact, navigation, trust, and control-label
  signals plus optional desktop/mobile rendered observations.
- 2026-07-18: Implemented deterministic heuristic findings for conversion visibility,
  contact reachability, trust, labels, mobile navigation/forms, and viewport overflow.
- 2026-07-18: Verified formatting, linting, strict type checking, 156 tests, exact npm
  build, dependency compatibility, and a clean production dependency audit.
