import { describe, expect, it } from "vitest";

import {
  auditResultSchema,
  generatePdfSummaryReport,
  type AuditFinding,
  type AuditResult,
  type FindingCategory,
  type FindingSeverity,
} from "../../../src/index.js";

describe("generatePdfSummaryReport", () => {
  it("creates a concise client summary and accounts for every finding", () => {
    const result = resultFixture();
    const html = generatePdfSummaryReport(result);

    expect(html).toContain("<title>Audit Summary - Example &amp; Partners</title>");
    expect(html).toContain('<h1 id="summary-title">Audit Summary</h1>');
    expect(html).toContain("What this means");
    expect(html).toContain("Issue landscape");
    expect(html).toContain("30-day action plan");
    expect(html).toContain("audit-report.pdf");
    expect(html).toContain("8 total");
    expect(html).toContain("Accessibility");
    expect(html).toContain("Security");
    expect(html.match(/class="priority-issue priority-issue--/gu)).toHaveLength(6);
    expect(html).toContain("Priority issue 6");
    expect(html).not.toContain("Priority issue 7");
    expect(html).not.toContain("Priority issue 8");
  });

  it("escapes audited content and bounds long priority prose", () => {
    const base = resultFixture();
    const firstFinding = base.findings[0];
    if (firstFinding === undefined) throw new Error("Fixture requires a finding");
    const unsafeTitle = "<script>unsafe()</script>";
    const longImpact = `${"Business impact with evidence. ".repeat(30)}END-OF-UNBOUNDED-CONTENT`;
    const result = auditResultSchema.parse({
      ...base,
      scannedPages: [{ ...base.scannedPages[0], title: "Example <Client>" }],
      summary: { ...base.summary, topPriorities: [unsafeTitle] },
      findings: [{ ...firstFinding, title: unsafeTitle, impact: longImpact }],
    });

    const html = generatePdfSummaryReport(result);

    expect(html).toContain("Example &lt;Client&gt;");
    expect(html).toContain("&lt;script&gt;unsafe()&lt;/script&gt;");
    expect(html).not.toContain("<script>unsafe()</script>");
    expect(html).not.toContain("END-OF-UNBOUNDED-CONTENT");
  });

  it("communicates an empty audit state without adding a priority page", () => {
    const base = resultFixture();
    const result = auditResultSchema.parse({
      ...base,
      findings: [],
      summary: {
        ...base.summary,
        findingCounts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        overallScore: 100,
        topPriorities: [],
      },
    });

    const html = generatePdfSummaryReport(result);

    expect(html).toContain("No automated findings were recorded");
    expect(html).toContain("0 total");
    expect(html).not.toContain('class="priority-list"');
    expect(html.match(/class="summary-page/gmu)).toHaveLength(3);
  });
});

function resultFixture(): AuditResult {
  const severities: readonly FindingSeverity[] = [
    "critical",
    "high",
    "high",
    "medium",
    "medium",
    "low",
    "low",
    "info",
  ];
  const categories: readonly FindingCategory[] = [
    "security",
    "accessibility",
    "forms",
    "performance",
    "seo",
    "ux",
    "analytics",
    "technical",
  ];
  const findings: AuditFinding[] = severities.map((severity, index) => ({
    id: `finding-${String(index + 1)}`,
    ruleId: `rule-${String(index + 1)}`,
    url: "https://example.com/",
    category: categories[index] ?? "technical",
    severity,
    title: `Priority issue ${String(index + 1)}`,
    description: "The audit recorded a client-relevant issue.",
    impact: `Business impact for priority issue ${String(index + 1)}.`,
    recommendation: `Resolve priority issue ${String(index + 1)} and verify the change.`,
    scanner: severity === "info" ? "orchestrator" : "ux",
    detectedAt: "2026-07-18T17:03:00.000Z",
    evidence: { source: "heuristic" },
  }));

  return auditResultSchema.parse({
    schemaVersion: "1.0.0",
    auditId: "audit-summary-report-test",
    startedAt: "2026-07-18T17:00:00.000Z",
    completedAt: "2026-07-18T17:05:00.000Z",
    targetUrl: "example.com",
    normalizedUrl: "https://example.com/",
    scannedPages: [
      {
        url: "https://example.com/",
        title: "Example & Partners",
        pageType: "home",
        statusCode: 200,
      },
    ],
    summary: {
      overallScore: 58,
      categoryScores: {
        performance: 62,
        accessibility: 54,
        formsAndConversionUx: 68,
        seo: 71,
        securityPrivacy: 42,
        technicalContentQuality: 76,
      },
      findingCounts: { critical: 1, high: 2, medium: 2, low: 2, info: 1 },
      topPriorities: findings.map((finding) => finding.title),
    },
    findings,
    outputs: {},
  });
}
