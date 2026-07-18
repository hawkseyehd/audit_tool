import { Buffer } from "node:buffer";

import { evaluateCrawlCandidate } from "../url/crawl-scope.js";
import { assertPublicNetworkTarget } from "../url/network-safety.js";
import { normalizeTargetUrl } from "../url/normalize-url.js";
import { PageFetchError } from "./errors.js";
import type { FetchPageOptions, FetchedPage, PageFetcher } from "./types.js";

const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);
const DEFAULT_USER_AGENT = "WebsiteAuditTool/0.1 (+public-safe automated audit)";

export interface HttpPageFetcherDependencies {
  readonly assertSafeTarget?: (url: string) => Promise<void>;
  readonly fetchImpl?: typeof fetch;
  readonly userAgent?: string;
}

export function createHttpPageFetcher(dependencies: HttpPageFetcherDependencies = {}): PageFetcher {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const assertSafeTarget = dependencies.assertSafeTarget ?? assertPublicNetworkTarget;
  const userAgent = dependencies.userAgent ?? DEFAULT_USER_AGENT;

  return async (inputUrl, options) => {
    let currentUrl = normalizeTargetUrl(inputUrl);
    const visitedRedirects = new Set<string>([currentUrl]);

    for (let redirectCount = 0; ; redirectCount += 1) {
      options.signal?.throwIfAborted();
      await assertSafeTarget(currentUrl);

      const response = await requestPage(fetchImpl, currentUrl, options, userAgent);

      if (REDIRECT_STATUS_CODES.has(response.status)) {
        if (redirectCount >= options.maxRedirects) {
          throw new PageFetchError("redirect-limit", "Maximum redirect count exceeded");
        }

        const location = response.headers.get("location");
        if (location === null) {
          throw new PageFetchError("invalid-redirect", "Redirect response is missing Location");
        }

        const decision = evaluateCrawlCandidate(location, currentUrl, options.scope);
        if (!decision.accepted) {
          throw new PageFetchError(
            "blocked-redirect",
            `Redirect rejected by crawl policy: ${decision.reason}`,
          );
        }

        if (visitedRedirects.has(decision.url)) {
          throw new PageFetchError("redirect-loop", "Redirect loop detected");
        }

        currentUrl = decision.url;
        visitedRedirects.add(currentUrl);
        continue;
      }

      const contentType = response.headers.get("content-type");
      const body = isHtmlContent(contentType)
        ? await readBoundedBody(response, options.maxResponseBytes)
        : "";

      return {
        body,
        contentType,
        finalUrl: currentUrl,
        statusCode: response.status,
      } satisfies FetchedPage;
    }
  };
}

async function requestPage(
  fetchImpl: typeof fetch,
  url: string,
  options: FetchPageOptions,
  userAgent: string,
): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(options.timeoutMs);
  const signal =
    options.signal === undefined ? timeoutSignal : AbortSignal.any([options.signal, timeoutSignal]);

  try {
    return await fetchImpl(url, {
      headers: {
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
        "user-agent": userAgent,
      },
      redirect: "manual",
      signal,
    });
  } catch (error: unknown) {
    if (options.signal?.aborted === true) {
      throw error;
    }

    if (timeoutSignal.aborted) {
      throw new PageFetchError("timeout", `Request timed out for ${url}`, {
        cause: error,
        retryable: true,
      });
    }

    throw new PageFetchError("network", `Network request failed for ${url}`, {
      cause: error,
      retryable: true,
    });
  }
}

async function readBoundedBody(response: Response, maxResponseBytes: number): Promise<string> {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (Number.isFinite(parsedLength) && parsedLength > maxResponseBytes) {
      throw new PageFetchError(
        "response-too-large",
        `Response exceeds ${String(maxResponseBytes)} bytes`,
      );
    }
  }

  if (response.body === null) {
    return "";
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  try {
    let chunk = await reader.read();
    while (!chunk.done) {
      totalBytes += chunk.value.byteLength;
      if (totalBytes > maxResponseBytes) {
        await reader.cancel();
        throw new PageFetchError(
          "response-too-large",
          `Response exceeds ${String(maxResponseBytes)} bytes`,
        );
      }

      chunks.push(Buffer.from(chunk.value));
      chunk = await reader.read();
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, totalBytes).toString("utf8");
}

function isHtmlContent(contentType: string | null): boolean {
  if (contentType === null) {
    return false;
  }

  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType === "text/html" || mediaType === "application/xhtml+xml";
}
