import { describe, expect, it, vi } from "vitest";

import {
  crawlWebsite,
  PageFetchError,
  parseAuditConfig,
  type CrawlPageResource,
  type FetchedPage,
  type PageFetcher,
} from "../../../src/index.js";

const fixedTimes = [new Date("2026-07-18T10:00:00.000Z"), new Date("2026-07-18T10:00:01.000Z")];

describe("crawlWebsite", () => {
  it("crawls deterministically by priority, deduplicates, and respects maxPages", async () => {
    const calls: string[] = [];
    let active = 0;
    let maxActive = 0;
    const pages = new Map<string, string>([
      [
        "https://example.com/",
        '<a href="/blog/post">Blog</a><a href="/pricing">Pricing</a><a href="/contact">Contact</a><a href="/contact#form">Duplicate</a>',
      ],
      ["https://example.com/contact", "<title>Contact</title>"],
      ["https://example.com/pricing", "<title>Pricing</title>"],
      ["https://example.com/blog/post", "<title>Blog</title>"],
    ]);
    const fetchPage: PageFetcher = async (url) => {
      calls.push(url);
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      return htmlPage(url, pages.get(url) ?? "");
    };
    const config = parseAuditConfig({
      targetUrl: "example.com",
      maxPages: 3,
      concurrency: 2,
      crawlDelayMs: 0,
    });

    const result = await crawlWebsite(
      { config },
      { fetchPage, now: sequentialClock(), sleep: () => Promise.resolve() },
    );

    expect(calls).toEqual([
      "https://example.com/",
      "https://example.com/contact",
      "https://example.com/pricing",
    ]);
    expect(result.stats.attemptedPages).toBe(3);
    expect(result.stats.discoveredUrls).toBe(4);
    expect(maxActive).toBeLessThanOrEqual(2);
    expect(result.pages.map((page) => page.pageType)).toEqual(["home", "contact", "pricing"]);
  });

  it("records a failed page and continues processing its batch", async () => {
    const fetchPage: PageFetcher = (url) => {
      if (url.endsWith("/contact")) {
        return Promise.reject(
          new PageFetchError("network", "Connection reset", { retryable: false }),
        );
      }
      if (url.endsWith("/")) {
        return Promise.resolve(
          htmlPage(url, '<a href="/contact">Contact</a><a href="/pricing">Pricing</a>'),
        );
      }
      return Promise.resolve(htmlPage(url, "<title>Pricing</title>"));
    };
    const config = parseAuditConfig({
      targetUrl: "example.com",
      maxPages: 3,
      concurrency: 2,
      crawlDelayMs: 0,
    });

    const result = await crawlWebsite(
      { config },
      { fetchPage, now: sequentialClock(), sleep: () => Promise.resolve() },
    );

    expect(result.stats.failedPages).toBe(1);
    expect(result.stats.successfulPages).toBe(2);
    expect(result.pages.find((page) => page.url.endsWith("/contact"))?.error).toMatchObject({
      code: "network",
      message: "Connection reset",
    });
    expect(result.pages.find((page) => page.url.endsWith("/contact"))?.pageType).toBe("contact");
  });

  it("retries transient failures with bounded backoff", async () => {
    const sleep = vi.fn((_durationMs: number) => Promise.resolve());
    let attempts = 0;
    const fetchPage: PageFetcher = (url) => {
      attempts += 1;
      return attempts === 1
        ? Promise.reject(new PageFetchError("timeout", "Timed out", { retryable: true }))
        : Promise.resolve(htmlPage(url, "<title>Home</title>"));
    };
    const config = parseAuditConfig({
      targetUrl: "example.com",
      maxPages: 1,
      maxRetries: 1,
      crawlDelayMs: 0,
    });

    const result = await crawlWebsite(
      { config },
      { fetchPage, now: sequentialClock(), random: () => 0, sleep },
    );

    expect(attempts).toBe(2);
    expect(sleep).toHaveBeenCalledWith(100);
    expect(result.stats.successfulPages).toBe(1);
  });

  it("aggregates rejected-link reasons", async () => {
    const fetchPage: PageFetcher = (url) =>
      Promise.resolve(
        htmlPage(url, '<a href="mailto:test@example.com">Email</a><a href="/file.pdf">File</a>'),
      );
    const config = parseAuditConfig({ targetUrl: "example.com", maxPages: 1 });

    const result = await crawlWebsite(
      { config },
      { fetchPage, now: sequentialClock(), sleep: () => Promise.resolve() },
    );

    expect(result.rejectionCounts).toMatchObject({ download: 1, "unsupported-scheme": 1 });
    expect(result.stats.rejectedLinks).toBe(2);
  });

  it("stores UI-signal classifications on successful pages", async () => {
    const fetchPage: PageFetcher = (url) =>
      Promise.resolve(
        htmlPage(
          url,
          '<form><input type="password" autocomplete="current-password"><button>Continue</button></form>',
        ),
      );
    const config = parseAuditConfig({
      targetUrl: "https://example.com/access",
      maxPages: 1,
      crawlDelayMs: 0,
    });

    const result = await crawlWebsite(
      { config },
      { fetchPage, now: sequentialClock(), sleep: () => Promise.resolve() },
    );

    expect(result.pages[0]?.pageType).toBe("auth");
  });

  it("exposes successful response data in memory without adding it to the crawl result", async () => {
    const resources: CrawlPageResource[] = [];
    const config = parseAuditConfig({ targetUrl: "example.com", maxPages: 1, crawlDelayMs: 0 });

    const result = await crawlWebsite(
      { config, onPageFetched: (resource) => resources.push(resource) },
      {
        fetchPage: (url) =>
          Promise.resolve({
            ...htmlPage(url, "<title>Captured</title>"),
            headers: { "content-security-policy": "default-src 'self'" },
            setCookieHeaders: ["session=secret; Secure; HttpOnly"],
          }),
        now: sequentialClock(),
        sleep: () => Promise.resolve(),
      },
    );

    expect(resources[0]).toMatchObject({
      body: "<title>Captured</title>",
      headers: { "content-security-policy": "default-src 'self'" },
      page: { url: "https://example.com/", pageType: "home" },
    });
    expect(JSON.stringify(result)).not.toContain("<title>");
    expect(JSON.stringify(result)).not.toContain("session=secret");
  });

  it("processes only explicit immutable scope URLs when link following is disabled", async () => {
    const calls: string[] = [];
    const progress: { completed: number; total: number }[] = [];
    const config = parseAuditConfig({
      targetUrl: "example.com",
      maxPages: 2,
      concurrency: 2,
      crawlDelayMs: 0,
    });

    const result = await crawlWebsite(
      {
        config,
        followLinks: false,
        onPageProcessed: (_page, completed, total) => progress.push({ completed, total }),
        seedUrls: ["https://example.com/", "https://example.com/contact"],
      },
      {
        fetchPage: (url) => {
          calls.push(url);
          return Promise.resolve(htmlPage(url, '<a href="/not-in-scope">Do not crawl</a>'));
        },
        now: sequentialClock(),
        sleep: () => Promise.resolve(),
      },
    );

    expect(new Set(calls)).toEqual(
      new Set(["https://example.com/", "https://example.com/contact"]),
    );
    expect(calls).not.toContain("https://example.com/not-in-scope");
    expect(result.stats).toMatchObject({ attemptedPages: 2, discoveredUrls: 2 });
    expect(progress.at(-1)).toEqual({ completed: 2, total: 2 });
  });

  it("rejects explicit seed URLs outside the configured target scope", async () => {
    const fetchPage = vi.fn<PageFetcher>();
    const config = parseAuditConfig({ targetUrl: "example.com", maxPages: 1 });

    await expect(
      crawlWebsite(
        {
          config,
          followLinks: false,
          seedUrls: ["https://outside.test/"],
        },
        { fetchPage },
      ),
    ).rejects.toThrow("outside the allowed target scope");
    expect(fetchPage).not.toHaveBeenCalled();
  });
});

function htmlPage(url: string, body: string): FetchedPage {
  return {
    body,
    contentType: "text/html; charset=utf-8",
    finalUrl: url,
    statusCode: 200,
  };
}

function sequentialClock(): () => Date {
  let index = 0;
  return () => {
    const timestamp = fixedTimes[Math.min(index, fixedTimes.length - 1)];
    index += 1;
    if (timestamp === undefined) {
      throw new Error("Test clock has no timestamps");
    }
    return timestamp;
  };
}
