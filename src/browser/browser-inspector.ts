import { prioritizePagesForScanning } from "../classifiers/page-scan-priority.js";
import { createCrawlScope } from "../url/crawl-scope.js";
import { normalizeTargetUrl } from "../url/normalize-url.js";
import { BrowserInspectionError } from "./errors.js";
import { createPlaywrightBrowserSession } from "./playwright-session.js";
import { BROWSER_INSPECTION_SCHEMA_VERSION, browserInspectionResultSchema } from "./schemas.js";
import { createScreenshotTarget, type ScreenshotTarget } from "./screenshot-path.js";
import type {
  BrowserInspectionDependencies,
  BrowserInspectionOptions,
  BrowserInspectionResult,
  BrowserPageInspection,
  BrowserSession,
} from "./types.js";

interface InspectionRequest {
  readonly requestedUrl: string;
  readonly screenshotTarget?: ScreenshotTarget;
  readonly viewport: BrowserInspectionOptions["config"]["viewports"][number];
}

export async function inspectPagesWithBrowser(
  options: BrowserInspectionOptions,
  dependencies: BrowserInspectionDependencies = {},
): Promise<BrowserInspectionResult> {
  const now = dependencies.now ?? (() => new Date());
  const monotonicNow = dependencies.monotonicNow ?? Date.now;
  const launchBrowser = dependencies.launchBrowser ?? createPlaywrightBrowserSession;
  const targetUrl = normalizeTargetUrl(options.config.targetUrl);
  const scope = createCrawlScope(targetUrl, options.config.allowedDomains);
  const startedAt = now().toISOString();
  const eligiblePages = prioritizePagesForScanning(
    options.pages.filter((page) => page.error === undefined),
  );
  const requests = createInspectionRequests(options, eligiblePages);
  const pages: BrowserPageInspection[] = [];
  const runErrors: { code?: string; message: string }[] = [];
  let browser: BrowserSession | undefined;

  if (requests.length > 0) {
    options.signal?.throwIfAborted();
    try {
      browser = await launchBrowser();
    } catch (error: unknown) {
      const runError = toSafeError(error, "browser-error");
      runErrors.push(runError);
      pages.push(
        ...requests.map((request) => ({
          requestedUrl: request.requestedUrl,
          viewport: request.viewport,
          durationMs: 0,
          consoleErrors: [],
          pageErrors: [],
          error: runError,
        })),
      );
    }
  }

  if (browser !== undefined) {
    try {
      for (const request of requests) {
        options.signal?.throwIfAborted();
        const inspectionStartedAt = monotonicNow();

        try {
          const snapshot = await browser.inspectPage({
            scope,
            ...(request.screenshotTarget === undefined
              ? {}
              : { screenshotPath: request.screenshotTarget.absolutePath }),
            ...(options.signal === undefined ? {} : { signal: options.signal }),
            timeoutMs: options.config.navigationTimeoutMs,
            url: request.requestedUrl,
            viewport: request.viewport,
          });
          pages.push({
            requestedUrl: request.requestedUrl,
            finalUrl: snapshot.finalUrl,
            viewport: request.viewport,
            ...(snapshot.title === undefined ? {} : { title: snapshot.title.slice(0, 500) }),
            ...(snapshot.statusCode === undefined ? {} : { statusCode: snapshot.statusCode }),
            ...(snapshot.screenshotCaptured && request.screenshotTarget !== undefined
              ? { screenshotPath: request.screenshotTarget.relativePath }
              : {}),
            durationMs: elapsedMilliseconds(inspectionStartedAt, monotonicNow()),
            consoleErrors: snapshot.consoleErrors.slice(0, 50).map(sanitizeRuntimeMessage),
            pageErrors: snapshot.pageErrors.slice(0, 20).map(sanitizeRuntimeMessage),
          });
        } catch (error: unknown) {
          options.signal?.throwIfAborted();
          pages.push({
            requestedUrl: request.requestedUrl,
            viewport: request.viewport,
            durationMs: elapsedMilliseconds(inspectionStartedAt, monotonicNow()),
            consoleErrors: [],
            pageErrors: [],
            error: toSafeError(error, "browser-error"),
          });
        }
      }
    } finally {
      try {
        await browser.close();
      } catch (error: unknown) {
        runErrors.push(toSafeError(error, "browser-error"));
      }
    }
  }

  const failedInspections = pages.filter((page) => page.error !== undefined).length;
  return browserInspectionResultSchema.parse({
    schemaVersion: BROWSER_INSPECTION_SCHEMA_VERSION,
    startedAt,
    completedAt: now().toISOString(),
    targetUrl,
    pages,
    runErrors,
    stats: {
      sourcePages: options.pages.length,
      skippedPages: options.pages.length - eligiblePages.length,
      attemptedInspections: pages.length,
      successfulInspections: pages.length - failedInspections,
      failedInspections,
      screenshotsCaptured: pages.filter((page) => page.screenshotPath !== undefined).length,
    },
  });
}

function createInspectionRequests(
  options: BrowserInspectionOptions,
  pages: readonly (typeof options.pages)[number][],
): InspectionRequest[] {
  const screenshotCounts = new Map(options.config.viewports.map((viewport) => [viewport, 0]));
  const requests: InspectionRequest[] = [];

  for (const page of pages) {
    for (const viewport of options.config.viewports) {
      const screenshotCount = screenshotCounts.get(viewport) ?? 0;
      const shouldCapture = screenshotCount < options.config.maxScreenshotsPerViewport;
      const screenshotTarget = shouldCapture
        ? createScreenshotTarget(
            options.auditDirectory,
            options.screenshotsDirectory,
            page.url,
            viewport,
          )
        : undefined;

      if (shouldCapture) {
        screenshotCounts.set(viewport, screenshotCount + 1);
      }

      requests.push({
        requestedUrl: page.url,
        ...(screenshotTarget === undefined ? {} : { screenshotTarget }),
        viewport,
      });
    }
  }

  return requests;
}

function elapsedMilliseconds(startedAt: number, completedAt: number): number {
  return Math.max(0, Math.round(completedAt - startedAt));
}

function sanitizeRuntimeMessage(message: string): string {
  const sanitized = message.replace(/\s+/gu, " ").trim().slice(0, 1_000);
  return sanitized.length > 0 ? sanitized : "Unspecified browser runtime error";
}

function toSafeError(
  error: unknown,
  fallbackCode: string,
): { readonly code?: string; readonly message: string } {
  const code = error instanceof BrowserInspectionError ? error.code : fallbackCode;
  const rawMessage = error instanceof Error ? error.message : "Unknown browser inspection failure";
  const message = rawMessage.replace(/\s+/gu, " ").trim().slice(0, 2_000);
  return { code, message: message.length > 0 ? message : "Browser inspection failed" };
}
