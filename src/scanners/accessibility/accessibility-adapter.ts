import { AxeBuilder } from "@axe-core/playwright";
import {
  chromium,
  errors as playwrightErrors,
  type Browser,
  type Page,
  type Route,
} from "playwright";

import {
  createBrowserContextOptions,
  evaluateBrowserRequestSafety,
} from "../../browser/playwright-session.js";
import { prioritizePagesForScanning } from "../../classifiers/page-scan-priority.js";
import { createCrawlScope } from "../../url/crawl-scope.js";
import { assertPublicNetworkTarget } from "../../url/network-safety.js";
import { accessibilityPageResultSchema, axeViolationSchema } from "./schemas.js";
import type {
  AccessibilityAuditDependencies,
  AccessibilityAuditOptions,
  AccessibilityPageRequest,
  AccessibilityPageResult,
  AccessibilitySession,
  AxeViolation,
} from "./types.js";

export async function runAccessibilityAudits(
  options: AccessibilityAuditOptions,
  dependencies: AccessibilityAuditDependencies = {},
): Promise<AccessibilityPageResult[]> {
  const assertSafeTarget = dependencies.assertSafeTarget ?? assertPublicNetworkTarget;
  const launchSession =
    dependencies.launchSession ??
    (() => createAccessibilitySession(dependencies.launchBrowser, assertSafeTarget));
  const pages = prioritizePagesForScanning(
    options.pages.filter((page) => page.error === undefined),
  ).slice(0, options.config.maxPages);

  if (pages.length === 0) return [];

  const scope = createCrawlScope(options.config.targetUrl, options.config.allowedDomains);
  const session = await launchSession();
  const results: AccessibilityPageResult[] = [];

  try {
    for (const page of pages) {
      for (const viewport of options.config.viewports) {
        options.signal?.throwIfAborted();
        try {
          await assertSafeTarget(page.url);
          const violations = await session.auditPage({
            scope,
            ...(options.signal === undefined ? {} : { signal: options.signal }),
            timeoutMs: options.config.navigationTimeoutMs,
            url: page.url,
            viewport,
          });
          results.push(
            accessibilityPageResultSchema.parse({ url: page.url, viewport, violations }),
          );
        } catch (error: unknown) {
          options.signal?.throwIfAborted();
          results.push(
            accessibilityPageResultSchema.parse({
              url: page.url,
              viewport,
              violations: [],
              error: { code: "axe-failed", message: safeMessage(error) },
            }),
          );
        }
      }
    }
  } finally {
    await session.close();
  }

  return results;
}

export async function createAccessibilitySession(
  launchBrowser?: () => Promise<Browser>,
  assertSafeTarget: (url: string) => Promise<void> = assertPublicNetworkTarget,
): Promise<AccessibilitySession> {
  const browser = await (launchBrowser ?? (() => chromium.launch({ headless: true })))();

  return {
    auditPage: (request) => auditPage(browser, request, assertSafeTarget),
    close: () => browser.close(),
  };
}

async function auditPage(
  browser: Browser,
  request: AccessibilityPageRequest,
  assertSafeTarget: (url: string) => Promise<void>,
): Promise<readonly AxeViolation[]> {
  request.signal?.throwIfAborted();
  const context = await browser.newContext(
    createBrowserContextOptions(request.viewport, browser.version()),
  );
  context.setDefaultNavigationTimeout(request.timeoutMs);
  context.setDefaultTimeout(request.timeoutMs);

  try {
    const page = await context.newPage();
    const abortPage = (): void => {
      void page.close().catch(() => undefined);
    };
    request.signal?.addEventListener("abort", abortPage, { once: true });

    try {
      await page.routeWebSocket("**/*", (webSocket) => {
        void webSocket.close().catch(() => undefined);
      });
      await page.route("**/*", async (route) => {
        const decision = await evaluateBrowserRequestSafety(
          {
            documentUrl: request.url,
            isMainFrameNavigation: isMainFrameNavigation(route, page),
            requestUrl: route.request().url(),
            scope: request.scope,
          },
          assertSafeTarget,
        );
        if (!decision.allowed) {
          await route.abort("blockedbyclient").catch(() => undefined);
          return;
        }
        await route.continue().catch(() => undefined);
      });
      page.on("dialog", (dialog) => {
        void dialog.dismiss().catch(() => undefined);
      });
      page.on("download", (download) => {
        void download.cancel().catch(() => undefined);
      });

      await page.goto(request.url, {
        timeout: request.timeoutMs,
        waitUntil: "domcontentloaded",
      });
      request.signal?.throwIfAborted();
      const result = await new AxeBuilder({ page }).analyze();

      return result.violations.map((violation) =>
        axeViolationSchema.parse({
          id: violation.id,
          impact: violation.impact,
          description: violation.description,
          help: violation.help,
          helpUrl: violation.helpUrl,
          nodes: violation.nodes.map((node) => ({
            target: node.target.map((target) =>
              typeof target === "string" ? target : target.join(" > "),
            ),
          })),
        }),
      );
    } catch (error: unknown) {
      request.signal?.throwIfAborted();
      if (error instanceof playwrightErrors.TimeoutError) {
        throw new Error(`Accessibility navigation timed out for ${request.url}`, { cause: error });
      }
      throw error;
    } finally {
      request.signal?.removeEventListener("abort", abortPage);
    }
  } finally {
    await context.close();
  }
}

function isMainFrameNavigation(route: Route, page: Page): boolean {
  const request = route.request();
  return request.isNavigationRequest() && request.frame() === page.mainFrame();
}

function safeMessage(error: unknown): string {
  return (error instanceof Error ? error.message : "Unknown accessibility failure")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 2_000);
}
