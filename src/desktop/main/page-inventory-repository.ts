import type {
  DiscoveryRun as PrismaDiscoveryRun,
  Prisma,
  PrismaClient,
  WebsitePage,
} from "@prisma/client";

import type { CrawlResult } from "../../crawler/types.js";
import type { PageType } from "../../core/types.js";
import { normalizeTargetUrl } from "../../url/normalize-url.js";
import {
  discoveryRunSchema,
  websitePageListQuerySchema,
  websitePageListResultSchema,
  websitePageRecordSchema,
  type DiscoveryRun,
  type WebsitePageListQuery,
  type WebsitePageListResult,
  type WebsitePageRecord,
} from "../shared/contracts.js";

type StartRunResult =
  | { code: "not-found" | "already-running"; message: string; ok: false }
  | { ok: true; run: DiscoveryRun; targetUrl: string };

export class PageInventoryRepository {
  readonly #database: PrismaClient;

  constructor(database: PrismaClient) {
    this.#database = database;
  }

  async startRun(clientId: string): Promise<StartRunResult> {
    return this.#database.$transaction(async (transaction) => {
      const website = await transaction.website.findFirst({
        select: { id: true, url: true },
        where: { clientId },
      });
      if (website === null) {
        return { code: "not-found", message: "Client website could not be found.", ok: false };
      }

      const running = await transaction.discoveryRun.findFirst({
        select: { id: true },
        where: { status: "running", websiteId: website.id },
      });
      if (running !== null) {
        return {
          code: "already-running",
          message: "A page discovery run is already in progress for this website.",
          ok: false,
        };
      }

      const run = await transaction.discoveryRun.create({
        data: { source: "manual", status: "running", websiteId: website.id },
      });
      await transaction.clientActivity.create({
        data: {
          clientId,
          kind: "discovery-started",
          summary: "Website page discovery started",
        },
      });
      return { ok: true, run: toDiscoveryRun(run), targetUrl: website.url };
    });
  }

  async completeRun(runId: string, result: CrawlResult): Promise<DiscoveryRun> {
    return this.#database.$transaction(
      async (transaction) => {
        const run = await transaction.discoveryRun.findUniqueOrThrow({
          include: { website: { select: { clientId: true } } },
          where: { id: runId },
        });
        const existingPages = await transaction.websitePage.findMany({
          where: { websiteId: run.websiteId },
        });
        const existingByUrl = new Map(existingPages.map((page) => [page.normalizedUrl, page]));
        const observedByUrl = deduplicateObservedPages(result);
        const observedAt = new Date(result.completedAt);
        let changedPageCount = 0;
        let newPageCount = 0;
        let unavailablePageCount = 0;

        for (const observed of observedByUrl.values()) {
          const existing = existingByUrl.get(observed.normalizedUrl);
          const availability = getAvailability(observed.statusCode, observed.failureMessage);
          const recommendation = getRecommendation(observed.pageType, observed.normalizedUrl);
          if (availability === "unavailable") unavailablePageCount += 1;

          if (existing === undefined) {
            newPageCount += 1;
            await transaction.websitePage.create({
              data: {
                availability,
                changeState: availability === "unavailable" ? "unavailable" : "new",
                failureCode: observed.failureCode,
                failureMessage: observed.failureMessage,
                firstDiscoveredAt: observedAt,
                lastChangedAt: observedAt,
                lastObservedAt: observedAt,
                normalizedUrl: observed.normalizedUrl,
                observedUrl: observed.observedUrl,
                pageType: observed.pageType,
                recommendationReason: recommendation.reason,
                recommendationState: recommendation.state,
                statusCode: observed.statusCode,
                title: observed.title,
                websiteId: run.websiteId,
              },
            });
            continue;
          }

          existingByUrl.delete(observed.normalizedUrl);
          const changed = hasMaterialChange(existing, observed, availability);
          if (changed) changedPageCount += 1;
          await transaction.websitePage.update({
            data: {
              availability,
              changeState:
                availability === "unavailable" ? "unavailable" : changed ? "changed" : "unchanged",
              failureCode: observed.failureCode,
              failureMessage: observed.failureMessage,
              lastChangedAt: changed ? observedAt : existing.lastChangedAt,
              lastObservedAt: observedAt,
              observedUrl: observed.observedUrl,
              pageType: observed.pageType,
              recommendationReason: recommendation.reason,
              recommendationState: recommendation.state,
              statusCode: observed.statusCode,
              title: observed.title,
            },
            where: { id: existing.id },
          });
        }

        for (const page of existingByUrl.values()) {
          const changed = page.availability !== "not-observed";
          await transaction.websitePage.update({
            data: {
              availability: "not-observed",
              changeState: "not-observed",
              lastChangedAt: changed ? observedAt : page.lastChangedAt,
            },
            where: { id: page.id },
          });
        }

        const noLongerObservedCount = existingByUrl.size;
        const status = result.stats.failedPages > 0 ? "partial" : "completed";
        const completedRun = await transaction.discoveryRun.update({
          data: {
            changedPageCount,
            completedAt: observedAt,
            discoveredUrlCount: result.stats.discoveredUrls,
            failedPageCount: result.stats.failedPages,
            newPageCount,
            noLongerObservedCount,
            observedPageCount: observedByUrl.size,
            status,
            successfulPageCount: result.stats.successfulPages,
            unavailablePageCount,
          },
          where: { id: runId },
        });
        await transaction.clientActivity.create({
          data: {
            clientId: run.website.clientId,
            kind: "discovery-completed",
            summary: `Website discovery ${status}: ${String(observedByUrl.size)} pages observed`,
          },
        });
        return toDiscoveryRun(completedRun);
      },
      { timeout: 30_000 },
    );
  }

  async failRun(runId: string, error: unknown): Promise<DiscoveryRun> {
    const failureMessage = safeMessage(error);
    return this.#database.$transaction(async (transaction) => {
      const run = await transaction.discoveryRun.update({
        data: { completedAt: new Date(), failureMessage, status: "failed" },
        include: { website: { select: { clientId: true } } },
        where: { id: runId },
      });
      await transaction.clientActivity.create({
        data: {
          clientId: run.website.clientId,
          kind: "discovery-failed",
          summary: "Website page discovery failed",
        },
      });
      return toDiscoveryRun(run);
    });
  }

  async list(input: WebsitePageListQuery): Promise<WebsitePageListResult> {
    const query = websitePageListQuerySchema.parse(input);
    const website = await this.#database.website.findFirst({
      select: { id: true },
      where: { clientId: query.clientId },
    });
    if (website === null) {
      return websitePageListResultSchema.parse({
        items: [],
        latestRun: null,
        page: query.page,
        pageSize: query.pageSize,
        summary: {
          available: 0,
          eligible: 0,
          excluded: 0,
          notObserved: 0,
          selected: 0,
          unavailable: 0,
        },
        total: 0,
      });
    }

    const where = buildPageWhere(website.id, query);
    const orderBy = buildPageOrder(query);
    const [
      items,
      total,
      latestRun,
      available,
      eligible,
      excluded,
      unavailable,
      notObserved,
      selected,
    ] = await Promise.all([
      this.#database.websitePage.findMany({
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        where,
      }),
      this.#database.websitePage.count({ where }),
      this.#database.discoveryRun.findFirst({
        orderBy: { startedAt: "desc" },
        where: { websiteId: website.id },
      }),
      this.#database.websitePage.count({
        where: { availability: "available", websiteId: website.id },
      }),
      this.#database.websitePage.count({
        where: {
          availability: "available",
          recommendationState: { not: "excluded" },
          websiteId: website.id,
        },
      }),
      this.#database.websitePage.count({
        where: { selectionState: "excluded", websiteId: website.id },
      }),
      this.#database.websitePage.count({
        where: { availability: "unavailable", websiteId: website.id },
      }),
      this.#database.websitePage.count({
        where: { availability: "not-observed", websiteId: website.id },
      }),
      this.#database.websitePage.count({
        where: { selectionState: "included", websiteId: website.id },
      }),
    ]);

    return websitePageListResultSchema.parse({
      items: items.map(toWebsitePage),
      latestRun: latestRun === null ? null : toDiscoveryRun(latestRun),
      page: query.page,
      pageSize: query.pageSize,
      summary: { available, eligible, excluded, notObserved, selected, unavailable },
      total,
    });
  }
}

interface ObservedPage {
  failureCode: string | null;
  failureMessage: string | null;
  normalizedUrl: string;
  observedUrl: string;
  pageType: PageType;
  statusCode: number | null;
  title: string | null;
}

function deduplicateObservedPages(result: CrawlResult): Map<string, ObservedPage> {
  const pages = new Map<string, ObservedPage>();
  for (const page of result.pages) {
    const normalizedUrl = normalizeTargetUrl(page.url);
    const candidate: ObservedPage = {
      failureCode: page.error?.code ?? null,
      failureMessage: page.error?.message ?? null,
      normalizedUrl,
      observedUrl: page.url,
      pageType: page.pageType,
      statusCode: page.statusCode ?? null,
      title: page.title ?? null,
    };
    const existing = pages.get(normalizedUrl);
    if (
      existing === undefined ||
      (existing.failureMessage !== null && candidate.failureMessage === null)
    ) {
      pages.set(normalizedUrl, candidate);
    }
  }
  return pages;
}

function getAvailability(
  statusCode: number | null,
  failureMessage: string | null,
): "available" | "unavailable" {
  return failureMessage === null && statusCode !== null && statusCode < 400
    ? "available"
    : "unavailable";
}

function hasMaterialChange(
  existing: WebsitePage,
  observed: ObservedPage,
  availability: "available" | "unavailable",
): boolean {
  return (
    existing.observedUrl !== observed.observedUrl ||
    existing.title !== observed.title ||
    existing.pageType !== observed.pageType ||
    existing.statusCode !== observed.statusCode ||
    existing.failureCode !== observed.failureCode ||
    existing.failureMessage !== observed.failureMessage ||
    existing.availability !== availability
  );
}

function getRecommendation(
  pageType: PageType,
  normalizedUrl: string,
): { reason: string; state: "recommended" | "review" | "excluded" } {
  if (pageType === "checkout" || pageType === "auth") {
    return {
      reason: "Transactional and account pages require explicit review before auditing.",
      state: "excluded",
    };
  }
  if (/\/(?:tag|category|author|page)\//iu.test(new URL(normalizedUrl).pathname)) {
    return {
      reason: "Archive and pagination pages are usually lower-value audit targets.",
      state: "excluded",
    };
  }
  if (
    ["home", "contact", "service", "product", "pricing", "booking", "form", "about"].includes(
      pageType,
    )
  ) {
    return {
      reason: "Representative customer-facing page recommended for review.",
      state: "recommended",
    };
  }
  return { reason: "Review this page before adding it to an audit scope.", state: "review" };
}

function buildPageWhere(
  websiteId: string,
  query: WebsitePageListQuery,
): Prisma.WebsitePageWhereInput {
  const statusWhere: Prisma.WebsitePageWhereInput =
    query.status === "success"
      ? { statusCode: { gte: 200, lt: 300 } }
      : query.status === "redirect"
        ? { statusCode: { gte: 300, lt: 400 } }
        : query.status === "client-error"
          ? { statusCode: { gte: 400, lt: 500 } }
          : query.status === "server-error"
            ? { statusCode: { gte: 500, lt: 600 } }
            : query.status === "failed"
              ? { statusCode: null }
              : {};

  return {
    ...statusWhere,
    ...(query.availability === "all" ? {} : { availability: query.availability }),
    ...(query.changeState === "all" ? {} : { changeState: query.changeState }),
    ...(query.pageType === "all" ? {} : { pageType: query.pageType }),
    ...(query.selectionState === "all" ? {} : { selectionState: query.selectionState }),
    ...(query.search.length === 0
      ? {}
      : {
          OR: [
            { title: { contains: query.search } },
            { normalizedUrl: { contains: query.search } },
          ],
        }),
    websiteId,
  };
}

function buildPageOrder(query: WebsitePageListQuery): Prisma.WebsitePageOrderByWithRelationInput[] {
  if (query.sort === "title") return [{ title: query.direction }, { normalizedUrl: "asc" }];
  if (query.sort === "url") return [{ normalizedUrl: query.direction }];
  return [{ lastObservedAt: query.direction }, { normalizedUrl: "asc" }];
}

function toWebsitePage(page: WebsitePage): WebsitePageRecord {
  return websitePageRecordSchema.parse({
    availability: page.availability,
    changeState: page.changeState,
    failureCode: page.failureCode,
    failureMessage: page.failureMessage,
    firstDiscoveredAt: page.firstDiscoveredAt.toISOString(),
    id: page.id,
    lastChangedAt: page.lastChangedAt?.toISOString() ?? null,
    lastObservedAt: page.lastObservedAt.toISOString(),
    normalizedUrl: page.normalizedUrl,
    observedUrl: page.observedUrl,
    pageType: page.pageType,
    recommendationReason: page.recommendationReason,
    recommendationState: page.recommendationState,
    selectionState: page.selectionState,
    statusCode: page.statusCode,
    title: page.title,
  });
}

function toDiscoveryRun(run: PrismaDiscoveryRun): DiscoveryRun {
  return discoveryRunSchema.parse({
    changedPageCount: run.changedPageCount,
    completedAt: run.completedAt?.toISOString() ?? null,
    discoveredUrlCount: run.discoveredUrlCount,
    failedPageCount: run.failedPageCount,
    failureMessage: run.failureMessage,
    id: run.id,
    newPageCount: run.newPageCount,
    noLongerObservedCount: run.noLongerObservedCount,
    observedPageCount: run.observedPageCount,
    source: run.source,
    startedAt: run.startedAt.toISOString(),
    status: run.status,
    successfulPageCount: run.successfulPageCount,
    unavailablePageCount: run.unavailablePageCount,
  });
}

function safeMessage(error: unknown): string {
  return (error instanceof Error ? error.message : "Website discovery failed").slice(0, 2_000);
}
