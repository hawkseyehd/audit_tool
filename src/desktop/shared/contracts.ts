import { z } from "zod";

import { PAGE_TYPES, findingCountsSchema, pageTypeSchema } from "../../core/schemas.js";

export const IPC_CHANNELS = {
  applyPageSelection: "desktop:pages:select",
  cancelAuditJob: "desktop:audits:cancel",
  cancelDiscoveryCampaign: "desktop:campaigns:cancel",
  createClient: "desktop:clients:create",
  createDiscoveryCampaign: "desktop:campaigns:create",
  createAuditScope: "desktop:scopes:create",
  deleteClient: "desktop:clients:delete",
  discoverWebsitePages: "desktop:pages:discover",
  exportReport: "desktop:reports:export",
  getAuditJob: "desktop:audits:get",
  getBootstrap: "desktop:get-bootstrap",
  getAuditScope: "desktop:scopes:get",
  getClient: "desktop:clients:get",
  getDiscoveryProvider: "desktop:campaigns:provider",
  listAuditJobs: "desktop:audits:list",
  listAuditHistory: "desktop:audit-history:list",
  listClients: "desktop:clients:list",
  listDiscoveryCampaigns: "desktop:campaigns:list",
  listProspects: "desktop:prospects:list",
  listReportArtifacts: "desktop:reports:list",
  listWebsitePages: "desktop:pages:list",
  openReport: "desktop:reports:open",
  revealReport: "desktop:reports:reveal",
  retryAuditJob: "desktop:audits:retry",
  resumeDiscoveryCampaign: "desktop:campaigns:resume",
  deleteProspect: "desktop:prospects:delete",
  getProspect: "desktop:prospects:get",
  promoteProspect: "desktop:prospects:promote",
  setProspectState: "desktop:prospects:set-state",
  setClientStatus: "desktop:clients:set-status",
  startAuditJob: "desktop:audits:start",
  suppressProspect: "desktop:prospects:suppress",
  updateClient: "desktop:clients:update",
  updateProspect: "desktop:prospects:update",
  verifyProspect: "desktop:prospects:verify",
} as const;

export const CLIENT_STATUSES = ["active", "paused", "archived"] as const;
export const clientStatusSchema = z.enum(CLIENT_STATUSES);
export const clientIdSchema = z.uuid();

const optionalText = (maximum: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value),
    z.string().trim().max(maximum).optional(),
  );

export const clientInputSchema = z
  .object({
    addressLine: optionalText(300),
    businessName: z.string().trim().min(1, "Business name is required").max(200),
    category: optionalText(120),
    country: optionalText(100),
    locality: optionalText(120),
    notes: optionalText(5_000),
    owner: optionalText(120),
    postalCode: optionalText(30),
    publicEmail: z.preprocess(
      (value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value),
      z.email("Enter a valid public business email").max(320).optional(),
    ),
    publicPhone: optionalText(50),
    region: optionalText(120),
    tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
    websiteUrl: z.string().trim().min(1, "Website URL is required").max(2_048),
  })
  .strict();

export const clientActivitySchema = z
  .object({
    createdAt: z.iso.datetime(),
    id: clientIdSchema,
    kind: z.string().trim().min(1).max(50),
    summary: z.string().trim().min(1).max(500),
  })
  .strict();

export const clientRecordSchema = z
  .object({
    activities: z.array(clientActivitySchema).max(100),
    addressLine: z.string().nullable(),
    businessName: z.string().trim().min(1).max(200),
    category: z.string().nullable(),
    country: z.string().nullable(),
    createdAt: z.iso.datetime(),
    id: clientIdSchema,
    locality: z.string().nullable(),
    notes: z.string().nullable(),
    normalizedDomain: z.string().trim().min(1).max(253).nullable(),
    owner: z.string().nullable(),
    postalCode: z.string().nullable(),
    publicEmail: z.string().nullable(),
    publicPhone: z.string().nullable(),
    region: z.string().nullable(),
    status: clientStatusSchema,
    tags: z.array(z.string().trim().min(1).max(50)).max(20),
    updatedAt: z.iso.datetime(),
    websiteUrl: z.url().nullable(),
  })
  .strict();

export const clientListQuerySchema = z
  .object({
    direction: z.enum(["asc", "desc"]).default("desc"),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(10).max(100).default(25),
    search: z.string().trim().max(200).default(""),
    sort: z.enum(["name", "updatedAt"]).default("updatedAt"),
    status: z.union([clientStatusSchema, z.literal("all")]).default("active"),
  })
  .strict();

export const clientListItemSchema = clientRecordSchema.omit({ activities: true, notes: true });
export const clientListResultSchema = z
  .object({
    items: z.array(clientListItemSchema),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
  })
  .strict();

export const clientMutationResultSchema = z.discriminatedUnion("ok", [
  z.object({ client: clientRecordSchema, ok: z.literal(true) }).strict(),
  z
    .object({
      error: z
        .object({
          clientId: clientIdSchema.optional(),
          code: z.enum(["duplicate-domain", "not-found", "retained-history"]),
          message: z.string().trim().min(1).max(500),
        })
        .strict(),
      ok: z.literal(false),
    })
    .strict(),
]);

export const getClientRequestSchema = z.object({ id: clientIdSchema }).strict();
export const updateClientRequestSchema = z
  .object({ id: clientIdSchema, input: clientInputSchema })
  .strict();
export const setClientStatusRequestSchema = z
  .object({ id: clientIdSchema, status: clientStatusSchema })
  .strict();
export const deleteClientRequestSchema = z
  .object({ confirmation: z.string().trim().min(1).max(200), id: clientIdSchema })
  .strict();
export const deleteClientResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true) }).strict(),
  z
    .object({
      error: z
        .object({
          code: z.enum(["not-found", "confirmation-mismatch", "retained-history"]),
          message: z.string().trim().min(1).max(500),
        })
        .strict(),
      ok: z.literal(false),
    })
    .strict(),
]);

export const PROSPECT_STATES = [
  "new",
  "reviewing",
  "qualified",
  "not-qualified",
  "promoted",
  "suppressed",
] as const;
export const PROSPECT_WEBSITE_AVAILABILITIES = ["unknown", "available", "unavailable"] as const;
export const PROSPECT_DUPLICATE_REVIEW_STATES = [
  "not-reviewed",
  "possible-duplicate",
  "confirmed-distinct",
] as const;
export const CAMPAIGN_STATES = [
  "draft",
  "queued",
  "running",
  "paused",
  "completed",
  "failed",
  "cancelled",
] as const;

export const prospectStateSchema = z.enum(PROSPECT_STATES);
export const prospectWebsiteAvailabilitySchema = z.enum(PROSPECT_WEBSITE_AVAILABILITIES);
export const prospectDuplicateReviewStateSchema = z.enum(PROSPECT_DUPLICATE_REVIEW_STATES);
export const prospectVerificationStateSchema = z.enum([
  "not-verified",
  "verified",
  "partial",
  "failed",
]);
export const campaignStateSchema = z.enum(CAMPAIGN_STATES);
export const prospectIdSchema = z.uuid();
export const campaignIdSchema = z.uuid();

export const campaignInputSchema = z
  .object({
    category: optionalText(120),
    country: z.string().trim().min(1).max(100),
    exclusionRules: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
    keywords: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
    latitude: z.number().min(-90).max(90).optional(),
    locality: optionalText(120),
    longitude: z.number().min(-180).max(180).optional(),
    maxResults: z.number().int().min(1).max(5_000),
    name: z.string().trim().min(1).max(200),
    provider: z.string().trim().min(1).max(100),
    providerTermsVersion: z.string().trim().min(1).max(100),
    radiusKm: z.number().positive().max(500).optional(),
    region: optionalText(120),
    requireWebsite: z.boolean().default(true),
    requiredFields: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  })
  .superRefine((input, context) => {
    const hasLatitude = input.latitude !== undefined;
    const hasLongitude = input.longitude !== undefined;
    if (hasLatitude !== hasLongitude) {
      context.addIssue({
        code: "custom",
        message: "Latitude and longitude must be provided together",
        path: hasLatitude ? ["longitude"] : ["latitude"],
      });
    }
    if (input.radiusKm !== undefined && (!hasLatitude || !hasLongitude)) {
      context.addIssue({
        code: "custom",
        message: "Radius requires latitude and longitude",
        path: ["radiusKm"],
      });
    }
  });

export const discoveryCampaignInputSchema = campaignInputSchema
  .safeExtend({
    country: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{2}$/u, "Enter a two-letter country code")
      .transform((value) => value.toUpperCase()),
    maxResults: z.number().int().min(1).max(100),
    provider: z.literal("playwright-web-search"),
    providerTermsVersion: z.literal("reviewed-2026-07-26"),
    requiredFields: z
      .array(z.enum(["businessName", "websiteUrl", "publicPhone", "addressLine"]))
      .max(4)
      .default([]),
  })
  .superRefine((input, context) => {
    if (input.category === undefined && input.keywords.length === 0) {
      context.addIssue({
        code: "custom",
        message: "Enter a category or at least one keyword",
        path: ["category"],
      });
    }
    if (
      input.latitude === undefined &&
      input.longitude === undefined &&
      input.locality === undefined &&
      input.region === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "Enter a city or region for browser-based discovery",
        path: ["locality"],
      });
    }
    if (
      input.latitude !== undefined ||
      input.longitude !== undefined ||
      input.radiusKm !== undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "Coordinate radius is not available for browser-based discovery",
        path: ["radiusKm"],
      });
    }
  });

export const discoveryCampaignRecordSchema = z
  .object({
    category: z.string().nullable(),
    completedAt: z.iso.datetime().nullable(),
    country: z.string().trim().min(1).max(100),
    createdAt: z.iso.datetime(),
    exclusionRules: z.array(z.string().trim().min(1).max(200)).max(20),
    failureMessage: z.string().nullable(),
    hasContinuation: z.boolean(),
    id: campaignIdSchema,
    keywords: z.array(z.string().trim().min(1).max(100)).max(20),
    latitude: z.number().nullable(),
    locality: z.string().nullable(),
    longitude: z.number().nullable(),
    maxResults: z.number().int().min(1).max(5_000),
    name: z.string().trim().min(1).max(200),
    processedCount: z.number().int().nonnegative(),
    provider: z.string().trim().min(1).max(100),
    providerRequestCount: z.number().int().nonnegative(),
    radiusKm: z.number().positive().nullable(),
    region: z.string().nullable(),
    requireWebsite: z.boolean(),
    requiredFields: z.array(z.string().trim().min(1).max(100)).max(30),
    resultCount: z.number().int().nonnegative(),
    startedAt: z.iso.datetime().nullable(),
    state: campaignStateSchema,
    suppressedCount: z.number().int().nonnegative(),
    updatedAt: z.iso.datetime(),
    warningMessage: z.string().nullable(),
  })
  .strict();

export const discoveryCampaignListQuerySchema = z
  .object({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(5).max(50).default(10),
    state: z.union([campaignStateSchema, z.literal("all")]).default("all"),
  })
  .strict();

export const discoveryCampaignListResultSchema = z
  .object({
    items: z.array(discoveryCampaignRecordSchema),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
  })
  .strict();

export const discoveryProviderSchema = z
  .object({
    configured: z.literal(true),
    credentialEnvironmentVariables: z.tuple([]),
    id: z.literal("playwright-web-search"),
    label: z.literal("Rendered map pages (Playwright)"),
    maxResults: z.literal(100),
    paidOperation: z.literal(false),
    supportsRadius: z.literal(false),
    termsVersion: z.literal("reviewed-2026-07-26"),
  })
  .strict();

export const discoveryCampaignMutationResultSchema = z.discriminatedUnion("ok", [
  z.object({ campaign: discoveryCampaignRecordSchema, ok: z.literal(true) }).strict(),
  z
    .object({
      error: z
        .object({
          code: z.enum([
            "already-running",
            "invalid-state",
            "not-configured",
            "not-found",
            "worker-unavailable",
          ]),
          message: z.string().trim().min(1).max(500),
        })
        .strict(),
      ok: z.literal(false),
    })
    .strict(),
]);

export const createDiscoveryCampaignRequestSchema = z
  .object({ input: discoveryCampaignInputSchema })
  .strict();
export const discoveryCampaignIdRequestSchema = z.object({ id: campaignIdSchema }).strict();

export const prospectSourceInputSchema = z
  .object({
    addressLine: optionalText(300),
    businessName: z.string().trim().min(1).max(200),
    campaignId: campaignIdSchema.optional(),
    category: optionalText(120),
    collectedAt: z.iso.datetime(),
    country: optionalText(100),
    fieldProvenance: z.record(z.string(), z.string().trim().min(1).max(500)),
    lastVerifiedAt: z.iso.datetime().optional(),
    locality: optionalText(120),
    permittedFields: z.array(z.string().trim().min(1).max(100)).max(50),
    postalCode: optionalText(30),
    provider: z.string().trim().min(1).max(100),
    providerRecordId: z.string().trim().min(1).max(300),
    publicEmail: z.email().max(320).optional(),
    publicPhone: optionalText(50),
    region: optionalText(120),
    retentionDays: z.number().int().min(1).max(3_650),
    retentionPolicy: z.string().trim().min(1).max(500),
    serviceArea: optionalText(300),
    socialProfiles: z.array(z.url().max(2_048)).max(20).default([]),
    sourceUpdatedAt: z.iso.datetime().optional(),
    sourceUrl: z.url().max(2_048).optional(),
    websiteUrl: z.url().max(2_048).optional(),
  })
  .strict();

export const prospectActivitySchema = z
  .object({
    createdAt: z.iso.datetime(),
    id: z.uuid(),
    kind: z.string().trim().min(1).max(50),
    summary: z.string().trim().min(1).max(500),
  })
  .strict();

export const prospectSourceRecordSchema = z
  .object({
    collectedAt: z.iso.datetime(),
    fieldProvenance: z.record(z.string(), z.string()),
    id: z.uuid(),
    lastVerifiedAt: z.iso.datetime().nullable(),
    permittedFields: z.array(z.string()),
    provider: z.string().trim().min(1).max(100),
    providerRecordId: z.string().trim().min(1).max(300),
    retainedUntil: z.iso.datetime(),
    retentionPolicy: z.string().trim().min(1).max(500),
    sourceUpdatedAt: z.iso.datetime().nullable(),
    sourceUrl: z.url().nullable(),
  })
  .strict();

export const prospectDuplicateCandidateSchema = z
  .object({
    businessName: z.string().trim().min(1).max(200),
    confidence: z.enum(["exact", "possible"]),
    id: z.uuid(),
    kind: z.enum(["client", "prospect"]),
    reasons: z
      .array(z.enum(["domain", "phone", "name-and-address", "source-record"]))
      .min(1)
      .max(4),
  })
  .strict();

export const prospectOpportunitySignalSchema = z
  .object({
    kind: z.enum([
      "website-reachable",
      "https-available",
      "website-unavailable",
      "no-website-listed",
      "limited-page-presence",
      "public-contact-available",
    ]),
    label: z.string().trim().min(1).max(160),
    tone: z.enum(["positive", "attention", "info"]),
  })
  .strict();

export const prospectRecordSchema = z
  .object({
    activities: z.array(prospectActivitySchema).max(100),
    addressLine: z.string().nullable(),
    businessName: z.string().trim().min(1).max(200),
    campaignId: campaignIdSchema.nullable(),
    category: z.string().nullable(),
    confidence: z.number().int().min(0).max(100),
    country: z.string().nullable(),
    createdAt: z.iso.datetime(),
    discoveredPageCount: z.number().int().nonnegative().nullable(),
    doNotContactAt: z.iso.datetime().nullable(),
    duplicateReviewState: prospectDuplicateReviewStateSchema,
    firstDiscoveredAt: z.iso.datetime(),
    homepageTitle: z.string().nullable(),
    id: prospectIdSchema,
    lastVerifiedAt: z.iso.datetime().nullable(),
    locality: z.string().nullable(),
    normalizedDomain: z.string().nullable(),
    notes: z.string().nullable(),
    opportunitySignals: z.array(prospectOpportunitySignalSchema).max(10),
    owner: z.string().nullable(),
    postalCode: z.string().nullable(),
    promotedClientId: clientIdSchema.nullable(),
    publicEmail: z.string().nullable(),
    publicPhone: z.string().nullable(),
    region: z.string().nullable(),
    retainedUntil: z.iso.datetime().nullable(),
    serviceArea: z.string().nullable(),
    socialProfiles: z.array(z.url()),
    sourceProvider: z.string().nullable(),
    sourceRecordCount: z.number().int().nonnegative(),
    sourceRecords: z.array(prospectSourceRecordSchema).max(100),
    sourceUpdatedAt: z.iso.datetime().nullable(),
    state: prospectStateSchema,
    suppressedAt: z.iso.datetime().nullable(),
    tags: z.array(z.string().trim().min(1).max(50)).max(20),
    updatedAt: z.iso.datetime(),
    verificationMessage: z.string().nullable(),
    verificationState: prospectVerificationStateSchema,
    verifiedWebsiteUrl: z.url().nullable(),
    websiteAvailability: prospectWebsiteAvailabilitySchema,
    websiteUrl: z.url().nullable(),
    duplicateCandidates: z.array(prospectDuplicateCandidateSchema).max(25),
  })
  .strict();

export const prospectQualificationInputSchema = z
  .object({
    confidence: z.number().int().min(0).max(100),
    duplicateReviewState: prospectDuplicateReviewStateSchema,
    notes: optionalText(5_000),
    owner: optionalText(120),
    tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  })
  .strict();

export const prospectListQuerySchema = z
  .object({
    confidenceAtLeast: z.number().int().min(0).max(100).default(0),
    direction: z.enum(["asc", "desc"]).default("desc"),
    owner: z.string().trim().max(120).default(""),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(10).max(100).default(25),
    search: z.string().trim().max(200).default(""),
    sort: z
      .enum(["businessName", "confidence", "lastVerifiedAt", "updatedAt"])
      .default("updatedAt"),
    state: z.union([prospectStateSchema, z.literal("all")]).default("all"),
    websiteAvailability: z
      .union([prospectWebsiteAvailabilitySchema, z.literal("all")])
      .default("all"),
  })
  .strict();

export const prospectListItemSchema = prospectRecordSchema.omit({
  activities: true,
  notes: true,
  sourceRecords: true,
});
export const prospectListResultSchema = z
  .object({
    items: z.array(prospectListItemSchema),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
  })
  .strict();

export const prospectMutationResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), prospect: prospectRecordSchema }).strict(),
  z
    .object({
      error: z
        .object({
          code: z.enum(["invalid-transition", "not-found", "suppressed"]),
          message: z.string().trim().min(1).max(500),
        })
        .strict(),
      ok: z.literal(false),
    })
    .strict(),
]);

export const prospectImportResultSchema = z.discriminatedUnion("status", [
  z.object({ prospect: prospectRecordSchema, status: z.literal("created") }).strict(),
  z.object({ prospect: prospectRecordSchema, status: z.literal("existing") }).strict(),
  z
    .object({
      matchType: z.enum(["domain", "source-record"]),
      status: z.literal("suppressed"),
    })
    .strict(),
]);

export const getProspectRequestSchema = z.object({ id: prospectIdSchema }).strict();
export const updateProspectRequestSchema = z
  .object({ id: prospectIdSchema, input: prospectQualificationInputSchema })
  .strict();
export const setProspectStateRequestSchema = z
  .object({ id: prospectIdSchema, state: prospectStateSchema })
  .strict();
export const suppressProspectRequestSchema = z
  .object({
    doNotContact: z.boolean().default(false),
    id: prospectIdSchema,
    reason: z.string().trim().min(1).max(500),
  })
  .strict();
export const deleteProspectRequestSchema = z
  .object({ confirmation: z.string().trim().min(1).max(200), id: prospectIdSchema })
  .strict();
export const prospectActionResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true) }).strict(),
  z
    .object({
      error: z
        .object({
          code: z.enum(["confirmation-mismatch", "not-found", "promoted"]),
          message: z.string().trim().min(1).max(500),
        })
        .strict(),
      ok: z.literal(false),
    })
    .strict(),
]);

export const verifyProspectRequestSchema = z.object({ id: prospectIdSchema }).strict();
export const prospectPromotionRequestSchema = z
  .object({
    existingClientId: clientIdSchema.optional(),
    id: prospectIdSchema,
  })
  .strict();
export const prospectPromotionResultSchema = z.discriminatedUnion("ok", [
  z
    .object({
      clientId: clientIdSchema,
      nextAction: z.enum(["discover-pages", "complete-profile"]),
      ok: z.literal(true),
      prospect: prospectRecordSchema,
    })
    .strict(),
  z
    .object({
      error: z
        .object({
          clientId: clientIdSchema.optional(),
          code: z.enum(["already-promoted", "duplicate-domain", "invalid-state", "not-found"]),
          message: z.string().trim().min(1).max(500),
        })
        .strict(),
      ok: z.literal(false),
    })
    .strict(),
]);

export const PAGE_AVAILABILITIES = ["available", "unavailable", "not-observed"] as const;
export const PAGE_CHANGE_STATES = [
  "new",
  "unchanged",
  "changed",
  "unavailable",
  "not-observed",
] as const;
export const PAGE_RECOMMENDATION_STATES = ["recommended", "review", "excluded"] as const;
export const PAGE_SELECTION_STATES = ["default", "included", "excluded"] as const;
export const DISCOVERY_RUN_STATUSES = ["running", "completed", "partial", "failed"] as const;

export const pageAvailabilitySchema = z.enum(PAGE_AVAILABILITIES);
export const pageChangeStateSchema = z.enum(PAGE_CHANGE_STATES);
export const pageRecommendationStateSchema = z.enum(PAGE_RECOMMENDATION_STATES);
export const pageSelectionStateSchema = z.enum(PAGE_SELECTION_STATES);
export const discoveryRunStatusSchema = z.enum(DISCOVERY_RUN_STATUSES);

export const websitePageRecordSchema = z
  .object({
    availability: pageAvailabilitySchema,
    changeState: pageChangeStateSchema,
    failureCode: z.string().trim().min(1).max(100).nullable(),
    failureMessage: z.string().trim().min(1).max(2_000).nullable(),
    firstDiscoveredAt: z.iso.datetime(),
    id: z.uuid(),
    lastChangedAt: z.iso.datetime().nullable(),
    lastObservedAt: z.iso.datetime(),
    normalizedUrl: z.url(),
    observedUrl: z.url(),
    pageType: pageTypeSchema,
    recommendationReason: z.string().trim().min(1).max(300),
    recommendationState: pageRecommendationStateSchema,
    selectionState: pageSelectionStateSchema,
    statusCode: z.number().int().min(100).max(599).nullable(),
    title: z.string().trim().max(500).nullable(),
  })
  .strict();

export const discoveryRunSchema = z
  .object({
    changedPageCount: z.number().int().nonnegative(),
    completedAt: z.iso.datetime().nullable(),
    discoveredUrlCount: z.number().int().nonnegative(),
    failedPageCount: z.number().int().nonnegative(),
    failureMessage: z.string().trim().min(1).max(2_000).nullable(),
    id: z.uuid(),
    newPageCount: z.number().int().nonnegative(),
    noLongerObservedCount: z.number().int().nonnegative(),
    observedPageCount: z.number().int().nonnegative(),
    source: z.string().trim().min(1).max(50),
    startedAt: z.iso.datetime(),
    status: discoveryRunStatusSchema,
    successfulPageCount: z.number().int().nonnegative(),
    unavailablePageCount: z.number().int().nonnegative(),
  })
  .strict();

export const websitePageListQuerySchema = z
  .object({
    availability: z.union([pageAvailabilitySchema, z.literal("all")]).default("all"),
    changeState: z.union([pageChangeStateSchema, z.literal("all")]).default("all"),
    clientId: clientIdSchema,
    direction: z.enum(["asc", "desc"]).default("desc"),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(10).max(100).default(25),
    pageType: z.union([pageTypeSchema, z.literal("all")]).default("all"),
    search: z.string().trim().max(500).default(""),
    selectionState: z.union([pageSelectionStateSchema, z.literal("all")]).default("all"),
    sort: z.enum(["lastObservedAt", "title", "url"]).default("lastObservedAt"),
    status: z
      .enum(["all", "success", "redirect", "client-error", "server-error", "failed"])
      .default("all"),
  })
  .strict();

export const websitePageSummarySchema = z
  .object({
    available: z.number().int().nonnegative(),
    eligible: z.number().int().nonnegative(),
    excluded: z.number().int().nonnegative(),
    notObserved: z.number().int().nonnegative(),
    selected: z.number().int().nonnegative(),
    unavailable: z.number().int().nonnegative(),
  })
  .strict();

export const websitePageListResultSchema = z
  .object({
    items: z.array(websitePageRecordSchema),
    latestRun: discoveryRunSchema.nullable(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    summary: websitePageSummarySchema,
    total: z.number().int().nonnegative(),
  })
  .strict();

export const discoverWebsitePagesRequestSchema = z
  .object({
    clientId: clientIdSchema,
    maxPages: z.number().int().min(1).max(100).default(100),
  })
  .strict();

export const discoveryResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), run: discoveryRunSchema }).strict(),
  z
    .object({
      error: z
        .object({
          code: z.enum(["not-found", "already-running", "discovery-failed"]),
          message: z.string().trim().min(1).max(2_000),
        })
        .strict(),
      ok: z.literal(false),
      run: discoveryRunSchema.optional(),
    })
    .strict(),
]);

export const PAGE_SELECTION_ACTIONS = [
  "include",
  "exclude",
  "reset",
  "clear",
  "include-recommended",
] as const;
export const pageSelectionActionSchema = z.enum(PAGE_SELECTION_ACTIONS);
export const applyPageSelectionRequestSchema = z
  .object({
    action: pageSelectionActionSchema,
    clientId: clientIdSchema,
    pageIds: z.array(z.uuid()).max(100).default([]),
  })
  .strict()
  .superRefine((request, context) => {
    if (new Set(request.pageIds).size !== request.pageIds.length) {
      context.addIssue({
        code: "custom",
        message: "Page IDs must be unique",
        path: ["pageIds"],
      });
    }
    const usesPageIds =
      request.action === "include" || request.action === "exclude" || request.action === "reset";
    if (usesPageIds && request.pageIds.length === 0) {
      context.addIssue({
        code: "custom",
        message: "At least one page is required for this selection action",
        path: ["pageIds"],
      });
    }
    if (!usesPageIds && request.pageIds.length > 0) {
      context.addIssue({
        code: "custom",
        message: "This selection action does not accept page IDs",
        path: ["pageIds"],
      });
    }
  });

export const pageSelectionResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), summary: websitePageSummarySchema }).strict(),
  z
    .object({
      error: z
        .object({
          code: z.enum(["not-found", "invalid-pages", "ineligible-pages"]),
          message: z.string().trim().min(1).max(1_000),
        })
        .strict(),
      ok: z.literal(false),
    })
    .strict(),
]);

export const AUDIT_SCOPE_REPORT_FORMATS = [
  "client-summary-pdf",
  "summary-pdf",
  "pdf",
  "html",
  "json",
  "markdown",
] as const;
export const auditScopeReportFormatSchema = z.enum(AUDIT_SCOPE_REPORT_FORMATS);
export const auditScopeConfigurationSchema = z
  .object({
    includeAccessibility: z.boolean(),
    includeAnalytics: z.boolean(),
    includeForms: z.boolean(),
    includeLighthouse: z.boolean(),
    includeSecurity: z.boolean(),
    includeSeo: z.boolean(),
    includeUxHeuristics: z.boolean(),
    submitForms: z.literal(false),
    viewports: z
      .array(z.enum(["desktop", "mobile"]))
      .min(1)
      .max(2)
      .refine((items) => new Set(items).size === items.length, "Viewports must be unique"),
  })
  .strict();

export const auditScopePageSchema = z
  .object({
    normalizedUrl: z.url(),
    pageId: z.uuid(),
    pageType: pageTypeSchema,
  })
  .strict();
export const auditScopeRecordSchema = z
  .object({
    clientBusinessName: z.string().trim().min(1).max(200),
    clientId: clientIdSchema,
    configuration: auditScopeConfigurationSchema,
    createdAt: z.iso.datetime(),
    id: z.uuid(),
    normalizedDomain: z.string().trim().min(1).max(253),
    pages: z.array(auditScopePageSchema).min(1).max(100),
    reportFormats: z
      .array(auditScopeReportFormatSchema)
      .min(1)
      .max(AUDIT_SCOPE_REPORT_FORMATS.length),
    requestedBy: z.string().trim().min(1).max(120),
    selectedPageCount: z.number().int().positive().max(100),
    targetUrl: z.url(),
    websiteId: z.uuid(),
  })
  .strict()
  .refine((scope) => scope.selectedPageCount === scope.pages.length, {
    message: "Selected page count must match scope pages",
    path: ["selectedPageCount"],
  });

export const createAuditScopeRequestSchema = z
  .object({
    clientId: clientIdSchema,
    configuration: auditScopeConfigurationSchema,
    reportFormats: z
      .array(auditScopeReportFormatSchema)
      .min(1)
      .max(AUDIT_SCOPE_REPORT_FORMATS.length)
      .refine((items) => new Set(items).size === items.length, "Report formats must be unique"),
  })
  .strict();
export const createAuditScopeResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), scope: auditScopeRecordSchema }).strict(),
  z
    .object({
      error: z
        .object({
          code: z.enum([
            "not-found",
            "no-selection",
            "too-many-pages",
            "ineligible-selection",
            "out-of-scope",
          ]),
          message: z.string().trim().min(1).max(1_000),
        })
        .strict(),
      ok: z.literal(false),
    })
    .strict(),
]);
export const getAuditScopeRequestSchema = z.object({ id: z.uuid() }).strict();

export const AUDIT_JOB_STATES = [
  "queued",
  "discovering",
  "scanning",
  "generating-reports",
  "completed",
  "partially-completed",
  "failed",
  "cancelled",
] as const;
export const auditJobStateSchema = z.enum(AUDIT_JOB_STATES);
export const auditJobFailureSchema = z
  .object({
    code: z.string().trim().min(1).max(80),
    message: z.string().trim().min(1).max(1_000),
  })
  .strict();
export const auditJobRecordSchema = z
  .object({
    attempt: z.number().int().positive().max(100),
    cancelAvailable: z.boolean(),
    cancelRequestedAt: z.iso.datetime().nullable(),
    clientBusinessName: z.string().trim().min(1).max(200),
    clientId: clientIdSchema,
    completedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    failedPageCount: z.number().int().nonnegative().max(100),
    failure: auditJobFailureSchema.nullable(),
    id: z.uuid(),
    pagesCompleted: z.number().int().nonnegative().max(100),
    pagesTotal: z.number().int().positive().max(100),
    scopeId: z.uuid(),
    startedAt: z.iso.datetime().nullable(),
    state: auditJobStateSchema,
    targetUrl: z.url(),
    updatedAt: z.iso.datetime(),
    warningCount: z.number().int().nonnegative().max(50),
    warnings: z.array(z.string().trim().min(1).max(500)).max(50),
    websiteId: z.uuid(),
  })
  .strict()
  .superRefine((job, context) => {
    if (job.pagesCompleted > job.pagesTotal) {
      context.addIssue({
        code: "custom",
        message: "Completed page count cannot exceed the job total",
        path: ["pagesCompleted"],
      });
    }
    if (job.warningCount !== job.warnings.length) {
      context.addIssue({
        code: "custom",
        message: "Warning count must match the stored warnings",
        path: ["warningCount"],
      });
    }
  });
export const auditJobListQuerySchema = z
  .object({
    clientId: clientIdSchema.optional(),
    page: z.number().int().min(1).max(100_000).default(1),
    pageSize: z.number().int().min(1).max(100).default(25),
    states: z
      .array(auditJobStateSchema)
      .max(AUDIT_JOB_STATES.length)
      .refine((states) => new Set(states).size === states.length, "Job states must be unique")
      .default([]),
  })
  .strict();
export const auditJobListResultSchema = z
  .object({
    items: z.array(auditJobRecordSchema),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
  })
  .strict();
export const startAuditJobRequestSchema = z.object({ scopeId: z.uuid() }).strict();
export const auditJobIdRequestSchema = z.object({ id: z.uuid() }).strict();
export const auditJobMutationResultSchema = z.discriminatedUnion("ok", [
  z.object({ job: auditJobRecordSchema, ok: z.literal(true) }).strict(),
  z
    .object({
      error: z
        .object({
          code: z.enum([
            "not-found",
            "worker-unavailable",
            "not-cancellable",
            "not-retryable",
            "transition-conflict",
          ]),
          message: z.string().trim().min(1).max(1_000),
        })
        .strict(),
      ok: z.literal(false),
    })
    .strict(),
]);

export const AUDIT_HISTORY_RESULT_STATES = [
  "completed",
  "partially-completed",
  "unavailable",
] as const;
export const auditHistoryResultStateSchema = z.enum(AUDIT_HISTORY_RESULT_STATES);
export const auditResultSummarySchema = z
  .object({
    artifactCount: z.number().int().nonnegative().max(AUDIT_SCOPE_REPORT_FORMATS.length),
    auditId: z.string().trim().min(1).max(200),
    availableArtifactCount: z.number().int().nonnegative().max(AUDIT_SCOPE_REPORT_FORMATS.length),
    categoryScores: z.record(z.string(), z.number().min(0).max(100)),
    completedAt: z.iso.datetime(),
    findingCounts: findingCountsSchema,
    overallScore: z.number().min(0).max(100),
    resultState: z.enum(["completed", "partially-completed"]),
    schemaVersion: z.string().trim().min(1).max(50),
  })
  .strict()
  .refine((result) => result.availableArtifactCount <= result.artifactCount, {
    message: "Available artifact count cannot exceed the artifact total",
    path: ["availableArtifactCount"],
  });
export const auditHistoryRecordSchema = z
  .object({
    job: auditJobRecordSchema,
    result: auditResultSummarySchema.nullable(),
  })
  .strict();
export const auditHistoryListQuerySchema = z
  .object({
    clientId: clientIdSchema.optional(),
    dateFrom: z.iso.datetime().optional(),
    dateTo: z.iso.datetime().optional(),
    page: z.number().int().min(1).max(100_000).default(1),
    pageSize: z.number().int().min(10).max(100).default(25),
    resultState: z.union([auditHistoryResultStateSchema, z.literal("all")]).default("all"),
    search: z.string().trim().max(200).default(""),
    state: z.union([auditJobStateSchema, z.literal("all")]).default("all"),
  })
  .strict()
  .refine(
    (query) =>
      query.dateFrom === undefined ||
      query.dateTo === undefined ||
      Date.parse(query.dateFrom) <= Date.parse(query.dateTo),
    { message: "The start date must not be later than the end date", path: ["dateFrom"] },
  );
export const auditHistoryListResultSchema = z
  .object({
    items: z.array(auditHistoryRecordSchema),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
  })
  .strict();

export const REPORT_ARTIFACT_FORMATS = AUDIT_SCOPE_REPORT_FORMATS;
export const REPORT_ARTIFACT_STATUSES = [
  "available",
  "missing",
  "generation-failed",
  "expired",
] as const;
export const reportArtifactFormatSchema = auditScopeReportFormatSchema;
export const reportArtifactStatusSchema = z.enum(REPORT_ARTIFACT_STATUSES);
export const reportArtifactRecordSchema = z
  .object({
    auditId: z.string().trim().min(1).max(200),
    clientBusinessName: z.string().trim().min(1).max(200),
    clientId: clientIdSchema,
    createdAt: z.iso.datetime(),
    fileName: z.string().trim().min(1).max(255),
    format: reportArtifactFormatSchema,
    id: z.uuid(),
    jobId: z.uuid(),
    retainedUntil: z.iso.datetime().nullable(),
    status: reportArtifactStatusSchema,
    targetUrl: z.url(),
    updatedAt: z.iso.datetime(),
    verifiedAt: z.iso.datetime().nullable(),
    websiteId: z.uuid(),
  })
  .strict();
export const reportArtifactListQuerySchema = z
  .object({
    clientId: clientIdSchema.optional(),
    format: z.union([reportArtifactFormatSchema, z.literal("all")]).default("all"),
    jobId: z.uuid().optional(),
    page: z.number().int().min(1).max(100_000).default(1),
    pageSize: z.number().int().min(10).max(100).default(25),
    search: z.string().trim().max(200).default(""),
    status: z.union([reportArtifactStatusSchema, z.literal("all")]).default("all"),
  })
  .strict();
export const reportArtifactListResultSchema = z
  .object({
    items: z.array(reportArtifactRecordSchema),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
  })
  .strict();
export const reportArtifactActionRequestSchema = z.object({ artifactId: z.uuid() }).strict();
export const reportArtifactActionResultSchema = z.discriminatedUnion("ok", [
  z
    .object({
      action: z.enum(["opened", "revealed", "exported"]),
      ok: z.literal(true),
    })
    .strict(),
  z
    .object({
      error: z
        .object({
          code: z.enum([
            "not-found",
            "unavailable",
            "expired",
            "unsafe-path",
            "cancelled",
            "open-failed",
            "export-failed",
          ]),
          message: z.string().trim().min(1).max(1_000),
        })
        .strict(),
      ok: z.literal(false),
    })
    .strict(),
]);

export const serviceStateSchema = z.enum(["ready", "unavailable"]);

export const workspaceSummarySchema = z
  .object({
    audits: z.number().int().nonnegative(),
    clients: z.number().int().nonnegative(),
    prospects: z.number().int().nonnegative(),
    reports: z.number().int().nonnegative(),
  })
  .strict();

export const desktopBootstrapSchema = z
  .object({
    app: z
      .object({
        name: z.string().trim().min(1).max(100),
        platform: z.enum(["darwin", "linux", "win32"]),
        version: z.string().trim().min(1).max(50),
      })
      .strict(),
    initializedAt: z.iso.datetime(),
    services: z
      .object({
        database: serviceStateSchema,
        worker: serviceStateSchema,
      })
      .strict(),
    workspace: workspaceSummarySchema,
  })
  .strict();

export type DesktopBootstrap = z.infer<typeof desktopBootstrapSchema>;
export type ClientInput = z.infer<typeof clientInputSchema>;
export type ClientListQuery = z.infer<typeof clientListQuerySchema>;
export type ClientListResult = z.infer<typeof clientListResultSchema>;
export type ClientMutationResult = z.infer<typeof clientMutationResultSchema>;
export type ClientRecord = z.infer<typeof clientRecordSchema>;
export type ClientStatus = z.infer<typeof clientStatusSchema>;
export type DeleteClientResult = z.infer<typeof deleteClientResultSchema>;
export type CampaignInput = z.infer<typeof campaignInputSchema>;
export type CampaignState = z.infer<typeof campaignStateSchema>;
export type DiscoveryCampaignInput = z.infer<typeof discoveryCampaignInputSchema>;
export type DiscoveryCampaignListQuery = z.infer<typeof discoveryCampaignListQuerySchema>;
export type DiscoveryCampaignListResult = z.infer<typeof discoveryCampaignListResultSchema>;
export type DiscoveryCampaignMutationResult = z.infer<typeof discoveryCampaignMutationResultSchema>;
export type DiscoveryCampaignRecord = z.infer<typeof discoveryCampaignRecordSchema>;
export type DiscoveryProvider = z.infer<typeof discoveryProviderSchema>;
export type ProspectActionResult = z.infer<typeof prospectActionResultSchema>;
export type ProspectImportResult = z.infer<typeof prospectImportResultSchema>;
export type ProspectListQuery = z.infer<typeof prospectListQuerySchema>;
export type ProspectListResult = z.infer<typeof prospectListResultSchema>;
export type ProspectMutationResult = z.infer<typeof prospectMutationResultSchema>;
export type ProspectPromotionResult = z.infer<typeof prospectPromotionResultSchema>;
export type ProspectQualificationInput = z.infer<typeof prospectQualificationInputSchema>;
export type ProspectRecord = z.infer<typeof prospectRecordSchema>;
export type ProspectSourceInput = z.infer<typeof prospectSourceInputSchema>;
export type ProspectState = z.infer<typeof prospectStateSchema>;
export type ProspectWebsiteAvailability = z.infer<typeof prospectWebsiteAvailabilitySchema>;
export type DiscoveryResult = z.infer<typeof discoveryResultSchema>;
export type DiscoveryRun = z.infer<typeof discoveryRunSchema>;
export type AuditScopeConfiguration = z.infer<typeof auditScopeConfigurationSchema>;
export type AuditScopeRecord = z.infer<typeof auditScopeRecordSchema>;
export type CreateAuditScopeResult = z.infer<typeof createAuditScopeResultSchema>;
export type AuditScopeReportFormat = z.infer<typeof auditScopeReportFormatSchema>;
export type AuditJobListQuery = z.infer<typeof auditJobListQuerySchema>;
export type AuditJobListResult = z.infer<typeof auditJobListResultSchema>;
export type AuditJobMutationResult = z.infer<typeof auditJobMutationResultSchema>;
export type AuditJobRecord = z.infer<typeof auditJobRecordSchema>;
export type AuditJobState = z.infer<typeof auditJobStateSchema>;
export type AuditHistoryListQuery = z.infer<typeof auditHistoryListQuerySchema>;
export type AuditHistoryListResult = z.infer<typeof auditHistoryListResultSchema>;
export type AuditHistoryRecord = z.infer<typeof auditHistoryRecordSchema>;
export type AuditHistoryResultState = z.infer<typeof auditHistoryResultStateSchema>;
export type AuditResultSummary = z.infer<typeof auditResultSummarySchema>;
export type PageSelectionAction = z.infer<typeof pageSelectionActionSchema>;
export type PageSelectionResult = z.infer<typeof pageSelectionResultSchema>;
export type ReportArtifactActionResult = z.infer<typeof reportArtifactActionResultSchema>;
export type ReportArtifactFormat = z.infer<typeof reportArtifactFormatSchema>;
export type ReportArtifactListQuery = z.infer<typeof reportArtifactListQuerySchema>;
export type ReportArtifactListResult = z.infer<typeof reportArtifactListResultSchema>;
export type ReportArtifactRecord = z.infer<typeof reportArtifactRecordSchema>;
export type ReportArtifactStatus = z.infer<typeof reportArtifactStatusSchema>;
export type WebsitePageListQuery = z.infer<typeof websitePageListQuerySchema>;
export type WebsitePageListResult = z.infer<typeof websitePageListResultSchema>;
export type WebsitePageRecord = z.infer<typeof websitePageRecordSchema>;

export { PAGE_TYPES };

export interface DesktopApi {
  applyPageSelection(
    request: z.infer<typeof applyPageSelectionRequestSchema>,
  ): Promise<PageSelectionResult>;
  cancelAuditJob(request: z.infer<typeof auditJobIdRequestSchema>): Promise<AuditJobMutationResult>;
  cancelDiscoveryCampaign(
    request: z.infer<typeof discoveryCampaignIdRequestSchema>,
  ): Promise<DiscoveryCampaignMutationResult>;
  createClient(input: ClientInput): Promise<ClientMutationResult>;
  createDiscoveryCampaign(
    request: z.infer<typeof createDiscoveryCampaignRequestSchema>,
  ): Promise<DiscoveryCampaignMutationResult>;
  createAuditScope(
    request: z.infer<typeof createAuditScopeRequestSchema>,
  ): Promise<CreateAuditScopeResult>;
  deleteClient(request: z.infer<typeof deleteClientRequestSchema>): Promise<DeleteClientResult>;
  deleteProspect(
    request: z.infer<typeof deleteProspectRequestSchema>,
  ): Promise<ProspectActionResult>;
  discoverWebsitePages(
    request: z.infer<typeof discoverWebsitePagesRequestSchema>,
  ): Promise<DiscoveryResult>;
  exportReport(
    request: z.infer<typeof reportArtifactActionRequestSchema>,
  ): Promise<ReportArtifactActionResult>;
  getBootstrap(): Promise<DesktopBootstrap>;
  getAuditScope(
    request: z.infer<typeof getAuditScopeRequestSchema>,
  ): Promise<AuditScopeRecord | null>;
  getAuditJob(request: z.infer<typeof auditJobIdRequestSchema>): Promise<AuditJobRecord | null>;
  getClient(request: z.infer<typeof getClientRequestSchema>): Promise<ClientRecord | null>;
  getDiscoveryProvider(): Promise<DiscoveryProvider>;
  getProspect(request: z.infer<typeof getProspectRequestSchema>): Promise<ProspectRecord | null>;
  listAuditHistory(query: AuditHistoryListQuery): Promise<AuditHistoryListResult>;
  listAuditJobs(query: AuditJobListQuery): Promise<AuditJobListResult>;
  listClients(query: ClientListQuery): Promise<ClientListResult>;
  listDiscoveryCampaigns(query: DiscoveryCampaignListQuery): Promise<DiscoveryCampaignListResult>;
  listProspects(query: ProspectListQuery): Promise<ProspectListResult>;
  listReportArtifacts(query: ReportArtifactListQuery): Promise<ReportArtifactListResult>;
  listWebsitePages(query: WebsitePageListQuery): Promise<WebsitePageListResult>;
  promoteProspect(
    request: z.infer<typeof prospectPromotionRequestSchema>,
  ): Promise<ProspectPromotionResult>;
  openReport(
    request: z.infer<typeof reportArtifactActionRequestSchema>,
  ): Promise<ReportArtifactActionResult>;
  revealReport(
    request: z.infer<typeof reportArtifactActionRequestSchema>,
  ): Promise<ReportArtifactActionResult>;
  retryAuditJob(request: z.infer<typeof auditJobIdRequestSchema>): Promise<AuditJobMutationResult>;
  resumeDiscoveryCampaign(
    request: z.infer<typeof discoveryCampaignIdRequestSchema>,
  ): Promise<DiscoveryCampaignMutationResult>;
  setProspectState(
    request: z.infer<typeof setProspectStateRequestSchema>,
  ): Promise<ProspectMutationResult>;
  setClientStatus(
    request: z.infer<typeof setClientStatusRequestSchema>,
  ): Promise<ClientMutationResult>;
  startAuditJob(
    request: z.infer<typeof startAuditJobRequestSchema>,
  ): Promise<AuditJobMutationResult>;
  suppressProspect(
    request: z.infer<typeof suppressProspectRequestSchema>,
  ): Promise<ProspectMutationResult>;
  updateClient(request: z.infer<typeof updateClientRequestSchema>): Promise<ClientMutationResult>;
  updateProspect(
    request: z.infer<typeof updateProspectRequestSchema>,
  ): Promise<ProspectMutationResult>;
  verifyProspect(
    request: z.infer<typeof verifyProspectRequestSchema>,
  ): Promise<ProspectMutationResult>;
}
