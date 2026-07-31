import { randomUUID } from "node:crypto";

import type { Prisma, PrismaClient } from "@prisma/client";

import { normalizeTargetUrl } from "../../url/normalize-url.js";
import {
  clientInputSchema,
  clientListQuerySchema,
  clientListResultSchema,
  clientMutationResultSchema,
  clientRecordSchema,
  deleteClientResultSchema,
  type ClientInput,
  type ClientListQuery,
  type ClientListResult,
  type ClientMutationResult,
  type ClientRecord,
  type ClientStatus,
  type DeleteClientResult,
} from "../shared/contracts.js";

const detailInclude = {
  activities: { orderBy: { createdAt: "desc" }, take: 100 },
  tags: { include: { tag: true } },
  websites: { orderBy: { createdAt: "asc" }, take: 1 },
} satisfies Prisma.ClientInclude;

const listInclude = {
  tags: { include: { tag: true } },
  websites: { orderBy: { createdAt: "asc" }, take: 1 },
} satisfies Prisma.ClientInclude;

type DetailClient = Prisma.ClientGetPayload<{ include: typeof detailInclude }>;
type ListClient = Prisma.ClientGetPayload<{ include: typeof listInclude }>;

function normalizeWebsite(input: string): { domain: string; url: string } {
  const url = normalizeTargetUrl(input);
  const parsed = new URL(url);
  return {
    domain: parsed.hostname.replace(/^www\./u, ""),
    url,
  };
}

function normalizeTags(tags: readonly string[]): { name: string; normalizedName: string }[] {
  const normalized = new Map<string, string>();
  for (const tag of tags) {
    const name = tag.trim();
    const normalizedName = name.toLocaleLowerCase("en-US");
    if (!normalized.has(normalizedName)) normalized.set(normalizedName, name);
  }
  return [...normalized].map(([normalizedName, name]) => ({ name, normalizedName }));
}

function nullable(value: string | undefined): string | null {
  return value ?? null;
}

function toRecord(client: DetailClient): ClientRecord {
  const website = client.websites[0];

  return clientRecordSchema.parse({
    activities: client.activities.map((activity) => ({
      createdAt: activity.createdAt.toISOString(),
      id: activity.id,
      kind: activity.kind,
      summary: activity.summary,
    })),
    addressLine: client.addressLine,
    businessName: client.businessName,
    category: client.category,
    country: client.country,
    createdAt: client.createdAt.toISOString(),
    id: client.id,
    locality: client.locality,
    normalizedDomain: website?.normalizedDomain ?? null,
    notes: client.notes,
    owner: client.owner,
    postalCode: client.postalCode,
    publicEmail: client.publicEmail,
    publicPhone: client.publicPhone,
    region: client.region,
    status: client.status,
    tags: client.tags.map(({ tag }) => tag.name).sort((left, right) => left.localeCompare(right)),
    updatedAt: client.updatedAt.toISOString(),
    websiteUrl: website?.normalizedUrl ?? null,
  });
}

function toListRecord(client: ListClient): Omit<ClientRecord, "activities" | "notes"> {
  const {
    activities: _activities,
    notes: _notes,
    ...record
  } = toRecord({
    ...client,
    activities: [],
    notes: null,
  });
  return clientRecordSchema.omit({ activities: true, notes: true }).parse(record);
}

export class ClientRepository {
  readonly #database: PrismaClient;

  constructor(database: PrismaClient) {
    this.#database = database;
  }

  async count(): Promise<number> {
    return this.#database.client.count();
  }

  async list(queryInput: ClientListQuery): Promise<ClientListResult> {
    const query = clientListQuerySchema.parse(queryInput);
    const where: Prisma.ClientWhereInput = {
      ...(query.search.length > 0
        ? { searchText: { contains: query.search.toLocaleLowerCase("en-US") } }
        : {}),
      ...(query.status === "all" ? {} : { status: query.status }),
    };
    const orderBy: Prisma.ClientOrderByWithRelationInput =
      query.sort === "name" ? { businessName: query.direction } : { updatedAt: query.direction };

    const [total, clients] = await this.#database.$transaction([
      this.#database.client.count({ where }),
      this.#database.client.findMany({
        include: listInclude,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        where,
      }),
    ]);

    return clientListResultSchema.parse({
      items: clients.map(toListRecord),
      page: query.page,
      pageSize: query.pageSize,
      total,
    });
  }

  async get(id: string): Promise<ClientRecord | null> {
    const client = await this.#database.client.findUnique({
      include: detailInclude,
      where: { id },
    });
    return client === null ? null : toRecord(client);
  }

  async create(inputValue: ClientInput): Promise<ClientMutationResult> {
    const input = clientInputSchema.parse(inputValue);
    const website = normalizeWebsite(input.websiteUrl);
    const existing = await this.#findByDomain(website.domain);
    if (existing !== null) return this.#duplicateResult(existing.clientId, website.domain);

    const clientId = randomUUID();
    await this.#database.$transaction(async (database) => {
      await database.client.create({
        data: {
          ...this.#profileData(input, website.domain),
          id: clientId,
          websites: {
            create: {
              id: randomUUID(),
              normalizedDomain: website.domain,
              normalizedUrl: website.url,
              url: input.websiteUrl,
            },
          },
        },
      });
      await this.#replaceTags(database, clientId, input.tags);
      await database.clientActivity.create({
        data: { clientId, id: randomUUID(), kind: "created", summary: "Client created" },
      });
    });

    const client = await this.get(clientId);
    if (client === null) throw new Error("Created client could not be loaded");
    return clientMutationResultSchema.parse({ client, ok: true });
  }

  async update(id: string, inputValue: ClientInput): Promise<ClientMutationResult> {
    const input = clientInputSchema.parse(inputValue);
    const current = await this.get(id);
    if (current === null) return this.#notFoundResult();

    const website = normalizeWebsite(input.websiteUrl);
    const existing = await this.#findByDomain(website.domain);
    if (existing !== null && existing.clientId !== id) {
      return this.#duplicateResult(existing.clientId, website.domain);
    }

    await this.#database.$transaction(async (database) => {
      await database.client.update({
        data: this.#profileData(input, website.domain),
        where: { id },
      });
      await database.website.updateMany({
        data: {
          normalizedDomain: website.domain,
          normalizedUrl: website.url,
          url: input.websiteUrl,
        },
        where: { clientId: id },
      });
      await this.#replaceTags(database, id, input.tags);
      await database.clientActivity.create({
        data: {
          clientId: id,
          id: randomUUID(),
          kind: "updated",
          summary: "Client profile updated",
        },
      });
    });

    const client = await this.get(id);
    if (client === null) return this.#notFoundResult();
    return clientMutationResultSchema.parse({ client, ok: true });
  }

  async setStatus(id: string, status: ClientStatus): Promise<ClientMutationResult> {
    const existing = await this.#database.client.findUnique({ where: { id } });
    if (existing === null) return this.#notFoundResult();

    await this.#database.$transaction([
      this.#database.client.update({
        data: { archivedAt: status === "archived" ? new Date() : null, status },
        where: { id },
      }),
      this.#database.clientActivity.create({
        data: {
          clientId: id,
          id: randomUUID(),
          kind: "status",
          summary: `Client marked ${status}`,
        },
      }),
    ]);
    const client = await this.get(id);
    if (client === null) return this.#notFoundResult();
    return clientMutationResultSchema.parse({ client, ok: true });
  }

  async delete(id: string, confirmation: string): Promise<DeleteClientResult> {
    const existing = await this.#database.client.findUnique({ where: { id } });
    if (existing === null) {
      return deleteClientResultSchema.parse({
        error: { code: "not-found", message: "Client was not found" },
        ok: false,
      });
    }
    if (confirmation !== existing.businessName) {
      return deleteClientResultSchema.parse({
        error: {
          code: "confirmation-mismatch",
          message: "Confirmation must exactly match the business name",
        },
        ok: false,
      });
    }

    const retainedScopeCount = await this.#database.auditScope.count({ where: { clientId: id } });
    if (retainedScopeCount > 0) {
      return deleteClientResultSchema.parse({
        error: {
          code: "retained-history",
          message: "This client has retained audit scopes and cannot be permanently deleted.",
        },
        ok: false,
      });
    }

    await this.#database.client.delete({ where: { id } });
    return deleteClientResultSchema.parse({ ok: true });
  }

  #profileData(input: ClientInput, domain: string): Prisma.ClientUncheckedCreateInput {
    return {
      addressLine: nullable(input.addressLine),
      businessName: input.businessName,
      category: nullable(input.category),
      country: nullable(input.country),
      locality: nullable(input.locality),
      notes: nullable(input.notes),
      owner: nullable(input.owner),
      postalCode: nullable(input.postalCode),
      publicEmail: nullable(input.publicEmail),
      publicPhone: nullable(input.publicPhone),
      region: nullable(input.region),
      searchText: `${input.businessName} ${domain}`.toLocaleLowerCase("en-US"),
    };
  }

  async #replaceTags(
    database: Prisma.TransactionClient,
    clientId: string,
    tags: readonly string[],
  ): Promise<void> {
    await database.clientTag.deleteMany({ where: { clientId } });
    for (const tagInput of normalizeTags(tags)) {
      const tag = await database.tag.upsert({
        create: { id: randomUUID(), ...tagInput },
        update: { name: tagInput.name },
        where: { normalizedName: tagInput.normalizedName },
      });
      await database.clientTag.create({ data: { clientId, tagId: tag.id } });
    }
  }

  async #findByDomain(domain: string): Promise<{ clientId: string } | null> {
    return this.#database.website.findUnique({
      select: { clientId: true },
      where: { normalizedDomain: domain },
    });
  }

  #duplicateResult(clientId: string, domain: string): ClientMutationResult {
    return clientMutationResultSchema.parse({
      error: {
        clientId,
        code: "duplicate-domain",
        message: `A client already uses ${domain}`,
      },
      ok: false,
    });
  }

  #notFoundResult(): ClientMutationResult {
    return clientMutationResultSchema.parse({
      error: { code: "not-found", message: "Client was not found" },
      ok: false,
    });
  }
}
