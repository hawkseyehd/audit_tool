import { describe, expect, it, vi } from "vitest";

import { createCrawlScope, createHttpPageFetcher, PageFetchError } from "../../../src/index.js";

const scope = createCrawlScope("https://example.com");
const baseOptions = {
  maxRedirects: 3,
  maxResponseBytes: 1_024,
  scope,
  timeoutMs: 5_000,
} as const;

describe("createHttpPageFetcher", () => {
  it("revalidates and follows an in-scope redirect", async () => {
    const checkedUrls: string[] = [];
    let callCount = 0;
    const fetchImpl: typeof fetch = () => {
      callCount += 1;
      return Promise.resolve(
        callCount === 1
          ? new Response(null, { status: 302, headers: { location: "/final" } })
          : new Response("<title>Final</title>", {
              status: 200,
              headers: { "content-type": "text/html; charset=utf-8" },
            }),
      );
    };
    const fetchPage = createHttpPageFetcher({
      assertSafeTarget: (url) => {
        checkedUrls.push(url);
        return Promise.resolve();
      },
      fetchImpl,
    });

    const page = await fetchPage("https://example.com", baseOptions);

    expect(page.finalUrl).toBe("https://example.com/final");
    expect(page.body).toContain("Final");
    expect(checkedUrls).toEqual(["https://example.com/", "https://example.com/final"]);
  });

  it("blocks an out-of-scope redirect before requesting it", async () => {
    const fetchImpl: typeof fetch = () =>
      Promise.resolve(
        new Response(null, { status: 302, headers: { location: "https://external.example" } }),
      );
    const fetchPage = createHttpPageFetcher({
      assertSafeTarget: () => Promise.resolve(),
      fetchImpl,
    });

    await expect(fetchPage("https://example.com", baseOptions)).rejects.toMatchObject({
      code: "blocked-redirect",
    });
  });

  it("rejects an oversized response from headers or streamed bytes", async () => {
    const declaredFetcher = createHttpPageFetcher({
      assertSafeTarget: () => Promise.resolve(),
      fetchImpl: () =>
        Promise.resolve(
          new Response("small", {
            headers: { "content-length": "2048", "content-type": "text/html" },
          }),
        ),
    });
    const streamedFetcher = createHttpPageFetcher({
      assertSafeTarget: () => Promise.resolve(),
      fetchImpl: () =>
        Promise.resolve(
          new Response("x".repeat(2_048), { headers: { "content-type": "text/html" } }),
        ),
    });

    await expect(declaredFetcher("https://example.com", baseOptions)).rejects.toBeInstanceOf(
      PageFetchError,
    );
    await expect(streamedFetcher("https://example.com", baseOptions)).rejects.toMatchObject({
      code: "response-too-large",
    });
  });

  it("does not read non-HTML response bodies", async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response("binary-ish", { headers: { "content-type": "application/pdf" } }),
      ),
    );
    const fetchPage = createHttpPageFetcher({
      assertSafeTarget: () => Promise.resolve(),
      fetchImpl,
    });

    await expect(fetchPage("https://example.com", baseOptions)).resolves.toMatchObject({
      body: "",
      contentType: "application/pdf",
    });
  });
});
