import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DesktopDatabaseService } from "../../src/desktop/main/database-service.js";
import type { ClientInput } from "../../src/desktop/shared/contracts.js";

let database: DesktopDatabaseService;
let directory: string;

const clientInput: ClientInput = {
  businessName: "Northstar Dental",
  category: "Dental clinic",
  notes: "Priority account",
  owner: "Aisha",
  publicEmail: "hello@northstar.test",
  tags: ["Healthcare", "Priority", "healthcare"],
  websiteUrl: "https://www.northstar.test/",
};

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "audit-tool-clients-"));
  database = new DesktopDatabaseService(directory);
  await database.initialize();
});

afterEach(async () => {
  await database.close();
  await rm(directory, { force: true, recursive: true });
});

describe("client persistence", () => {
  it("creates a normalized client with deduplicated tags and activity", async () => {
    const result = await database.createClient(clientInput);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.client.normalizedDomain).toBe("northstar.test");
    expect(result.client.tags).toEqual(["Healthcare", "Priority"]);
    expect(result.client.activities[0]?.kind).toBe("created");
    await expect(database.getWorkspaceSummary()).resolves.toMatchObject({ clients: 1 });
  });

  it("returns the existing client for an equivalent duplicate domain", async () => {
    const created = await database.createClient(clientInput);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const duplicate = await database.createClient({
      ...clientInput,
      businessName: "Duplicate",
      websiteUrl: "northstar.test/contact",
    });
    expect(duplicate).toMatchObject({
      error: { clientId: created.client.id, code: "duplicate-domain" },
      ok: false,
    });
  });

  it("searches, filters, updates, and archives clients", async () => {
    const first = await database.createClient(clientInput);
    const second = await database.createClient({
      businessName: "Blue Harbor Legal",
      tags: [],
      websiteUrl: "blueharbor.test",
    });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    const searchResult = await database.listClients({
      direction: "asc",
      page: 1,
      pageSize: 10,
      search: "northstar",
      sort: "name",
      status: "active",
    });
    expect(searchResult.items.map((client) => client.id)).toEqual([first.client.id]);

    const updated = await database.updateClient(first.client.id, {
      ...clientInput,
      businessName: "Northstar Dental Studio",
      tags: ["Retained"],
    });
    expect(updated).toMatchObject({
      client: { businessName: "Northstar Dental Studio", tags: ["Retained"] },
      ok: true,
    });

    const archived = await database.setClientStatus(first.client.id, "archived");
    expect(archived).toMatchObject({ client: { status: "archived" }, ok: true });
    const active = await database.listClients({
      direction: "desc",
      page: 1,
      pageSize: 10,
      search: "",
      sort: "updatedAt",
      status: "active",
    });
    expect(active.items.map((client) => client.id)).toEqual([second.client.id]);
  });

  it("requires exact business-name confirmation before deletion", async () => {
    const created = await database.createClient(clientInput);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await expect(database.deleteClient(created.client.id, "Northstar")).resolves.toMatchObject({
      error: { code: "confirmation-mismatch" },
      ok: false,
    });
    await expect(
      database.deleteClient(created.client.id, clientInput.businessName),
    ).resolves.toEqual({ ok: true });
    await expect(database.getClient(created.client.id)).resolves.toBeNull();
  });
});
