import { z } from "zod";

export const IPC_CHANNELS = {
  createClient: "desktop:clients:create",
  deleteClient: "desktop:clients:delete",
  getBootstrap: "desktop:get-bootstrap",
  getClient: "desktop:clients:get",
  listClients: "desktop:clients:list",
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

export interface DesktopApi {
  createClient(input: ClientInput): Promise<ClientMutationResult>;
  deleteClient(request: z.infer<typeof deleteClientRequestSchema>): Promise<DeleteClientResult>;
  getBootstrap(): Promise<DesktopBootstrap>;
  getClient(request: z.infer<typeof getClientRequestSchema>): Promise<ClientRecord | null>;
  listClients(query: ClientListQuery): Promise<ClientListResult>;
  setClientStatus(
    request: z.infer<typeof setClientStatusRequestSchema>,
  ): Promise<ClientMutationResult>;
  updateClient(request: z.infer<typeof updateClientRequestSchema>): Promise<ClientMutationResult>;
}
