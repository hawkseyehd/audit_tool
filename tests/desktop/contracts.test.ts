import { describe, expect, it } from "vitest";

import {
  applyPageSelectionRequestSchema,
  clientInputSchema,
  clientListQuerySchema,
  createAuditScopeRequestSchema,
  desktopBootstrapSchema,
  discoverWebsitePagesRequestSchema,
  websitePageListQuerySchema,
} from "../../src/desktop/shared/contracts.js";
import { workerRequestSchema } from "../../src/desktop/shared/worker-contracts.js";

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
});
