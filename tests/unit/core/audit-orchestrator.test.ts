import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ACCESSIBILITY_AUTOMATION_DISCLAIMER,
  BROWSER_INSPECTION_SCHEMA_VERSION,
  CRAWL_SCHEMA_VERSION,
  auditResultSchema,
  parseAuditConfig,
  runAuditOrchestration,
  type AccessibilityPageResult,
  type AuditOrchestratorDependencies,
  type BrowserInspectionResult,
  type CrawlResult,
  type CrawlWebsiteOptions,
  type LighthousePageResult,
  type SeoSiteResources,
} from "../../../src/index.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("runAuditOrchestration", () => {
  it("coordinates crawl, evidence, all scanners, scoring, and reports", async () => {
    const outputDir = await createTemporaryDirectory();
    const config = parseAuditConfig({ targetUrl: "example.com", maxPages: 1, outputDir });
    const outcome = await runAuditOrchestration(config, {
      createAuditId: () => "audit-complete-test",
      crawl: crawlWithResource,
      discoverSeoResources: () => Promise.resolve(siteResources()),
      inspect: () => Promise.resolve(browserResult()),
      now: sequentialClock(),
      runAccessibility: () => Promise.resolve(accessibilityResults()),
      runLighthouse: () => Promise.resolve(lighthouseResults()),
      writePdf: (_directory, result) =>
        Promise.resolve(
          auditResultSchema.parse({
            ...result,
            outputs: {
              ...result.outputs,
              pdfReportPath: "C:/reports/audit-complete-test/pdf/audit-report.pdf",
            },
          }),
        ),
    });

    expect(() => auditResultSchema.parse(outcome.auditResult)).not.toThrow();
    expect(outcome.auditResult.scannedPages[0]?.screenshotPath).toBe(
      "screenshots/example-com-desktop.png",
    );
    expect(new Set(outcome.auditResult.findings.map((finding) => finding.scanner))).toEqual(
      new Set(["seo", "forms", "security", "ux", "analytics", "accessibility", "lighthouse"]),
    );
    expect(outcome.auditResult.summary.findingCounts.high).toBeGreaterThan(0);

    const jsonPath = outcome.auditResult.outputs.jsonReportPath ?? "";
    const htmlPath = outcome.auditResult.outputs.htmlReportPath ?? "";
    const markdownPath = outcome.auditResult.outputs.markdownReportPath ?? "";
    expect(outcome.auditResult.outputs.pdfReportPath).toContain("audit-report.pdf");
    const persisted: unknown = JSON.parse(await readFile(jsonPath, "utf8"));
    const html = await readFile(htmlPath, "utf8");
    const markdown = await readFile(markdownPath, "utf8");
    expect(persisted).toEqual(outcome.auditResult);
    expect(html).toContain("Audit Report");
    expect(html).toContain(ACCESSIBILITY_AUTOMATION_DISCLAIMER);
    expect(markdown).toContain(ACCESSIBILITY_AUTOMATION_DISCLAIMER);
    expect(JSON.stringify(persisted)).not.toContain("top-secret-cookie-value");
    expect(JSON.stringify(persisted)).not.toContain("<form");
  });

  it("records a failed scanner and continues into later scanners and JSON output", async () => {
    const outputDir = await createTemporaryDirectory();
    const runLighthouse = vi.fn(() => Promise.resolve(lighthouseResults()));
    const config = parseAuditConfig({
      targetUrl: "example.com",
      maxPages: 1,
      outputDir,
      includeSeo: false,
      includeForms: false,
      includeSecurity: false,
      includeUxHeuristics: false,
      includeAnalytics: false,
      writeHtml: false,
      writeMarkdown: false,
      writePdf: false,
    });
    const outcome = await runAuditOrchestration(config, {
      createAuditId: () => "audit-partial-test",
      crawl: crawlWithResource,
      inspect: () => Promise.reject(new Error("Browser unavailable")),
      now: sequentialClock(),
      runAccessibility: () => Promise.reject(new Error("axe injection failed")),
      runLighthouse,
    });

    expect(runLighthouse).toHaveBeenCalledOnce();
    expect(outcome.auditResult.outputs.markdownReportPath).toBeUndefined();
    expect(outcome.auditResult.outputs.jsonReportPath).toContain("audit-result.json");
    expect(outcome.auditResult.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "browser-inspection-failed", severity: "info" }),
        expect.objectContaining({ ruleId: "accessibility-scanner-failed", severity: "info" }),
        expect.objectContaining({ ruleId: "performance-score-low", scanner: "lighthouse" }),
      ]),
    );
  });

  it("does not invoke disabled scanners or report writers", async () => {
    const outputDir = await createTemporaryDirectory();
    const runAccessibility = vi.fn(() => Promise.resolve([]));
    const runLighthouse = vi.fn(() => Promise.resolve([]));
    const discoverSeoResources = vi.fn(() => Promise.resolve(siteResources()));
    const writeHtml: NonNullable<AuditOrchestratorDependencies["writeHtml"]> = vi.fn(
      (_directory, result) => Promise.resolve(result),
    );
    const writeJson: NonNullable<AuditOrchestratorDependencies["writeJson"]> = vi.fn(
      (_directory, result) => Promise.resolve(auditResultSchema.parse(result)),
    );
    const writeMarkdown: NonNullable<AuditOrchestratorDependencies["writeMarkdown"]> = vi.fn(
      (_directory, result) => Promise.resolve(result),
    );
    const writePdf: NonNullable<AuditOrchestratorDependencies["writePdf"]> = vi.fn(
      (_directory, result) => Promise.resolve(result),
    );
    const config = parseAuditConfig({
      targetUrl: "example.com",
      maxPages: 1,
      outputDir,
      includeSeo: false,
      includeForms: false,
      includeSecurity: false,
      includeUxHeuristics: false,
      includeAnalytics: false,
      includeAccessibility: false,
      includeLighthouse: false,
      writeHtml: false,
      writeJson: false,
      writeMarkdown: false,
      writePdf: false,
    });

    const outcome = await runAuditOrchestration(config, {
      createAuditId: () => "audit-disabled-test",
      crawl: crawlWithResource,
      discoverSeoResources,
      inspect: () => Promise.resolve(browserResult()),
      now: sequentialClock(),
      runAccessibility,
      runLighthouse,
      writeHtml,
      writeJson,
      writeMarkdown,
      writePdf,
    });

    expect(runAccessibility).not.toHaveBeenCalled();
    expect(runLighthouse).not.toHaveBeenCalled();
    expect(discoverSeoResources).not.toHaveBeenCalled();
    expect(writeHtml).not.toHaveBeenCalled();
    expect(writeJson).not.toHaveBeenCalled();
    expect(writeMarkdown).not.toHaveBeenCalled();
    expect(writePdf).not.toHaveBeenCalled();
    expect(outcome.auditResult.findings).toEqual([]);
    expect(Object.keys(outcome.auditResult.outputs)).toEqual(["screenshotDirectory"]);
    expect(outcome.auditResult.outputs.screenshotDirectory ?? "").toContain("screenshots");
  });

  it("produces a partial report when crawling fails", async () => {
    const outputDir = await createTemporaryDirectory();
    const config = parseAuditConfig({
      targetUrl: "example.com",
      outputDir,
      includeSeo: false,
      includeForms: false,
      includeSecurity: false,
      includeUxHeuristics: false,
      includeAnalytics: false,
      includeAccessibility: false,
      includeLighthouse: false,
      writePdf: false,
    });
    const outcome = await runAuditOrchestration(config, {
      createAuditId: () => "audit-crawl-failed-test",
      crawl: () => Promise.reject(new Error("Target refused connection")),
      now: sequentialClock(),
    });

    expect(outcome.auditResult.scannedPages).toEqual([]);
    expect(outcome.auditResult.findings[0]).toMatchObject({
      ruleId: "crawl-failed",
      scanner: "orchestrator",
      severity: "info",
    });
    expect(outcome.auditResult.outputs.jsonReportPath).toContain("audit-result.json");
    expect(outcome.auditResult.outputs.htmlReportPath).toContain("audit-report.html");
    expect(outcome.auditResult.outputs.markdownReportPath).toContain("audit-report.md");
  });

  it("enforces the configured audit deadline and returns a partial result", async () => {
    vi.useFakeTimers();
    try {
      const config = parseAuditConfig({
        targetUrl: "example.com",
        auditTimeoutMs: 30_000,
        includeSeo: false,
        includeForms: false,
        includeSecurity: false,
        includeUxHeuristics: false,
        includeAnalytics: false,
        includeAccessibility: false,
        includeLighthouse: false,
        writeHtml: false,
        writeJson: false,
        writeMarkdown: false,
        writePdf: false,
      });
      const run = runAuditOrchestration(config, {
        createAuditId: () => "audit-deadline-test",
        createOutputDirectories: () =>
          Promise.resolve({
            rootDirectory: "C:/reports",
            auditDirectory: "C:/reports/audit-deadline-test",
            screenshotsDirectory: "C:/reports/audit-deadline-test/screenshots",
            jsonDirectory: "C:/reports/audit-deadline-test/json",
            htmlDirectory: "C:/reports/audit-deadline-test/html",
            markdownDirectory: "C:/reports/audit-deadline-test/markdown",
            pdfDirectory: "C:/reports/audit-deadline-test/pdf",
          }),
        crawl: (options) =>
          new Promise<CrawlResult>((_resolve, reject) => {
            options.signal?.addEventListener(
              "abort",
              () => {
                reject(new Error("Audit deadline exceeded"));
              },
              { once: true },
            );
          }),
        now: sequentialClock(),
      });

      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(30_000);
      const outcome = await run;

      expect(outcome.auditResult.findings[0]).toMatchObject({
        ruleId: "crawl-failed",
        severity: "info",
      });
      expect(outcome.auditResult.findings[0]?.description).toContain("Audit deadline exceeded");
    } finally {
      vi.useRealTimers();
    }
  });
});

function crawlWithResource(options: CrawlWebsiteOptions): Promise<CrawlResult> {
  const result = crawlResult();
  options.onPageFetched?.({
    body: "<!doctype html><html><body><form><input name='email'></form><button></button></body></html>",
    contentType: "text/html",
    headers: { "content-type": "text/html" },
    page: result.pages[0] ?? { url: "https://example.com/", pageType: "home" },
    setCookieHeaders: ["session=top-secret-cookie-value; Secure; HttpOnly; SameSite=Lax"],
  });
  return Promise.resolve(result);
}

function crawlResult(): CrawlResult {
  return {
    schemaVersion: CRAWL_SCHEMA_VERSION,
    startedAt: "2026-07-18T18:00:00.000Z",
    completedAt: "2026-07-18T18:00:01.000Z",
    targetUrl: "https://example.com/",
    pages: [{ url: "https://example.com/", pageType: "home", statusCode: 200 }],
    rejectionCounts: {},
    stats: {
      attemptedPages: 1,
      successfulPages: 1,
      failedPages: 0,
      discoveredUrls: 1,
      rejectedLinks: 0,
    },
  };
}

function browserResult(): BrowserInspectionResult {
  return {
    schemaVersion: BROWSER_INSPECTION_SCHEMA_VERSION,
    startedAt: "2026-07-18T18:00:01.000Z",
    completedAt: "2026-07-18T18:00:02.000Z",
    targetUrl: "https://example.com/",
    pages: [
      {
        requestedUrl: "https://example.com/",
        finalUrl: "https://example.com/",
        viewport: "desktop",
        screenshotPath: "screenshots/example-com-desktop.png",
        durationMs: 50,
        consoleErrors: [],
        pageErrors: [],
        statusCode: 200,
      },
    ],
    runErrors: [],
    stats: {
      sourcePages: 1,
      skippedPages: 0,
      attemptedInspections: 1,
      successfulInspections: 1,
      failedInspections: 0,
      screenshotsCaptured: 1,
    },
  };
}

function accessibilityResults(): AccessibilityPageResult[] {
  return [
    {
      url: "https://example.com/",
      viewport: "desktop",
      violations: [
        {
          id: "button-name",
          impact: "critical",
          description: "Buttons must have discernible text.",
          help: "Buttons must have discernible text",
          nodes: [{ target: ["button"] }],
        },
      ],
    },
  ];
}

function lighthouseResults(): LighthousePageResult[] {
  return [
    {
      url: "https://example.com/",
      viewport: "desktop",
      metrics: {
        performanceScore: 40,
        largestContentfulPaintMs: 4_500,
        cumulativeLayoutShift: 0.3,
        totalBlockingTimeMs: 700,
        speedIndexMs: 5_000,
        firstContentfulPaintMs: 2_000,
      },
      opportunities: [],
    },
  ];
}

function siteResources(): SeoSiteResources {
  return {
    robotsTxt: {
      requestedUrl: "https://example.com/robots.txt",
      finalUrl: "https://example.com/robots.txt",
      statusCode: 200,
      body: "User-agent: *\nAllow: /",
    },
    sitemap: {
      requestedUrl: "https://example.com/sitemap.xml",
      finalUrl: "https://example.com/sitemap.xml",
      statusCode: 200,
      body: "<?xml version='1.0'?><urlset></urlset>",
    },
  };
}

function sequentialClock(): () => Date {
  let offset = 0;
  return () => {
    const date = new Date(Date.parse("2026-07-18T18:00:00.000Z") + offset * 1_000);
    offset += 1;
    return date;
  };
}

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "website-audit-orchestrator-"));
  temporaryDirectories.push(directory);
  return directory;
}
