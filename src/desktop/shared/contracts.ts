import { z } from "zod";

import { PAGE_TYPES, pageTypeSchema } from "../../core/schemas.js";

export const IPC_CHANNELS = {
  createClient: "desktop:clients:create",
  deleteClient: "desktop:clients:delete",
  discoverWebsitePages: "desktop:pages:discover",
  getBootstrap: "desktop:get-bootstrap",
  getClient: "desktop:clients:get",
  listClients: "desktop:clients:list",
  listWebsitePages: "desktop:pages:list",
  setClientStatus: "desktop:clients:set-status",
  updateClient: "desktop:clients:update",
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
    normalizedDomain: z.string().trim().min(1).max(253),
    owner: z.string().nullable(),
    postalCode: z.string().nullable(),
    publicEmail: z.string().nullable(),
    publicPhone: z.string().nullable(),
    region: z.string().nullable(),
    status: clientStatusSchema,
    tags: z.array(z.string().trim().min(1).max(50)).max(20),
    updatedAt: z.iso.datetime(),
    websiteUrl: z.url(),
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
export type DiscoveryResult = z.infer<typeof discoveryResultSchema>;
export type DiscoveryRun = z.infer<typeof discoveryRunSchema>;
export type WebsitePageListQuery = z.infer<typeof websitePageListQuerySchema>;
export type WebsitePageListResult = z.infer<typeof websitePageListResultSchema>;
export type WebsitePageRecord = z.infer<typeof websitePageRecordSchema>;

export { PAGE_TYPES };

export interface DesktopApi {
  createClient(input: ClientInput): Promise<ClientMutationResult>;
  deleteClient(request: z.infer<typeof deleteClientRequestSchema>): Promise<DeleteClientResult>;
  discoverWebsitePages(
    request: z.infer<typeof discoverWebsitePagesRequestSchema>,
  ): Promise<DiscoveryResult>;
  getBootstrap(): Promise<DesktopBootstrap>;
  getClient(request: z.infer<typeof getClientRequestSchema>): Promise<ClientRecord | null>;
  listClients(query: ClientListQuery): Promise<ClientListResult>;
  listWebsitePages(query: WebsitePageListQuery): Promise<WebsitePageListResult>;
  setClientStatus(
    request: z.infer<typeof setClientStatusRequestSchema>,
  ): Promise<ClientMutationResult>;
  updateClient(request: z.infer<typeof updateClientRequestSchema>): Promise<ClientMutationResult>;
}
