import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  auditResultSchema,
  generateJsonReport,
  writeJsonReport,
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

describe("generateJsonReport", () => {
  it("serializes the complete validated result deterministically", () => {
    const result = resultFixture();
    const first = generateJsonReport(result);
    const second = generateJsonReport(result);
    const parsed: unknown = JSON.parse(first);

    expect(first).toBe(second);
    expect(first.endsWith("\n")).toBe(true);
    expect(first).toContain('\n  "schemaVersion": "1.0.0"');
    expect(parsed).toEqual(result);
    expect(() => auditResultSchema.parse(parsed)).not.toThrow();
  });
});

describe("writeJsonReport", () => {
  it("atomically writes the full result and retains existing output paths", async () => {
    const directory = await createTemporaryDirectory();
    const result = resultFixture();
    const writtenResult = await writeJsonReport(directory, result);
    const reportPath = writtenResult.outputs.jsonReportPath;
    const persisted: unknown = JSON.parse(await readFile(reportPath ?? "", "utf8"));

    expect(reportPath).toBe(join(directory, "audit-result.json"));
    expect(writtenResult.outputs.markdownReportPath).toBe("reports/markdown/audit-report.md");
    expect(persisted).toEqual(writtenResult);
    expect(() => auditResultSchema.parse(persisted)).not.toThrow();
    expect((await readdir(directory)).filter((name) => name.endsWith(".tmp"))).toEqual([]);
  });

  it("rejects invalid results before creating an artifact", async () => {
    const directory = await createTemporaryDirectory();
    const invalid = { ...resultFixture(), schemaVersion: "2.0.0" };

    await expect(writeJsonReport(directory, invalid)).rejects.toThrow();
    expect(await readdir(directory)).toEqual([]);
  });
});

function resultFixture(): AuditResult {
  return auditResultSchema.parse({
    schemaVersion: "1.0.0",
    auditId: "audit-json-test",
    startedAt: "2026-07-18T18:00:00.000Z",
    completedAt: "2026-07-18T18:05:00.000Z",
    targetUrl: "example.com",
    normalizedUrl: "https://example.com/",
    scannedPages: [{ url: "https://example.com/", pageType: "home", statusCode: 200 }],
    summary: {
      overallScore: 90,
      categoryScores: {
        performance: 90,
        accessibility: 100,
        formsAndConversionUx: 100,
        seo: 100,
        securityPrivacy: 100,
        technicalContentQuality: 100,
      },
      findingCounts: { critical: 0, high: 1, medium: 0, low: 0, info: 0 },
      topPriorities: ["Largest Contentful Paint is slow"],
    },
    findings: [
      {
        id: "performance-lcp",
        ruleId: "largest-contentful-paint",
        url: "https://example.com/",
        category: "performance",
        severity: "high",
        title: "Largest Contentful Paint is slow",
        description: "LCP exceeded the accepted threshold.",
        impact: "Visitors may wait too long for the main content.",
        recommendation: "Optimize the LCP resource and critical rendering path.",
        scanner: "lighthouse",
        detectedAt: "2026-07-18T18:03:00.000Z",
        evidence: {
          metric: "LCP (ms)",
          value: 4500,
          expected: "<=2500",
          source: "lighthouse",
        },
      },
    ],
    outputs: {
      markdownReportPath: "reports/markdown/audit-report.md",
      screenshotDirectory: "reports/screenshots",
    },
  });
}

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "website-audit-json-"));
  temporaryDirectories.push(directory);
  return directory;
}
