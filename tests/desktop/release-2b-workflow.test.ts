import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CLIENT_SCHEMA_STATEMENTS } from "../../src/desktop/main/client-migrations.js";
import { PROSPECT_SCHEMA_STATEMENTS } from "../../src/desktop/main/prospect-migrations.js";
import {
  DiscoveryCampaignRepository,
  ProspectRepository,
} from "../../src/desktop/main/prospect-repository.js";
import type { ProspectSourceInput } from "../../src/desktop/shared/contracts.js";

let database: PrismaClient;
let directory: string;
let campaigns: DiscoveryCampaignRepository;
let prospects: ProspectRepository;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "audit-tool-release-2b-"));
  process.env.DATABASE_URL = `file:${path.join(directory, "workspace.db").replaceAll("\\", "/")}`;
  database = new PrismaClient();
  await database.$connect();
  await database.$executeRawUnsafe("PRAGMA foreign_keys = ON");
  for (const statement of [...CLIENT_SCHEMA_STATEMENTS, ...PROSPECT_SCHEMA_STATEMENTS]) {
    await database.$executeRawUnsafe(statement);
  }
  campaigns = new DiscoveryCampaignRepository(database);
  prospects = new ProspectRepository(database);
});

afterEach(async () => {
  await database.$disconnect();
  await rm(directory, { force: true, recursive: true });
});

describe("Release 2B workflow acceptance", () => {
  it("moves an approved provider record from campaign to client only after explicit promotion", async () => {
    const campaignId = await campaigns.create({
      category: "Accountant",
      country: "PK",
      exclusionRules: [],
      keywords: ["accounting firm"],
      locality: "Karachi",
      maxResults: 25,
      name: "Karachi accountants",
      provider: "playwright-web-search",
      providerTermsVersion: "reviewed-2026-07-26",
      requireWebsite: false,
      requiredFields: ["businessName"],
    });
    const imported = await prospects.importFromSource(sourceInput(campaignId, 1));
    if (imported.status !== "created") throw new Error("Expected a created prospect");

    expect(await database.client.count()).toBe(0);
    expect(imported.prospect.sourceRecords[0]).toMatchObject({
      permittedFields: ["businessName", "websiteUrl", "publicPhone", "addressLine"],
      provider: "playwright-web-search",
      providerRecordId: "rendered-business-1",
      retentionPolicy: "Public business fields retained for qualification for 30 days.",
    });
    await expect(prospects.importFromSource(sourceInput(campaignId, 1))).resolves.toMatchObject({
      status: "existing",
    });
    expect(await database.client.count()).toBe(0);

    await prospects.updateQualification(imported.prospect.id, {
      confidence: 85,
      duplicateReviewState: "confirmed-distinct",
      notes: "Public business record reviewed.",
      owner: "Release reviewer",
      tags: ["Qualified"],
    });
    await prospects.setState(imported.prospect.id, "qualified");
    expect(await database.client.count()).toBe(0);

    const promoted = await prospects.promote(imported.prospect.id);
    expect(promoted).toMatchObject({
      nextAction: "discover-pages",
      ok: true,
      prospect: { state: "promoted" },
    });
    expect(await database.client.count()).toBe(1);
    expect(
      await database.prospect.findUniqueOrThrow({
        include: { sourceRecords: true },
        where: { id: imported.prospect.id },
      }),
    ).toMatchObject({
      promotedClientId: promoted.ok ? promoted.clientId : undefined,
      sourceRecords: [{ providerRecordId: "rendered-business-1" }],
      state: "promoted",
    });
  });

  it("preserves suppression and recovers interrupted campaigns without creating clients", async () => {
    const campaignId = await campaigns.create({
      country: "PK",
      exclusionRules: [],
      keywords: ["tailor"],
      locality: "Karachi",
      maxResults: 10,
      name: "Karachi tailors",
      provider: "playwright-web-search",
      providerTermsVersion: "reviewed-2026-07-26",
      requireWebsite: false,
      requiredFields: ["businessName"],
    });
    await campaigns.queue(campaignId);
    await campaigns.start(campaignId);
    await expect(campaigns.markInterrupted()).resolves.toBe(1);
    const recoveredCampaign = await campaigns.get(campaignId);
    expect(recoveredCampaign?.state).toBe("paused");
    expect(recoveredCampaign?.warningMessage).toContain("interrupted");

    const imported = await prospects.importFromSource(sourceInput(campaignId, 2));
    if (imported.status !== "created") throw new Error("Expected a created prospect");
    await prospects.suppress(imported.prospect.id, "Release compliance fixture", true);
    await expect(prospects.importFromSource(sourceInput(campaignId, 2))).resolves.toMatchObject({
      status: "suppressed",
    });
    expect(await database.client.count()).toBe(0);
  });

  it("keeps large prospect collections paginated, stable, and database filtered", async () => {
    const campaignId = await campaigns.create({
      country: "PK",
      exclusionRules: [],
      keywords: ["business"],
      locality: "Karachi",
      maxResults: 100,
      name: "Pagination acceptance",
      provider: "playwright-web-search",
      providerTermsVersion: "reviewed-2026-07-26",
      requireWebsite: false,
      requiredFields: ["businessName"],
    });
    for (let index = 1; index <= 120; index += 1) {
      await prospects.importFromSource(sourceInput(campaignId, index));
    }

    const firstPage = await prospects.list({
      confidenceAtLeast: 0,
      direction: "asc",
      owner: "",
      page: 1,
      pageSize: 25,
      search: "release business",
      sort: "businessName",
      state: "all",
      websiteAvailability: "all",
    });
    const fifthPage = await prospects.list({
      confidenceAtLeast: 0,
      direction: "asc",
      owner: "",
      page: 5,
      pageSize: 25,
      search: "release business",
      sort: "businessName",
      state: "all",
      websiteAvailability: "all",
    });

    expect(firstPage).toMatchObject({ page: 1, pageSize: 25, total: 120 });
    expect(firstPage.items).toHaveLength(25);
    expect(fifthPage.items).toHaveLength(20);
    expect(new Set([...firstPage.items, ...fifthPage.items].map((item) => item.id)).size).toBe(45);
  });
});

function sourceInput(campaignId: string, index: number): ProspectSourceInput {
  return {
    addressLine: `${String(index)} Release Street, Karachi`,
    businessName: `Release Business ${String(index).padStart(3, "0")}`,
    campaignId,
    collectedAt: "2026-07-31T10:00:00.000Z",
    country: "PK",
    fieldProvenance: {
      addressLine: "Visible rendered business detail",
      businessName: "Visible rendered business heading",
      publicPhone: "Visible rendered business contact control",
      websiteUrl: "Visible rendered website control",
    },
    lastVerifiedAt: "2026-07-31T10:00:00.000Z",
    locality: "Karachi",
    permittedFields: ["businessName", "websiteUrl", "publicPhone", "addressLine"],
    provider: "playwright-web-search",
    providerRecordId: `rendered-business-${String(index)}`,
    publicPhone: `+92 21 555 ${String(index).padStart(4, "0")}`,
    retentionDays: 30,
    retentionPolicy: "Public business fields retained for qualification for 30 days.",
    socialProfiles: [],
    sourceUrl: `https://www.google.com/maps/place/release-business-${String(index)}`,
    websiteUrl: `https://release-business-${String(index)}.test/`,
  };
}
