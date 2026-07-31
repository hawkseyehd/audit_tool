import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import pino from "pino";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DesktopDatabaseService } from "../../src/desktop/main/database-service.js";
import { DiscoveryCampaignManager } from "../../src/desktop/main/discovery-campaign-manager.js";
import type { WorkerCoordinator } from "../../src/desktop/main/worker-coordinator.js";
import type { CampaignInput, DiscoveryCampaignInput } from "../../src/desktop/shared/contracts.js";

const campaignInput: DiscoveryCampaignInput = {
  category: "dental_clinic",
  country: "PK",
  exclusionRules: [],
  keywords: [],
  locality: "Karachi",
  maxResults: 25,
  name: "Karachi dental practices",
  provider: "playwright-web-search",
  providerTermsVersion: "reviewed-2026-07-26",
  requireWebsite: false,
  requiredFields: ["businessName"],
};

let database: DesktopDatabaseService;
let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "audit-tool-campaign-"));
  database = new DesktopDatabaseService(directory);
  await database.initialize();
});

afterEach(async () => {
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
          {
            addressLine: "14 Civic Centre",
            businessName: "Civic Dental Studio",
            category: "Dental clinic",
            country: "PK",
            locality: "Karachi",
            providerRecordId: "maps-civic-dental",
            publicEmail: "hello@civicdental.example",
            publicPhone: "+92 300 555 0101",
            socialProfiles: ["https://www.linkedin.com/company/civic-dental-studio/"],
            sourceUrl: "https://www.google.com/maps/place/Civic+Dental+Studio",
          },
        ],
        totalAvailable: 2,
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
      processedCount: 2,
      providerRequestCount: 1,
      resultCount: 2,
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
    expect(prospects.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          businessName: "Northstar Dental",
          campaignId: created.campaign.id,
          websiteUrl: "https://northstar.example/",
        }),
        expect.objectContaining({
          businessName: "Civic Dental Studio",
          publicEmail: "hello@civicdental.example",
          publicPhone: "+92 300 555 0101",
          socialProfiles: ["https://www.linkedin.com/company/civic-dental-studio/"],
          sourceProvider: "playwright-web-search",
          websiteUrl: null,
        }),
      ]),
    );
    expect(runDiscoveryPage).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "playwright-web-search" }),
    );
    await manager.stop();
  });

  it("runs browser campaigns without provider credentials", async () => {
    const runDiscoveryPage = vi.fn().mockResolvedValue({
      campaignId: "unused",
      id: "unused",
      page: {
        continuationToken: null,
        providerRequestCount: 2,
        records: [],
        totalAvailable: 0,
      },
      type: "discovery-page-completed",
    });
    const manager = new DiscoveryCampaignManager({
      database,
      logger: pino({ enabled: false }),
      worker: { ready: true, runDiscoveryPage } as unknown as WorkerCoordinator,
    });

    const result = await manager.create(campaignInput);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected campaign creation");
    await expect
      .poll(async () => (await database.campaigns.get(result.campaign.id))?.state)
      .toBe("completed");
  });

  it("does not resume legacy API campaigns", async () => {
    const legacyInput: CampaignInput = {
      ...campaignInput,
      provider: "dataforseo-business-listings",
      providerTermsVersion: "reviewed-2026-07-25",
    };
    const id = await database.campaigns.create(legacyInput);
    await database.campaigns.queue(id);
    await database.campaigns.cancel(id);
    const manager = new DiscoveryCampaignManager({
      database,
      logger: pino({ enabled: false }),
      worker: { ready: true } as WorkerCoordinator,
    });

    await expect(manager.resume(id)).resolves.toMatchObject({
      error: { code: "invalid-state" },
      ok: false,
    });
  });
});
