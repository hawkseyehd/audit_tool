import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AuditScopeRepository } from "../../src/desktop/main/audit-scope-repository.js";
import { CLIENT_SCHEMA_STATEMENTS } from "../../src/desktop/main/client-migrations.js";
import { ClientRepository } from "../../src/desktop/main/client-repository.js";
import { PAGE_SCHEMA_STATEMENTS } from "../../src/desktop/main/page-migrations.js";
import { SCOPE_SCHEMA_STATEMENTS } from "../../src/desktop/main/scope-migrations.js";
import type {
  AuditScopeConfiguration,
  AuditScopeReportFormat,
} from "../../src/desktop/shared/contracts.js";

let clientId: string;
let clientRepository: ClientRepository;
let database: PrismaClient;
let directory: string;
let homePageId: string;
let scopeRepository: AuditScopeRepository;
let unavailablePageId: string;
let websiteId: string;

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

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "audit-tool-scopes-"));
  process.env.DATABASE_URL = `file:${path.join(directory, "workspace.db").replaceAll("\\", "/")}`;
  database = new PrismaClient();
  await database.$connect();
  await database.$executeRawUnsafe("PRAGMA foreign_keys = ON");
  for (const statement of [
    ...CLIENT_SCHEMA_STATEMENTS,
    ...PAGE_SCHEMA_STATEMENTS,
    ...SCOPE_SCHEMA_STATEMENTS,
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
  const observedAt = new Date("2026-07-23T13:00:00.000Z");
  const home = await database.websitePage.create({
    data: {
      availability: "available",
      changeState: "new",
      firstDiscoveredAt: observedAt,
      lastChangedAt: observedAt,
      lastObservedAt: observedAt,
      normalizedUrl: "https://northstar.test/",
      observedUrl: "https://northstar.test/",
      pageType: "home",
      recommendationReason: "Representative customer-facing page recommended for review.",
      recommendationState: "recommended",
      statusCode: 200,
      title: "Northstar Dental",
      websiteId: website.id,
    },
  });
  await database.websitePage.create({
    data: {
      availability: "available",
      changeState: "new",
      firstDiscoveredAt: observedAt,
      lastChangedAt: observedAt,
      lastObservedAt: observedAt,
      normalizedUrl: "https://northstar.test/login",
      observedUrl: "https://northstar.test/login",
      pageType: "auth",
      recommendationReason: "Account pages require explicit review before auditing.",
      recommendationState: "excluded",
      statusCode: 200,
      title: "Sign in",
      websiteId: website.id,
    },
  });
  const unavailable = await database.websitePage.create({
    data: {
      availability: "unavailable",
      changeState: "unavailable",
      failureMessage: "Request failed",
      firstDiscoveredAt: observedAt,
      lastChangedAt: observedAt,
      lastObservedAt: observedAt,
      normalizedUrl: "https://northstar.test/contact",
      observedUrl: "https://northstar.test/contact",
      pageType: "contact",
      recommendationReason: "Representative customer-facing page recommended for review.",
      recommendationState: "recommended",
      title: "Contact",
      websiteId: website.id,
    },
  });
  clientId = client.id;
  websiteId = website.id;
  homePageId = home.id;
  unavailablePageId = unavailable.id;
  scopeRepository = new AuditScopeRepository(database);
  clientRepository = new ClientRepository(database);
});

afterEach(async () => {
  await database.$disconnect();
  await rm(directory, { force: true, recursive: true });
});

describe("page selection and immutable audit scopes", () => {
  it("selects recommended pages while preserving explicit exclusions", async () => {
    await scopeRepository.applySelection(clientId, "exclude", [homePageId]);
    const result = await scopeRepository.applySelection(clientId, "include-recommended", []);

    expect(result).toMatchObject({
      ok: true,
      summary: { eligible: 1, excluded: 1, selected: 0 },
    });
    await scopeRepository.applySelection(clientId, "reset", [homePageId]);
    const selected = await scopeRepository.applySelection(clientId, "include-recommended", []);
    expect(selected).toMatchObject({ ok: true, summary: { selected: 1 } });
  });

  it("refuses foreign and unavailable pages but allows explicit low-value overrides", async () => {
    await expect(
      scopeRepository.applySelection(clientId, "include", [unavailablePageId]),
    ).resolves.toMatchObject({ error: { code: "ineligible-pages" }, ok: false });
    await expect(
      scopeRepository.applySelection(clientId, "include", [randomUUID()]),
    ).resolves.toMatchObject({ error: { code: "invalid-pages" }, ok: false });

    const auth = await database.websitePage.findFirstOrThrow({ where: { pageType: "auth" } });
    await expect(
      scopeRepository.applySelection(clientId, "include", [auth.id]),
    ).resolves.toMatchObject({ ok: true, summary: { selected: 1 } });
  });

  it("keeps a scope immutable after inventory and client changes", async () => {
    await scopeRepository.applySelection(clientId, "include", [homePageId]);
    const created = await scopeRepository.createScope(clientId, configuration, reportFormats);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const snapshot = created.scope;

    await database.websitePage.deleteMany({ where: { websiteId } });
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

    await expect(scopeRepository.get(snapshot.id)).resolves.toEqual(snapshot);
    await expect(clientRepository.delete(clientId, "Renamed Practice")).resolves.toMatchObject({
      error: { code: "retained-history" },
      ok: false,
    });
  });

  it("rejects stale or out-of-scope selections before snapshot creation", async () => {
    await scopeRepository.applySelection(clientId, "include", [homePageId]);
    await database.websitePage.update({
      data: { availability: "not-observed" },
      where: { id: homePageId },
    });
    await expect(
      scopeRepository.createScope(clientId, configuration, reportFormats),
    ).resolves.toMatchObject({ error: { code: "ineligible-selection" }, ok: false });

    await database.websitePage.update({
      data: { availability: "available", normalizedUrl: "https://external.test/" },
      where: { id: homePageId },
    });
    await expect(
      scopeRepository.createScope(clientId, configuration, reportFormats),
    ).resolves.toMatchObject({ error: { code: "out-of-scope" }, ok: false });
  });
});
