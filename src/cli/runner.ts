import type { AuditConfig } from "../config/audit-config.js";
import { inspectPagesWithBrowser } from "../browser/browser-inspector.js";
import { writeBrowserInspectionResult } from "../browser/browser-result-writer.js";
import type { BrowserInspectionOptions, BrowserInspectionResult } from "../browser/types.js";
import { writeCrawlResult } from "../crawler/crawl-result-writer.js";
import { crawlWebsite } from "../crawler/crawler.js";
import type { CrawlResult } from "../crawler/types.js";
import { createAuditId, createAuditOutputDirectories } from "../infrastructure/audit-output.js";

export interface AuditRunReceipt {
  readonly status: "initialized" | "crawled" | "inspected" | "completed";
  readonly auditId: string;
  readonly scannedPageCount: number;
  readonly outputDirectory: string;
  readonly markdownReportPath?: string;
  readonly jsonReportPath?: string;
  readonly browserInspectionPath?: string;
  readonly screenshotDirectory?: string;
}

export type AuditRunner = (config: AuditConfig) => Promise<AuditRunReceipt>;
export type CrawlRunner = (config: AuditConfig) => Promise<CrawlResult>;
export type BrowserInspector = (
  options: BrowserInspectionOptions,
) => Promise<BrowserInspectionResult>;

export interface BrowserAuditRunnerDependencies {
  readonly crawl?: CrawlRunner;
  readonly inspect?: BrowserInspector;
}

export const runFoundationAudit: AuditRunner = async (config) => {
  const auditId = createAuditId();
  const directories = await createAuditOutputDirectories(config.outputDir, auditId);

  return {
    status: "initialized",
    auditId,
    scannedPageCount: 0,
    outputDirectory: directories.auditDirectory,
  };
};

export function createCrawlerAuditRunner(
  crawl: CrawlRunner = (config) => crawlWebsite({ config }),
): AuditRunner {
  return async (config) => {
    const auditId = createAuditId();
    const directories = await createAuditOutputDirectories(config.outputDir, auditId);
    const crawlResult = await crawl(config);
    const crawlResultPath = await writeCrawlResult(directories.jsonDirectory, crawlResult);

    return {
      status: "crawled",
      auditId,
      scannedPageCount: crawlResult.stats.attemptedPages,
      outputDirectory: directories.auditDirectory,
      jsonReportPath: crawlResultPath,
    };
  };
}

export const runCrawlerAudit = createCrawlerAuditRunner();

export function createBrowserAuditRunner(
  dependencies: BrowserAuditRunnerDependencies = {},
): AuditRunner {
  const crawl = dependencies.crawl ?? ((config) => crawlWebsite({ config }));
  const inspect = dependencies.inspect ?? inspectPagesWithBrowser;

  return async (config) => {
    const auditId = createAuditId();
    const directories = await createAuditOutputDirectories(config.outputDir, auditId);
    const crawlResult = await crawl(config);
    const crawlResultPath = await writeCrawlResult(directories.jsonDirectory, crawlResult);
    const inspectionResult = await inspect({
      auditDirectory: directories.auditDirectory,
      config,
      pages: crawlResult.pages,
      screenshotsDirectory: directories.screenshotsDirectory,
    });
    const browserInspectionPath = await writeBrowserInspectionResult(
      directories.jsonDirectory,
      inspectionResult,
    );

    return {
      status: "inspected",
      auditId,
      scannedPageCount: crawlResult.stats.attemptedPages,
      outputDirectory: directories.auditDirectory,
      jsonReportPath: crawlResultPath,
      browserInspectionPath,
      screenshotDirectory: directories.screenshotsDirectory,
    };
  };
}

export const runBrowserAudit = createBrowserAuditRunner();
