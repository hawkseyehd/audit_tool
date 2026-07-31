# Playwright Prospect Discovery Policy

## Approval

Feature 30 uses Playwright browser automation to read rendered public Google Maps result cards and
business detail pages. It does not use a Google Maps, Places, business-data, search, directory,
geocoding, or prospect API.

- Provider ID: `playwright-web-search`
- Terms review version: `reviewed-2026-07-26`
- Discovery surface: rendered public Google Maps search results
- Detail surface: rendered public Google Maps business pages
- Authentication: none

The provider may navigate, wait for rendered content, scroll the result feed, and read visible
text and links. It must not call hidden JSON endpoints, reverse-engineer private service
interfaces, log in, submit forms, accept downloads, bypass CAPTCHAs, evade access controls,
rotate identities, or defeat rate limits.

## Permitted Fields

Only public business fields visibly presented on the rendered pages may be imported:

- Displayed business name.
- Primary campaign category.
- Public website URL and normalized domain.
- Public business phone displayed on the business detail page.
- Public business email displayed as an email control on the business detail page.
- Public business profile URLs visibly associated with the listing. LinkedIn URLs are restricted
  to company, school, and showcase pages; personal profiles are excluded.
- Public address displayed on the business detail page.
- User-supplied locality, region, and country used for the search.
- Source page URL and application collection timestamp.

Reviews, ratings, images, opening hours, inferred personal data, individual contact details,
personal social profiles, cookies, tracking identifiers, and hidden page state are not persisted.

## Limits

- A campaign requires a two-letter country code, a category or keyword, and a city or region.
- Campaign result limit: 1 to 100 prospects.
- At most five bounded rendered result-page passes per campaign.
- At most 20 imported prospects per campaign page.
- At most 30 candidate website inspections per campaign page.
- One browser session and one page navigation at a time.
- Navigation timeout: 20 seconds.
- Minimum delay between candidate website inspections: 650 milliseconds.
- Images, media, fonts, downloads, dialogs, service workers, and WebSockets are disabled.
- Every top-level target and browser request is checked against the public-network policy.
- Cancellation closes the current browser context and the campaign browser.
- Chromium closes after success, failure, cancellation, or application shutdown.

## Search and Review Behavior

- Search terms combine the user-entered business category, keywords, locality, region, and
  country.
- Search-result links are deduplicated by rendered business identity.
- Search engines, social networks, directories, and common content platforms are not imported as
  prospects.
- Each candidate business detail page is opened directly before a prospect is imported.
- Businesses with and without websites are imported by default.
- Business names, website links, telephone controls, email controls, associated public business
  profile links, and address controls are read from rendered page content.
- Exclusions are applied case-insensitively to the name, website, phone, email, business profiles,
  and address.
- Missing websites are represented explicitly and do not prevent import. Unreadable business
  detail pages are skipped and counted in a campaign warning.
- Imported prospects remain reviewable records and are never promoted to clients automatically.

## Compliance and Reliability

Browser automation does not imply permission to bypass Google's terms or technical controls.
Google Maps markup can change, and Google may refuse automated access. The application must fail
clearly rather than conceal automation or bypass a challenge. The operator remains responsible
for confirming that the intended use is permitted.

Every imported field retains page-level provenance and a conservative 30-day refresh period.
Suppression tombstones remain durable and prevent silent re-import.
