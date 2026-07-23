import type { Prisma, PrismaClient } from "@prisma/client";

import { createCrawlScope, evaluateCrawlCandidate } from "../../url/crawl-scope.js";
import {
  auditScopeConfigurationSchema,
  auditScopeRecordSchema,
  createAuditScopeResultSchema,
  pageSelectionResultSchema,
  websitePageSummarySchema,
  type AuditScopeConfiguration,
  type AuditScopeRecord,
  type AuditScopeReportFormat,
  type CreateAuditScopeResult,
  type PageSelectionAction,
  type PageSelectionResult,
} from "../shared/contracts.js";

type ScopeWithPages = Prisma.AuditScopeGetPayload<{ include: { pages: true } }>;

export class AuditScopeRepository {
  readonly #database: PrismaClient;

  constructor(database: PrismaClient) {
    this.#database = database;
  }

  async applySelection(
    clientId: string,
    action: PageSelectionAction,
    pageIds: readonly string[],
  ): Promise<PageSelectionResult> {
    const website = await this.#database.website.findFirst({
      select: { id: true },
      where: { clientId },
    });
    if (website === null) return selectionError("not-found", "Client website could not be found.");

    const uniquePageIds = [...new Set(pageIds)];
    if (action === "include" || action === "exclude" || action === "reset") {
      const pages = await this.#database.websitePage.findMany({
        select: { availability: true, id: true },
        where: { id: { in: uniquePageIds }, websiteId: website.id },
      });
      if (pages.length !== uniquePageIds.length) {
        return selectionError(
          "invalid-pages",
          "One or more pages do not belong to this client website.",
        );
      }
      if (action === "include" && pages.some((page) => page.availability !== "available")) {
        return selectionError(
          "ineligible-pages",
          "Unavailable or no-longer-observed pages cannot be included in an audit scope.",
        );
      }
    }

    await this.#database.$transaction(async (transaction) => {
      if (action === "clear") {
        await transaction.websitePage.updateMany({
          data: { selectionState: "default" },
          where: { websiteId: website.id },
        });
      } else if (action === "include-recommended") {
        await transaction.websitePage.updateMany({
          data: { selectionState: "included" },
          where: {
            availability: "available",
            recommendationState: "recommended",
            selectionState: { not: "excluded" },
            websiteId: website.id,
          },
        });
      } else {
        await transaction.websitePage.updateMany({
          data: {
            selectionState:
              action === "include" ? "included" : action === "exclude" ? "excluded" : "default",
          },
          where: { id: { in: uniquePageIds }, websiteId: website.id },
        });
      }
      await transaction.clientActivity.create({
        data: {
          clientId,
          kind: "page-selection-updated",
          summary: selectionActivitySummary(action, uniquePageIds.length),
        },
      });
    });

    return pageSelectionResultSchema.parse({
      ok: true,
      summary: await this.getSummary(website.id),
    });
  }

  async createScope(
    clientId: string,
    configuration: AuditScopeConfiguration,
    reportFormats: readonly AuditScopeReportFormat[],
  ): Promise<CreateAuditScopeResult> {
    const client = await this.#database.client.findUnique({
      include: { websites: { take: 1 } },
      where: { id: clientId },
    });
    const website = client?.websites[0];
    if (client === null || website === undefined) {
      return scopeError("not-found", "Client website could not be found.");
    }

    const selectedPages = await this.#database.websitePage.findMany({
      orderBy: { normalizedUrl: "asc" },
      where: { selectionState: "included", websiteId: website.id },
    });
    if (selectedPages.length === 0) {
      return scopeError(
        "no-selection",
        "Select at least one available page before creating a scope.",
      );
    }
    if (selectedPages.length > 100) {
      return scopeError("too-many-pages", "An audit scope can contain at most 100 pages.");
    }
    if (selectedPages.some((page) => page.availability !== "available")) {
      return scopeError(
        "ineligible-selection",
        "The selection contains unavailable or no-longer-observed pages. Review it and try again.",
      );
    }

    const scope = createCrawlScope(website.normalizedUrl);
    for (const page of selectedPages) {
      const decision = evaluateCrawlCandidate(page.normalizedUrl, website.normalizedUrl, scope);
      if (!decision.accepted || decision.url !== page.normalizedUrl) {
        return scopeError(
          "out-of-scope",
          "The selection contains a page outside the current website scope.",
        );
      }
    }

    const parsedConfiguration = auditScopeConfigurationSchema.parse(configuration);
    const record = await this.#database.$transaction(async (transaction) => {
      const created = await transaction.auditScope.create({
        data: {
          clientBusinessName: client.businessName,
          clientId,
          configurationJson: JSON.stringify(parsedConfiguration),
          normalizedDomain: website.normalizedDomain,
          pages: {
            create: selectedPages.map((page) => ({
              normalizedUrl: page.normalizedUrl,
              pageId: page.id,
              pageType: page.pageType,
            })),
          },
          reportFormatsJson: JSON.stringify(reportFormats),
          requestedBy: "local-user",
          selectedPageCount: selectedPages.length,
          targetUrl: website.normalizedUrl,
          websiteId: website.id,
        },
        include: { pages: true },
      });
      await transaction.clientActivity.create({
        data: {
          clientId,
          kind: "audit-scope-created",
          summary: `Audit scope locked with ${String(selectedPages.length)} pages`,
        },
      });
      return created;
    });

    return createAuditScopeResultSchema.parse({ ok: true, scope: toAuditScope(record) });
  }

  async get(id: string): Promise<AuditScopeRecord | null> {
    const scope = await this.#database.auditScope.findUnique({
      include: { pages: { orderBy: { normalizedUrl: "asc" } } },
      where: { id },
    });
    return scope === null ? null : toAuditScope(scope);
  }

  async getSummary(websiteId: string) {
    const [available, eligible, excluded, notObserved, selected, unavailable] = await Promise.all([
      this.#database.websitePage.count({ where: { availability: "available", websiteId } }),
      this.#database.websitePage.count({
        where: {
          availability: "available",
          recommendationState: { not: "excluded" },
          websiteId,
        },
      }),
      this.#database.websitePage.count({ where: { selectionState: "excluded", websiteId } }),
      this.#database.websitePage.count({ where: { availability: "not-observed", websiteId } }),
      this.#database.websitePage.count({ where: { selectionState: "included", websiteId } }),
      this.#database.websitePage.count({ where: { availability: "unavailable", websiteId } }),
    ]);
    return websitePageSummarySchema.parse({
      available,
      eligible,
      excluded,
      notObserved,
      selected,
      unavailable,
    });
  }
}

function toAuditScope(scope: ScopeWithPages): AuditScopeRecord {
  return auditScopeRecordSchema.parse({
    clientBusinessName: scope.clientBusinessName,
    clientId: scope.clientId,
    configuration: JSON.parse(scope.configurationJson) as unknown,
    createdAt: scope.createdAt.toISOString(),
    id: scope.id,
    normalizedDomain: scope.normalizedDomain,
    pages: scope.pages.map((page) => ({
      normalizedUrl: page.normalizedUrl,
      pageId: page.pageId,
      pageType: page.pageType,
    })),
    reportFormats: JSON.parse(scope.reportFormatsJson) as unknown,
    requestedBy: scope.requestedBy,
    selectedPageCount: scope.selectedPageCount,
    targetUrl: scope.targetUrl,
    websiteId: scope.websiteId,
  });
}

function selectionError(
  code: "not-found" | "invalid-pages" | "ineligible-pages",
  message: string,
): PageSelectionResult {
  return pageSelectionResultSchema.parse({ error: { code, message }, ok: false });
}

function scopeError(
  code: "not-found" | "no-selection" | "too-many-pages" | "ineligible-selection" | "out-of-scope",
  message: string,
): CreateAuditScopeResult {
  return createAuditScopeResultSchema.parse({ error: { code, message }, ok: false });
}

function selectionActivitySummary(action: PageSelectionAction, count: number): string {
  if (action === "clear") return "Page selection cleared";
  if (action === "include-recommended") return "Recommended pages selected";
  const verb = action === "include" ? "Included" : action === "exclude" ? "Excluded" : "Reset";
  return `${verb} ${String(count)} website ${count === 1 ? "page" : "pages"}`;
}
