import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { auditResultSchema } from "../../src/core/schemas.js";
import { CRAWL_SCHEMA_VERSION } from "../../src/crawler/schemas.js";
import type { CrawlResult } from "../../src/crawler/types.js";
import { AuditHistoryRepository } from "../../src/desktop/main/audit-history-repository.js";
import { AuditJobRepository } from "../../src/desktop/main/audit-job-repository.js";
import { AuditScopeRepository } from "../../src/desktop/main/audit-scope-repository.js";
import { CLIENT_SCHEMA_STATEMENTS } from "../../src/desktop/main/client-migrations.js";
import { ClientRepository } from "../../src/desktop/main/client-repository.js";
import { HISTORY_SCHEMA_STATEMENTS } from "../../src/desktop/main/history-migrations.js";
import { JOB_SCHEMA_STATEMENTS } from "../../src/desktop/main/job-migrations.js";
import {
  PageDiscoveryService,
  type DiscoveryCrawler,
} from "../../src/desktop/main/page-discovery-service.js";
import { PageInventoryRepository } from "../../src/desktop/main/page-inventory-repository.js";
import { PAGE_SCHEMA_STATEMENTS } from "../../src/desktop/main/page-migrations.js";
import { ReportArtifactService } from "../../src/desktop/main/report-artifact-service.js";
import { SCOPE_SCHEMA_STATEMENTS } from "../../src/desktop/main/scope-migrations.js";
import type { AuditScopeConfiguration } from "../../src/desktop/shared/contracts.js";

const configuration: AuditScopeConfiguration = {
  includeAccessibility: true,
  includeAnalytics: true,
  includeForms: true,
  includeLighthouse: true,
  includeSecurity: true,
  includeSeo: true,
  includeUxHeuristics: true,
  submitForms: false,
  viewports: ["desktop", "mobile"],
};

let database: PrismaClient;
let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "audit-tool-release-2a-"));
  process.env.DATABASE_URL = `file:${path.join(directory, "workspace.db").replaceAll("\\", "/")}`;
  database = new PrismaClient();
  await database.$connect();
  await database.$executeRawUnsafe("PRAGMA foreign_keys = ON");
  for (const statement of [
    ...CLIENT_SCHEMA_STATEMENTS,
    ...PAGE_SCHEMA_STATEMENTS,
    ...SCOPE_SCHEMA_STATEMENTS,
    ...JOB_SCHEMA_STATEMENTS,
    ...HISTORY_SCHEMA_STATEMENTS,
  ]) {
    await database.$executeRawUnsafe(statement);
  }
});

afterEach(async () => {
  await database.$disconnect();
  await rm(directory, { force: true, recursive: true });
  vi.restoreAllMocks();
});

describe("Release 2A client-to-report workflow", () => {
  it("preserves immutable history through rediscovery and exports by artifact ID", async () => {
    const clients = new ClientRepository(database);
    const created = await clients.create({
      businessName: "Northstar Dental",
      category: "Dental clinic",
      tags: ["Priority"],
      websiteUrl: "https://northstar.test/",
    });
    if (!created.ok) throw new Error(created.error.message);

    const inventory = new PageInventoryRepository(database);
    const crawler = vi
      .fn<DiscoveryCrawler>()
      .mockResolvedValueOnce(
        crawlResult(
          [
            {
              pageType: "home",
              statusCode: 200,
              title: "Northstar Dental",
              url: "https://northstar.test/",
            },
            {
              pageType: "contact",
              statusCode: 200,
              title: "Contact",
              url: "https://northstar.test/contact",
            },
          ],
          "2026-07-24T10:00:00.000Z",
          "2026-07-24T10:01:00.000Z",
        ),
      )
      .mockResolvedValueOnce(
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
              title: "Treatments",
              url: "https://northstar.test/treatments",
            },
          ],
          "2026-07-24T11:00:00.000Z",
          "2026-07-24T11:01:00.000Z",
        ),
      );
    const discovery = new PageDiscoveryService(inventory, crawler);
    await expect(discovery.discover(created.client.id, 25)).resolves.toMatchObject({
      ok: true,
      run: { observedPageCount: 2, status: "completed" },
    });

    const scopes = new AuditScopeRepository(database);
    await expect(
      scopes.applySelection(created.client.id, "include-recommended", []),
    ).resolves.toMatchObject({ ok: true, summary: { selected: 2 } });
    const scopeResult = await scopes.createScope(created.client.id, configuration, [
      "client-summary-pdf",
      "json",
    ]);
    if (!scopeResult.ok) throw new Error(scopeResult.error.message);
    const immutableScope = scopeResult.scope;

    await expect(discovery.discover(created.client.id, 25)).resolves.toMatchObject({
      ok: true,
      run: { changedPageCount: 1, newPageCount: 1, noLongerObservedCount: 1 },
    });
    const renamed = await clients.update(created.client.id, {
      businessName: "Northstar Dental Studio",
      category: "Dental clinic",
      tags: ["Priority"],
      websiteUrl: "https://northstar.test/",
    });
    if (!renamed.ok) throw new Error(renamed.error.message);
    await expect(scopes.get(immutableScope.id)).resolves.toEqual(immutableScope);

    const outputRoot = path.join(directory, "audits");
    const reportDirectory = path.join(outputRoot, "release-2a-audit");
    const clientSummaryPath = path.join(reportDirectory, "client-summary.pdf");
    const jsonPath = path.join(reportDirectory, "audit-result.json");
    await mkdir(reportDirectory, { recursive: true });
    await writeFile(clientSummaryPath, "%PDF-1.4\nrelease-2a");
    await writeFile(jsonPath, "{}");

    const jobs = new AuditJobRepository(database, outputRoot);
    const jobResult = await jobs.createForScope(immutableScope.id);
    if (!jobResult.ok) throw new Error(jobResult.error.message);
    await jobs.markStarted(jobResult.job.id);
    await jobs.updateProgress(jobResult.job.id, "scanning", 2, 0, []);
    await jobs.updateProgress(jobResult.job.id, "generating-reports", 2, 0, []);
    const auditResult = auditResultSchema.parse({
      auditId: "release-2a-audit",
      completedAt: "2026-07-24T10:05:00.000Z",
      findings: [],
      normalizedUrl: "https://northstar.test/",
      outputs: {
        clientSummaryPdfReportPath: clientSummaryPath,
        jsonReportPath: jsonPath,
      },
      scannedPages: immutableScope.pages.map((page) => ({
        pageType: page.pageType,
        statusCode: 200,
        url: page.normalizedUrl,
      })),
      schemaVersion: "1.0.0",
      startedAt: "2026-07-24T10:02:00.000Z",
      summary: {
        categoryScores: { performance: 82, seo: 88 },
        findingCounts: { critical: 0, high: 0, info: 0, low: 1, medium: 1 },
        overallScore: 85,
        topPriorities: ["Improve the contact journey"],
      },
      targetUrl: "https://northstar.test/",
    });
    await expect(
      jobs.complete(jobResult.job.id, auditResult, reportDirectory, false, []),
    ).resolves.toMatchObject({
      clientBusinessName: "Northstar Dental",
      pagesCompleted: 2,
      state: "completed",
    });

    const history = new AuditHistoryRepository(database);
    await expect(
      history.listHistory({
        clientId: created.client.id,
        page: 1,
        pageSize: 25,
        resultState: "completed",
        search: "",
        state: "completed",
      }),
    ).resolves.toMatchObject({
      items: [
        {
          job: { clientBusinessName: "Northstar Dental" },
          result: { artifactCount: 2, availableArtifactCount: 2, overallScore: 85 },
        },
      ],
      total: 1,
    });
    const reports = await history.listArtifacts({
      clientId: created.client.id,
      format: "client-summary-pdf",
      page: 1,
      pageSize: 25,
      search: "",
      status: "available",
    });
    expect(reports).toMatchObject({
      items: [{ clientBusinessName: "Northstar Dental", fileName: "client-summary.pdf" }],
      total: 1,
    });

    const exportedPath = path.join(directory, "exported-client-summary.pdf");
    const openPath = vi.fn().mockResolvedValue("");
    const reportService = new ReportArtifactService({
      dataDirectory: directory,
      dialogApi: {
        showSaveDialog: vi.fn().mockResolvedValue({ canceled: false, filePath: exportedPath }),
      },
      history,
      shellApi: { openPath, showItemInFolder: vi.fn() },
    });
    await reportService.initialize();
    const artifactId = reports.items[0]?.id;
    if (artifactId === undefined) throw new Error("Expected the client summary artifact");
    await expect(reportService.open(artifactId)).resolves.toEqual({
      action: "opened",
      ok: true,
    });
    await expect(reportService.export(artifactId, {} as never)).resolves.toEqual({
      action: "exported",
      ok: true,
    });
    expect(openPath).toHaveBeenCalledWith(clientSummaryPath);
    await expect(readFile(exportedPath, "utf8")).resolves.toBe("%PDF-1.4\nrelease-2a");
  });
});

function crawlResult(
  pages: CrawlResult["pages"],
  startedAt: string,
  completedAt: string,
): CrawlResult {
  return {
    completedAt,
    pages,
    rejectionCounts: {},
    schemaVersion: CRAWL_SCHEMA_VERSION,
    startedAt,
    stats: {
      attemptedPages: pages.length,
      discoveredUrls: pages.length,
      failedPages: 0,
      rejectedLinks: 0,
      successfulPages: pages.length,
    },
    targetUrl: "https://northstar.test/",
  };
}
