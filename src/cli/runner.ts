import type { AuditConfig } from "../config/audit-config.js";
import { writeCrawlResult } from "../crawler/crawl-result-writer.js";
import { crawlWebsite } from "../crawler/crawler.js";
import type { CrawlResult } from "../crawler/types.js";
import { createAuditId, createAuditOutputDirectories } from "../infrastructure/audit-output.js";

export interface AuditRunReceipt {
  readonly status: "initialized" | "crawled" | "completed";
  readonly auditId: string;
  readonly scannedPageCount: number;
  readonly outputDirectory: string;
  readonly markdownReportPath?: string;
  readonly jsonReportPath?: string;
}

export type AuditRunner = (config: AuditConfig) => Promise<AuditRunReceipt>;
export type CrawlRunner = (config: AuditConfig) => Promise<CrawlResult>;

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
