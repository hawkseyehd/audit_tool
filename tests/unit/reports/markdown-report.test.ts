import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  ACCESSIBILITY_AUTOMATION_DISCLAIMER,
  auditResultSchema,
  generateMarkdownReport,
  writeMarkdownReport,
  type AuditFinding,
  type AuditResult,
} from "../../../src/index.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("generateMarkdownReport", () => {
  it("renders every required section and complete finding evidence", () => {
    const report = generateMarkdownReport(resultFixture());
    const headings = [
      "# Website Audit Report",
      "## Executive Summary",
      "## Overall Score",
      "## Category Scores",
      "## Top Priority Fixes",
      "## Scope and Scanned Pages",
      "## Findings by Severity",
      "## Findings by Category",
      "## Form Audit Summary",
      "## Performance Summary",
      "## Accessibility Summary",
      "## SEO Summary",
      "## Security and Privacy Summary",
      "## Recommended 30-Day Action Plan",
      "## Disclaimer and Audit Limitations",
    ];

    for (const heading of headings) expect(report).toContain(heading);
    expect(report).toContain("**Impact**");
    expect(report).toContain("**Recommendation**");
    expect(report).toContain("- Source: axe");
    expect(report).toContain("- Selector: ``button ` span``");
    expect(report).toContain(ACCESSIBILITY_AUTOMATION_DISCLAIMER);
    expect(report).toContain("Results are partial: 1 page recorded an inspection error.");
  });

  it("renders explicit empty states", () => {
    const result = resultFixture({ findings: [], scannedPages: [], topPriorities: [] });
    const report = generateMarkdownReport(result);

    expect(report).toContain("No actionable automated findings were prioritized.");
    expect(report).toContain("| No pages were recorded | Not available | Not available | Incomplete |");
    expect(report).toContain("No critical-severity findings were recorded.");
    expect(report).toContain("No automated findings were recorded for this area.");
  });

  it("escapes untrusted content instead of creating report structure", () => {
    const injectedFinding = findingFixture({
      title: "Injected\n## Heading *bold* | table",
      description: "[link](javascript:alert(1))",
    });
    const report = generateMarkdownReport(resultFixture({ findings: [injectedFinding] }));

    expect(report).not.toContain("\n## Heading");
    expect(report).toContain("Injected \\#\\# Heading \\*bold\\* \\| table");
    expect(report).toContain("\\[link\\](javascript:alert(1))");
    expect(report).toContain("Failed: Page \\| timed out");
  });
});

describe("writeMarkdownReport", () => {
  it("atomically writes the report and returns a validated output path", async () => {
    const directory = await createTemporaryDirectory();
    const writtenResult = await writeMarkdownReport(directory, resultFixture());
    const reportPath = writtenResult.outputs.markdownReportPath;

    expect(reportPath).toBe(join(directory, "audit-report.md"));
    expect(() => auditResultSchema.parse(writtenResult)).not.toThrow();
    await expect(readFile(reportPath ?? "", "utf8")).resolves.toBe(
      generateMarkdownReport(writtenResult),
    );
    expect((await readdir(directory)).filter((name) => name.endsWith(".tmp"))).toEqual([]);
  });
});

function resultFixture(
  overrides: {
    readonly findings?: readonly AuditFinding[];
    readonly scannedPages?: AuditResult["scannedPages"];
    readonly topPriorities?: readonly string[];
  } = {},
): AuditResult {
  const findings = overrides.findings ?? [findingFixture()];
  return auditResultSchema.parse({
    schemaVersion: "1.0.0",
    auditId: "audit-report-test",
    startedAt: "2026-07-18T17:00:00.000Z",
    completedAt: "2026-07-18T17:05:00.000Z",
    targetUrl: "example.com",
    normalizedUrl: "https://example.com/",
    scannedPages: overrides.scannedPages ?? [
      { url: "https://example.com/", pageType: "home", statusCode: 200 },
      {
        url: "https://example.com/contact",
        pageType: "contact",
        error: { code: "navigation-timeout", message: "Page | timed out" },
      },
    ],
    summary: {
      overallScore: findings.length === 0 ? 100 : 90,
      categoryScores: {
        performance: 100,
        accessibility: findings.length === 0 ? 100 : 90,
        formsAndConversionUx: 100,
        seo: 100,
        securityPrivacy: 100,
        technicalContentQuality: 100,
      },
      findingCounts: {
        critical: 0,
        high: findings.filter((finding) => finding.severity === "high").length,
        medium: 0,
        low: 0,
        info: 0,
      },
      topPriorities: overrides.topPriorities ?? findings.map((finding) => finding.title),
    },
    findings,
    outputs: {},
  });
}

function findingFixture(overrides: Partial<AuditFinding> = {}): AuditFinding {
  return {
    id: "accessibility-button-name",
    ruleId: "button-name",
    url: "https://example.com/",
    category: "accessibility",
    severity: "high",
    title: "Button has no accessible name",
    description: "A primary action has no programmatic name.",
    impact: "Screen-reader users may not understand or complete the action.",
    recommendation: "Add a concise accessible name and verify it with assistive technology.",
    scanner: "accessibility",
    detectedAt: "2026-07-18T17:03:00.000Z",
    evidence: {
      selector: "button ` span",
      screenshotPath: "screenshots/home.png",
      metric: "affected nodes",
      value: 1,
      expected: 0,
      source: "axe",
    },
    ...overrides,
  };
}

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "website-audit-report-"));
  temporaryDirectories.push(directory);
  return directory;
}
