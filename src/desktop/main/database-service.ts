import { mkdir } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import { workspaceSummarySchema, type DesktopBootstrap } from "../shared/contracts.js";

const WORKSPACE_ID = "workspace";
const SCHEMA_VERSION = 1;

export class DesktopDatabaseService {
  readonly #dataDirectory: string;
  #client: PrismaClient | undefined;
  #initializedAt: string | undefined;

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

    const metadata = await this.#client.appMetadata.upsert({
      create: { id: WORKSPACE_ID, schemaVersion: SCHEMA_VERSION },
      update: { schemaVersion: SCHEMA_VERSION },
      where: { id: WORKSPACE_ID },
    });
    this.#initializedAt = metadata.createdAt.toISOString();
  }

  get initializedAt(): string {
    if (this.#initializedAt === undefined) {
      throw new Error("Desktop database has not been initialized");
    }
    return this.#initializedAt;
  }

  getWorkspaceSummary(): DesktopBootstrap["workspace"] {
    this.#requireClient();
    return workspaceSummarySchema.parse({ audits: 0, clients: 0, prospects: 0, reports: 0 });
  }

  async close(): Promise<void> {
    const client = this.#client;
    this.#client = undefined;
    if (client !== undefined) {
      await client.$disconnect();
    }
  }

  #requireClient(): PrismaClient {
    if (this.#client === undefined) {
      throw new Error("Desktop database is unavailable");
    }
    return this.#client;
  }
}
