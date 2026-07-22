import type { AuditConfig } from "../config/audit-config.js";
import { inspectPagesWithBrowser } from "../browser/browser-inspector.js";
import { writeBrowserInspectionResult } from "../browser/browser-result-writer.js";
import type { BrowserInspectionOptions, BrowserInspectionResult } from "../browser/types.js";
import { writeCrawlResult } from "../crawler/crawl-result-writer.js";
import { crawlWebsite } from "../crawler/crawler.js";
import type { CrawlResult } from "../crawler/types.js";
import { createAuditId, createAuditOutputDirectories } from "../infrastructure/audit-output.js";
import {
  runAuditOrchestration,
  type AuditOrchestratorDependencies,
} from "../core/audit-orchestrator.js";

export interface AuditRunReceipt {
  readonly status: "initialized" | "crawled" | "inspected" | "completed";
  readonly auditId: string;
  readonly scannedPageCount: number;
  readonly outputDirectory: string;
  readonly clientSummaryPdfReportPath?: string;
  readonly htmlReportPath?: string;
  readonly markdownReportPath?: string;
  readonly jsonReportPath?: string;
  readonly pdfReportPath?: string;
  readonly summaryPdfReportPath?: string;
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

export function createFullAuditRunner(
  dependencies: AuditOrchestratorDependencies = {},
): AuditRunner {
  return async (config) => {
    const outcome = await runAuditOrchestration(config, dependencies);
    return {
      status: "completed",
      auditId: outcome.auditResult.auditId,
      scannedPageCount: outcome.auditResult.scannedPages.length,
      outputDirectory: outcome.outputDirectory,
      ...(outcome.auditResult.outputs.clientSummaryPdfReportPath === undefined
        ? {}
        : { clientSummaryPdfReportPath: outcome.auditResult.outputs.clientSummaryPdfReportPath }),
      ...(outcome.auditResult.outputs.htmlReportPath === undefined
        ? {}
        : { htmlReportPath: outcome.auditResult.outputs.htmlReportPath }),
      ...(outcome.auditResult.outputs.markdownReportPath === undefined
        ? {}
        : { markdownReportPath: outcome.auditResult.outputs.markdownReportPath }),
      ...(outcome.auditResult.outputs.jsonReportPath === undefined
        ? {}
        : { jsonReportPath: outcome.auditResult.outputs.jsonReportPath }),
      ...(outcome.auditResult.outputs.pdfReportPath === undefined
        ? {}
        : { pdfReportPath: outcome.auditResult.outputs.pdfReportPath }),
      ...(outcome.auditResult.outputs.summaryPdfReportPath === undefined
        ? {}
        : { summaryPdfReportPath: outcome.auditResult.outputs.summaryPdfReportPath }),
      ...(outcome.auditResult.outputs.screenshotDirectory === undefined
        ? {}
        : { screenshotDirectory: outcome.auditResult.outputs.screenshotDirectory }),
    };
  };
}

export const runFullAudit = createFullAuditRunner();
