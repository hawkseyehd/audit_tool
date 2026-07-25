import { setTimeout as delay } from "node:timers/promises";

import type { Logger } from "pino";

import type { ProviderBusinessRecord } from "../../discovery/provider-contracts.js";
import {
  discoveryCampaignMutationResultSchema,
  discoveryProviderSchema,
  type DiscoveryCampaignInput,
  type DiscoveryCampaignMutationResult,
  type DiscoveryProvider,
  type ProspectSourceInput,
} from "../shared/contracts.js";
import type { DesktopDatabaseService } from "./database-service.js";
import { WorkerUnavailableError, type WorkerCoordinator } from "./worker-coordinator.js";

const PROVIDER = "dataforseo-business-listings";
const TERMS_VERSION = "reviewed-2026-07-25";
const MAX_PROVIDER_CALLS = 5;
const PROVIDER_PAGE_LIMIT = 1_000;
const INTER_PAGE_DELAY_MS = 500;
const RETENTION_DAYS = 30;

export class DiscoveryCampaignManager {
  readonly #database: DesktopDatabaseService;
  readonly #logger: Logger;
  readonly #worker: WorkerCoordinator;
  #active:
    | {
        campaignId: string;
        promise: Promise<void>;
      }
    | undefined;
  readonly #cancelRequested = new Set<string>();

  constructor(options: {
    database: DesktopDatabaseService;
    logger: Logger;
    worker: WorkerCoordinator;
  }) {
    this.#database = options.database;
    this.#logger = options.logger;
    this.#worker = options.worker;
  }

  provider(): DiscoveryProvider {
    return discoveryProviderSchema.parse({
      configured: providerConfigured(),
      credentialEnvironmentVariables: ["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"],
      id: PROVIDER,
      label: "DataForSEO Business Listings",
      maxResults: 5_000,
      paidOperation: true,
      supportsRadius: true,
      termsVersion: TERMS_VERSION,
    });
  }

  async create(input: DiscoveryCampaignInput): Promise<DiscoveryCampaignMutationResult> {
    const unavailable = this.#preflight();
    if (unavailable !== null) return unavailable;
    const id = await this.#database.campaigns.create(input);
    await this.#database.campaigns.queue(id);
    const campaign = await this.#database.campaigns.get(id);
    if (campaign === null) return mutationError("not-found", "Campaign could not be created");
    this.#launch(id);
    return discoveryCampaignMutationResultSchema.parse({ campaign, ok: true });
  }

  async resume(id: string): Promise<DiscoveryCampaignMutationResult> {
    const unavailable = this.#preflight();
    if (unavailable !== null) return unavailable;
    const existing = await this.#database.campaigns.get(id);
    if (existing === null) return mutationError("not-found", "Campaign was not found");
    if (!["cancelled", "failed", "paused"].includes(existing.state)) {
      return mutationError("invalid-state", `A ${existing.state} campaign cannot be resumed`);
    }
    if (!(await this.#database.campaigns.queue(id))) {
      return mutationError("invalid-state", "Campaign state changed before it could be resumed");
    }
    const campaign = await this.#database.campaigns.get(id);
    if (campaign === null) return mutationError("not-found", "Campaign was not found");
    this.#launch(id);
    return discoveryCampaignMutationResultSchema.parse({ campaign, ok: true });
  }

  async cancel(id: string): Promise<DiscoveryCampaignMutationResult> {
    const campaign = await this.#database.campaigns.get(id);
    if (campaign === null) return mutationError("not-found", "Campaign was not found");
    if (campaign.state !== "queued" && campaign.state !== "running") {
      return mutationError("invalid-state", `A ${campaign.state} campaign cannot be cancelled`);
    }
    this.#cancelRequested.add(id);
    this.#worker.cancelDiscovery(id);
    await this.#database.campaigns.cancel(id);
    const cancelled = await this.#database.campaigns.get(id);
    if (cancelled === null) return mutationError("not-found", "Campaign was not found");
    return discoveryCampaignMutationResultSchema.parse({ campaign: cancelled, ok: true });
  }

  async stop(): Promise<void> {
    const active = this.#active;
    if (active === undefined) return;
    this.#cancelRequested.add(active.campaignId);
    this.#worker.cancelDiscovery(active.campaignId);
    await active.promise.catch(() => undefined);
  }

  #preflight(): DiscoveryCampaignMutationResult | null {
    if (!providerConfigured()) {
      return mutationError(
        "not-configured",
        "Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD before running a paid campaign.",
      );
    }
    if (!this.#worker.ready) {
      return mutationError("worker-unavailable", "The desktop worker is unavailable");
    }
    if (this.#active !== undefined) {
      return mutationError("already-running", "Another discovery campaign is already running");
    }
    return null;
  }

  #launch(campaignId: string): void {
    const promise = this.#execute(campaignId).finally(() => {
      this.#cancelRequested.delete(campaignId);
      if (this.#active?.campaignId === campaignId) this.#active = undefined;
    });
    this.#active = { campaignId, promise };
    void promise.catch((error: unknown) => {
      this.#logger.error(
        { campaignId, error: safeMessage(error) },
        "Discovery campaign execution failed",
      );
    });
  }

  async #execute(campaignId: string): Promise<void> {
    try {
      await this.#database.campaigns.start(campaignId);
      let campaign = await this.#database.campaigns.getExecution(campaignId);
      if (campaign === null) throw new Error("Campaign was not found");

      while (
        campaign.processedCount < campaign.maxResults &&
        campaign.providerRequestCount < MAX_PROVIDER_CALLS
      ) {
        if (this.#cancelRequested.has(campaignId)) return;
        const remaining = campaign.maxResults - campaign.processedCount;
        const outcome = await this.#worker.runDiscoveryPage({
          campaignId,
          input: {
            ...(campaign.category === null ? {} : { category: campaign.category }),
            ...(campaign.continuationToken === null
              ? {}
              : { continuationToken: campaign.continuationToken }),
            country: campaign.country.toUpperCase(),
            exclusions: campaign.exclusionRules,
            keywords: campaign.keywords,
            ...(campaign.latitude === null ? {} : { latitude: campaign.latitude }),
            limit: Math.min(PROVIDER_PAGE_LIMIT, remaining),
            ...(campaign.locality === null ? {} : { locality: campaign.locality }),
            ...(campaign.longitude === null ? {} : { longitude: campaign.longitude }),
            ...(campaign.radiusKm === null ? {} : { radiusKm: campaign.radiusKm }),
            ...(campaign.region === null ? {} : { region: campaign.region }),
            requireWebsite: campaign.requireWebsite,
          },
        });
        if (outcome.type === "discovery-cancelled" || this.#cancelRequested.has(campaignId)) {
          await this.#database.campaigns.cancel(campaignId);
          return;
        }
        if (outcome.type === "discovery-failed") {
          await this.#database.campaigns.fail(campaignId, outcome.message);
          return;
        }

        const counts = await this.#importPage(
          campaignId,
          outcome.page.records,
          campaign.requiredFields,
        );
        const warnings = [
          outcome.page.warning,
          counts.skippedRequired > 0
            ? `${String(counts.skippedRequired)} records did not contain all required fields.`
            : undefined,
        ].filter((value): value is string => value !== undefined);
        await this.#database.campaigns.recordPage(campaignId, {
          continuationToken: outcome.page.continuationToken,
          importedCount: counts.imported,
          processedCount: outcome.page.records.length,
          providerRequestCount: outcome.page.providerRequestCount,
          suppressedCount: counts.suppressed,
          ...(warnings.length === 0 ? {} : { warning: warnings.join(" ") }),
        });
        campaign = await this.#database.campaigns.getExecution(campaignId);
        if (campaign === null) throw new Error("Campaign was not found after provider progress");
        if (outcome.page.continuationToken === null || outcome.page.records.length === 0) break;
        await delay(INTER_PAGE_DELAY_MS);
      }

      if (this.#cancelRequested.has(campaignId)) return;
      const limited =
        campaign.providerRequestCount >= MAX_PROVIDER_CALLS && campaign.hasContinuation;
      await this.#database.campaigns.complete(
        campaignId,
        limited
          ? "Campaign reached the five-request safety limit. Create a narrower campaign for more results."
          : undefined,
      );
    } catch (error) {
      if (this.#cancelRequested.has(campaignId)) {
        await this.#database.campaigns.cancel(campaignId);
        return;
      }
      const message =
        error instanceof WorkerUnavailableError
          ? "The desktop worker is busy or unavailable. Resume this campaign when it is ready."
          : safeMessage(error);
      await this.#database.campaigns.fail(campaignId, message);
      throw error;
    }
  }

  async #importPage(
    campaignId: string,
    records: readonly ProviderBusinessRecord[],
    requiredFields: readonly string[],
  ): Promise<{ imported: number; skippedRequired: number; suppressed: number }> {
    let imported = 0;
    let skippedRequired = 0;
    let suppressed = 0;
    const collectedAt = new Date().toISOString();
    for (const record of records) {
      if (this.#cancelRequested.has(campaignId)) break;
      if (!hasRequiredFields(record, requiredFields)) {
        skippedRequired += 1;
        continue;
      }
      const result = await this.#database.prospects.importFromSource(
        toSourceInput(campaignId, collectedAt, record),
      );
      if (result.status === "suppressed") suppressed += 1;
      else imported += 1;
    }
    return { imported, skippedRequired, suppressed };
  }
}

function toSourceInput(
  campaignId: string,
  collectedAt: string,
  record: ProviderBusinessRecord,
): ProspectSourceInput {
  const permittedFields = Object.entries(record)
    .filter(([, value]) => value !== undefined)
    .map(([field]) => field)
    .filter((field) => field !== "providerRecordId");
  return {
    ...(record.addressLine === undefined ? {} : { addressLine: record.addressLine }),
    businessName: record.businessName,
    campaignId,
    ...(record.category === undefined ? {} : { category: record.category }),
    collectedAt,
    ...(record.country === undefined ? {} : { country: record.country }),
    fieldProvenance: Object.fromEntries(
      permittedFields.map((field) => [field, "DataForSEO Business Listings Search Live"]),
    ),
    ...(record.locality === undefined ? {} : { locality: record.locality }),
    permittedFields,
    ...(record.postalCode === undefined ? {} : { postalCode: record.postalCode }),
    provider: PROVIDER,
    providerRecordId: record.providerRecordId,
    ...(record.publicPhone === undefined ? {} : { publicPhone: record.publicPhone }),
    ...(record.region === undefined ? {} : { region: record.region }),
    retentionDays: RETENTION_DAYS,
    retentionPolicy: "DataForSEO approved public business fields; retain for 30 days",
    socialProfiles: [],
    ...(record.sourceUpdatedAt === undefined ? {} : { sourceUpdatedAt: record.sourceUpdatedAt }),
    ...(record.sourceUrl === undefined ? {} : { sourceUrl: record.sourceUrl }),
    ...(record.websiteUrl === undefined ? {} : { websiteUrl: record.websiteUrl }),
  };
}

function hasRequiredFields(
  record: ProviderBusinessRecord,
  requiredFields: readonly string[],
): boolean {
  return requiredFields.every((field) => {
    const value =
      field === "businessName"
        ? record.businessName
        : field === "websiteUrl"
          ? record.websiteUrl
          : field === "publicPhone"
            ? record.publicPhone
            : field === "addressLine"
              ? record.addressLine
              : undefined;
    return value !== undefined && value.length > 0;
  });
}

function providerConfigured(): boolean {
  return (
    (process.env.DATAFORSEO_LOGIN?.trim().length ?? 0) > 0 &&
    (process.env.DATAFORSEO_PASSWORD?.trim().length ?? 0) > 0
  );
}

function mutationError(
  code: "already-running" | "invalid-state" | "not-configured" | "not-found" | "worker-unavailable",
  message: string,
): DiscoveryCampaignMutationResult {
  return discoveryCampaignMutationResultSchema.parse({ error: { code, message }, ok: false });
}

function safeMessage(error: unknown): string {
  return (error instanceof Error ? error.message : "Discovery campaign failed")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 1_000);
}
