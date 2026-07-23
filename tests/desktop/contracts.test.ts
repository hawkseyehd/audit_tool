import { describe, expect, it } from "vitest";

import { parseAuditConfig } from "../../src/config/audit-config.js";
import {
  applyPageSelectionRequestSchema,
  auditJobListQuerySchema,
  clientInputSchema,
  clientListQuerySchema,
  createAuditScopeRequestSchema,
  desktopBootstrapSchema,
  discoverWebsitePagesRequestSchema,
  websitePageListQuerySchema,
} from "../../src/desktop/shared/contracts.js";
import {
  workerRequestSchema,
  workerResponseSchema,
} from "../../src/desktop/shared/worker-contracts.js";

const validBootstrap = {
  app: { name: "Website Audit Tool", platform: "win32", version: "0.1.0" },
  initializedAt: "2026-07-23T10:00:00.000Z",
  services: { database: "ready", worker: "ready" },
  workspace: { audits: 0, clients: 0, prospects: 0, reports: 0 },
};

describe("desktop contracts", () => {
  it("accepts the strict bootstrap contract", () => {
    expect(desktopBootstrapSchema.parse(validBootstrap)).toEqual(validBootstrap);
  });

  it("rejects unexpected bootstrap fields", () => {
    expect(() =>
      desktopBootstrapSchema.parse({ ...validBootstrap, databasePath: "C:/private.db" }),
    ).toThrow();
  });

  it("rejects worker messages without stable identifiers", () => {
    expect(workerRequestSchema.safeParse({ type: "ping" }).success).toBe(false);
  });

  it("normalizes optional client fields and applies bounded list defaults", () => {
    expect(
      clientInputSchema.parse({
        businessName: "Northstar",
        notes: "  ",
        websiteUrl: "northstar.test",
      }),
    ).toMatchObject({ businessName: "Northstar", notes: undefined, tags: [] });
    expect(clientListQuerySchema.parse({})).toEqual({
      direction: "desc",
      page: 1,
      pageSize: 25,
      search: "",
      sort: "updatedAt",
      status: "active",
    });
  });

  it("bounds discovery jobs and applies strict page-inventory defaults", () => {
    const clientId = "953c75a4-6293-4fbc-bfe6-595f68368c1c";
    expect(discoverWebsitePagesRequestSchema.parse({ clientId })).toEqual({
      clientId,
      maxPages: 100,
    });
    expect(discoverWebsitePagesRequestSchema.safeParse({ clientId, maxPages: 101 }).success).toBe(
      false,
    );
    expect(websitePageListQuerySchema.parse({ clientId })).toEqual({
      availability: "all",
      changeState: "all",
      clientId,
      direction: "desc",
      page: 1,
      pageSize: 25,
      pageType: "all",
      search: "",
      selectionState: "all",
      sort: "lastObservedAt",
      status: "all",
    });
  });

  it("validates bounded selection commands and no-submit scope snapshots", () => {
    const clientId = "953c75a4-6293-4fbc-bfe6-595f68368c1c";
    const pageId = "58c4439a-30fd-42b7-b742-28d5b6f66781";
    expect(
      applyPageSelectionRequestSchema.parse({ action: "include", clientId, pageIds: [pageId] }),
    ).toEqual({ action: "include", clientId, pageIds: [pageId] });
    expect(
      applyPageSelectionRequestSchema.safeParse({ action: "include", clientId, pageIds: [] })
        .success,
    ).toBe(false);
    expect(
      applyPageSelectionRequestSchema.safeParse({
        action: "include",
        clientId,
        pageIds: [pageId, pageId],
      }).success,
    ).toBe(false);
    expect(
      createAuditScopeRequestSchema.safeParse({
        clientId,
        configuration: {
          includeAccessibility: true,
          includeAnalytics: true,
          includeForms: true,
          includeLighthouse: true,
          includeSecurity: true,
          includeSeo: true,
          includeUxHeuristics: true,
          submitForms: true,
          viewports: ["desktop"],
        },
        reportFormats: ["pdf"],
      }).success,
    ).toBe(false);
  });

  it("validates bounded audit job queries and exact worker page lists", () => {
    const id = "953c75a4-6293-4fbc-bfe6-595f68368c1c";
    const jobId = "58c4439a-30fd-42b7-b742-28d5b6f66781";
    const config = parseAuditConfig({ maxPages: 2, targetUrl: "example.com" });

    expect(auditJobListQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 25,
      states: [],
    });
    expect(
      workerRequestSchema.safeParse({
        config,
        id,
        jobId,
        pageUrls: ["https://example.com/", "https://example.com/contact"],
        type: "run-audit",
      }).success,
    ).toBe(true);
    expect(
      workerRequestSchema.safeParse({
        config,
        id,
        jobId,
        pageUrls: ["https://example.com/", "https://example.com/"],
        type: "run-audit",
      }).success,
    ).toBe(false);
    expect(
      workerResponseSchema.safeParse({
        failedPageCount: 2,
        id,
        jobId,
        pagesCompleted: 1,
        pagesTotal: 2,
        stage: "scanning",
        type: "audit-progress",
        warnings: [],
      }).success,
    ).toBe(false);
  });
});
