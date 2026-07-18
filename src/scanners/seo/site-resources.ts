import { Buffer } from "node:buffer";

import { PageFetchError } from "../../crawler/errors.js";
import { createCrawlScope, type CrawlScope } from "../../url/crawl-scope.js";
import { assertPublicNetworkTarget } from "../../url/network-safety.js";
import { normalizeDiscoveredUrl, normalizeTargetUrl } from "../../url/normalize-url.js";
import { seoSiteResourcesSchema } from "./schemas.js";
import type {
  SeoResourceConfig,
  SeoResourceFetcherDependencies,
  SeoSiteResource,
  SeoSiteResourceDependencies,
  SeoSiteResourceFetcher,
  SeoSiteResources,
} from "./types.js";

const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);
const MAX_SEO_RESOURCE_BYTES = 1_000_000;
const USER_AGENT = "WebsiteAuditTool/0.1 (+public-safe automated audit)";

export async function discoverSeoSiteResources(
  config: SeoResourceConfig,
  dependencies: SeoSiteResourceDependencies = {},
  signal?: AbortSignal,
): Promise<SeoSiteResources> {
  const targetUrl = normalizeTargetUrl(config.targetUrl);
  const scope = createCrawlScope(targetUrl, config.allowedDomains);
  const fetchResource = dependencies.fetchResource ?? createSeoSiteResourceFetcher();
  const options = {
    maxRedirects: config.maxRedirects,
    maxResponseBytes: Math.min(config.maxResponseBytes, MAX_SEO_RESOURCE_BYTES),
    ...(signal === undefined ? {} : { signal }),
    timeoutMs: config.navigationTimeoutMs,
  };
  const robotsUrl = new URL("/robots.txt", targetUrl).toString();
  const robotsTxt = await fetchSiteResource(robotsUrl, fetchResource, options);
  const sitemapUrl = selectSitemapUrl(robotsTxt.body, targetUrl, scope);
  const sitemap = await fetchSiteResource(sitemapUrl, fetchResource, options);

  return seoSiteResourcesSchema.parse({ robotsTxt, sitemap });
}

export function createSeoSiteResourceFetcher(
  dependencies: SeoResourceFetcherDependencies = {},
): SeoSiteResourceFetcher {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const assertSafeTarget = dependencies.assertSafeTarget ?? assertPublicNetworkTarget;

  return async (inputUrl, options) => {
    let currentUrl = normalizeTargetUrl(inputUrl);
    const scope = createCrawlScope(currentUrl);
    const visitedUrls = new Set([currentUrl]);

    for (let redirectCount = 0; ; redirectCount += 1) {
      options.signal?.throwIfAborted();
      await assertSafeTarget(currentUrl);
      const response = await fetchResourceResponse(fetchImpl, currentUrl, options);

      if (REDIRECT_STATUS_CODES.has(response.status)) {
        if (redirectCount >= options.maxRedirects) {
          throw new PageFetchError("redirect-limit", "Maximum resource redirect count exceeded");
        }
        const location = response.headers.get("location");
        if (location === null) {
          throw new PageFetchError("invalid-redirect", "Resource redirect is missing Location");
        }
        const redirectUrl = normalizeDiscoveredUrl(location, currentUrl);
        if (!isResourceInScope(redirectUrl, scope)) {
          throw new PageFetchError("blocked-redirect", "Resource redirect left audit scope");
        }
        if (visitedUrls.has(redirectUrl)) {
          throw new PageFetchError("redirect-loop", "Resource redirect loop detected");
        }
        currentUrl = redirectUrl;
        visitedUrls.add(currentUrl);
        continue;
      }

      return {
        body: await readBoundedText(response, options.maxResponseBytes),
        finalUrl: currentUrl,
        statusCode: response.status,
      };
    }
  };
}

async function fetchSiteResource(
  requestedUrl: string,
  fetchResource: SeoSiteResourceFetcher,
  options: Parameters<SeoSiteResourceFetcher>[1],
): Promise<SeoSiteResource> {
  try {
    const resource = await fetchResource(requestedUrl, options);
    return {
      requestedUrl,
      finalUrl: resource.finalUrl,
      statusCode: resource.statusCode,
      body: resource.body.slice(0, MAX_SEO_RESOURCE_BYTES),
    };
  } catch (error: unknown) {
    options.signal?.throwIfAborted();
    return {
      requestedUrl,
      error: {
        ...(error instanceof PageFetchError ? { code: error.code } : { code: "resource-failed" }),
        message: safeErrorMessage(error),
      },
    };
  }
}

function selectSitemapUrl(
  robotsBody: string | undefined,
  targetUrl: string,
  scope: CrawlScope,
): string {
  for (const line of (robotsBody ?? "").split(/\r?\n/gu)) {
    const match = /^\s*sitemap\s*:\s*(\S+)\s*$/iu.exec(line);
    if (match?.[1] === undefined) {
      continue;
    }
    try {
      const sitemapUrl = normalizeDiscoveredUrl(match[1], targetUrl);
      if (isResourceInScope(sitemapUrl, scope)) {
        return sitemapUrl;
      }
    } catch {
      // Invalid or out-of-scope declarations fall back to the conventional location.
    }
  }
  return new URL("/sitemap.xml", targetUrl).toString();
}

function isResourceInScope(resourceUrl: string, scope: CrawlScope): boolean {
  const url = new URL(resourceUrl);
  if (!scope.allowedHostnames.has(url.hostname)) {
    return false;
  }
  const expectedPort = url.hostname === scope.targetHostname ? scope.targetPort : "";
  return url.port === expectedPort;
}

async function fetchResourceResponse(
  fetchImpl: typeof fetch,
  url: string,
  options: Parameters<SeoSiteResourceFetcher>[1],
): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(options.timeoutMs);
  const signal =
    options.signal === undefined ? timeoutSignal : AbortSignal.any([options.signal, timeoutSignal]);
  try {
    return await fetchImpl(url, {
      headers: {
        accept: "text/plain,application/xml,text/xml;q=0.9,*/*;q=0.1",
        "user-agent": USER_AGENT,
      },
      redirect: "manual",
      signal,
    });
  } catch (error: unknown) {
    if (options.signal?.aborted === true) {
      throw error;
    }
    throw new PageFetchError(
      timeoutSignal.aborted ? "timeout" : "network",
      timeoutSignal.aborted
        ? `Resource request timed out for ${url}`
        : `Resource request failed for ${url}`,
      { cause: error, retryable: true },
    );
  }
}

async function readBoundedText(response: Response, maxResponseBytes: number): Promise<string> {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null && Number(declaredLength) > maxResponseBytes) {
    throw new PageFetchError("response-too-large", "SEO resource exceeds response limit");
  }
  if (response.body === null) {
    return "";
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let sizeBytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      sizeBytes += value.byteLength;
      if (sizeBytes > maxResponseBytes) {
        throw new PageFetchError("response-too-large", "SEO resource exceeds response limit");
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown SEO resource failure";
  return message.replace(/\s+/gu, " ").trim().slice(0, 2_000);
}
