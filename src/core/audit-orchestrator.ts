import { createHash } from "node:crypto";

import { inspectPagesWithBrowser } from "../browser/browser-inspector.js";
import type { BrowserInspectionOptions, BrowserInspectionResult } from "../browser/types.js";
import { parseAuditConfig, type AuditConfig } from "../config/audit-config.js";
import { crawlWebsite } from "../crawler/crawler.js";
import { CRAWL_SCHEMA_VERSION, crawlResultSchema } from "../crawler/schemas.js";
import type { CrawlPageResource, CrawlResult, CrawlWebsiteOptions } from "../crawler/types.js";
import {
  createAuditId,
  createAuditOutputDirectories,
  type AuditOutputDirectories,
} from "../infrastructure/audit-output.js";
import { writeJsonReport } from "../reports/json-report.js";
import { writeMarkdownReport } from "../reports/markdown-report.js";
import { runAccessibilityAudits } from "../scanners/accessibility/accessibility-adapter.js";
import { scanAccessibility } from "../scanners/accessibility/accessibility-scanner.js";
import {
  extractAnalyticsPageSnapshot,
  scanAnalytics,
} from "../scanners/analytics/analytics-scanner.js";
import { extractFormPageSnapshot } from "../scanners/forms/form-snapshot.js";
import { scanForms } from "../scanners/forms/form-scanner.js";
import { runLighthouseAudits } from "../scanners/lighthouse/lighthouse-adapter.js";
import { scanLighthouse } from "../scanners/lighthouse/lighthouse-scanner.js";
import { extractSecurityPageSnapshot } from "../scanners/security/security-snapshot.js";
import { scanSecurity } from "../scanners/security/security-scanner.js";
import { discoverSeoSiteResources } from "../scanners/seo/site-resources.js";
import { extractSeoPageSnapshot } from "../scanners/seo/seo-snapshot.js";
import { scanSeo } from "../scanners/seo/seo-scanner.js";
import type { SeoSiteResources } from "../scanners/seo/types.js";
import type { ScannerContext } from "../scanners/types.js";
import { extractUxPageSnapshot } from "../scanners/ux/ux-snapshot.js";
import { scanUx } from "../scanners/ux/ux-scanner.js";
import { calculateAuditSummary } from "../scoring/scoring-engine.js";
import { normalizeTargetUrl } from "../url/normalize-url.js";
import {
  AUDIT_SCHEMA_VERSION,
  auditFindingSchema,
  auditResultSchema,
  scannedPageSchema,
} from "./schemas.js";
import type { AuditFinding, AuditResult, ScannedPage, ScannerName } from "./types.js";

export interface FullAuditRunResult {
  readonly auditResult: AuditResult;
  readonly outputDirectory: string;
}

export type OrchestratorCrawlRunner = (options: CrawlWebsiteOptions) => Promise<CrawlResult>;
export type SeoResourceDiscovery = (
  config: AuditConfig,
  signal?: AbortSignal,
) => Promise<SeoSiteResources>;

export interface AuditOrchestratorDependencies {
  readonly createAuditId?: () => string;
  readonly createOutputDirectories?: (
    outputRoot: string,
    auditId: string,
  ) => Promise<AuditOutputDirectories>;
  readonly crawl?: OrchestratorCrawlRunner;
  readonly discoverSeoResources?: SeoResourceDiscovery;
  readonly inspect?: (options: BrowserInspectionOptions) => Promise<BrowserInspectionResult>;
  readonly now?: () => Date;
  readonly runAccessibility?: typeof runAccessibilityAudits;
  readonly runLighthouse?: typeof runLighthouseAudits;
  readonly writeJson?: typeof writeJsonReport;
  readonly writeMarkdown?: typeof writeMarkdownReport;
}

export async function runAuditOrchestration(
  configInput: AuditConfig,
  dependencies: AuditOrchestratorDependencies = {},
): Promise<FullAuditRunResult> {
  const config = parseAuditConfig(configInput);
  const normalizedUrl = normalizeTargetUrl(config.targetUrl);
  const now = dependencies.now ?? (() => new Date());
  const startedAt = timestamp(now);
  const auditId = dependencies.createAuditId?.() ?? createAuditId();
  const directories = await (dependencies.createOutputDirectories ?? createAuditOutputDirectories)(
    config.outputDir,
    auditId,
  );
  const deadline = new AbortController();
  const timeout = setTimeout(() => {
    deadline.abort(new Error("Audit deadline exceeded"));
  }, config.auditTimeoutMs);
  const resources: CrawlPageResource[] = [];
  const findings: AuditFinding[] = [];
  const context: ScannerContext = { detectedAt: timestamp(now) };
  let crawlResult: CrawlResult;
  let inspectionResult: BrowserInspectionResult | undefined;

  try {
    try {
      crawlResult = await (dependencies.crawl ?? crawlWebsite)({
        config,
        onPageFetched: (resource) => resources.push(resource),
        signal: deadline.signal,
      });
    } catch (error: unknown) {
      crawlResult = emptyCrawlResult(normalizedUrl, now);
      findings.push(
        operationalFinding("orchestrator", "crawl-failed", normalizedUrl, error, context),
      );
    }

    if (crawlResult.pages.length > 0 && !deadline.signal.aborted) {
      try {
        inspectionResult = await (dependencies.inspect ?? inspectPagesWithBrowser)({
          auditDirectory: directories.auditDirectory,
          config,
          pages: crawlResult.pages,
          screenshotsDirectory: directories.screenshotsDirectory,
          signal: deadline.signal,
        });
        if (inspectionResult.runErrors.length > 0) {
          findings.push(
            operationalFinding(
              "orchestrator",
              "browser-inspection-partial",
              normalizedUrl,
              new Error(inspectionResult.runErrors.map((error) => error.message).join("; ")),
              context,
            ),
          );
        }
      } catch (error: unknown) {
        findings.push(
          operationalFinding(
            "orchestrator",
            "browser-inspection-failed",
            normalizedUrl,
            error,
            context,
          ),
        );
      }
    }

    if (config.includeSeo) {
      findings.push(
        ...(await runScanner("seo", normalizedUrl, context, deadline.signal, async () => {
          const siteResources = await (
            dependencies.discoverSeoResources ?? defaultSeoResourceDiscovery
          )(config, deadline.signal);
          return scanSeo(
            {
              crawlPages: crawlResult.pages,
              pages: resources.map((resource) =>
                extractSeoPageSnapshot({
                  allowedDomains: config.allowedDomains,
                  html: resource.body,
                  page: resource.page,
                  targetUrl: normalizedUrl,
                }),
              ),
              siteResources,
            },
            context,
          );
        })),
      );
    }

    if (config.includeForms) {
      findings.push(
        ...(await runScanner("forms", normalizedUrl, context, deadline.signal, () =>
          Promise.resolve(
            scanForms(
              {
                pages: resources.map((resource) =>
                  extractFormPageSnapshot({ html: resource.body, page: resource.page }),
                ),
              },
              context,
            ),
          ),
        )),
      );
    }

    if (config.includeSecurity) {
      findings.push(
        ...(await runScanner("security", normalizedUrl, context, deadline.signal, () =>
          Promise.resolve(
            scanSecurity(
              {
                pages: resources.map((resource) =>
                  extractSecurityPageSnapshot({
                    finalUrl: resource.page.url,
                    headers: resource.headers,
                    html: resource.body,
                    setCookieHeaders: resource.setCookieHeaders,
                    ...(resource.page.statusCode === undefined
                      ? {}
                      : { statusCode: resource.page.statusCode }),
                    url: resource.page.url,
                  }),
                ),
              },
              context,
            ),
          ),
        )),
      );
    }

    if (config.includeUxHeuristics) {
      findings.push(
        ...(await runScanner("ux", normalizedUrl, context, deadline.signal, () =>
          Promise.resolve(
            scanUx(
              {
                pages: resources.map((resource) =>
                  extractUxPageSnapshot({
                    html: resource.body,
                    page: resource.page,
                    rendered: renderedEvidence(resource.page.url, inspectionResult),
                  }),
                ),
              },
              context,
            ),
          ),
        )),
      );
    }

    if (config.includeAnalytics) {
      findings.push(
        ...(await runScanner("analytics", normalizedUrl, context, deadline.signal, () =>
          Promise.resolve(
            scanAnalytics(
              {
                pages: resources.map((resource) =>
                  extractAnalyticsPageSnapshot(resource.body, resource.page.url),
                ),
              },
              context,
            ),
          ),
        )),
      );
    }

    if (config.includeAccessibility) {
      findings.push(
        ...(await runScanner("accessibility", normalizedUrl, context, deadline.signal, async () =>
          scanAccessibility(
            {
              results: await (dependencies.runAccessibility ?? runAccessibilityAudits)({
                config,
                pages: crawlResult.pages,
                signal: deadline.signal,
              }),
            },
            context,
          ),
        )),
      );
    }

    if (config.includeLighthouse) {
      findings.push(
        ...(await runScanner("lighthouse", normalizedUrl, context, deadline.signal, async () =>
          scanLighthouse(
            {
              results: await (dependencies.runLighthouse ?? runLighthouseAudits)({
                config,
                pages: crawlResult.pages,
                signal: deadline.signal,
              }),
            },
            context,
          ),
        )),
      );
    }

    const scannedPages = mergeScannedPages(crawlResult.pages, inspectionResult);
    let auditResult = auditResultSchema.parse({
      schemaVersion: AUDIT_SCHEMA_VERSION,
      auditId,
      startedAt,
      completedAt: timestamp(now),
      targetUrl: config.targetUrl,
      normalizedUrl,
      scannedPages,
      summary: calculateAuditSummary(findings),
      findings,
      outputs: { screenshotDirectory: directories.screenshotsDirectory },
    });

    if (config.writeMarkdown) {
      auditResult = await (dependencies.writeMarkdown ?? writeMarkdownReport)(
        directories.markdownDirectory,
        auditResult,
      );
    }
    if (config.writeJson) {
      auditResult = await (dependencies.writeJson ?? writeJsonReport)(
        directories.jsonDirectory,
        auditResult,
      );
    }

    return { auditResult, outputDirectory: directories.auditDirectory };
  } finally {
    clearTimeout(timeout);
  }
}

async function runScanner(
  scanner: ScannerName,
  url: string,
  context: ScannerContext,
  signal: AbortSignal,
  operation: () => Promise<readonly AuditFinding[]>,
): Promise<readonly AuditFinding[]> {
  try {
    signal.throwIfAborted();
    return await operation();
  } catch (error: unknown) {
    return [operationalFinding(scanner, `${scanner}-scanner-failed`, url, error, context)];
  }
}

function operationalFinding(
  scanner: ScannerName,
  ruleId: string,
  url: string,
  error: unknown,
  context: ScannerContext,
): AuditFinding {
  const message = safeMessage(error);
  const digest = createHash("sha256")
    .update(`${ruleId}|${url}|${message}`)
    .digest("hex")
    .slice(0, 12);
  return auditFindingSchema.parse({
    id: `technical-${ruleId}-${digest}`,
    ruleId,
    url,
    category: "technical",
    severity: "info",
    title: `${scannerLabel(scanner)} could not complete`,
    description: `The audit recorded a partial operational failure: ${message}`,
    impact:
      "Some checks may be missing from this point-in-time report, so absence of findings is not proof that this area passed.",
    recommendation:
      "Review the recorded error, confirm site access and tooling prerequisites, then rerun this scanner or complete the checks manually.",
    scanner,
    detectedAt: context.detectedAt,
    evidence: {
      metric: "scanner status",
      value: "failed or partial",
      expected: "completed",
      source: "heuristic",
    },
  });
}

function mergeScannedPages(
  pages: readonly ScannedPage[],
  inspection: BrowserInspectionResult | undefined,
): ScannedPage[] {
  return pages.map((page) => {
    const inspections = inspection?.pages.filter((entry) => entry.requestedUrl === page.url) ?? [];
    const successful = inspections.filter((entry) => entry.error === undefined);
    const evidence = successful.find((entry) => entry.viewport === "desktop") ?? successful[0];
    const screenshot = successful.find(
      (entry) => entry.screenshotPath !== undefined,
    )?.screenshotPath;
    const inspectionError =
      page.error === undefined && inspections.length > 0 && successful.length === 0
        ? inspections[0]?.error
        : undefined;
    return scannedPageSchema.parse({
      ...page,
      ...(page.title === undefined && evidence?.title !== undefined
        ? { title: evidence.title }
        : {}),
      ...(page.statusCode === undefined && evidence?.statusCode !== undefined
        ? { statusCode: evidence.statusCode }
        : {}),
      ...(screenshot === undefined ? {} : { screenshotPath: screenshot }),
      ...(inspectionError === undefined
        ? {}
        : {
            error: {
              code: inspectionError.code ?? "browser-inspection-failed",
              message: inspectionError.message,
            },
          }),
    });
  });
}

function renderedEvidence(
  url: string,
  inspection: BrowserInspectionResult | undefined,
): { readonly viewport: "desktop" | "mobile"; readonly screenshotPath?: string }[] {
  return (inspection?.pages ?? [])
    .filter((page) => page.requestedUrl === url && page.error === undefined)
    .map((page) => ({
      viewport: page.viewport,
      ...(page.screenshotPath === undefined ? {} : { screenshotPath: page.screenshotPath }),
    }));
}

function emptyCrawlResult(normalizedUrl: string, now: () => Date): CrawlResult {
  const timestampValue = timestamp(now);
  return crawlResultSchema.parse({
    schemaVersion: CRAWL_SCHEMA_VERSION,
    startedAt: timestampValue,
    completedAt: timestampValue,
    targetUrl: normalizedUrl,
    pages: [],
    rejectionCounts: {},
    stats: {
      attemptedPages: 0,
      successfulPages: 0,
      failedPages: 0,
      discoveredUrls: 0,
      rejectedLinks: 0,
    },
  });
}

function defaultSeoResourceDiscovery(
  config: AuditConfig,
  signal?: AbortSignal,
): Promise<SeoSiteResources> {
  return discoverSeoSiteResources(config, {}, signal);
}

function scannerLabel(scanner: ScannerName): string {
  if (scanner === "lighthouse") return "Lighthouse scanner";
  if (scanner === "orchestrator") return "Audit operation";
  return `${scanner.charAt(0).toUpperCase()}${scanner.slice(1)} scanner`;
}

function timestamp(now: () => Date): string {
  const date = now();
  if (Number.isNaN(date.getTime())) throw new TypeError("Audit clock returned an invalid date");
  return date.toISOString();
}

function safeMessage(error: unknown): string {
  return (error instanceof Error ? error.message : "Unknown audit failure")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 1_500);
}
