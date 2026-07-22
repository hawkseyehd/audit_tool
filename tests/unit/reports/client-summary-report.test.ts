import { describe, expect, it } from "vitest";

import {
  auditResultSchema,
  generateClientSummaryReport,
  type AuditFinding,
  type AuditResult,
  type FindingCategory,
  type FindingSeverity,
} from "../../../src/index.js";

describe("generateClientSummaryReport", () => {
  it("creates exactly three client-facing pages and represents every finding once", () => {
    const result = resultFixture();
    const html = generateClientSummaryReport(result);
    const categoryCounts = [...html.matchAll(/data-finding-count="(\d+)"/gu)].map((match) =>
      Number(match[1]),
    );

    expect(html.match(/class="client-page(?:\s|")/gu)).toHaveLength(3);
    expect(html).toContain("Website Improvement Summary");
    expect(html).toContain("Example Business");
    expect(html).toContain("Pages reviewed");
    expect(html).toContain("11</strong><small>across the website");
    expect(html).toContain(
      "Improvements identified</span><strong>10</strong><small>across all business areas",
    );
    expect(html).toContain(`${String(result.findings.length)} findings represented`);
    expect(categoryCounts.reduce((total, count) => total + count, 0)).toBe(
      result.findings.length,
    );
    expect(new Set([...html.matchAll(/data-category="([^"]+)"/gu)].map((match) => match[1])).size)
      .toBe(10);
    expect(html.match(/class="action-title"/gu)).toHaveLength(6);
  });

  it("excludes audit-process details and references to other reports", () => {
    const html = generateClientSummaryReport(resultFixture());

    expect(html).not.toContain("audit-client-summary-test");
    expect(html).not.toContain("2026-07-21T10:00:00.000Z");
    expect(html).not.toContain("Audit ID");
    expect(html).not.toContain("Audit window");
    expect(html).not.toContain("Completed inspections");
    expect(html).not.toContain("Inspection failures");
    expect(html).not.toContain("audit-report.pdf");
    expect(html).not.toContain("scanner");
    expect(html).not.toContain("penetration test");
    expect(html).not.toContain("certification");
    expect(html.toLowerCase()).not.toContain("audit");
    expect(html.toLowerCase()).not.toContain("automated");
  });

  it("escapes audited content and bounds long client-facing prose", () => {
    const base = resultFixture();
    const firstFinding = base.findings[0];
    if (firstFinding === undefined) throw new Error("Fixture requires a finding");
    const unsafeTitle = "<script>unsafe()</script>";
    const longImpact = `${"This issue may reduce customer confidence and conversion. ".repeat(20)}END-OF-LONG-IMPACT`;
    const result = auditResultSchema.parse({
      ...base,
      scannedPages: [{ ...base.scannedPages[0], title: "Example <Client>" }],
      summary: { ...base.summary, topPriorities: [unsafeTitle] },
      findings: [{ ...firstFinding, title: unsafeTitle, impact: longImpact }],
    });

    const html = generateClientSummaryReport(result);

    expect(html).toContain("Example &lt;Client&gt;");
    expect(html).toContain("&lt;script&gt;unsafe()&lt;/script&gt;");
    expect(html).not.toContain("<script>unsafe()</script>");
    expect(html).not.toContain("END-OF-LONG-IMPACT");
  });

  it("shows one plain-language completeness note only for partial coverage", () => {
    const complete = resultFixture();
    const partial = auditResultSchema.parse({
      ...complete,
      scannedPages: complete.scannedPages.map((page, index) =>
        index === 0
          ? { ...page, error: { code: "navigation-timeout", message: "Page timed out" } }
          : page,
      ),
    });

    expect(generateClientSummaryReport(complete)).not.toContain(
      "Some areas of the website could not be fully assessed",
    );
    expect(generateClientSummaryReport(partial)).toContain(
      "Some areas of the website could not be fully assessed, so these recommendations reflect the available information.",
    );
  });

  it("keeps an empty result useful while preserving the three-page contract", () => {
    const base = resultFixture();
    const result = auditResultSchema.parse({
      ...base,
      findings: [],
      summary: {
        ...base.summary,
        overallScore: 100,
        findingCounts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        topPriorities: [],
      },
    });

    const html = generateClientSummaryReport(result);

    expect(html.match(/class="client-page(?:\s|")/gu)).toHaveLength(3);
    expect(html).toContain("No immediate website improvements were identified");
    expect(html).toContain("No improvements were identified in this business area");
    expect(html).toContain("0 findings represented");
  });
});

function resultFixture(): AuditResult {
  const categories: readonly FindingCategory[] = [
    "business",
    "ux",
    "forms",
    "performance",
    "accessibility",
    "seo",
    "security",
    "privacy",
    "analytics",
    "technical",
  ];
  const severities: readonly FindingSeverity[] = [
    "critical",
    "high",
    "high",
    "high",
    "medium",
    "medium",
    "medium",
    "low",
    "low",
    "info",
  ];
  const findings: AuditFinding[] = categories.map((category, index) => ({
    id: `client-finding-${String(index + 1)}`,
    ruleId: `client-rule-${String(index + 1)}`,
    url: `https://example.com/page-${String(index + 1)}`,
    category,
    severity: severities[index] ?? "info",
    title: `${category} improvement ${String(index + 1)}`,
    description: "The website contains an opportunity for improvement.",
    impact: `This ${category} issue may affect customer confidence or business performance.`,
    recommendation: `Resolve the ${category} issue and verify the customer journey.`,
    scanner: category === "technical" ? "orchestrator" : "ux",
    detectedAt: "2026-07-21T10:03:00.000Z",
    evidence: { source: "heuristic" },
  }));

  return auditResultSchema.parse({
    schemaVersion: "1.0.0",
    auditId: "audit-client-summary-test",
    startedAt: "2026-07-21T10:00:00.000Z",
    completedAt: "2026-07-21T10:05:00.000Z",
    targetUrl: "example.com",
    normalizedUrl: "https://example.com/",
    scannedPages: Array.from({ length: 11 }, (_, index) => ({
      url: `https://example.com/page-${String(index + 1)}`,
      ...(index === 0 ? { title: "Example Business" } : {}),
      pageType: index === 0 ? "home" : "unknown",
      statusCode: 200,
    })),
    summary: {
      overallScore: 58,
      categoryScores: {
        performance: 62,
        accessibility: 54,
        formsAndConversionUx: 61,
        seo: 72,
        securityPrivacy: 43,
        technicalContentQuality: 79,
      },
      findingCounts: { critical: 1, high: 3, medium: 3, low: 2, info: 1 },
      topPriorities: findings.map((finding) => finding.title),
    },
    findings,
    outputs: {},
  });
}
