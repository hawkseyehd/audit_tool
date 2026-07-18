import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  CRAWL_SCHEMA_VERSION,
  BROWSER_INSPECTION_SCHEMA_VERSION,
  createBrowserAuditRunner,
  createCrawlerAuditRunner,
  createFullAuditRunner,
  parseAuditConfig,
  runFoundationAudit,
  type BrowserInspectionResult,
  type CrawlResult,
} from "../../../src/index.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("runFoundationAudit", () => {
  it("creates a safe audit workspace without claiming pages were scanned", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "website-audit-cli-"));
    temporaryDirectories.push(outputDir);
    const config = parseAuditConfig({ targetUrl: "example.com", outputDir });

    const receipt = await runFoundationAudit(config);

    expect(receipt.status).toBe("initialized");
    expect(receipt.scannedPageCount).toBe(0);
    expect(receipt.auditId).toMatch(/^audit-/u);
    await expect(access(receipt.outputDirectory)).resolves.toBeUndefined();
  });
});

describe("createCrawlerAuditRunner", () => {
  it("writes the crawl artifact and reports the real attempted page count", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "website-audit-crawler-runner-"));
    temporaryDirectories.push(outputDir);
    const config = parseAuditConfig({ targetUrl: "example.com", outputDir });
    const result = createCrawlResult();
    const runner = createCrawlerAuditRunner(() => Promise.resolve(result));

    const receipt = await runner(config);

    expect(receipt.status).toBe("crawled");
    expect(receipt.scannedPageCount).toBe(1);
    expect(receipt.jsonReportPath).toContain("crawl-result.json");
    await expect(access(receipt.jsonReportPath ?? "missing")).resolves.toBeUndefined();
  });
});

describe("createBrowserAuditRunner", () => {
  it("writes crawl and browser artifacts and reports inspected lifecycle state", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "website-audit-browser-runner-"));
    temporaryDirectories.push(outputDir);
    const config = parseAuditConfig({ targetUrl: "example.com", outputDir });
    const result = createCrawlResult();
    const runner = createBrowserAuditRunner({
      crawl: () => Promise.resolve(result),
      inspect: (options) => {
        expect(options.pages).toEqual(result.pages);
        expect(options.screenshotsDirectory).toContain("screenshots");
        return Promise.resolve(createBrowserResult());
      },
    });

    const receipt = await runner(config);

    expect(receipt.status).toBe("inspected");
    expect(receipt.scannedPageCount).toBe(1);
    expect(receipt.jsonReportPath).toContain("crawl-result.json");
    expect(receipt.browserInspectionPath).toContain("browser-inspection.json");
    await expect(access(receipt.browserInspectionPath ?? "missing")).resolves.toBeUndefined();
    await expect(access(receipt.screenshotDirectory ?? "missing")).resolves.toBeUndefined();
  });
});

describe("createFullAuditRunner", () => {
  it("returns completed lifecycle paths from the canonical orchestrator", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "website-audit-full-runner-"));
    temporaryDirectories.push(outputDir);
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
      writePdfSummary: false,
    });
    const runner = createFullAuditRunner({
      createAuditId: () => "audit-full-runner-test",
      crawl: () => Promise.resolve(createCrawlResult()),
      inspect: () => Promise.resolve(createBrowserResult()),
      now: sequentialClock(),
    });

    const receipt = await runner(config);

    expect(receipt.status).toBe("completed");
    expect(receipt.scannedPageCount).toBe(1);
    expect(receipt.htmlReportPath).toContain("audit-report.html");
    expect(receipt.markdownReportPath).toContain("audit-report.md");
    expect(receipt.jsonReportPath).toContain("audit-result.json");
    expect(receipt.screenshotDirectory).toContain("screenshots");
  });
});

function createCrawlResult(): CrawlResult {
  return {
    schemaVersion: CRAWL_SCHEMA_VERSION,
    startedAt: "2026-07-18T10:00:00.000Z",
    completedAt: "2026-07-18T10:00:01.000Z",
    targetUrl: "https://example.com/",
    pages: [{ url: "https://example.com/", pageType: "unknown", statusCode: 200 }],
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

function createBrowserResult(): BrowserInspectionResult {
  return {
    schemaVersion: BROWSER_INSPECTION_SCHEMA_VERSION,
    startedAt: "2026-07-18T10:00:01.000Z",
    completedAt: "2026-07-18T10:00:02.000Z",
    targetUrl: "https://example.com/",
    pages: [
      {
        requestedUrl: "https://example.com/",
        finalUrl: "https://example.com/",
        viewport: "desktop",
        durationMs: 100,
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
      screenshotsCaptured: 0,
    },
  };
}

function sequentialClock(): () => Date {
  let offset = 0;
  return () => {
    const date = new Date(Date.parse("2026-07-18T10:00:00.000Z") + offset * 1_000);
    offset += 1;
    return date;
  };
}
