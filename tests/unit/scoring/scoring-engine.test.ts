import { describe, expect, it } from "vitest";

import {
  FINDING_CATEGORIES,
  FINDING_CATEGORY_SCORE_GROUPS,
  SCORE_CATEGORIES,
  SCORE_CATEGORY_WEIGHTS,
  SEVERITY_PENALTIES,
  auditSummarySchema,
  calculateAuditSummary,
  selectTopPriorities,
  type AuditFinding,
  type FindingCategory,
  type FindingSeverity,
} from "../../../src/index.js";

describe("Scoring Engine", () => {
  it("uses the exact PRD penalties and weights", () => {
    expect(SEVERITY_PENALTIES).toEqual({
      critical: 20,
      high: 10,
      medium: 5,
      low: 2,
      info: 0,
    });
    expect(SCORE_CATEGORY_WEIGHTS).toEqual({
      performance: 0.2,
      accessibility: 0.2,
      formsAndConversionUx: 0.2,
      seo: 0.15,
      securityPrivacy: 0.15,
      technicalContentQuality: 0.1,
    });
    expect(
      Object.values(SCORE_CATEGORY_WEIGHTS).reduce((sum, weight) => sum + weight, 0),
    ).toBeCloseTo(1);
  });

  it("returns a perfect schema-valid summary for no findings", () => {
    const summary = calculateAuditSummary([]);

    expect(summary).toEqual({
      overallScore: 100,
      categoryScores: {
        performance: 100,
        accessibility: 100,
        formsAndConversionUx: 100,
        seo: 100,
        securityPrivacy: 100,
        technicalContentQuality: 100,
      },
      findingCounts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      topPriorities: [],
    });
    expect(() => auditSummarySchema.parse(summary)).not.toThrow();
  });

  it("calculates weighted scores and counts every severity", () => {
    const findings = [
      finding("performance", "critical", "Critical performance"),
      finding("accessibility", "high", "High accessibility"),
      finding("forms", "medium", "Medium form"),
      finding("seo", "low", "Low SEO"),
      finding("security", "info", "Security information"),
    ];

    const summary = calculateAuditSummary(findings);

    expect(summary.categoryScores).toEqual({
      performance: 80,
      accessibility: 90,
      formsAndConversionUx: 95,
      seo: 98,
      securityPrivacy: 100,
      technicalContentQuality: 100,
    });
    expect(summary.overallScore).toBe(92.7);
    expect(summary.findingCounts).toEqual({ critical: 1, high: 1, medium: 1, low: 1, info: 1 });
    expect(summary.topPriorities).not.toContain("Security information");
  });

  it("maps every canonical category to exactly one score group", () => {
    expect(Object.keys(FINDING_CATEGORY_SCORE_GROUPS).sort()).toEqual(
      [...FINDING_CATEGORIES].sort(),
    );
    expect(new Set(Object.values(FINDING_CATEGORY_SCORE_GROUPS))).toEqual(
      new Set(SCORE_CATEGORIES),
    );

    const summary = calculateAuditSummary(
      FINDING_CATEGORIES.map((category) => finding(category, "low", `${category} issue`)),
    );
    expect(summary.categoryScores).toEqual({
      performance: 98,
      accessibility: 98,
      formsAndConversionUx: 94,
      seo: 98,
      securityPrivacy: 96,
      technicalContentQuality: 96,
    });
  });

  it("clamps heavily penalized categories and overall scores at zero", () => {
    const findings = FINDING_CATEGORIES.flatMap((category) =>
      Array.from({ length: 5 }, (_, index) =>
        finding(category, "critical", `${category} critical ${String(index)}`),
      ),
    );

    const summary = calculateAuditSummary(findings);

    expect(summary.overallScore).toBe(0);
    expect(Object.values(summary.categoryScores)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it("selects stable, unique, bounded priorities by severity and category weight", () => {
    const findings = [
      finding("seo", "critical", "Zulu"),
      finding("performance", "critical", "Beta"),
      finding("performance", "critical", "Alpha"),
      finding("accessibility", "high", "Repeated"),
      finding("forms", "high", "Repeated"),
      finding("security", "info", "Information only"),
    ];

    expect(selectTopPriorities(findings, 3)).toEqual(["Alpha", "Beta", "Zulu"]);
    expect(selectTopPriorities(findings, 20)).toEqual(["Alpha", "Beta", "Zulu", "Repeated"]);
    expect(selectTopPriorities(findings, 0)).toEqual([]);
  });
});

function finding(
  category: FindingCategory,
  severity: FindingSeverity,
  title: string,
): AuditFinding {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/gu, "-");
  return {
    id: `${category}-${slug}`,
    ruleId: slug,
    url: "https://example.com/",
    category,
    severity,
    title,
    description: "A test finding.",
    impact: "A test impact.",
    recommendation: "A test recommendation.",
    scanner: scannerForCategory(category),
    detectedAt: "2026-07-18T18:00:00.000Z",
  };
}

function scannerForCategory(category: FindingCategory): AuditFinding["scanner"] {
  if (category === "performance") return "lighthouse";
  if (category === "accessibility") return "accessibility";
  if (category === "forms") return "forms";
  if (category === "seo") return "seo";
  if (category === "security" || category === "privacy") return "security";
  if (category === "analytics") return "analytics";
  return "ux";
}
