import { describe, expect, it } from "vitest";
import {
  auditFindingSchema,
  createLighthouseScanner,
  scanLighthouse,
  type LighthousePageResult,
} from "../../../../src/index.js";
const context = { detectedAt: "2026-07-18T18:00:00.000Z" };
describe("Lighthouse Scanner", () => {
  it("maps poor mobile metrics and opportunities to validated findings", () => {
    const result: LighthousePageResult = {
      url: "https://example.com/",
      finalUrl: "https://example.com/",
      viewport: "mobile",
      metrics: {
        performanceScore: 42,
        largestContentfulPaintMs: 4_500,
        cumulativeLayoutShift: 0.3,
        totalBlockingTimeMs: 700,
        speedIndexMs: 5_000,
        firstContentfulPaintMs: 2_000,
      },
      opportunities: [
        { ruleId: "unused-javascript", title: "Reduce unused JavaScript", savingsMs: 500 },
      ],
    };
    const findings = scanLighthouse({ results: [result] }, context);
    expect(findings.map((finding) => finding.ruleId)).toEqual(
      expect.arrayContaining([
        "performance-score-low",
        "largest-contentful-paint",
        "cumulative-layout-shift",
        "total-blocking-time",
        "opportunity-unused-javascript",
      ]),
    );
    expect(findings.find((finding) => finding.ruleId === "performance-score-low")?.severity).toBe(
      "high",
    );
    for (const finding of findings) expect(() => auditFindingSchema.parse(finding)).not.toThrow();
  });
  it("ignores failed runs and metrics within thresholds", () => {
    const good: LighthousePageResult = {
      url: "https://example.com/",
      viewport: "desktop",
      metrics: {
        performanceScore: 90,
        largestContentfulPaintMs: 2_000,
        cumulativeLayoutShift: 0.05,
        totalBlockingTimeMs: 100,
        speedIndexMs: 2_500,
        firstContentfulPaintMs: 1_000,
      },
      opportunities: [],
    };
    const failed: LighthousePageResult = {
      url: "https://example.com/contact",
      viewport: "mobile",
      opportunities: [],
      error: { message: "Failed" },
    };
    expect(scanLighthouse({ results: [good, failed] }, context)).toEqual([]);
  });
  it("implements the scanner contract", async () => {
    const scanner = createLighthouseScanner();
    expect(scanner.name).toBe("lighthouse");
    await expect(scanner.scan({ results: [] }, context)).resolves.toEqual([]);
  });
});
