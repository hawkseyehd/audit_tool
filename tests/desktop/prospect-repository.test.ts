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
let prospects: ProspectRepository;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "audit-tool-prospects-"));
  process.env.DATABASE_URL = `file:${path.join(directory, "workspace.db").replaceAll("\\", "/")}`;
  database = new PrismaClient();
  await database.$connect();
  await database.$executeRawUnsafe("PRAGMA foreign_keys = ON");
  for (const statement of [...CLIENT_SCHEMA_STATEMENTS, ...PROSPECT_SCHEMA_STATEMENTS]) {
    await database.$executeRawUnsafe(statement);
  }
  prospects = new ProspectRepository(database);
});

afterEach(async () => {
  await database.$disconnect();
  await rm(directory, { force: true, recursive: true });
});

describe("ProspectRepository", () => {
  it("stores campaign criteria, provenance, qualification, and paginated filters", async () => {
    const campaigns = new DiscoveryCampaignRepository(database);
    const campaignId = await campaigns.create({
      category: "Dentist",
      country: "Pakistan",
      exclusionRules: ["Existing clients"],
      keywords: ["dental clinic"],
      locality: "Karachi",
      maxResults: 75,
      name: "Karachi dentists",
      provider: "approved-fixture",
      providerTermsVersion: "2026-07",
      requireWebsite: true,
      requiredFields: ["websiteUrl"],
    });
    const campaign = await database.discoveryCampaign.findUniqueOrThrow({
      where: { id: campaignId },
    });
    expect(campaign.keywordsJson).toBe('["dental clinic"]');
    expect(campaign.maxResults).toBe(75);

    const imported = await prospects.importFromSource(sourceInput({ campaignId }));
    expect(imported.status).toBe("created");
    if (imported.status !== "created") throw new Error("Expected a created prospect");
    expect(imported.prospect).toMatchObject({
      businessName: "Northstar Dental",
      normalizedDomain: "northstar.test",
      sourceProvider: "approved-fixture",
      sourceRecordCount: 1,
      state: "new",
    });

    await expect(
      prospects.updateQualification(imported.prospect.id, {
        confidence: 82,
        duplicateReviewState: "confirmed-distinct",
        notes: "Good geographic fit",
        owner: "Aisha",
        tags: ["Priority", "Healthcare"],
      }),
    ).resolves.toMatchObject({
      ok: true,
      prospect: {
        confidence: 82,
        owner: "Aisha",
        tags: ["Healthcare", "Priority"],
      },
    });
    await expect(
      prospects.importFromSource(
        sourceInput({
          businessName: "Provider Renamed Business",
          campaignId,
          lastVerifiedAt: "2026-07-26T10:00:00.000Z",
        }),
      ),
    ).resolves.toMatchObject({
      prospect: {
        businessName: "Northstar Dental",
        lastVerifiedAt: "2026-07-26T10:00:00.000Z",
        owner: "Aisha",
      },
      status: "existing",
    });
    await expect(prospects.setState(imported.prospect.id, "reviewing")).resolves.toMatchObject({
      ok: true,
      prospect: { state: "reviewing" },
    });
    await expect(prospects.setState(imported.prospect.id, "promoted")).resolves.toMatchObject({
      error: { code: "invalid-transition" },
      ok: false,
    });
    await expect(
      prospects.list({
        confidenceAtLeast: 80,
        direction: "desc",
        owner: "Aisha",
        page: 1,
        pageSize: 25,
        search: "northstar",
        sort: "confidence",
        state: "reviewing",
        websiteAvailability: "unknown",
      }),
    ).resolves.toMatchObject({
      items: [{ businessName: "Northstar Dental", confidence: 82 }],
      total: 1,
    });
  });

  it("keeps durable suppression after deletion and blocks later imports", async () => {
    const imported = await prospects.importFromSource(sourceInput());
    if (imported.status !== "created") throw new Error("Expected a created prospect");

    const suppressed = await prospects.suppress(
      imported.prospect.id,
      "Business requested removal",
      true,
    );
    expect(suppressed).toMatchObject({
      ok: true,
      prospect: { state: "suppressed" },
    });
    if (suppressed.ok) expect(typeof suppressed.prospect.doNotContactAt).toBe("string");
    await expect(prospects.delete(imported.prospect.id, "wrong")).resolves.toMatchObject({
      error: { code: "confirmation-mismatch" },
      ok: false,
    });
    await expect(
      prospects.delete(imported.prospect.id, imported.prospect.businessName),
    ).resolves.toEqual({ ok: true });
    expect(await database.suppressionRecord.count()).toBe(2);

    await expect(prospects.importFromSource(sourceInput())).resolves.toEqual({
      matchType: "domain",
      status: "suppressed",
    });
    expect(await database.prospect.count()).toBe(0);
  });

  it("applies source retention without deleting promoted provenance", async () => {
    const expired = await prospects.importFromSource(
      sourceInput({
        collectedAt: "2025-01-01T00:00:00.000Z",
        providerRecordId: "expired",
        websiteUrl: "https://expired.test/",
      }),
    );
    const promoted = await prospects.importFromSource(
      sourceInput({
        collectedAt: "2025-01-01T00:00:00.000Z",
        providerRecordId: "promoted",
        websiteUrl: "https://promoted.test/",
      }),
    );
    if (expired.status !== "created" || promoted.status !== "created") {
      throw new Error("Expected created prospects");
    }
    await database.prospect.update({
      data: { state: "promoted" },
      where: { id: promoted.prospect.id },
    });

    await expect(prospects.deleteExpired(new Date("2025-01-03T00:00:00.000Z"))).resolves.toBe(1);
    await expect(prospects.get(expired.prospect.id)).resolves.toBeNull();
    await expect(prospects.get(promoted.prospect.id)).resolves.toMatchObject({
      state: "promoted",
    });
  });
});

function sourceInput(overrides: Partial<ProspectSourceInput> = {}): ProspectSourceInput {
  return {
    businessName: "Northstar Dental",
    collectedAt: "2026-07-25T10:00:00.000Z",
    country: "Pakistan",
    fieldProvenance: {
      businessName: "provider record",
      websiteUrl: "provider record",
    },
    lastVerifiedAt: "2026-07-25T10:00:00.000Z",
    locality: "Karachi",
    permittedFields: ["businessName", "websiteUrl", "country", "locality"],
    provider: "approved-fixture",
    providerRecordId: "northstar-1",
    retentionDays: 1,
    retentionPolicy: "Fixture provider permits storage for one day.",
    socialProfiles: [],
    websiteUrl: "https://northstar.test/",
    ...overrides,
  };
}
