import {
  chromium,
  errors as playwrightErrors,
  type Browser,
  type BrowserContextOptions,
  type Page,
  type Route,
} from "playwright";

import type { Viewport } from "../core/types.js";
import { evaluateCrawlCandidate } from "../url/crawl-scope.js";
import { assertPublicNetworkTarget } from "../url/network-safety.js";
import { BrowserInspectionError } from "./errors.js";
import type { BrowserPageRequest, BrowserPageSnapshot, BrowserSession } from "./types.js";

const MAX_CONSOLE_ERRORS = 50;
const MAX_PAGE_ERRORS = 20;

export interface PlaywrightSessionDependencies {
  readonly assertSafeTarget?: (url: string) => Promise<void>;
  readonly launchBrowser?: () => Promise<Browser>;
}

export interface BrowserRequestSafetyInput {
  readonly documentUrl: string;
  readonly isMainFrameNavigation: boolean;
  readonly requestUrl: string;
  readonly scope: BrowserPageRequest["scope"];
}

export type BrowserRequestSafetyDecision =
  { readonly allowed: true } | { readonly allowed: false; readonly reason: string };

export async function createPlaywrightBrowserSession(
  dependencies: PlaywrightSessionDependencies = {},
): Promise<BrowserSession> {
  const browser = await (
    dependencies.launchBrowser ?? (() => chromium.launch({ headless: true }))
  )();
  const assertSafeTarget = dependencies.assertSafeTarget ?? assertPublicNetworkTarget;

  return {
    inspectPage: (request) => inspectPage(browser, request, assertSafeTarget),
    close: () => browser.close(),
  };
}

async function inspectPage(
  browser: Browser,
  request: BrowserPageRequest,
  assertSafeTarget: (url: string) => Promise<void>,
): Promise<BrowserPageSnapshot> {
  request.signal?.throwIfAborted();
  const context = await browser.newContext(
    createBrowserContextOptions(request.viewport, browser.version()),
  );
  context.setDefaultNavigationTimeout(request.timeoutMs);
  context.setDefaultTimeout(request.timeoutMs);

  try {
    const page = await context.newPage();
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    let blockedNavigation: string | undefined;
    const abortPage = (): void => {
      void page.close().catch(() => undefined);
    };

    request.signal?.addEventListener("abort", abortPage, { once: true });
    await page.routeWebSocket("**/*", (webSocket) => {
      void webSocket.close().catch(() => undefined);
    });
    await page.route("**/*", async (route) => {
      const blockedReason = await validateBrowserRequest(route, page, request, assertSafeTarget);
      if (blockedReason !== undefined) {
        if (isMainFrameNavigation(route, page)) {
          blockedNavigation = blockedReason;
        }
        await route.abort("blockedbyclient").catch(() => undefined);
        return;
      }

      await route.continue().catch(() => undefined);
    });
    page.on("console", (message) => {
      if (message.type() === "error") {
        appendBounded(consoleErrors, message.text(), MAX_CONSOLE_ERRORS);
      }
    });
    page.on("pageerror", (error) => {
      appendBounded(pageErrors, error.message, MAX_PAGE_ERRORS);
    });
    page.on("dialog", (dialog) => {
      void dialog.dismiss().catch(() => undefined);
    });
    page.on("download", (download) => {
      void download.cancel().catch(() => undefined);
    });

    try {
      const response = await page.goto(request.url, {
        timeout: request.timeoutMs,
        waitUntil: "domcontentloaded",
      });
      request.signal?.throwIfAborted();

      if (blockedNavigation !== undefined) {
        throw new BrowserInspectionError("blocked-navigation", blockedNavigation);
      }

      const title = (await page.title()).replace(/\s+/gu, " ").trim().slice(0, 500);
      let screenshotCaptured = false;
      if (request.screenshotPath !== undefined) {
        await page.screenshot({
          animations: "disabled",
          caret: "hide",
          fullPage: false,
          path: request.screenshotPath,
          scale: "css",
          timeout: request.timeoutMs,
          type: "png",
        });
        screenshotCaptured = true;
      }

      return {
        consoleErrors,
        finalUrl: page.url(),
        pageErrors,
        screenshotCaptured,
        ...(response === null ? {} : { statusCode: response.status() }),
        ...(title.length === 0 ? {} : { title }),
      };
    } catch (error: unknown) {
      request.signal?.throwIfAborted();
      if (error instanceof BrowserInspectionError) {
        throw error;
      }
      if (blockedNavigation !== undefined) {
        throw new BrowserInspectionError("blocked-navigation", blockedNavigation, { cause: error });
      }
      if (error instanceof playwrightErrors.TimeoutError) {
        throw new BrowserInspectionError(
          "navigation-timeout",
          `Browser navigation timed out for ${request.url}`,
          { cause: error },
        );
      }
      throw new BrowserInspectionError(
        "navigation-failed",
        `Browser navigation failed for ${request.url}`,
        { cause: error },
      );
    } finally {
      request.signal?.removeEventListener("abort", abortPage);
    }
  } finally {
    await context.close();
  }
}

async function validateBrowserRequest(
  route: Route,
  page: Page,
  inspection: BrowserPageRequest,
  assertSafeTarget: (url: string) => Promise<void>,
): Promise<string | undefined> {
  const decision = await evaluateBrowserRequestSafety(
    {
      documentUrl: inspection.url,
      isMainFrameNavigation: isMainFrameNavigation(route, page),
      requestUrl: route.request().url(),
      scope: inspection.scope,
    },
    assertSafeTarget,
  );

  return decision.allowed ? undefined : decision.reason;
}

export async function evaluateBrowserRequestSafety(
  input: BrowserRequestSafetyInput,
  assertSafeTarget: (url: string) => Promise<void> = assertPublicNetworkTarget,
): Promise<BrowserRequestSafetyDecision> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(input.requestUrl);
  } catch {
    return { allowed: false, reason: "Browser request contained an invalid URL" };
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    const isInertSubresource =
      !input.isMainFrameNavigation &&
      (parsedUrl.protocol === "data:" ||
        parsedUrl.protocol === "blob:" ||
        parsedUrl.protocol === "about:");
    return isInertSubresource
      ? { allowed: true }
      : { allowed: false, reason: "Browser request used a blocked protocol" };
  }

  if (input.isMainFrameNavigation) {
    const decision = evaluateCrawlCandidate(input.requestUrl, input.documentUrl, input.scope);
    if (!decision.accepted) {
      return {
        allowed: false,
        reason: `Top-level browser navigation rejected by crawl policy: ${decision.reason}`,
      };
    }
  }

  try {
    await assertSafeTarget(input.requestUrl);
    return { allowed: true };
  } catch {
    return {
      allowed: false,
      reason: input.isMainFrameNavigation
        ? "Top-level browser navigation rejected by public-network policy"
        : "Browser subresource rejected by public-network policy",
    };
  }
}

function isMainFrameNavigation(route: Route, page: Page): boolean {
  const browserRequest = route.request();
  return browserRequest.isNavigationRequest() && browserRequest.frame() === page.mainFrame();
}

export function createBrowserContextOptions(
  viewport: Viewport,
  browserVersion: string,
): BrowserContextOptions {
  const isMobile = viewport === "mobile";
  const size = isMobile ? { width: 390, height: 844 } : { width: 1_440, height: 900 };
  const chromeVersion = browserVersion.replace(/[^0-9.]/gu, "") || "120.0.0.0";
  const userAgent = isMobile
    ? `Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Mobile Safari/537.36 WebsiteAuditTool/0.1`
    : `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36 WebsiteAuditTool/0.1`;

  return {
    acceptDownloads: false,
    colorScheme: "light",
    deviceScaleFactor: 1,
    hasTouch: isMobile,
    ignoreHTTPSErrors: false,
    isMobile,
    javaScriptEnabled: true,
    locale: "en-US",
    permissions: [],
    reducedMotion: "reduce",
    screen: size,
    serviceWorkers: "block",
    timezoneId: "UTC",
    userAgent,
    viewport: size,
  };
}

function appendBounded(target: string[], message: string, limit: number): void {
  if (target.length >= limit) {
    return;
  }
  const normalized = message.replace(/\s+/gu, " ").trim().slice(0, 1_000);
  if (normalized.length > 0) {
    target.push(normalized);
  }
}
