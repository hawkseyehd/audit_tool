import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  ACCESSIBILITY_AUTOMATION_DISCLAIMER,
  auditResultSchema,
  generateHtmlReport,
  resolveReportSiteName,
  writeHtmlReport,
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

describe("generateHtmlReport", () => {
  it("renders the complete client report with semantic structure and evidence", () => {
    const report = generateHtmlReport(resultFixture());

    expect(report).toContain("<!doctype html>");
    expect(report).toContain('<main class="report">');
    expect(report).toContain('<h1 id="report-title">Audit Report</h1>');
    expect(report).toContain("Example Business | Home");
    expect(report).toContain("Executive summary");
    expect(report).toContain("Category scores");
    expect(report).toContain("Top priorities");
    expect(report).toContain("Scope and scanned pages");
    expect(report).toContain("Detailed findings");
    expect(report).toContain("Recommended 30-day action plan");
    expect(report).toContain("Disclaimer and audit limitations");
    expect(report).toContain("Screen-reader users may not understand or complete the action.");
    expect(report).toContain("Add a concise accessible name");
    expect(report).toContain("../screenshots/home.png");
    expect(report).toContain(ACCESSIBILITY_AUTOMATION_DISCLAIMER);
    expect(report).not.toContain("<script");
  });

  it("escapes untrusted content and rejects unsafe screenshot references", () => {
    const finding = findingFixture({
      title: '<img src=x onerror="alert(1)">',
      description: "<style>body{display:none}</style>",
      evidence: {
        source: "playwright",
        screenshotPath: "../private/secret.png",
        selector: "<button>",
      },
    });
    const report = generateHtmlReport(
      resultFixture({
        findings: [finding],
        scannedPages: [
          {
            url: "https://example.com/",
            title: "<script>alert(1)</script>",
            pageType: "home",
            statusCode: 200,
          },
        ],
      }),
    );

    expect(report).not.toContain("<script>alert(1)</script>");
    expect(report).not.toContain('<img src=x onerror="alert(1)">');
    expect(report).not.toContain('src="../../private/secret.png"');
    expect(report).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(report).toContain("&lt;style&gt;body{display:none}&lt;/style&gt;");
    expect(report).toContain("Screenshot reference:");
  });

  it("renders explicit empty states and uses the hostname when no page title exists", () => {
    const result = resultFixture({ findings: [], scannedPages: [], topPriorities: [] });
    const report = generateHtmlReport(result);

    expect(resolveReportSiteName(result)).toBe("example.com");
    expect(report).toContain("No actionable automated findings were prioritized.");
    expect(report).toContain("No pages were recorded. Audit coverage is incomplete.");
    expect(report).toContain("No automated findings were recorded.");
  });
});

describe("writeHtmlReport", () => {
  it("atomically writes a validated standalone report", async () => {
    const directory = await createTemporaryDirectory();
    const writtenResult = await writeHtmlReport(directory, resultFixture());
    const reportPath = writtenResult.outputs.htmlReportPath;

    expect(reportPath).toBe(join(directory, "audit-report.html"));
    expect(() => auditResultSchema.parse(writtenResult)).not.toThrow();
    await expect(readFile(reportPath ?? "", "utf8")).resolves.toBe(
      generateHtmlReport(writtenResult),
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
    auditId: "audit-html-report-test",
    startedAt: "2026-07-18T17:00:00.000Z",
    completedAt: "2026-07-18T17:05:00.000Z",
    targetUrl: "example.com",
    normalizedUrl: "https://example.com/",
    scannedPages: overrides.scannedPages ?? [
      {
        url: "https://example.com/",
        title: "Example Business | Home",
        pageType: "home",
        statusCode: 200,
        screenshotPath: "screenshots/home.png",
      },
      {
        url: "https://example.com/contact",
        title: "Contact Example Business",
        pageType: "contact",
        error: { code: "navigation-timeout", message: "Page timed out" },
      },
    ],
    summary: {
      overallScore: findings.length === 0 ? 100 : 78,
      categoryScores: {
        performance: 82,
        accessibility: findings.length === 0 ? 100 : 62,
        formsAndConversionUx: 91,
        seo: 88,
        securityPrivacy: 94,
        technicalContentQuality: 79,
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
      selector: "button > span",
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
  const directory = await mkdtemp(join(tmpdir(), "website-audit-html-report-"));
  temporaryDirectories.push(directory);
  return directory;
}
