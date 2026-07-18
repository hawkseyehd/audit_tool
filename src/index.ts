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
  createBrowserContextOptions,
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
export type { AuditScanner, ScannerContext } from "./scanners/types.js";
export { createSeoScanner, scanSeo } from "./scanners/seo/seo-scanner.js";
export { extractSeoPageSnapshot } from "./scanners/seo/seo-snapshot.js";
export {
  createSeoSiteResourceFetcher,
  discoverSeoSiteResources,
} from "./scanners/seo/site-resources.js";
export {
  seoHeadingSchema,
  seoPageSnapshotSchema,
  seoSiteResourceSchema,
  seoSiteResourcesSchema,
} from "./scanners/seo/schemas.js";
export type {
  SeoFetchedResource,
  SeoHeading,
  SeoPageSnapshot,
  SeoResourceConfig,
  SeoResourceFetcherDependencies,
  SeoScanInput,
  SeoScannerDependencies,
  SeoSiteResource,
  SeoSiteResourceDependencies,
  SeoSiteResourceFetcher,
  SeoSiteResourceFetcherOptions,
  SeoSiteResources,
  SeoSnapshotInput,
} from "./scanners/seo/types.js";
export { createFormScanner, scanForms } from "./scanners/forms/form-scanner.js";
export { extractFormPageSnapshot } from "./scanners/forms/form-snapshot.js";
export {
  FORM_KINDS,
  formFactSchema,
  formFieldFactSchema,
  formKindSchema,
  formPageSnapshotSchema,
} from "./scanners/forms/schemas.js";
export type {
  FormFact,
  FormFieldFact,
  FormKind,
  FormPageSnapshot,
  FormScanInput,
  FormSnapshotInput,
} from "./scanners/forms/types.js";
export { createSecurityScanner, scanSecurity } from "./scanners/security/security-scanner.js";
export { extractSecurityPageSnapshot } from "./scanners/security/security-snapshot.js";
export { securityPageSnapshotSchema } from "./scanners/security/schemas.js";
export type {
  SecurityPageSnapshot,
  SecurityScanInput,
  SecuritySnapshotInput,
} from "./scanners/security/types.js";
export { createUxScanner, scanUx } from "./scanners/ux/ux-scanner.js";
export { extractUxPageSnapshot } from "./scanners/ux/ux-snapshot.js";
export { uxPageSnapshotSchema, uxRenderedObservationSchema } from "./scanners/ux/schemas.js";
export type {
  UxPageSnapshot,
  UxRenderedObservation,
  UxScanInput,
  UxSnapshotInput,
} from "./scanners/ux/types.js";
export {
  ANALYTICS_PROVIDERS,
  analyticsPageSnapshotSchema,
  analyticsProviderSchema,
  createAnalyticsScanner,
  extractAnalyticsPageSnapshot,
  scanAnalytics,
  type AnalyticsPageSnapshot,
  type AnalyticsProvider,
  type AnalyticsScanInput,
} from "./scanners/analytics/analytics-scanner.js";
export { runLighthouseAudits } from "./scanners/lighthouse/lighthouse-adapter.js";
export {
  createLighthouseScanner,
  scanLighthouse,
} from "./scanners/lighthouse/lighthouse-scanner.js";
export {
  lighthouseMetricsSchema,
  lighthouseOpportunitySchema,
  lighthousePageResultSchema,
} from "./scanners/lighthouse/schemas.js";
export type {
  LighthouseAuditDependencies,
  LighthouseAuditOptions,
  LighthouseChrome,
  LighthouseChromeLauncher,
  LighthouseMetrics,
  LighthouseOpportunity,
  LighthousePageResult,
  LighthouseRunRequest,
  LighthouseRunner,
  LighthouseScanInput,
} from "./scanners/lighthouse/types.js";
export {
  ACCESSIBILITY_AUTOMATION_DISCLAIMER,
  createAccessibilityScanner,
  scanAccessibility,
} from "./scanners/accessibility/accessibility-scanner.js";
export {
  createAccessibilitySession,
  runAccessibilityAudits,
} from "./scanners/accessibility/accessibility-adapter.js";
export {
  accessibilityPageResultSchema,
  axeImpactSchema,
  axeViolationSchema,
} from "./scanners/accessibility/schemas.js";
export type {
  AccessibilityAuditDependencies,
  AccessibilityAuditOptions,
  AccessibilityPageResult,
  AccessibilityPageRequest,
  AccessibilityScanInput,
  AccessibilitySession,
  AccessibilitySessionLauncher,
  AxeImpact,
  AxeViolation,
} from "./scanners/accessibility/types.js";
export {
  FINDING_CATEGORY_SCORE_GROUPS,
  SCORE_CATEGORIES,
  SCORE_CATEGORY_WEIGHTS,
  SEVERITY_PENALTIES,
  calculateAuditSummary,
  calculateCategoryScores,
  countFindings,
  selectTopPriorities,
  type ScoreCategory,
  type ScoreCategoryScores,
} from "./scoring/scoring-engine.js";
