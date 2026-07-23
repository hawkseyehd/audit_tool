import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CRAWL_SCHEMA_VERSION } from "../../src/crawler/schemas.js";
import type { CrawlResult } from "../../src/crawler/types.js";
import { CLIENT_SCHEMA_STATEMENTS } from "../../src/desktop/main/client-migrations.js";
import {
  PageDiscoveryService,
  type DiscoveryCrawler,
} from "../../src/desktop/main/page-discovery-service.js";
import { PageInventoryRepository } from "../../src/desktop/main/page-inventory-repository.js";
import { PAGE_SCHEMA_STATEMENTS } from "../../src/desktop/main/page-migrations.js";
import type { WebsitePageListQuery } from "../../src/desktop/shared/contracts.js";

let clientId: string;
let database: PrismaClient;
let directory: string;
let inventory: PageInventoryRepository;
let websiteId: string;

const listQuery = (overrides: Partial<WebsitePageListQuery> = {}): WebsitePageListQuery => ({
  availability: "all",
  changeState: "all",
  clientId,
  direction: "asc",
  page: 1,
  pageSize: 25,
  pageType: "all",
  search: "",
  selectionState: "all",
  sort: "url",
  status: "all",
  ...overrides,
});

function crawlResult(
  pages: CrawlResult["pages"],
  timestamps = {
    completedAt: "2026-07-23T11:01:00.000Z",
    startedAt: "2026-07-23T11:00:00.000Z",
  },
): CrawlResult {
  const failedPages = pages.filter((page) => page.error !== undefined).length;
  return {
    completedAt: timestamps.completedAt,
    pages,
    rejectionCounts: {},
    schemaVersion: CRAWL_SCHEMA_VERSION,
    startedAt: timestamps.startedAt,
    stats: {
      attemptedPages: pages.length,
      discoveredUrls: pages.length,
      failedPages,
      rejectedLinks: 0,
      successfulPages: pages.length - failedPages,
    },
    targetUrl: "https://northstar.test/",
  };
}

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "audit-tool-pages-"));
  process.env.DATABASE_URL = `file:${path.join(directory, "workspace.db").replaceAll("\\", "/")}`;
  database = new PrismaClient();
  await database.$connect();
  await database.$executeRawUnsafe("PRAGMA foreign_keys = ON");
  for (const statement of [...CLIENT_SCHEMA_STATEMENTS, ...PAGE_SCHEMA_STATEMENTS]) {
    await database.$executeRawUnsafe(statement);
  }
  const client = await database.client.create({
    data: { businessName: "Northstar Dental", searchText: "northstar dental northstar.test" },
  });
  const website = await database.website.create({
    data: {
      clientId: client.id,
      normalizedDomain: "northstar.test",
      normalizedUrl: "https://northstar.test/",
      url: "https://northstar.test/",
    },
  });
  clientId = client.id;
  websiteId = website.id;
  inventory = new PageInventoryRepository(database);
});

afterEach(async () => {
  await database.$disconnect();
  await rm(directory, { force: true, recursive: true });
});

describe("page discovery", () => {
  it("uses the crawler's safe discovery-only configuration", async () => {
    const crawler = vi.fn<DiscoveryCrawler>().mockImplementation(({ config }) => {
      expect(config).toMatchObject({
        includeAccessibility: false,
        includeAnalytics: false,
        includeForms: false,
        includeLighthouse: false,
        includeSecurity: false,
        includeSeo: false,
        includeUxHeuristics: false,
        maxPages: 40,
        submitForms: false,
      });
      return Promise.resolve(
        crawlResult([{ pageType: "home", statusCode: 200, url: config.targetUrl }]),
      );
    });
    const service = new PageDiscoveryService(inventory, crawler);

    const result = await service.discover(clientId, 40);

    expect(result).toMatchObject({ ok: true, run: { observedPageCount: 1, status: "completed" } });
    expect(crawler).toHaveBeenCalledOnce();
  });

  it("keeps stable page identity and selection while recording rediscovery changes", async () => {
    const firstCrawler = vi.fn<DiscoveryCrawler>().mockResolvedValue(
      crawlResult([
        {
          pageType: "home",
          statusCode: 200,
          title: "Northstar Dental",
          url: "https://northstar.test/",
        },
        {
          error: { code: "http-status", message: "Request returned HTTP 503" },
          pageType: "contact",
          url: "https://northstar.test/contact",
        },
      ]),
    );
    const first = await new PageDiscoveryService(inventory, firstCrawler).discover(clientId, 100);
    expect(first).toMatchObject({
      ok: true,
      run: { failedPageCount: 1, newPageCount: 2, status: "partial", unavailablePageCount: 1 },
    });
    const firstList = await inventory.list(listQuery());
    const homeBefore = firstList.items.find((page) => page.pageType === "home");
    const contactBefore = firstList.items.find((page) => page.pageType === "contact");
    expect(homeBefore).toBeDefined();
    expect(contactBefore).toBeDefined();
    if (homeBefore === undefined || contactBefore === undefined) return;
    await database.websitePage.update({
      data: { selectionState: "included" },
      where: { id: contactBefore.id },
    });

    const secondCrawler = vi.fn<DiscoveryCrawler>().mockResolvedValue(
      crawlResult(
        [
          {
            pageType: "home",
            statusCode: 200,
            title: "Northstar Dental Studio",
            url: "https://northstar.test/",
          },
          {
            pageType: "service",
            statusCode: 200,
            title: "Services",
            url: "https://northstar.test/services/",
          },
        ],
        {
          completedAt: "2026-07-23T12:01:00.000Z",
          startedAt: "2026-07-23T12:00:00.000Z",
        },
      ),
    );
    const second = await new PageDiscoveryService(inventory, secondCrawler).discover(clientId, 100);
    expect(second).toMatchObject({
      ok: true,
      run: {
        changedPageCount: 1,
        newPageCount: 1,
        noLongerObservedCount: 1,
        status: "completed",
      },
    });

    const secondList = await inventory.list(listQuery());
    const homeAfter = secondList.items.find((page) => page.pageType === "home");
    const contactAfter = secondList.items.find((page) => page.pageType === "contact");
    expect(homeAfter).toMatchObject({
      changeState: "changed",
      id: homeBefore.id,
      title: "Northstar Dental Studio",
    });
    expect(contactAfter).toMatchObject({
      availability: "not-observed",
      changeState: "not-observed",
      id: contactBefore.id,
      selectionState: "included",
    });
    expect(secondList.summary).toEqual({
      available: 2,
      eligible: 2,
      excluded: 0,
      notObserved: 1,
      selected: 1,
      unavailable: 0,
    });
  });

  it("records failed jobs and prevents overlapping runs", async () => {
    const started = await inventory.startRun(clientId);
    expect(started.ok).toBe(true);
    const blocked = await new PageDiscoveryService(inventory, vi.fn()).discover(clientId, 10);
    expect(blocked).toMatchObject({ error: { code: "already-running" }, ok: false });
    if (!started.ok) return;
    await inventory.failRun(started.run.id, new Error("Network route unavailable"));

    const failingCrawler = vi
      .fn<DiscoveryCrawler>()
      .mockRejectedValue(new Error("DNS unavailable"));
    const failed = await new PageDiscoveryService(inventory, failingCrawler).discover(clientId, 10);
    expect(failed).toMatchObject({
      error: { code: "discovery-failed", message: "DNS unavailable" },
      ok: false,
      run: { status: "failed" },
    });
  });

  it("supports database-backed inventory search and filters", async () => {
    const started = await inventory.startRun(clientId);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    await inventory.completeRun(
      started.run.id,
      crawlResult([
        { pageType: "home", statusCode: 200, title: "Home", url: "https://northstar.test/" },
        {
          pageType: "service",
          statusCode: 200,
          title: "Dental Implants",
          url: "https://northstar.test/services/implants",
        },
      ]),
    );

    const filtered = await inventory.list(
      listQuery({ availability: "available", pageType: "service", search: "implants" }),
    );
    expect(filtered.total).toBe(1);
    expect(filtered.items[0]).toMatchObject({ pageType: "service", title: "Dental Implants" });
    await expect(database.websitePage.count({ where: { websiteId } })).resolves.toBe(2);
  });
});
