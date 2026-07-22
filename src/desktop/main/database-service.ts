import { mkdir } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import {
  workspaceSummarySchema,
  type ClientInput,
  type ClientListQuery,
  type ClientListResult,
  type ClientMutationResult,
  type ClientRecord,
  type ClientStatus,
  type DeleteClientResult,
  type DesktopBootstrap,
  type DiscoveryResult,
  type WebsitePageListQuery,
  type WebsitePageListResult,
} from "../shared/contracts.js";
import { CLIENT_SCHEMA_STATEMENTS } from "./client-migrations.js";
import { ClientRepository } from "./client-repository.js";
import { PageDiscoveryService } from "./page-discovery-service.js";
import { PageInventoryRepository } from "./page-inventory-repository.js";
import { PAGE_SCHEMA_STATEMENTS } from "./page-migrations.js";

const WORKSPACE_ID = "workspace";
const SCHEMA_VERSION = 3;

export class DesktopDatabaseService {
  readonly #dataDirectory: string;
  #client: PrismaClient | undefined;
  #clients: ClientRepository | undefined;
  #discovery: PageDiscoveryService | undefined;
  #initializedAt: string | undefined;
  #pages: PageInventoryRepository | undefined;

  constructor(dataDirectory: string) {
    this.#dataDirectory = path.resolve(dataDirectory);
  }

  async initialize(): Promise<void> {
    await mkdir(this.#dataDirectory, { recursive: true });
    const databasePath = path.join(this.#dataDirectory, "workspace.db").replaceAll("\\", "/");
    process.env.DATABASE_URL = `file:${databasePath}`;

    this.#client = new PrismaClient();
    await this.#client.$connect();
    await this.#client.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AppMetadata" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "schemaVersion" INTEGER NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL
      )
    `);
    await this.#client.$executeRawUnsafe("PRAGMA foreign_keys = ON");
    for (const statement of CLIENT_SCHEMA_STATEMENTS) {
      await this.#client.$executeRawUnsafe(statement);
    }
    for (const statement of PAGE_SCHEMA_STATEMENTS) {
      await this.#client.$executeRawUnsafe(statement);
    }
    await this.#client.discoveryRun.updateMany({
      data: {
        completedAt: new Date(),
        failureMessage: "Discovery was interrupted when the desktop application closed.",
        status: "failed",
      },
      where: { status: "running" },
    });

    const metadata = await this.#client.appMetadata.upsert({
      create: { id: WORKSPACE_ID, schemaVersion: SCHEMA_VERSION },
      update: { schemaVersion: SCHEMA_VERSION },
      where: { id: WORKSPACE_ID },
    });
    this.#clients = new ClientRepository(this.#client);
    this.#pages = new PageInventoryRepository(this.#client);
    this.#discovery = new PageDiscoveryService(this.#pages);
    this.#initializedAt = metadata.createdAt.toISOString();
  }

  get initializedAt(): string {
    if (this.#initializedAt === undefined) {
      throw new Error("Desktop database has not been initialized");
    }
    return this.#initializedAt;
  }

  async getWorkspaceSummary(): Promise<DesktopBootstrap["workspace"]> {
    return workspaceSummarySchema.parse({
      audits: 0,
      clients: await this.#requireClients().count(),
      prospects: 0,
      reports: 0,
    });
  }

  listClients(query: ClientListQuery): Promise<ClientListResult> {
    return this.#requireClients().list(query);
  }

  getClient(id: string): Promise<ClientRecord | null> {
    return this.#requireClients().get(id);
  }

  createClient(input: ClientInput): Promise<ClientMutationResult> {
    return this.#requireClients().create(input);
  }

  updateClient(id: string, input: ClientInput): Promise<ClientMutationResult> {
    return this.#requireClients().update(id, input);
  }

  setClientStatus(id: string, status: ClientStatus): Promise<ClientMutationResult> {
    return this.#requireClients().setStatus(id, status);
  }

  deleteClient(id: string, confirmation: string): Promise<DeleteClientResult> {
    return this.#requireClients().delete(id, confirmation);
  }

  listWebsitePages(query: WebsitePageListQuery): Promise<WebsitePageListResult> {
    return this.#requirePages().list(query);
  }

  discoverWebsitePages(clientId: string, maxPages: number): Promise<DiscoveryResult> {
    return this.#requireDiscovery().discover(clientId, maxPages);
  }

  async close(): Promise<void> {
    const client = this.#client;
    this.#client = undefined;
    this.#clients = undefined;
    this.#discovery = undefined;
    this.#pages = undefined;
    if (client !== undefined) {
      await client.$disconnect();
    }
  }

  #requireClients(): ClientRepository {
    if (this.#clients === undefined) {
      throw new Error("Client repository is unavailable");
    }
    return this.#clients;
  }

  #requirePages(): PageInventoryRepository {
    if (this.#pages === undefined) throw new Error("Page inventory repository is unavailable");
    return this.#pages;
  }

  #requireDiscovery(): PageDiscoveryService {
    if (this.#discovery === undefined) throw new Error("Page discovery service is unavailable");
    return this.#discovery;
  }
}
