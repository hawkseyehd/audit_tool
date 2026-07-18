import { describe, expect, it } from "vitest";

import {
  ACCESSIBILITY_AUTOMATION_DISCLAIMER,
  auditFindingSchema,
  createAccessibilityScanner,
  scanAccessibility,
  type AccessibilityPageResult,
} from "../../../../src/index.js";

const context = { detectedAt: "2026-07-18T18:00:00.000Z" };

describe("Accessibility Scanner", () => {
  it("maps axe impacts and bounded selector evidence to validated findings", () => {
    const impacts = ["critical", "serious", "moderate", "minor", null] as const;
    const result: AccessibilityPageResult = {
      url: "https://example.com/contact",
      viewport: "mobile",
      violations: impacts.map((impact, index) => ({
        id: `rule-${String(index)}`,
        impact,
        description: "Elements do not meet the accessibility rule.",
        help: `Fix rule ${String(index)}`,
        helpUrl: "https://dequeuniversity.com/rules/axe/4.10/label",
        nodes: Array.from({ length: 12 }, (_, nodeIndex) => ({
          target: [`#field-${String(nodeIndex)}`],
        })),
      })),
    };

    const findings = scanAccessibility({ results: [result] }, context);

    expect(findings.map((finding) => finding.severity)).toEqual([
      "critical",
      "high",
      "medium",
      "low",
      "info",
    ]);
    expect(findings[0]?.evidence).toMatchObject({
      metric: "affected nodes",
      value: 12,
      expected: 0,
      source: "axe",
    });
    expect(findings[0]?.evidence?.selector?.split(", ")).toHaveLength(10);
    expect(findings[0]?.description).toContain("mobile automated axe scan");
    for (const finding of findings) expect(() => auditFindingSchema.parse(finding)).not.toThrow();
  });

  it("generates deterministic IDs and ignores failed page results", () => {
    const result: AccessibilityPageResult = {
      url: "https://example.com/",
      viewport: "desktop",
      violations: [
        {
          id: "html-has-lang",
          impact: "serious",
          description: "The html element has no lang attribute.",
          help: "The html element must have a lang attribute",
          nodes: [{ target: ["html"] }],
        },
      ],
    };
    const failed: AccessibilityPageResult = {
      url: "https://example.com/contact",
      viewport: "desktop",
      violations: [],
      error: { code: "axe-failed", message: "Page failed" },
    };

    const first = scanAccessibility({ results: [result, failed] }, context);
    const second = scanAccessibility({ results: [result] }, context);

    expect(first).toHaveLength(1);
    expect(first[0]?.id).toBe(second[0]?.id);
  });

  it("exports the manual-review limitation and implements the scanner contract", async () => {
    expect(ACCESSIBILITY_AUTOMATION_DISCLAIMER).toContain("do not prove WCAG conformance");
    expect(ACCESSIBILITY_AUTOMATION_DISCLAIMER).toContain("manual");
    const scanner = createAccessibilityScanner();
    expect(scanner.name).toBe("accessibility");
    await expect(scanner.scan({ results: [] }, context)).resolves.toEqual([]);
  });
});
