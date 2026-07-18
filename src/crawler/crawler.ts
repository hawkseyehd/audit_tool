import type { ScannedPage } from "../core/types.js";
import { classifyPage } from "../classifiers/page-classifier.js";
import { createCrawlScope, type CrawlRejectionReason } from "../url/crawl-scope.js";
import { normalizeTargetUrl } from "../url/normalize-url.js";
import { PageFetchError } from "./errors.js";
import { createHttpPageFetcher } from "./http-page-fetcher.js";
import { extractPageLinks } from "./link-extractor.js";
import { scoreUrlPriority } from "./priority.js";
import { CRAWL_SCHEMA_VERSION, crawlResultSchema } from "./schemas.js";
import type {
  CrawlDependencies,
  CrawlPageResource,
  CrawlResult,
  CrawlWebsiteOptions,
  FetchedPage,
  PageFetcher,
} from "./types.js";

interface QueueEntry {
  readonly discoveryOrder: number;
  readonly priority: number;
  readonly url: string;
}

interface ProcessedPage {
  readonly links: readonly string[];
  readonly page: ScannedPage;
  readonly resource?: Omit<CrawlPageResource, "page">;
  readonly rejectionCounts: Readonly<Partial<Record<CrawlRejectionReason, number>>>;
  readonly successful: boolean;
}

export async function crawlWebsite(
  options: CrawlWebsiteOptions,
  dependencies: CrawlDependencies = {},
): Promise<CrawlResult> {
  const { config, signal } = options;
  const now = dependencies.now ?? (() => new Date());
  const random = dependencies.random ?? Math.random;
  const sleep = dependencies.sleep ?? delay;
  const fetchPage = dependencies.fetchPage ?? createHttpPageFetcher();
  const targetUrl = normalizeTargetUrl(config.targetUrl);
  const scope = createCrawlScope(targetUrl, config.allowedDomains);
  const startedAt = now().toISOString();
  const queue: QueueEntry[] = [createQueueEntry(targetUrl, 0)];
  const seenUrls = new Set<string>([targetUrl]);
  const pages: ScannedPage[] = [];
  const rejectionCounts: Record<string, number> = {};
  const maxQueuedUrls = Math.max(100, config.maxPages * 20);
  let discoveryOrder = 1;

  while (queue.length > 0 && pages.length < config.maxPages) {
    signal?.throwIfAborted();
    queue.sort(compareQueueEntries);

    const batchSize = Math.min(config.concurrency, config.maxPages - pages.length, queue.length);
    const batch = queue.splice(0, batchSize);
    const processedPages = await Promise.all(
      batch.map((entry) => processPage(entry.url, config, scope, fetchPage, sleep, random, signal)),
    );

    for (const processed of processedPages) {
      pages.push(processed.page);
      if (processed.resource !== undefined) {
        options.onPageFetched?.({ ...processed.resource, page: processed.page });
      }
      mergeRejectionCounts(rejectionCounts, processed.rejectionCounts);

      if (!processed.successful) {
        continue;
      }

      seenUrls.add(processed.page.url);
      for (const link of processed.links) {
        if (seenUrls.has(link)) {
          continue;
        }

        if (queue.length >= maxQueuedUrls) {
          rejectionCounts["queue-limit"] = (rejectionCounts["queue-limit"] ?? 0) + 1;
          continue;
        }

        seenUrls.add(link);
        queue.push(createQueueEntry(link, discoveryOrder));
        discoveryOrder += 1;
      }
    }

    if (queue.length > 0 && pages.length < config.maxPages && config.crawlDelayMs > 0) {
      await sleep(config.crawlDelayMs);
    }
  }

  const failedPages = pages.filter((page) => page.error !== undefined).length;
  const rejectedLinks = Object.values(rejectionCounts).reduce((total, count) => total + count, 0);

  return crawlResultSchema.parse({
    schemaVersion: CRAWL_SCHEMA_VERSION,
    startedAt,
    completedAt: now().toISOString(),
    targetUrl,
    pages,
    rejectionCounts,
    stats: {
      attemptedPages: pages.length,
      successfulPages: pages.length - failedPages,
      failedPages,
      discoveredUrls: seenUrls.size,
      rejectedLinks,
    },
  });
}

async function processPage(
  url: string,
  config: CrawlWebsiteOptions["config"],
  scope: ReturnType<typeof createCrawlScope>,
  fetchPage: PageFetcher,
  sleep: (durationMs: number) => Promise<void>,
  random: () => number,
  signal: AbortSignal | undefined,
): Promise<ProcessedPage> {
  try {
    const fetchedPage = await fetchWithRetries(
      url,
      config,
      scope,
      fetchPage,
      sleep,
      random,
      signal,
    );
    const extracted = isHtmlContent(fetchedPage.contentType)
      ? extractPageLinks(fetchedPage.body, fetchedPage.finalUrl, scope)
      : { classificationSignals: {}, links: [], rejectionCounts: {} };
    const classification = classifyPage({
      url: fetchedPage.finalUrl,
      ...(extracted.title === undefined ? {} : { title: extracted.title }),
      ...extracted.classificationSignals,
    });

    return {
      links: extracted.links,
      page: {
        url: fetchedPage.finalUrl,
        pageType: classification.pageType,
        statusCode: fetchedPage.statusCode,
        ...(extracted.title === undefined ? {} : { title: extracted.title }),
      },
      resource: {
        body: fetchedPage.body,
        contentType: fetchedPage.contentType,
        headers: fetchedPage.headers ?? {},
        setCookieHeaders: fetchedPage.setCookieHeaders ?? [],
      },
      rejectionCounts: extracted.rejectionCounts,
      successful: true,
    };
  } catch (error: unknown) {
    signal?.throwIfAborted();
    const classification = classifyPage({ url });
    return {
      links: [],
      page: {
        url,
        pageType: classification.pageType,
        error: {
          ...(error instanceof PageFetchError ? { code: error.code } : {}),
          message: safeErrorMessage(error),
        },
      },
      rejectionCounts: {},
      successful: false,
    };
  }
}

async function fetchWithRetries(
  url: string,
  config: CrawlWebsiteOptions["config"],
  scope: ReturnType<typeof createCrawlScope>,
  fetchPage: PageFetcher,
  sleep: (durationMs: number) => Promise<void>,
  random: () => number,
  signal: AbortSignal | undefined,
): Promise<FetchedPage> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fetchPage(url, {
        maxRedirects: config.maxRedirects,
        maxResponseBytes: config.maxResponseBytes,
        scope,
        ...(signal === undefined ? {} : { signal }),
        timeoutMs: config.navigationTimeoutMs,
      });
    } catch (error: unknown) {
      const canRetry =
        error instanceof PageFetchError && error.retryable && attempt < config.maxRetries;
      if (!canRetry) {
        throw error;
      }

      const backoffMs = Math.min(2_000, 100 * 2 ** attempt) + Math.floor(random() * 100);
      await sleep(backoffMs);
    }
  }
}

function createQueueEntry(url: string, discoveryOrder: number): QueueEntry {
  return {
    discoveryOrder,
    priority: scoreUrlPriority(url),
    url,
  };
}

function compareQueueEntries(left: QueueEntry, right: QueueEntry): number {
  return right.priority - left.priority || left.discoveryOrder - right.discoveryOrder;
}

function mergeRejectionCounts(
  target: Record<string, number>,
  source: Readonly<Partial<Record<CrawlRejectionReason, number>>>,
): void {
  for (const [reason, count] of Object.entries(source)) {
    target[reason] = (target[reason] ?? 0) + count;
  }
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown page failure";
  return message.slice(0, 2_000);
}

function isHtmlContent(contentType: string | null): boolean {
  const normalizedType = contentType?.split(";", 1)[0]?.trim().toLowerCase();
  return normalizedType === "text/html" || normalizedType === "application/xhtml+xml";
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}
