import { describe, expect, it, vi } from "vitest";

import { createCrawlScope, evaluateBrowserRequestSafety } from "../../../src/index.js";

const scope = createCrawlScope("https://example.com/");

describe("evaluateBrowserRequestSafety", () => {
  it("blocks out-of-scope top-level navigation before network access", async () => {
    const assertSafeTarget = vi.fn(() => Promise.resolve());

    const decision = await evaluateBrowserRequestSafety(
      {
        documentUrl: "https://example.com/",
        isMainFrameNavigation: true,
        requestUrl: "https://external.example/login",
        scope,
      },
      assertSafeTarget,
    );

    expect(decision).toMatchObject({ allowed: false });
    expect(assertSafeTarget).not.toHaveBeenCalled();
  });

  it("checks public-network safety for external subresources", async () => {
    const assertSafeTarget = vi.fn(() => Promise.resolve());

    const decision = await evaluateBrowserRequestSafety(
      {
        documentUrl: "https://example.com/",
        isMainFrameNavigation: false,
        requestUrl: "https://cdn.example.net/app.js",
        scope,
      },
      assertSafeTarget,
    );

    expect(decision).toEqual({ allowed: true });
    expect(assertSafeTarget).toHaveBeenCalledWith("https://cdn.example.net/app.js");
  });

  it("blocks unsafe subresources", async () => {
    const decision = await evaluateBrowserRequestSafety(
      {
        documentUrl: "https://example.com/",
        isMainFrameNavigation: false,
        requestUrl: "http://127.0.0.1/private",
        scope,
      },
      () => Promise.reject(new Error("unsafe")),
    );

    expect(decision).toEqual({
      allowed: false,
      reason: "Browser subresource rejected by public-network policy",
    });
  });

  it("allows non-network browser resources without DNS resolution", async () => {
    const assertSafeTarget = vi.fn(() => Promise.resolve());

    const decision = await evaluateBrowserRequestSafety(
      {
        documentUrl: "https://example.com/",
        isMainFrameNavigation: false,
        requestUrl: "data:text/plain,hello",
        scope,
      },
      assertSafeTarget,
    );

    expect(decision).toEqual({ allowed: true });
    expect(assertSafeTarget).not.toHaveBeenCalled();
  });

  it.each([
    { isMainFrameNavigation: true, requestUrl: "data:text/html,hello" },
    { isMainFrameNavigation: false, requestUrl: "file:///etc/passwd" },
  ])("blocks unsupported browser protocols", async (request) => {
    const decision = await evaluateBrowserRequestSafety({
      documentUrl: "https://example.com/",
      scope,
      ...request,
    });

    expect(decision).toEqual({
      allowed: false,
      reason: "Browser request used a blocked protocol",
    });
  });
});
