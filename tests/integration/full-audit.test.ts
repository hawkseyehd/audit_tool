import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  auditResultSchema,
  createHttpPageFetcher,
  createPlaywrightBrowserSession,
  createSeoSiteResourceFetcher,
  crawlWebsite,
  discoverSeoSiteResources,
  inspectPagesWithBrowser,
  parseAuditConfig,
  runAccessibilityAudits,
  runAuditOrchestration,
  type LighthousePageResult,
} from "../../src/index.js";
import { startAuditFixtureSite } from "../fixtures/audit-site.fixture.js";

describe("full local audit integration", () => {
  it("runs real crawl, browser, axe, scanners, scoring, and report persistence", async () => {
    const site = await startAuditFixtureSite();
    const outputDir = await mkdtemp(join(tmpdir(), "website-audit-integration-"));
    const allowFixtureTarget = (): Promise<void> => Promise.resolve();

    try {
      const config = parseAuditConfig({
        targetUrl: site.url,
        maxPages: 2,
        maxLighthousePages: 1,
        outputDir,
        viewports: ["desktop", "mobile"],
        concurrency: 1,
        crawlDelayMs: 10,
        navigationTimeoutMs: 20_000,
        auditTimeoutMs: 120_000,
      });
      const outcome = await runAuditOrchestration(config, {
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
        runLighthouse: (options) => Promise.resolve(lighthouseFixture(options.pages[0]?.url)),
      });

      expect(() => auditResultSchema.parse(outcome.auditResult)).not.toThrow();
      expect(outcome.auditResult.scannedPages).toHaveLength(2);
      expect(outcome.auditResult.findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ scanner: "forms" }),
          expect.objectContaining({ scanner: "accessibility", ruleId: "button-name" }),
          expect.objectContaining({ scanner: "lighthouse", ruleId: "performance-score-low" }),
        ]),
      );
      expect(outcome.auditResult.summary.overallScore).toBeLessThan(100);
      expect(outcome.auditResult.outputs.markdownReportPath).toContain("audit-report.md");
      expect(outcome.auditResult.outputs.jsonReportPath).toContain("audit-result.json");

      const screenshotPage = outcome.auditResult.scannedPages.find(
        (page) => page.screenshotPath !== undefined,
      );
      await expect(
        access(join(outcome.outputDirectory, screenshotPage?.screenshotPath ?? "missing")),
      ).resolves.toBeUndefined();
      const json = await readFile(outcome.auditResult.outputs.jsonReportPath ?? "", "utf8");
      const markdown = await readFile(outcome.auditResult.outputs.markdownReportPath ?? "", "utf8");
      expect(json).not.toContain("private-fixture-value");
      expect(json).not.toContain("<!doctype html>");
      expect(markdown).toContain("## Recommended 30-Day Action Plan");
      expect(markdown).toContain("## Disclaimer and Audit Limitations");
    } finally {
      await site.close();
      await rm(outputDir, { force: true, recursive: true });
    }
  }, 30_000);
});

function lighthouseFixture(url: string | undefined): LighthousePageResult[] {
  if (url === undefined) return [];
  return [
    {
      url,
      viewport: "mobile",
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
