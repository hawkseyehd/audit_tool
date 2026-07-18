import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  auditResultSchema,
  createFullAuditRunner,
  createHttpPageFetcher,
  createPlaywrightBrowserSession,
  createSeoSiteResourceFetcher,
  crawlWebsite,
  discoverSeoSiteResources,
  executeCli,
  inspectPagesWithBrowser,
  runAccessibilityAudits,
  type LighthousePageResult,
} from "../../src/index.js";
import { startAuditFixtureSite } from "../fixtures/audit-site.fixture.js";

describe("MVP acceptance", () => {
  it("completes one CLI audit across 10 pages without submitting forms", async () => {
    const site = await startAuditFixtureSite();
    const outputDir = await mkdtemp(join(tmpdir(), "website-audit-mvp-"));
    const allowFixtureTarget = (): Promise<void> => Promise.resolve();
    const lighthouseUrls: string[] = [];
    const stdout: string[] = [];
    const stderr: string[] = [];
    const auditId = "audit-mvp-acceptance";
    const runner = createFullAuditRunner({
      createAuditId: () => auditId,
      crawl: (options) =>
        crawlWebsite(options, {
          fetchPage: createHttpPageFetcher({ assertSafeTarget: allowFixtureTarget }),
        }),
      discoverSeoResources: (resourceConfig, signal) =>
        discoverSeoSiteResources(
          resourceConfig,
          {
            fetchResource: createSeoSiteResourceFetcher({
              assertSafeTarget: allowFixtureTarget,
            }),
          },
          signal,
        ),
      inspect: (options) =>
        inspectPagesWithBrowser(options, {
          launchBrowser: () =>
            createPlaywrightBrowserSession({ assertSafeTarget: allowFixtureTarget }),
        }),
      runAccessibility: (options) =>
        runAccessibilityAudits(options, { assertSafeTarget: allowFixtureTarget }),
      runLighthouse: (options) => {
        const homepage = options.pages.find((page) => new URL(page.url).pathname === "/");
        if (homepage !== undefined) lighthouseUrls.push(homepage.url);
        return Promise.resolve(lighthouseFixture(homepage?.url));
      },
    });

    try {
      const exitCode = await executeCli(
        [
          "node",
          "website-audit",
          "audit",
          site.url,
          "--max-pages",
          "10",
          "--output",
          outputDir,
          "--desktop",
        ],
        {
          logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
          runAudit: runner,
          writeError: (message) => stderr.push(message),
          writeOut: (message) => stdout.push(message),
        },
      );

      expect(exitCode).toBe(0);
      expect(stderr).toEqual([]);
      expect(stdout.join("\n")).toContain("Audit completed: audit-mvp-acceptance");
      expect(stdout.join("\n")).toContain("Scanned pages: 10");

      const jsonPath = join(outputDir, auditId, "json", "audit-result.json");
      const markdownPath = join(outputDir, auditId, "markdown", "audit-report.md");
      const persisted: unknown = JSON.parse(await readFile(jsonPath, "utf8"));
      const result = auditResultSchema.parse(persisted);
      const markdown = await readFile(markdownPath, "utf8");

      expect(result.scannedPages).toHaveLength(10);
      expect(
        result.scannedPages.every((page) => new URL(page.url).origin === new URL(site.url).origin),
      ).toBe(true);
      expect(lighthouseUrls).toEqual([site.url]);
      expect(result.findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ scanner: "forms" }),
          expect.objectContaining({ scanner: "accessibility" }),
          expect.objectContaining({ scanner: "lighthouse", ruleId: "performance-score-low" }),
        ]),
      );
      for (const finding of result.findings) {
        expect(finding.severity.length).toBeGreaterThan(0);
        expect(finding.impact.length).toBeGreaterThan(0);
        expect(finding.recommendation.length).toBeGreaterThan(0);
        expect(finding.evidence).toBeDefined();
      }
      expect(result.outputs.markdownReportPath).toBe(markdownPath);
      expect(result.outputs.jsonReportPath).toBe(jsonPath);
      expect(markdown).toContain("# Website Audit Report");
      expect(markdown).toContain("## Findings by Severity");
      expect(site.getRequests().some((request) => request.method === "POST")).toBe(false);
    } finally {
      await site.close();
      await rm(outputDir, { force: true, recursive: true });
    }
  }, 90_000);
});

function lighthouseFixture(url: string | undefined): LighthousePageResult[] {
  if (url === undefined) return [];
  return [
    {
      url,
      viewport: "desktop",
      metrics: {
        performanceScore: 45,
        largestContentfulPaintMs: 4_100,
        cumulativeLayoutShift: 0.2,
        totalBlockingTimeMs: 650,
        speedIndexMs: 5_000,
        firstContentfulPaintMs: 2_000,
      },
      opportunities: [],
    },
  ];
}
