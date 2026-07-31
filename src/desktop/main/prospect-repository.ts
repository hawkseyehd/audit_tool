import { randomUUID } from "node:crypto";

import type { Prisma, PrismaClient } from "@prisma/client";

import { parseAuditConfig } from "../../config/audit-config.js";
import { crawlWebsite } from "../../crawler/crawler.js";
import { normalizeTargetUrl } from "../../url/normalize-url.js";
import {
  campaignInputSchema,
  campaignStateSchema,
  discoveryCampaignListQuerySchema,
  discoveryCampaignListResultSchema,
  discoveryCampaignRecordSchema,
  prospectActionResultSchema,
  prospectImportResultSchema,
  prospectListQuerySchema,
  prospectListResultSchema,
  prospectMutationResultSchema,
  prospectPromotionResultSchema,
  prospectQualificationInputSchema,
  prospectRecordSchema,
  prospectSourceInputSchema,
  prospectStateSchema,
  type CampaignInput,
  type DiscoveryCampaignListQuery,
  type DiscoveryCampaignListResult,
  type DiscoveryCampaignRecord,
  type ProspectActionResult,
  type ProspectImportResult,
  type ProspectListQuery,
  type ProspectListResult,
  type ProspectMutationResult,
  type ProspectPromotionResult,
  type ProspectQualificationInput,
  type ProspectRecord,
  type ProspectSourceInput,
  type ProspectState,
} from "../shared/contracts.js";

const detailInclude = {
  _count: { select: { sourceRecords: true } },
  activities: { orderBy: { createdAt: "desc" }, take: 100 },
  sourceRecords: { orderBy: { collectedAt: "desc" }, take: 100 },
  tags: { include: { tag: true } },
} satisfies Prisma.ProspectInclude;

const listInclude = {
  _count: { select: { sourceRecords: true } },
  sourceRecords: { orderBy: { collectedAt: "asc" }, take: 1 },
  tags: { include: { tag: true } },
} satisfies Prisma.ProspectInclude;

type DetailProspect = Prisma.ProspectGetPayload<{ include: typeof detailInclude }>;
type ListProspect = Prisma.ProspectGetPayload<{ include: typeof listInclude }>;

const allowedTransitions: Readonly<Record<ProspectState, readonly ProspectState[]>> = {
  new: ["reviewing", "qualified", "not-qualified", "suppressed"],
  reviewing: ["new", "qualified", "not-qualified", "suppressed"],
  qualified: ["reviewing", "not-qualified", "suppressed"],
  "not-qualified": ["reviewing", "qualified", "suppressed"],
  promoted: [],
  suppressed: [],
};

export class DiscoveryCampaignRepository {
  readonly #database: PrismaClient;

  constructor(database: PrismaClient) {
    this.#database = database;
  }

  async create(inputValue: CampaignInput): Promise<string> {
    const input = campaignInputSchema.parse(inputValue);
    const campaign = await this.#database.discoveryCampaign.create({
      data: {
        category: input.category ?? null,
        country: input.country,
        exclusionRulesJson: JSON.stringify(input.exclusionRules),
        id: randomUUID(),
        keywordsJson: JSON.stringify(input.keywords),
        latitude: input.latitude ?? null,
        locality: input.locality ?? null,
        longitude: input.longitude ?? null,
        maxResults: input.maxResults,
        name: input.name,
        provider: input.provider,
        providerTermsVersion: input.providerTermsVersion,
        radiusKm: input.radiusKm ?? null,
        region: input.region ?? null,
        requireWebsite: input.requireWebsite,
        requiredFieldsJson: JSON.stringify(input.requiredFields),
      },
      select: { id: true },
    });
    return campaign.id;
  }

  async get(id: string): Promise<DiscoveryCampaignRecord | null> {
    const campaign = await this.#database.discoveryCampaign.findUnique({ where: { id } });
    return campaign === null ? null : toCampaignRecord(campaign);
  }

  async getExecution(id: string): Promise<CampaignExecutionRecord | null> {
    const campaign = await this.#database.discoveryCampaign.findUnique({ where: { id } });
    if (campaign === null) return null;
    return {
      ...toCampaignRecord(campaign),
      continuationToken: parseContinuation(campaign.continuationDataJson),
    };
  }

  async list(queryValue: DiscoveryCampaignListQuery): Promise<DiscoveryCampaignListResult> {
    const query = discoveryCampaignListQuerySchema.parse(queryValue);
    const where: Prisma.DiscoveryCampaignWhereInput =
      query.state === "all" ? {} : { state: query.state };
    const [total, campaigns] = await this.#database.$transaction([
      this.#database.discoveryCampaign.count({ where }),
      this.#database.discoveryCampaign.findMany({
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        where,
      }),
    ]);
    return discoveryCampaignListResultSchema.parse({
      items: campaigns.map(toCampaignRecord),
      page: query.page,
      pageSize: query.pageSize,
      total,
    });
  }

  async markInterrupted(): Promise<number> {
    const result = await this.#database.discoveryCampaign.updateMany({
      data: {
        state: "paused",
        warningMessage: "Campaign was interrupted when the application closed. Resume to continue.",
      },
      where: { state: { in: ["queued", "running"] } },
    });
    return result.count;
  }

  async queue(id: string): Promise<boolean> {
    const result = await this.#database.discoveryCampaign.updateMany({
      data: {
        completedAt: null,
        failureMessage: null,
        state: "queued",
        warningMessage: null,
      },
      where: { id, state: { in: ["draft", "paused", "failed", "cancelled"] } },
    });
    return result.count === 1;
  }

  async start(id: string): Promise<void> {
    await this.#database.discoveryCampaign.update({
      data: {
        failureMessage: null,
        startedAt: new Date(),
        state: "running",
      },
      where: { id },
    });
  }

  async recordPage(
    id: string,
    progress: {
      continuationToken: string | null;
      importedCount: number;
      processedCount: number;
      providerRequestCount: number;
      suppressedCount: number;
      warning?: string;
    },
  ): Promise<void> {
    await this.#database.discoveryCampaign.update({
      data: {
        continuationDataJson:
          progress.continuationToken === null
            ? null
            : JSON.stringify({ offsetToken: progress.continuationToken }),
        processedCount: { increment: progress.processedCount },
        providerRequestCount: { increment: progress.providerRequestCount },
        resultCount: { increment: progress.importedCount },
        suppressedCount: { increment: progress.suppressedCount },
        ...(progress.warning === undefined ? {} : { warningMessage: progress.warning }),
      },
      where: { id },
    });
  }

  async complete(id: string, warning?: string): Promise<void> {
    await this.#database.discoveryCampaign.update({
      data: {
        completedAt: new Date(),
        continuationDataJson: null,
        failureMessage: null,
        state: "completed",
        ...(warning === undefined ? {} : { warningMessage: warning }),
      },
      where: { id },
    });
  }

  async fail(id: string, message: string): Promise<void> {
    await this.#database.discoveryCampaign.update({
      data: {
        completedAt: new Date(),
        failureMessage: message.slice(0, 1_000),
        state: "failed",
      },
      where: { id },
    });
  }

  async cancel(id: string): Promise<void> {
    await this.#database.discoveryCampaign.update({
      data: { completedAt: new Date(), state: "cancelled" },
      where: { id },
    });
  }
}

export interface CampaignExecutionRecord extends DiscoveryCampaignRecord {
  continuationToken: string | null;
}

export class ProspectRepository {
  readonly #database: PrismaClient;

  constructor(database: PrismaClient) {
    this.#database = database;
  }

  count(): Promise<number> {
    return this.#database.prospect.count();
  }

  async list(queryValue: ProspectListQuery): Promise<ProspectListResult> {
    const query = prospectListQuerySchema.parse(queryValue);
    const where: Prisma.ProspectWhereInput = {
      confidence: { gte: query.confidenceAtLeast },
      ...(query.owner.length > 0 ? { owner: { contains: query.owner } } : {}),
      ...(query.search.length > 0
        ? { searchText: { contains: query.search.toLocaleLowerCase("en-US") } }
        : {}),
      ...(query.state === "all" ? {} : { state: query.state }),
      ...(query.websiteAvailability === "all"
        ? {}
        : { websiteAvailability: query.websiteAvailability }),
    };
    const orderBy: Prisma.ProspectOrderByWithRelationInput =
      query.sort === "businessName"
        ? { businessName: query.direction }
        : query.sort === "confidence"
          ? { confidence: query.direction }
          : query.sort === "lastVerifiedAt"
            ? { lastVerifiedAt: query.direction }
            : { updatedAt: query.direction };
    const [total, prospects] = await this.#database.$transaction([
      this.#database.prospect.count({ where }),
      this.#database.prospect.findMany({
        include: listInclude,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        where,
      }),
    ]);
    return prospectListResultSchema.parse({
      items: prospects.map(toListRecord),
      page: query.page,
      pageSize: query.pageSize,
      total,
    });
  }

  async get(id: string): Promise<ProspectRecord | null> {
    const prospect = await this.#database.prospect.findUnique({
      include: detailInclude,
      where: { id },
    });
    if (prospect === null) return null;
    return toRecord(prospect, await this.#duplicateCandidates(prospect));
  }

  async #duplicateCandidates(prospect: DetailProspect): Promise<DuplicateCandidate[]> {
    const phone = normalizePhone(prospect.publicPhone);
    const prospects = await this.#database.prospect.findMany({
      select: {
        addressLine: true,
        businessName: true,
        id: true,
        normalizedDomain: true,
        publicPhone: true,
      },
      take: 250,
      where: { id: { not: prospect.id } },
    });
    const clients = await this.#database.client.findMany({
      include: { websites: { select: { normalizedDomain: true }, take: 1 } },
      take: 250,
    });
    return [
      ...prospects.flatMap((candidate) =>
        candidateMatch(prospect, phone, {
          ...candidate,
          domain: candidate.normalizedDomain,
          kind: "prospect" as const,
        }),
      ),
      ...clients.flatMap((candidate) =>
        candidateMatch(prospect, phone, {
          addressLine: candidate.addressLine,
          businessName: candidate.businessName,
          domain: candidate.websites[0]?.normalizedDomain ?? null,
          id: candidate.id,
          kind: "client" as const,
          publicPhone: candidate.publicPhone,
        }),
      ),
    ].slice(0, 25);
  }

  async importFromSource(inputValue: ProspectSourceInput): Promise<ProspectImportResult> {
    const input = prospectSourceInputSchema.parse(inputValue);
    const collectedAt = new Date(input.collectedAt);
    const retainedUntil = new Date(
      collectedAt.getTime() + input.retentionDays * 24 * 60 * 60 * 1_000,
    );
    const website = normalizeOptionalWebsite(input.websiteUrl);
    const sourceMatchKey = sourceKey(input.provider, input.providerRecordId);
    const suppressionKeys = [
      sourceMatchKey,
      ...(website === null ? [] : [domainKey(website.domain)]),
    ];
    const suppression = await this.#database.suppressionRecord.findFirst({
      where: {
        matchKey: { in: suppressionKeys },
        OR: [{ expiresAt: null }, { expiresAt: { gt: collectedAt } }],
      },
    });
    if (suppression !== null) {
      await this.#database.suppressionRecord.update({
        data: { lastMatchedAt: collectedAt },
        where: { id: suppression.id },
      });
      return prospectImportResultSchema.parse({
        matchType: suppression.matchType,
        status: "suppressed",
      });
    }

    const existingSource = await this.#database.discoverySourceRecord.findUnique({
      where: {
        provider_providerRecordId: {
          provider: input.provider,
          providerRecordId: input.providerRecordId,
        },
      },
    });
    if (existingSource !== null) {
      await this.#database.$transaction(async (database) => {
        await database.discoverySourceRecord.update({
          data: {
            collectedAt,
            fieldProvenanceJson: JSON.stringify(input.fieldProvenance),
            lastVerifiedAt:
              input.lastVerifiedAt === undefined ? null : new Date(input.lastVerifiedAt),
            permittedFieldsJson: JSON.stringify(input.permittedFields),
            retainedUntil,
            retentionPolicy: input.retentionPolicy,
            sourceUpdatedAt:
              input.sourceUpdatedAt === undefined ? null : new Date(input.sourceUpdatedAt),
            sourceUrl: input.sourceUrl ?? null,
          },
          where: { id: existingSource.id },
        });
        const retention = await database.discoverySourceRecord.aggregate({
          _max: { retainedUntil: true },
          where: { prospectId: existingSource.prospectId },
        });
        await database.prospect.update({
          data: {
            ...(input.lastVerifiedAt === undefined
              ? {}
              : { lastVerifiedAt: new Date(input.lastVerifiedAt) }),
            retainedUntil: retention._max.retainedUntil,
            ...(input.sourceUpdatedAt === undefined
              ? {}
              : { sourceUpdatedAt: new Date(input.sourceUpdatedAt) }),
          },
          where: { id: existingSource.prospectId },
        });
        await database.prospectActivity.create({
          data: {
            id: randomUUID(),
            kind: "source-refreshed",
            prospectId: existingSource.prospectId,
            summary: `Source record refreshed from ${input.provider}`,
          },
        });
      });
      const existing = await this.get(existingSource.prospectId);
      if (existing === null) throw new Error("Existing source prospect could not be loaded");
      return prospectImportResultSchema.parse({ prospect: existing, status: "existing" });
    }

    const prospectId = randomUUID();
    await this.#database.$transaction(async (database) => {
      await database.prospect.create({
        data: {
          addressLine: input.addressLine ?? null,
          businessName: input.businessName,
          campaignId: input.campaignId ?? null,
          category: input.category ?? null,
          country: input.country ?? null,
          firstDiscoveredAt: collectedAt,
          id: prospectId,
          lastVerifiedAt:
            input.lastVerifiedAt === undefined ? null : new Date(input.lastVerifiedAt),
          locality: input.locality ?? null,
          normalizedDomain: website?.domain ?? null,
          normalizedWebsiteUrl: website?.url ?? null,
          postalCode: input.postalCode ?? null,
          publicEmail: input.publicEmail ?? null,
          publicPhone: input.publicPhone ?? null,
          region: input.region ?? null,
          retainedUntil,
          searchText: buildSearchText(input, website?.domain),
          serviceArea: input.serviceArea ?? null,
          socialProfilesJson: JSON.stringify(input.socialProfiles),
          sourceUpdatedAt:
            input.sourceUpdatedAt === undefined ? null : new Date(input.sourceUpdatedAt),
          websiteUrl: input.websiteUrl ?? null,
        },
      });
      await database.discoverySourceRecord.create({
        data: {
          campaignId: input.campaignId ?? null,
          collectedAt,
          fieldProvenanceJson: JSON.stringify(input.fieldProvenance),
          id: randomUUID(),
          lastVerifiedAt:
            input.lastVerifiedAt === undefined ? null : new Date(input.lastVerifiedAt),
          permittedFieldsJson: JSON.stringify(input.permittedFields),
          prospectId,
          provider: input.provider,
          providerRecordId: input.providerRecordId,
          retainedUntil,
          retentionPolicy: input.retentionPolicy,
          sourceUpdatedAt:
            input.sourceUpdatedAt === undefined ? null : new Date(input.sourceUpdatedAt),
          sourceUrl: input.sourceUrl ?? null,
        },
      });
      await database.prospectActivity.create({
        data: {
          id: randomUUID(),
          kind: "imported",
          prospectId,
          summary: `Prospect imported from ${input.provider}`,
        },
      });
    });
    const prospect = await this.get(prospectId);
    if (prospect === null) throw new Error("Imported prospect could not be loaded");
    return prospectImportResultSchema.parse({ prospect, status: "created" });
  }

  async updateQualification(
    id: string,
    inputValue: ProspectQualificationInput,
  ): Promise<ProspectMutationResult> {
    const input = prospectQualificationInputSchema.parse(inputValue);
    const existing = await this.#database.prospect.findUnique({ where: { id } });
    if (existing === null) return mutationError("not-found", "Prospect was not found");
    await this.#database.$transaction(async (database) => {
      await database.prospect.update({
        data: {
          confidence: input.confidence,
          duplicateReviewState: input.duplicateReviewState,
          notes: input.notes ?? null,
          owner: input.owner ?? null,
          searchText: appendQualificationSearch(existing.searchText, input),
        },
        where: { id },
      });
      await replaceTags(database, id, input.tags);
      await database.prospectActivity.create({
        data: {
          id: randomUUID(),
          kind: "qualification",
          prospectId: id,
          summary: "Qualification details updated",
        },
      });
    });
    return this.#success(id);
  }

  async verify(id: string): Promise<ProspectMutationResult> {
    const prospect = await this.#database.prospect.findUnique({ where: { id } });
    if (prospect === null) return mutationError("not-found", "Prospect was not found");
    const verifiedAt = new Date();
    if (prospect.normalizedWebsiteUrl === null) {
      await this.#database.$transaction([
        this.#database.prospect.update({
          data: {
            lastVerifiedAt: verifiedAt,
            verificationMessage: "No website was listed in the imported public record.",
            verificationState: "partial",
            websiteAvailability: "unavailable",
          },
          where: { id },
        }),
        this.#database.prospectActivity.create({
          data: {
            id: randomUUID(),
            kind: "verification",
            prospectId: id,
            summary: "Public record verified without a listed website",
          },
        }),
        this.#database.discoverySourceRecord.updateMany({
          data: { lastVerifiedAt: verifiedAt },
          where: { prospectId: id },
        }),
      ]);
      return this.#success(id);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error("Prospect verification exceeded its two-minute safety limit"));
    }, 120_000);
    try {
      const result = await crawlWebsite({
        config: parseAuditConfig({
          includeAccessibility: false,
          includeAnalytics: false,
          includeForms: false,
          includeLighthouse: false,
          includeSecurity: false,
          includeSeo: false,
          includeUxHeuristics: false,
          maxPages: 10,
          submitForms: false,
          targetUrl: prospect.normalizedWebsiteUrl,
          viewports: ["desktop"],
          writeClientSummaryPdf: false,
          writeHtml: false,
          writeJson: false,
          writeMarkdown: false,
          writePdf: false,
          writePdfSummary: false,
        }),
        signal: controller.signal,
      });
      const homepage = result.pages[0];
      const successfulPages = result.pages.filter((page) => page.error === undefined);
      await this.#database.$transaction([
        this.#database.prospect.update({
          data: {
            discoveredPageCount: successfulPages.length,
            homepageTitle: homepage?.title ?? null,
            lastVerifiedAt: verifiedAt,
            verificationMessage:
              successfulPages.length === 0 ? "The listed website could not be reached." : null,
            verificationState: successfulPages.length === 0 ? "failed" : "verified",
            verifiedWebsiteUrl: homepage?.url ?? prospect.normalizedWebsiteUrl,
            websiteAvailability: successfulPages.length === 0 ? "unavailable" : "available",
          },
          where: { id },
        }),
        this.#database.prospectActivity.create({
          data: {
            id: randomUUID(),
            kind: "verification",
            prospectId: id,
            summary: `Website verification observed ${String(successfulPages.length)} page${successfulPages.length === 1 ? "" : "s"}`,
          },
        }),
        this.#database.discoverySourceRecord.updateMany({
          data: { lastVerifiedAt: verifiedAt },
          where: { prospectId: id },
        }),
      ]);
      return await this.#success(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Website verification failed";
      await this.#database.$transaction([
        this.#database.prospect.update({
          data: {
            lastVerifiedAt: verifiedAt,
            verificationMessage: message.slice(0, 500),
            verificationState: "failed",
            websiteAvailability: "unavailable",
          },
          where: { id },
        }),
        this.#database.discoverySourceRecord.updateMany({
          data: { lastVerifiedAt: verifiedAt },
          where: { prospectId: id },
        }),
      ]);
      return await this.#success(id);
    } finally {
      clearTimeout(timeout);
    }
  }

  async promote(id: string, existingClientId?: string): Promise<ProspectPromotionResult> {
    const prospect = await this.#database.prospect.findUnique({
      include: { tags: { include: { tag: true } } },
      where: { id },
    });
    if (prospect === null) return promotionError("not-found", "Prospect was not found");
    if (prospect.promotedClientId !== null) {
      return promotionError(
        "already-promoted",
        "This prospect is already linked to a client.",
        prospect.promotedClientId,
      );
    }
    if (prospect.state !== "qualified") {
      return promotionError("invalid-state", "Only qualified prospects can be promoted.");
    }

    const domainClient =
      prospect.normalizedDomain === null
        ? null
        : await this.#database.website.findUnique({
            select: { clientId: true },
            where: { normalizedDomain: prospect.normalizedDomain },
          });
    if (domainClient !== null && existingClientId !== domainClient.clientId) {
      return promotionError(
        "duplicate-domain",
        "A client already uses this website. Review and link that client explicitly.",
        domainClient.clientId,
      );
    }
    if (existingClientId !== undefined) {
      const existing = await this.#database.client.findUnique({ where: { id: existingClientId } });
      if (existing === null)
        return promotionError("not-found", "The selected client was not found.");
    }

    const clientId = existingClientId ?? randomUUID();
    await this.#database.$transaction(async (database) => {
      if (existingClientId === undefined) {
        await database.client.create({
          data: {
            addressLine: prospect.addressLine,
            businessName: prospect.businessName,
            category: prospect.category,
            country: prospect.country,
            id: clientId,
            locality: prospect.locality,
            notes: prospect.notes,
            owner: prospect.owner,
            postalCode: prospect.postalCode,
            publicEmail: prospect.publicEmail,
            publicPhone: prospect.publicPhone,
            region: prospect.region,
            searchText: prospect.searchText,
            ...(prospect.normalizedWebsiteUrl === null || prospect.normalizedDomain === null
              ? {}
              : {
                  websites: {
                    create: {
                      id: randomUUID(),
                      normalizedDomain: prospect.normalizedDomain,
                      normalizedUrl: prospect.normalizedWebsiteUrl,
                      url: prospect.websiteUrl ?? prospect.normalizedWebsiteUrl,
                    },
                  },
                }),
          },
        });
        for (const { tag } of prospect.tags) {
          await database.clientTag.create({ data: { clientId, tagId: tag.id } });
        }
      }
      await database.prospect.update({
        data: { promotedClientId: clientId, state: "promoted" },
        where: { id },
      });
      await database.clientActivity.create({
        data: {
          clientId,
          id: randomUUID(),
          kind: "prospect-promotion",
          summary: `Linked from prospect ${prospect.businessName}`,
        },
      });
      await database.prospectActivity.create({
        data: {
          id: randomUUID(),
          kind: "promoted",
          prospectId: id,
          summary:
            existingClientId === undefined
              ? "Promoted to a new client"
              : "Linked to an existing client",
        },
      });
    });
    const updated = await this.get(id);
    if (updated === null) return promotionError("not-found", "Promoted prospect was not found.");
    return prospectPromotionResultSchema.parse({
      clientId,
      nextAction: prospect.normalizedWebsiteUrl === null ? "complete-profile" : "discover-pages",
      ok: true,
      prospect: updated,
    });
  }

  async setState(id: string, state: ProspectState): Promise<ProspectMutationResult> {
    const existing = await this.#database.prospect.findUnique({ where: { id } });
    if (existing === null) return mutationError("not-found", "Prospect was not found");
    const current = prospectStateSchema.parse(existing.state);
    if (state === "promoted" || !allowedTransitions[current].includes(state)) {
      return mutationError(
        "invalid-transition",
        state === "promoted"
          ? "Promotion must use the explicit client-promotion workflow."
          : `A ${current} prospect cannot be moved to ${state}.`,
      );
    }
    if (state === "suppressed") {
      return mutationError(
        "invalid-transition",
        "Use the suppression action so durable suppression records are created.",
      );
    }
    await this.#database.$transaction([
      this.#database.prospect.update({ data: { state }, where: { id } }),
      this.#database.prospectActivity.create({
        data: {
          id: randomUUID(),
          kind: "state",
          prospectId: id,
          summary: `Prospect marked ${state}`,
        },
      }),
    ]);
    return this.#success(id);
  }

  async suppress(
    id: string,
    reason: string,
    doNotContact: boolean,
  ): Promise<ProspectMutationResult> {
    const prospect = await this.#database.prospect.findUnique({
      include: { sourceRecords: true },
      where: { id },
    });
    if (prospect === null) return mutationError("not-found", "Prospect was not found");
    if (prospect.state === "promoted") {
      return mutationError("invalid-transition", "Promoted prospects cannot be suppressed here.");
    }
    const keys = [
      ...(prospect.normalizedDomain === null ? [] : [domainKey(prospect.normalizedDomain)]),
      ...prospect.sourceRecords.map((source) =>
        sourceKey(source.provider, source.providerRecordId),
      ),
    ];
    if (keys.length === 0) {
      return mutationError(
        "invalid-transition",
        "This prospect has no durable source or domain identity to suppress.",
      );
    }
    const now = new Date();
    await this.#database.$transaction(async (database) => {
      for (const matchKey of keys) {
        await database.suppressionRecord.upsert({
          create: {
            doNotContact,
            id: randomUUID(),
            matchKey,
            matchType: matchKey.startsWith("domain:") ? "domain" : "source-record",
            reason,
            sourceProspectId: id,
          },
          update: { doNotContact, expiresAt: null, reason, sourceProspectId: id },
          where: { matchKey },
        });
      }
      await database.prospect.update({
        data: {
          doNotContactAt: doNotContact ? now : prospect.doNotContactAt,
          state: "suppressed",
          suppressedAt: now,
        },
        where: { id },
      });
      await database.prospectActivity.create({
        data: {
          id: randomUUID(),
          kind: "suppressed",
          prospectId: id,
          summary: doNotContact
            ? "Prospect suppressed and marked do not contact"
            : "Prospect suppressed",
        },
      });
    });
    return this.#success(id);
  }

  async delete(id: string, confirmation: string): Promise<ProspectActionResult> {
    const prospect = await this.#database.prospect.findUnique({ where: { id } });
    if (prospect === null) return actionError("not-found", "Prospect was not found");
    if (confirmation !== prospect.businessName) {
      return actionError(
        "confirmation-mismatch",
        "Confirmation must exactly match the business name",
      );
    }
    if (prospect.state === "promoted") {
      return actionError("promoted", "Promoted prospect provenance cannot be deleted here.");
    }
    await this.#database.prospect.delete({ where: { id } });
    return prospectActionResultSchema.parse({ ok: true });
  }

  async deleteExpired(now = new Date()): Promise<number> {
    const result = await this.#database.prospect.deleteMany({
      where: {
        retainedUntil: { lte: now },
        state: { not: "promoted" },
      },
    });
    return result.count;
  }

  async #success(id: string): Promise<ProspectMutationResult> {
    const prospect = await this.get(id);
    if (prospect === null) return mutationError("not-found", "Prospect was not found");
    return prospectMutationResultSchema.parse({ ok: true, prospect });
  }
}

function normalizeOptionalWebsite(
  websiteUrl: string | undefined,
): { domain: string; url: string } | null {
  if (websiteUrl === undefined) return null;
  const url = normalizeTargetUrl(websiteUrl);
  return { domain: new URL(url).hostname.replace(/^www\./u, ""), url };
}

function domainKey(domain: string): string {
  return `domain:${domain.toLocaleLowerCase("en-US")}`;
}

function sourceKey(provider: string, providerRecordId: string): string {
  return `source:${provider.toLocaleLowerCase("en-US")}:${providerRecordId.toLocaleLowerCase("en-US")}`;
}

function buildSearchText(input: ProspectSourceInput, domain: string | undefined): string {
  return [input.businessName, domain, input.category, input.locality, input.region, input.country]
    .filter((value): value is string => value !== undefined)
    .join(" ")
    .toLocaleLowerCase("en-US");
}

function appendQualificationSearch(searchText: string, input: ProspectQualificationInput): string {
  return [searchText, input.owner, ...input.tags]
    .filter((value): value is string => value !== undefined)
    .join(" ")
    .toLocaleLowerCase("en-US");
}

function toCampaignRecord(
  campaign: Prisma.DiscoveryCampaignGetPayload<Record<string, never>>,
): DiscoveryCampaignRecord {
  return discoveryCampaignRecordSchema.parse({
    category: campaign.category,
    completedAt: campaign.completedAt?.toISOString() ?? null,
    country: campaign.country,
    createdAt: campaign.createdAt.toISOString(),
    exclusionRules: parseStringArray(campaign.exclusionRulesJson),
    failureMessage: campaign.failureMessage,
    hasContinuation: parseContinuation(campaign.continuationDataJson) !== null,
    id: campaign.id,
    keywords: parseStringArray(campaign.keywordsJson),
    latitude: campaign.latitude,
    locality: campaign.locality,
    longitude: campaign.longitude,
    maxResults: campaign.maxResults,
    name: campaign.name,
    processedCount: campaign.processedCount,
    provider: campaign.provider,
    providerRequestCount: campaign.providerRequestCount,
    radiusKm: campaign.radiusKm,
    region: campaign.region,
    requireWebsite: campaign.requireWebsite,
    requiredFields: parseStringArray(campaign.requiredFieldsJson),
    resultCount: campaign.resultCount,
    startedAt: campaign.startedAt?.toISOString() ?? null,
    state: campaignStateSchema.parse(campaign.state),
    suppressedCount: campaign.suppressedCount,
    updatedAt: campaign.updatedAt.toISOString(),
    warningMessage: campaign.warningMessage,
  });
}

function parseStringArray(value: string): string[] {
  const parsed: unknown = JSON.parse(value);
  return zStringArray(parsed);
}

function zStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function parseContinuation(value: string | null): string | null {
  if (value === null) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "offsetToken" in parsed &&
      typeof parsed.offsetToken === "string" &&
      parsed.offsetToken.length > 0
    ) {
      return parsed.offsetToken;
    }
  } catch {
    return null;
  }
  return null;
}

async function replaceTags(
  database: Prisma.TransactionClient,
  prospectId: string,
  tags: readonly string[],
): Promise<void> {
  await database.prospectTag.deleteMany({ where: { prospectId } });
  const normalized = new Map<string, string>();
  for (const tag of tags) {
    const name = tag.trim();
    normalized.set(name.toLocaleLowerCase("en-US"), name);
  }
  for (const [normalizedName, name] of normalized) {
    const tag = await database.tag.upsert({
      create: { id: randomUUID(), name, normalizedName },
      update: { name },
      where: { normalizedName },
    });
    await database.prospectTag.create({ data: { prospectId, tagId: tag.id } });
  }
}

type DuplicateCandidate = ProspectRecord["duplicateCandidates"][number];

function toRecord(
  prospect: DetailProspect,
  duplicateCandidates: readonly DuplicateCandidate[] = [],
): ProspectRecord {
  return prospectRecordSchema.parse({
    activities: prospect.activities.map((activity) => ({
      createdAt: activity.createdAt.toISOString(),
      id: activity.id,
      kind: activity.kind,
      summary: activity.summary,
    })),
    addressLine: prospect.addressLine,
    businessName: prospect.businessName,
    campaignId: prospect.campaignId,
    category: prospect.category,
    confidence: prospect.confidence,
    country: prospect.country,
    createdAt: prospect.createdAt.toISOString(),
    discoveredPageCount: prospect.discoveredPageCount,
    doNotContactAt: prospect.doNotContactAt?.toISOString() ?? null,
    duplicateReviewState: prospect.duplicateReviewState,
    duplicateCandidates,
    firstDiscoveredAt: prospect.firstDiscoveredAt.toISOString(),
    homepageTitle: prospect.homepageTitle,
    id: prospect.id,
    lastVerifiedAt: prospect.lastVerifiedAt?.toISOString() ?? null,
    locality: prospect.locality,
    normalizedDomain: prospect.normalizedDomain,
    notes: prospect.notes,
    opportunitySignals: opportunitySignals(prospect),
    owner: prospect.owner,
    postalCode: prospect.postalCode,
    promotedClientId: prospect.promotedClientId,
    publicEmail: prospect.publicEmail,
    publicPhone: prospect.publicPhone,
    region: prospect.region,
    retainedUntil: prospect.retainedUntil?.toISOString() ?? null,
    serviceArea: prospect.serviceArea,
    socialProfiles: JSON.parse(prospect.socialProfilesJson) as unknown,
    sourceProvider: prospect.sourceRecords[0]?.provider ?? null,
    sourceRecordCount: prospect._count.sourceRecords,
    sourceRecords: prospect.sourceRecords.map((source) => ({
      collectedAt: source.collectedAt.toISOString(),
      fieldProvenance: JSON.parse(source.fieldProvenanceJson) as unknown,
      id: source.id,
      lastVerifiedAt: source.lastVerifiedAt?.toISOString() ?? null,
      permittedFields: JSON.parse(source.permittedFieldsJson) as unknown,
      provider: source.provider,
      providerRecordId: source.providerRecordId,
      retainedUntil: source.retainedUntil.toISOString(),
      retentionPolicy: source.retentionPolicy,
      sourceUpdatedAt: source.sourceUpdatedAt?.toISOString() ?? null,
      sourceUrl: source.sourceUrl,
    })),
    sourceUpdatedAt: prospect.sourceUpdatedAt?.toISOString() ?? null,
    state: prospect.state,
    suppressedAt: prospect.suppressedAt?.toISOString() ?? null,
    tags: prospect.tags.map(({ tag }) => tag.name).sort((left, right) => left.localeCompare(right)),
    updatedAt: prospect.updatedAt.toISOString(),
    verificationMessage: prospect.verificationMessage,
    verificationState: prospect.verificationState,
    verifiedWebsiteUrl: prospect.verifiedWebsiteUrl,
    websiteAvailability: prospect.websiteAvailability,
    websiteUrl: prospect.normalizedWebsiteUrl,
  });
}

function normalizePhone(value: string | null): string | null {
  if (value === null) return null;
  const digits = value.replace(/\D/gu, "");
  return digits.length < 7 ? null : digits.slice(-10);
}

function normalizedWords(value: string | null): string[] {
  return (value ?? "")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/u)
    .filter((word) => word.length > 1);
}

function wordSimilarity(left: string | null, right: string | null): number {
  const a = new Set(normalizedWords(left));
  const b = new Set(normalizedWords(right));
  if (a.size === 0 || b.size === 0) return 0;
  const overlap = [...a].filter((word) => b.has(word)).length;
  return overlap / Math.max(a.size, b.size);
}

function candidateMatch(
  prospect: DetailProspect,
  phone: string | null,
  candidate: {
    addressLine: string | null;
    businessName: string;
    domain: string | null;
    id: string;
    kind: "client" | "prospect";
    publicPhone: string | null;
  },
): DuplicateCandidate[] {
  const reasons: DuplicateCandidate["reasons"] = [];
  if (prospect.normalizedDomain !== null && prospect.normalizedDomain === candidate.domain) {
    reasons.push("domain");
  }
  if (phone !== null && phone === normalizePhone(candidate.publicPhone)) reasons.push("phone");
  if (
    wordSimilarity(prospect.businessName, candidate.businessName) >= 0.8 &&
    wordSimilarity(prospect.addressLine, candidate.addressLine) >= 0.5
  ) {
    reasons.push("name-and-address");
  }
  if (reasons.length === 0) return [];
  return [
    {
      businessName: candidate.businessName,
      confidence: reasons.includes("domain") || reasons.includes("phone") ? "exact" : "possible",
      id: candidate.id,
      kind: candidate.kind,
      reasons,
    },
  ];
}

function opportunitySignals(prospect: DetailProspect): ProspectRecord["opportunitySignals"] {
  const signals: ProspectRecord["opportunitySignals"] = [];
  if (prospect.normalizedWebsiteUrl === null) {
    signals.push({
      kind: "no-website-listed",
      label: "No public website is listed",
      tone: "attention",
    });
  } else if (prospect.websiteAvailability === "available") {
    signals.push({
      kind: "website-reachable",
      label: "The listed website is reachable",
      tone: "positive",
    });
    if ((prospect.verifiedWebsiteUrl ?? prospect.normalizedWebsiteUrl).startsWith("https://")) {
      signals.push({
        kind: "https-available",
        label: "The verified website uses HTTPS",
        tone: "positive",
      });
    }
    if ((prospect.discoveredPageCount ?? 0) <= 2) {
      signals.push({
        kind: "limited-page-presence",
        label: "Only a small public page set was observed",
        tone: "attention",
      });
    }
  } else if (prospect.verificationState === "failed") {
    signals.push({
      kind: "website-unavailable",
      label: "The listed website was not reachable during verification",
      tone: "attention",
    });
  }
  if (prospect.publicPhone !== null || prospect.publicEmail !== null) {
    signals.push({
      kind: "public-contact-available",
      label: "Public business contact details are available",
      tone: "info",
    });
  }
  return signals;
}

function toListRecord(
  prospect: ListProspect,
): Omit<ProspectRecord, "activities" | "notes" | "sourceRecords"> {
  const {
    activities: _activities,
    notes: _notes,
    sourceRecords: _sourceRecords,
    ...record
  } = toRecord({ ...prospect, activities: [], notes: null });
  return record;
}

function mutationError(
  code: "invalid-transition" | "not-found" | "suppressed",
  message: string,
): ProspectMutationResult {
  return prospectMutationResultSchema.parse({ error: { code, message }, ok: false });
}

function actionError(
  code: "confirmation-mismatch" | "not-found" | "promoted",
  message: string,
): ProspectActionResult {
  return prospectActionResultSchema.parse({ error: { code, message }, ok: false });
}

function promotionError(
  code: "already-promoted" | "duplicate-domain" | "invalid-state" | "not-found",
  message: string,
  clientId?: string,
): ProspectPromotionResult {
  return prospectPromotionResultSchema.parse({
    error: { ...(clientId === undefined ? {} : { clientId }), code, message },
    ok: false,
  });
}
