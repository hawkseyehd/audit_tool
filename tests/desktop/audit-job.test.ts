import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  AuditJobRepository,
  AuditJobTransitionError,
} from "../../src/desktop/main/audit-job-repository.js";
import { CLIENT_SCHEMA_STATEMENTS } from "../../src/desktop/main/client-migrations.js";
import { JOB_SCHEMA_STATEMENTS } from "../../src/desktop/main/job-migrations.js";
import { PAGE_SCHEMA_STATEMENTS } from "../../src/desktop/main/page-migrations.js";
import { SCOPE_SCHEMA_STATEMENTS } from "../../src/desktop/main/scope-migrations.js";
import type {
  AuditScopeConfiguration,
  AuditScopeReportFormat,
} from "../../src/desktop/shared/contracts.js";

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
const reportFormats: AuditScopeReportFormat[] = ["client-summary-pdf", "pdf", "json"];

let clientId: string;
let database: PrismaClient;
let directory: string;
let jobs: AuditJobRepository;
let scopeId: string;
let websiteId: string;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "audit-tool-jobs-"));
  process.env.DATABASE_URL = `file:${path.join(directory, "workspace.db").replaceAll("\\", "/")}`;
  database = new PrismaClient();
  await database.$connect();
  await database.$executeRawUnsafe("PRAGMA foreign_keys = ON");
  for (const statement of [
    ...CLIENT_SCHEMA_STATEMENTS,
    ...PAGE_SCHEMA_STATEMENTS,
    ...SCOPE_SCHEMA_STATEMENTS,
    ...JOB_SCHEMA_STATEMENTS,
  ]) {
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
  const scope = await database.auditScope.create({
    data: {
      clientBusinessName: client.businessName,
      clientId: client.id,
      configurationJson: JSON.stringify(configuration),
      normalizedDomain: website.normalizedDomain,
      pages: {
        create: [
          {
            normalizedUrl: "https://northstar.test/",
            pageId: randomUUID(),
            pageType: "home",
          },
          {
            normalizedUrl: "https://northstar.test/contact",
            pageId: randomUUID(),
            pageType: "contact",
          },
        ],
      },
      reportFormatsJson: JSON.stringify(reportFormats),
      requestedBy: "local-user",
      selectedPageCount: 2,
      targetUrl: website.normalizedUrl,
      websiteId: website.id,
    },
  });
  clientId = client.id;
  websiteId = website.id;
  scopeId = scope.id;
  jobs = new AuditJobRepository(database);
});

afterEach(async () => {
  await database.$disconnect();
  await rm(directory, { force: true, recursive: true });
});

describe("AuditJobRepository", () => {
  it("creates one idempotent job per immutable scope", async () => {
    const first = await jobs.createForScope(scopeId);
    const second = await jobs.createForScope(scopeId);

    expect(first).toMatchObject({
      job: {
        clientBusinessName: "Northstar Dental",
        pagesCompleted: 0,
        pagesTotal: 2,
        state: "queued",
      },
      ok: true,
    });
    expect(second).toEqual(first);
    await expect(database.auditJob.count()).resolves.toBe(1);
    await expect(
      database.clientActivity.count({ where: { kind: "audit-job-created" } }),
    ).resolves.toBe(1);
  });

  it("executes only the exact URLs and settings captured by the scope", async () => {
    const created = await jobs.createForScope(scopeId);
    if (!created.ok) throw new Error("Expected audit job creation to succeed");

    await database.client.update({
      data: { businessName: "Renamed Practice" },
      where: { id: clientId },
    });
    await database.website.update({
      data: {
        normalizedDomain: "renamed.test",
        normalizedUrl: "https://renamed.test/",
        url: "https://renamed.test/",
      },
      where: { id: websiteId },
    });

    await expect(jobs.getExecution(created.job.id)).resolves.toEqual({
      configuration,
      jobId: created.job.id,
      normalizedDomain: "northstar.test",
      pageUrls: ["https://northstar.test/", "https://northstar.test/contact"],
      reportFormats,
      targetUrl: "https://northstar.test/",
    });
  });

  it("persists progress, cancellation, and a clean retry attempt", async () => {
    const created = await jobs.createForScope(scopeId);
    if (!created.ok) throw new Error("Expected audit job creation to succeed");

    await jobs.markStarted(created.job.id);
    const running = await jobs.updateProgress(created.job.id, "scanning", 1, 1, [
      " One scoped page could not be fetched. ",
    ]);
    expect(running).toMatchObject({
      failedPageCount: 1,
      pagesCompleted: 1,
      state: "scanning",
      warningCount: 1,
      warnings: ["One scoped page could not be fetched."],
    });

    const requested = await jobs.requestCancellation(created.job.id);
    expect(requested).toMatchObject({
      job: { cancelAvailable: false, state: "scanning" },
      ok: true,
    });
    const cancelled = await jobs.markCancelled(created.job.id);
    expect(cancelled).toMatchObject({ cancelAvailable: false, state: "cancelled" });

    const retried = await jobs.retry(created.job.id);
    expect(retried).toMatchObject({
      job: {
        attempt: 2,
        cancelRequestedAt: null,
        failedPageCount: 0,
        pagesCompleted: 0,
        state: "queued",
      },
      ok: true,
    });
  });

  it("recovers interrupted work into the durable queue with a warning", async () => {
    const created = await jobs.createForScope(scopeId);
    if (!created.ok) throw new Error("Expected audit job creation to succeed");
    await jobs.markStarted(created.job.id);
    await jobs.updateProgress(created.job.id, "scanning", 1, 0, []);

    await expect(jobs.recoverInterrupted()).resolves.toBe(1);
    await expect(jobs.get(created.job.id)).resolves.toMatchObject({
      attempt: 2,
      pagesCompleted: 0,
      state: "queued",
      warningCount: 1,
      warnings: ["Audit resumed after the desktop application was interrupted."],
    });
    await expect(jobs.listQueuedIds()).resolves.toEqual([created.job.id]);
  });

  it("rejects invalid state transitions and terminal mutations", async () => {
    const created = await jobs.createForScope(scopeId);
    if (!created.ok) throw new Error("Expected audit job creation to succeed");

    await expect(jobs.updateProgress(created.job.id, "scanning", 0, 0, [])).rejects.toBeInstanceOf(
      AuditJobTransitionError,
    );
    await jobs.requestCancellation(created.job.id);
    await expect(jobs.retry(created.job.id)).resolves.toMatchObject({
      job: { attempt: 2, state: "queued" },
      ok: true,
    });
    await expect(jobs.retry(created.job.id)).resolves.toMatchObject({
      error: { code: "not-retryable" },
      ok: false,
    });
  });
});
