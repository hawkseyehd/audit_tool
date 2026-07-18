import { describe, expect, it } from "vitest";
import {
  auditFindingSchema,
  createAnalyticsScanner,
  extractAnalyticsPageSnapshot,
  scanAnalytics,
} from "../../../../src/index.js";
const context = { detectedAt: "2026-07-18T17:00:00.000Z" };
describe("Analytics Readiness Scanner", () => {
  it("detects common external and inline providers", () => {
    const page = extractAnalyticsPageSnapshot(
      '<script src="https://www.googletagmanager.com/gtm.js?id=GTM-ABC"></script><script>fbq("init", "123"); _linkedin_partner_id="456";</script>',
      "https://example.com/",
    );
    expect(page.providers).toEqual(["google-tag-manager", "meta-pixel", "linkedin-insight"]);
    expect(page.signalCount).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(page)).not.toContain("123");
  });
  it("uses cautious language when no common signal is detected", () => {
    const page = extractAnalyticsPageSnapshot("<main>Home</main>", "https://example.com/");
    const findings = scanAnalytics({ pages: [page] }, context);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.description).toContain("does not prove analytics is absent");
    expect(() => auditFindingSchema.parse(findings[0])).not.toThrow();
  });
  it("does not create an absence finding when a provider is detected", () => {
    const page = extractAnalyticsPageSnapshot(
      "<script>gtag('config','G-ABC')</script>",
      "https://example.com/",
    );
    expect(scanAnalytics({ pages: [page] }, context)).toEqual([]);
  });
  it("implements the scanner contract", async () => {
    const scanner = createAnalyticsScanner();
    expect(scanner.name).toBe("analytics");
    await expect(scanner.scan({ pages: [] }, context)).resolves.toEqual([]);
  });
});
