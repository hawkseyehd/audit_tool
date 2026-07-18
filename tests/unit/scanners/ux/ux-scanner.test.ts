import { describe, expect, it } from "vitest";
import {
  auditFindingSchema,
  createUxScanner,
  extractUxPageSnapshot,
  scanUx,
} from "../../../../src/index.js";
const context = { detectedAt: "2026-07-18T16:00:00.000Z" };
describe("Conversion UX Scanner", () => {
  it("extracts conversion and trust signals", () => {
    const page = extractUxPageSnapshot({
      html: '<header><nav><a href="/contact">Contact</a></nav></header><a href="tel:+15550100">Call</a><button>Get started</button><section>Customer testimonials and reviews</section>',
      page: { url: "https://example.com/", pageType: "home" },
    });
    expect(page).toMatchObject({
      primaryCtaCount: 1,
      hasPhone: true,
      hasContactNavigation: true,
      testimonialSignals: 1,
      reviewSignals: 1,
    });
  });
  it("emits schema-valid heuristic and rendered mobile findings", () => {
    const page = extractUxPageSnapshot({
      html: "<button>Click here</button>",
      page: { url: "https://example.com/services", pageType: "service" },
      rendered: [
        {
          viewport: "mobile",
          primaryCtaAboveFold: false,
          navigationUsable: false,
          formUsable: false,
          hasHorizontalOverflow: true,
          screenshotPath: "screenshots/mobile.png",
        },
      ],
    });
    const findings = scanUx({ pages: [page] }, context);
    const rules = findings.map((finding) => finding.ruleId);
    expect(rules).toEqual(
      expect.arrayContaining([
        "primary-cta-not-detected",
        "service-contact-signal-missing",
        "conversion-page-navigation-missing",
        "trust-signals-not-detected",
        "unclear-control-labels",
        "mobile-cta-below-fold",
        "mobile-navigation-usability",
        "mobile-form-usability",
        "mobile-horizontal-overflow",
      ]),
    );
    for (const finding of findings) {
      expect(() => auditFindingSchema.parse(finding)).not.toThrow();
      expect(finding.evidence?.source).toBe("heuristic");
    }
  });
  it("returns no findings for a complete non-conversion page", () => {
    const page = extractUxPageSnapshot({
      html: '<a href="/article">Detailed article</a>',
      page: { url: "https://example.com/blog/article", pageType: "blog" },
    });
    expect(scanUx({ pages: [page] }, context)).toEqual([]);
  });
  it("implements the scanner contract", async () => {
    const scanner = createUxScanner();
    expect(scanner.name).toBe("ux");
    await expect(scanner.scan({ pages: [] }, context)).resolves.toEqual([]);
  });
});
