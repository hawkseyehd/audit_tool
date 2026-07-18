import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  BrowserInspectionError,
  inspectPagesWithBrowser,
  parseAuditConfig,
  type BrowserInspectionOptions,
  type BrowserPageRequest,
  type BrowserPageSnapshot,
  type BrowserSession,
} from "../../../src/index.js";

describe("inspectPagesWithBrowser", () => {
  it("prioritizes pages, isolates viewports, bounds screenshots, and skips crawl failures", async () => {
    const requests: BrowserPageRequest[] = [];
    let closeCount = 0;
    const session = createSession(
      (request) => {
        requests.push(request);
        return Promise.resolve({
          consoleErrors: Array.from({ length: 55 }, (_, index) => `Console ${String(index)}`),
          finalUrl: request.url,
          pageErrors: [],
          screenshotCaptured: request.screenshotPath !== undefined,
          statusCode: 200,
          title: "Example page",
        });
      },
      () => {
        closeCount += 1;
        return Promise.resolve();
      },
    );

    const result = await inspectPagesWithBrowser(createOptions(), {
      launchBrowser: () => Promise.resolve(session),
      monotonicNow: incrementalClock(),
      now: fixedClock,
    });

    expect(requests.map((request) => `${request.url}:${request.viewport}`)).toEqual([
      "https://example.com/:desktop",
      "https://example.com/:mobile",
      "https://example.com/pricing:desktop",
      "https://example.com/pricing:mobile",
      "https://example.com/blog:desktop",
      "https://example.com/blog:mobile",
    ]);
    expect(requests.filter((request) => request.screenshotPath !== undefined)).toHaveLength(2);
    expect(result.pages[0]?.screenshotPath).toMatch(/^screenshots\//u);
    expect(result.pages[0]?.consoleErrors).toHaveLength(50);
    expect(result.stats).toEqual({
      sourcePages: 4,
      skippedPages: 1,
      attemptedInspections: 6,
      successfulInspections: 6,
      failedInspections: 0,
      screenshotsCaptured: 2,
    });
    expect(closeCount).toBe(1);
  });

  it("continues after a viewport failure and closes the browser", async () => {
    const requests: BrowserPageRequest[] = [];
    let closeCount = 0;
    const session = createSession(
      (request) => {
        requests.push(request);
        return request.viewport === "mobile"
          ? Promise.reject(new BrowserInspectionError("navigation-timeout", "Navigation timed out"))
          : Promise.resolve(snapshotFor(request));
      },
      () => {
        closeCount += 1;
        return Promise.resolve();
      },
    );
    const options = createOptions({
      pages: [{ url: "https://example.com/", pageType: "home" }],
    });

    const result = await inspectPagesWithBrowser(options, {
      launchBrowser: () => Promise.resolve(session),
      monotonicNow: incrementalClock(),
      now: fixedClock,
    });

    expect(requests).toHaveLength(2);
    expect(result.stats).toMatchObject({ successfulInspections: 1, failedInspections: 1 });
    expect(result.pages[1]?.error).toEqual({
      code: "navigation-timeout",
      message: "Navigation timed out",
    });
    expect(closeCount).toBe(1);
  });

  it("records a launch failure for every planned inspection", async () => {
    const result = await inspectPagesWithBrowser(
      createOptions({ pages: [{ url: "https://example.com/", pageType: "home" }] }),
      {
        launchBrowser: () => Promise.reject(new Error("Browser executable missing")),
        now: fixedClock,
      },
    );

    expect(result.pages).toHaveLength(2);
    expect(result.stats.failedInspections).toBe(2);
    expect(result.runErrors).toEqual([
      { code: "browser-error", message: "Browser executable missing" },
    ]);
  });

  it("records browser close failures without discarding page results", async () => {
    const session = createSession(
      (request) => Promise.resolve(snapshotFor(request)),
      () => Promise.reject(new Error("Close failed")),
    );

    const result = await inspectPagesWithBrowser(
      createOptions({
        config: parseAuditConfig({
          targetUrl: "example.com",
          viewports: ["desktop"],
          maxScreenshotsPerViewport: 0,
        }),
        pages: [{ url: "https://example.com/", pageType: "home" }],
      }),
      {
        launchBrowser: () => Promise.resolve(session),
        monotonicNow: incrementalClock(),
        now: fixedClock,
      },
    );

    expect(result.stats.successfulInspections).toBe(1);
    expect(result.runErrors).toEqual([{ code: "browser-error", message: "Close failed" }]);
  });

  it("does not launch the browser when an audit is already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    let launchCount = 0;

    await expect(
      inspectPagesWithBrowser(
        createOptions({
          pages: [{ url: "https://example.com/", pageType: "home" }],
          signal: controller.signal,
        }),
        {
          launchBrowser: () => {
            launchCount += 1;
            return Promise.reject(new Error("should not launch"));
          },
          now: fixedClock,
        },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(launchCount).toBe(0);
  });

  it("closes the browser when an active inspection is cancelled", async () => {
    const controller = new AbortController();
    let closeCount = 0;
    const session = createSession(
      () => {
        controller.abort();
        return Promise.reject(new Error("Page closed by cancellation"));
      },
      () => {
        closeCount += 1;
        return Promise.resolve();
      },
    );

    await expect(
      inspectPagesWithBrowser(
        createOptions({
          pages: [{ url: "https://example.com/", pageType: "home" }],
          signal: controller.signal,
        }),
        { launchBrowser: () => Promise.resolve(session), now: fixedClock },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(closeCount).toBe(1);
  });
});

function createOptions(
  overrides: Partial<BrowserInspectionOptions> = {},
): BrowserInspectionOptions {
  const auditDirectory = resolve("reports", "audit-1");
  return {
    auditDirectory,
    config: parseAuditConfig({
      targetUrl: "example.com",
      viewports: ["desktop", "mobile"],
      maxScreenshotsPerViewport: 1,
    }),
    pages: [
      { url: "https://example.com/blog", pageType: "blog" },
      {
        url: "https://example.com/contact",
        pageType: "contact",
        error: { message: "Crawl failed" },
      },
      { url: "https://example.com/pricing", pageType: "pricing" },
      { url: "https://example.com/", pageType: "home" },
    ],
    screenshotsDirectory: resolve(auditDirectory, "screenshots"),
    ...overrides,
  };
}

function createSession(
  inspectPage: BrowserSession["inspectPage"],
  close: BrowserSession["close"],
): BrowserSession {
  return { close, inspectPage };
}

function snapshotFor(request: BrowserPageRequest): BrowserPageSnapshot {
  return {
    consoleErrors: [],
    finalUrl: request.url,
    pageErrors: [],
    screenshotCaptured: request.screenshotPath !== undefined,
    statusCode: 200,
  };
}

function fixedClock(): Date {
  return new Date("2026-07-18T12:00:00.000Z");
}

function incrementalClock(): () => number {
  let current = 0;
  return () => {
    current += 10;
    return current;
  };
}
