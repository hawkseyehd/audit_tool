import { describe, expect, it } from "vitest";

import {
  parseAuditConfig,
  runAccessibilityAudits,
  type AccessibilityPageRequest,
  type AccessibilitySession,
} from "../../../../src/index.js";

describe("runAccessibilityAudits", () => {
  it("prioritizes, bounds, and scans pages sequentially across viewports", async () => {
    const requests: AccessibilityPageRequest[] = [];
    let closed = 0;
    const config = parseAuditConfig({
      targetUrl: "example.com",
      maxPages: 2,
      viewports: ["desktop", "mobile"],
    });
    const session: AccessibilitySession = {
      auditPage: (request) => {
        requests.push(request);
        return Promise.resolve([]);
      },
      close: () => {
        closed += 1;
        return Promise.resolve();
      },
    };

    const results = await runAccessibilityAudits(
      {
        config,
        pages: [
          { url: "https://example.com/blog", pageType: "blog" },
          { url: "https://example.com/", pageType: "home" },
          { url: "https://example.com/pricing", pageType: "pricing" },
          {
            url: "https://example.com/failed",
            pageType: "unknown",
            error: { message: "crawl failed" },
          },
        ],
      },
      { assertSafeTarget: () => Promise.resolve(), launchSession: () => Promise.resolve(session) },
    );

    expect(requests.map((request) => `${request.url}:${request.viewport}`)).toEqual([
      "https://example.com/:desktop",
      "https://example.com/:mobile",
      "https://example.com/pricing:desktop",
      "https://example.com/pricing:mobile",
    ]);
    expect(results).toHaveLength(4);
    expect(closed).toBe(1);
  });

  it("records individual failures, continues scanning, and closes the session", async () => {
    let attempts = 0;
    let closed = 0;
    const session: AccessibilitySession = {
      auditPage: () => {
        attempts += 1;
        return attempts === 1
          ? Promise.reject(new Error("axe injection failed"))
          : Promise.resolve([
              {
                id: "button-name",
                impact: "critical",
                description: "Buttons must have discernible text.",
                help: "Buttons must have discernible text",
                nodes: [{ target: ["button"] }],
              },
            ]);
      },
      close: () => {
        closed += 1;
        return Promise.resolve();
      },
    };
    const config = parseAuditConfig({ targetUrl: "example.com", maxPages: 2 });

    const results = await runAccessibilityAudits(
      {
        config,
        pages: [
          { url: "https://example.com/", pageType: "home" },
          { url: "https://example.com/contact", pageType: "contact" },
        ],
      },
      { assertSafeTarget: () => Promise.resolve(), launchSession: () => Promise.resolve(session) },
    );

    expect(results[0]?.error).toMatchObject({
      code: "axe-failed",
      message: "axe injection failed",
    });
    expect(results[1]?.violations[0]?.id).toBe("button-name");
    expect(closed).toBe(1);
  });

  it("propagates cancellation while still closing the session", async () => {
    let closed = 0;
    const controller = new AbortController();
    controller.abort();
    const session: AccessibilitySession = {
      auditPage: () => Promise.resolve([]),
      close: () => {
        closed += 1;
        return Promise.resolve();
      },
    };

    await expect(
      runAccessibilityAudits(
        {
          config: parseAuditConfig({ targetUrl: "example.com" }),
          pages: [{ url: "https://example.com/", pageType: "home" }],
          signal: controller.signal,
        },
        { launchSession: () => Promise.resolve(session) },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(closed).toBe(1);
  });
});
