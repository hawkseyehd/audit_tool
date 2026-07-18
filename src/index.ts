export {
  AUDIT_LIMITS,
  auditConfigSchema,
  parseAuditConfig,
  safeParseAuditConfig,
  type AuditConfig,
  type AuditConfigInput,
} from "./config/audit-config.js";
export {
  CLASSIFICATION_CONFIDENCE_LEVELS,
  classifyPage,
  type ClassificationConfidence,
  type PageClassification,
  type PageClassificationInput,
} from "./classifiers/page-classifier.js";
export {
  getPageScanPriority,
  prioritizePagesForScanning,
} from "./classifiers/page-scan-priority.js";
export { inspectPagesWithBrowser } from "./browser/browser-inspector.js";
export { writeBrowserInspectionResult } from "./browser/browser-result-writer.js";
export { BrowserInspectionError, type BrowserInspectionErrorCode } from "./browser/errors.js";
export {
  createPlaywrightBrowserSession,
  evaluateBrowserRequestSafety,
  type BrowserRequestSafetyDecision,
  type BrowserRequestSafetyInput,
  type PlaywrightSessionDependencies,
} from "./browser/playwright-session.js";
export {
  BROWSER_INSPECTION_SCHEMA_VERSION,
  browserInspectionResultSchema,
  browserInspectionStatsSchema,
  browserPageInspectionSchema,
} from "./browser/schemas.js";
export { createScreenshotTarget, type ScreenshotTarget } from "./browser/screenshot-path.js";
export type {
  BrowserInspectionDependencies,
  BrowserInspectionOptions,
  BrowserInspectionResult,
  BrowserInspectionStats,
  BrowserLauncher,
  BrowserPageInspection,
  BrowserPageRequest,
  BrowserPageSnapshot,
  BrowserSession,
} from "./browser/types.js";
export { writeCrawlResult } from "./crawler/crawl-result-writer.js";
export { crawlWebsite } from "./crawler/crawler.js";
export { PageFetchError, type PageFetchErrorCode } from "./crawler/errors.js";
export {
  createHttpPageFetcher,
  type HttpPageFetcherDependencies,
} from "./crawler/http-page-fetcher.js";
export {
  extractPageLinks,
  type ExtractedPage,
  type PageClassificationSignals,
} from "./crawler/link-extractor.js";
export { scoreUrlPriority } from "./crawler/priority.js";
export { CRAWL_SCHEMA_VERSION, crawlResultSchema, crawlStatsSchema } from "./crawler/schemas.js";
export type {
  CrawlDependencies,
  CrawlResult,
  CrawlStats,
  CrawlWebsiteOptions,
  FetchedPage,
  FetchPageOptions,
  PageFetcher,
} from "./crawler/types.js";
export { executeCli, type CliDependencies, type CliLogger } from "./cli/program.js";
export {
  createCrawlerAuditRunner,
  createBrowserAuditRunner,
  runBrowserAudit,
  runCrawlerAudit,
  runFoundationAudit,
  type AuditRunReceipt,
  type AuditRunner,
  type BrowserAuditRunnerDependencies,
  type BrowserInspector,
  type CrawlRunner,
} from "./cli/runner.js";
export {
  AUDIT_SCHEMA_VERSION,
  EVIDENCE_SOURCES,
  FINDING_CATEGORIES,
  FINDING_SEVERITIES,
  PAGE_TYPES,
  SCANNERS,
  VIEWPORTS,
  auditEvidenceSchema,
  auditFindingSchema,
  auditOutputsSchema,
  auditResultSchema,
  auditSummarySchema,
  evidenceSourceSchema,
  findingCategorySchema,
  findingCountsSchema,
  findingSeveritySchema,
  pageTypeSchema,
  scannedPageErrorSchema,
  scannedPageSchema,
  scannerSchema,
  viewportSchema,
} from "./core/schemas.js";
export type {
  AuditEvidence,
  AuditFinding,
  AuditOutputs,
  AuditResult,
  AuditSummary,
  EvidenceSource,
  FindingCategory,
  FindingCounts,
  FindingSeverity,
  PageType,
  ScannedPage,
  ScannedPageError,
  ScannerName,
  Viewport,
} from "./core/types.js";
export {
  createAuditEvidence,
  createBrowserScreenshotEvidence,
  type AuditEvidenceInput,
} from "./evidence/evidence.js";
export {
  createAuditId,
  createAuditOutputDirectories,
  type AuditIdDependencies,
  type AuditOutputDirectories,
} from "./infrastructure/audit-output.js";
export {
  REDACTED_LOG_PATHS,
  createLogger,
  type CreateLoggerOptions,
} from "./infrastructure/logger.js";
export {
  createCrawlScope,
  evaluateCrawlCandidate,
  type CrawlRejectionReason,
  type CrawlScope,
  type CrawlUrlDecision,
} from "./url/crawl-scope.js";
export { assertPublicNetworkTarget, type DnsResolver } from "./url/network-safety.js";
export {
  UrlPolicyError,
  deduplicateUrls,
  normalizeDiscoveredUrl,
  normalizeTargetUrl,
  type UrlPolicyErrorCode,
} from "./url/normalize-url.js";
