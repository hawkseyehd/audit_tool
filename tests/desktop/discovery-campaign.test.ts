import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import pino from "pino";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DesktopDatabaseService } from "../../src/desktop/main/database-service.js";
import { DiscoveryCampaignManager } from "../../src/desktop/main/discovery-campaign-manager.js";
import type { WorkerCoordinator } from "../../src/desktop/main/worker-coordinator.js";
import type { DiscoveryCampaignInput } from "../../src/desktop/shared/contracts.js";

const campaignInput: DiscoveryCampaignInput = {
  category: "dental_clinic",
  country: "PK",
  exclusionRules: [],
  keywords: [],
  locality: "Karachi",
  maxResults: 25,
  name: "Karachi dental practices",
  provider: "dataforseo-business-listings",
  providerTermsVersion: "reviewed-2026-07-25",
  requireWebsite: true,
  requiredFields: ["businessName", "websiteUrl"],
};

let database: DesktopDatabaseService;
let directory: string;
const originalLogin = process.env.DATAFORSEO_LOGIN;
const originalPassword = process.env.DATAFORSEO_PASSWORD;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "audit-tool-campaign-"));
  database = new DesktopDatabaseService(directory);
  await database.initialize();
  process.env.DATAFORSEO_LOGIN = "account";
  process.env.DATAFORSEO_PASSWORD = "secret";
});

afterEach(async () => {
  if (originalLogin === undefined) delete process.env.DATAFORSEO_LOGIN;
  else process.env.DATAFORSEO_LOGIN = originalLogin;
  if (originalPassword === undefined) delete process.env.DATAFORSEO_PASSWORD;
  else process.env.DATAFORSEO_PASSWORD = originalPassword;
  await database.close();
  await rm(directory, { force: true, recursive: true });
});

describe("DiscoveryCampaignManager", () => {
  it("runs a durable provider page and imports provenance-aware prospects", async () => {
    const runDiscoveryPage = vi.fn().mockResolvedValue({
      campaignId: "unused",
      id: "unused",
      page: {
        continuationToken: null,
        providerRequestCount: 1,
        records: [
          {
            addressLine: "12 Sea View Road",
            businessName: "Northstar Dental",
            category: "Dental clinic",
            country: "PK",
            locality: "Karachi",
            providerRecordId: "place-1",
            publicPhone: "+92 21 555 0100",
            region: "Sindh",
            sourceUrl: "https://example.test/source/1",
            websiteUrl: "https://northstar.example/",
          },
        ],
        totalAvailable: 1,
      },
      type: "discovery-page-completed",
    });
    const worker = {
      cancelDiscovery: vi.fn(),
      ready: true,
      runDiscoveryPage,
    } as unknown as WorkerCoordinator;
    const manager = new DiscoveryCampaignManager({
      database,
      logger: pino({ enabled: false }),
      worker,
    });

    const created = await manager.create(campaignInput);
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error("Expected campaign creation");
    await expect
      .poll(async () => (await database.campaigns.get(created.campaign.id))?.state)
      .toBe("completed");

    const campaign = await database.campaigns.get(created.campaign.id);
    expect(campaign).toMatchObject({
      processedCount: 1,
      providerRequestCount: 1,
      resultCount: 1,
      state: "completed",
    });
    const prospects = await database.listProspects({
      confidenceAtLeast: 0,
      direction: "desc",
      owner: "",
      page: 1,
      pageSize: 25,
      search: "",
      sort: "updatedAt",
      state: "all",
      websiteAvailability: "all",
    });
    expect(prospects.items[0]).toMatchObject({
      businessName: "Northstar Dental",
      campaignId: created.campaign.id,
      sourceProvider: "dataforseo-business-listings",
    });
    await manager.stop();
  });

  it("refuses paid execution before creating a campaign when credentials are absent", async () => {
    delete process.env.DATAFORSEO_LOGIN;
    delete process.env.DATAFORSEO_PASSWORD;
    const manager = new DiscoveryCampaignManager({
      database,
      logger: pino({ enabled: false }),
      worker: { ready: true } as WorkerCoordinator,
    });

    await expect(manager.create(campaignInput)).resolves.toMatchObject({
      error: { code: "not-configured" },
      ok: false,
    });
    await expect(
      database.campaigns.list({ page: 1, pageSize: 10, state: "all" }),
    ).resolves.toMatchObject({ total: 0 });
  });
});
