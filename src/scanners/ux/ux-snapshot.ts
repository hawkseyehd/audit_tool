import { load } from "cheerio";
import { uxPageSnapshotSchema } from "./schemas.js";
import type { UxPageSnapshot, UxSnapshotInput } from "./types.js";
const PRIMARY_CTA =
  /\b(?:get started|contact us|book|schedule|buy|shop|request (?:a )?quote|start (?:a )?trial|sign up|subscribe|download|order now)\b/u;
const UNCLEAR = /^(?:click here|here|more|learn more|go|submit|continue|read more)$/u;
export function extractUxPageSnapshot(input: UxSnapshotInput): UxPageSnapshot {
  const document = load(input.html);
  let primaryCtaCount = 0;
  let unclearControlCount = 0;
  const unclearControlSelectors = new Set<string>();
  document("a[href], button, [role='button'], input[type='submit']")
    .slice(0, 500)
    .each((_index, element) => {
      const control = document(element);
      const text =
        `${control.text()} ${control.attr("aria-label") ?? ""} ${control.attr("value") ?? ""}`
          .toLowerCase()
          .replace(/\s+/gu, " ")
          .trim()
          .slice(0, 200);
      if (PRIMARY_CTA.test(text)) primaryCtaCount += 1;
      if (text.length === 0 || UNCLEAR.test(text)) {
        unclearControlCount += 1;
        if (unclearControlSelectors.size < 10)
          unclearControlSelectors.add(element.tagName.toLowerCase());
      }
    });
  const bodyText = document("body").text().toLowerCase().replace(/\s+/gu, " ").slice(0, 100_000);
  const html = input.html.toLowerCase().slice(0, 500_000);
  const navigationLinks = document("nav a[href], header a[href]");
  let hasContactNavigation = false;
  let hasBookingNavigation = false;
  navigationLinks.each((_index, element) => {
    const value =
      `${document(element).attr("href") ?? ""} ${document(element).text()}`.toLowerCase();
    if (/\bcontact\b/u.test(value)) hasContactNavigation = true;
    if (/\b(?:book|booking|appointment|schedule)\b/u.test(value)) hasBookingNavigation = true;
  });
  return uxPageSnapshotSchema.parse({
    url: input.page.url,
    pageType: input.page.pageType,
    primaryCtaCount,
    unclearControlCount,
    unclearControlSelectors: [...unclearControlSelectors],
    hasPhone: /(?:tel:|\+?\d[\d\s().-]{7,}\d)/u.test(html),
    hasEmail: /(?:mailto:|[\w.+-]+@[\w.-]+\.[a-z]{2,})/u.test(html),
    hasContactNavigation,
    hasBookingNavigation,
    reviewSignals: countSignals(bodyText, /\b(?:reviews?|ratings?)\b/gu),
    testimonialSignals: countSignals(bodyText, /\btestimonials?\b/gu),
    certificationSignals: countSignals(
      bodyText,
      /\b(?:certified|certification|accredited|licensed)\b/gu,
    ),
    caseStudySignals: countSignals(bodyText, /\bcase studies?\b/gu),
    clientLogoSignals: document(
      "img[alt*='client' i], img[class*='client'], [class*='client-logo']",
    ).length,
    rendered: input.rendered ?? [],
  });
}
function countSignals(text: string, pattern: RegExp): number {
  return Math.min(100, [...text.matchAll(pattern)].length);
}
