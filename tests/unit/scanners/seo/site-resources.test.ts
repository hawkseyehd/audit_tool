import { describe, expect, it, vi } from "vitest";

import {
  createSeoSiteResourceFetcher,
  discoverSeoSiteResources,
  PageFetchError,
  parseAuditConfig,
  type SeoSiteResourceFetcher,
} from "../../../../src/index.js";

describe("discoverSeoSiteResources", () => {
  it("uses an in-scope sitemap declared by robots.txt", async () => {
    const calls: string[] = [];
    const fetchResource: SeoSiteResourceFetcher = (url) => {
      calls.push(url);
      return Promise.resolve({
        body: url.endsWith("robots.txt")
          ? "User-agent: *\nSitemap: https://example.com/maps/site.xml"
          : "<urlset></urlset>",
        finalUrl: url,
        statusCode: 200,
      });
    };

    const result = await discoverSeoSiteResources(parseAuditConfig({ targetUrl: "example.com" }), {
      fetchResource,
    });

    expect(calls).toEqual(["https://example.com/robots.txt", "https://example.com/maps/site.xml"]);
    expect(result.sitemap.statusCode).toBe(200);
  });

  it("falls back to the conventional sitemap for external declarations", async () => {
    const calls: string[] = [];
    const fetchResource: SeoSiteResourceFetcher = (url) => {
      calls.push(url);
      return Promise.resolve({
        body: url.endsWith("robots.txt") ? "Sitemap: https://external.example/map.xml" : "",
        finalUrl: url,
        statusCode: 200,
      });
    };

    await discoverSeoSiteResources(parseAuditConfig({ targetUrl: "example.com" }), {
      fetchResource,
    });

    expect(calls[1]).toBe("https://example.com/sitemap.xml");
  });

  it("records resource failures and continues to the sitemap", async () => {
    const fetchResource: SeoSiteResourceFetcher = (url) =>
      url.endsWith("robots.txt")
        ? Promise.reject(new PageFetchError("network", "Connection failed"))
        : Promise.resolve({ body: "", finalUrl: url, statusCode: 404 });

    const result = await discoverSeoSiteResources(parseAuditConfig({ targetUrl: "example.com" }), {
      fetchResource,
    });

    expect(result.robotsTxt.error).toMatchObject({ code: "network" });
    expect(result.sitemap.statusCode).toBe(404);
  });
});

describe("createSeoSiteResourceFetcher", () => {
  it("revalidates redirects and returns bounded text resources", async () => {
    const assertSafeTarget = vi.fn(() => Promise.resolve());
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: "/robots-live.txt" } }),
      )
      .mockResolvedValueOnce(new Response("User-agent: *", { status: 200 }));
    const fetchResource = createSeoSiteResourceFetcher({ assertSafeTarget, fetchImpl });

    const result = await fetchResource("https://example.com/robots.txt", {
      maxRedirects: 2,
      maxResponseBytes: 1_000,
      timeoutMs: 1_000,
    });

    expect(result).toMatchObject({
      finalUrl: "https://example.com/robots-live.txt",
      statusCode: 200,
      body: "User-agent: *",
    });
    expect(assertSafeTarget).toHaveBeenCalledTimes(2);
  });

  it("blocks redirects that leave the original resource scope", async () => {
    const fetchResource = createSeoSiteResourceFetcher({
      assertSafeTarget: () => Promise.resolve(),
      fetchImpl: () =>
        Promise.resolve(
          new Response(null, {
            status: 302,
            headers: { location: "https://external.example/robots.txt" },
          }),
        ),
    });

    await expect(
      fetchResource("https://example.com/robots.txt", {
        maxRedirects: 2,
        maxResponseBytes: 1_000,
        timeoutMs: 1_000,
      }),
    ).rejects.toMatchObject({ code: "blocked-redirect" });
  });

  it("rejects resources over the configured response bound", async () => {
    const fetchResource = createSeoSiteResourceFetcher({
      assertSafeTarget: () => Promise.resolve(),
      fetchImpl: () =>
        Promise.resolve(
          new Response("large", { status: 200, headers: { "content-length": "100" } }),
        ),
    });

    await expect(
      fetchResource("https://example.com/robots.txt", {
        maxRedirects: 0,
        maxResponseBytes: 10,
        timeoutMs: 1_000,
      }),
    ).rejects.toMatchObject({ code: "response-too-large" });
  });
});
