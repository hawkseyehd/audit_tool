import { mkdir } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import {
  workspaceSummarySchema,
  type AuditScopeConfiguration,
  type AuditHistoryListQuery,
  type AuditHistoryListResult,
  type AuditScopeRecord,
  type AuditScopeReportFormat,
  type ClientInput,
  type ClientListQuery,
  type ClientListResult,
  type ClientMutationResult,
  type ClientRecord,
  type ClientStatus,
  type CreateAuditScopeResult,
  type DeleteClientResult,
  type DesktopBootstrap,
  type DiscoveryResult,
  type DiscoveryCampaignListQuery,
  type DiscoveryCampaignListResult,
  type PageSelectionAction,
  type PageSelectionResult,
  type ProspectActionResult,
  type ProspectListQuery,
  type ProspectListResult,
  type ProspectMutationResult,
  type ProspectPromotionResult,
  type ProspectQualificationInput,
  type ProspectRecord,
  type ProspectState,
  type ReportArtifactListQuery,
  type ReportArtifactListResult,
  type WebsitePageListQuery,
  type WebsitePageListResult,
} from "../shared/contracts.js";
import { AuditHistoryRepository } from "./audit-history-repository.js";
import { AuditScopeRepository } from "./audit-scope-repository.js";
import { AuditJobRepository } from "./audit-job-repository.js";
import { CLIENT_SCHEMA_STATEMENTS } from "./client-migrations.js";
import { ClientRepository } from "./client-repository.js";
import { JOB_SCHEMA_STATEMENTS } from "./job-migrations.js";
import { HISTORY_SCHEMA_STATEMENTS } from "./history-migrations.js";
import { PageDiscoveryService } from "./page-discovery-service.js";
import { PageInventoryRepository } from "./page-inventory-repository.js";
import { PAGE_SCHEMA_STATEMENTS } from "./page-migrations.js";
import {
  CAMPAIGN_SCHEMA_COLUMNS,
  PROSPECT_SCHEMA_COLUMNS,
  PROSPECT_SCHEMA_STATEMENTS,
} from "./prospect-migrations.js";
import { DiscoveryCampaignRepository, ProspectRepository } from "./prospect-repository.js";
import { SCOPE_SCHEMA_STATEMENTS } from "./scope-migrations.js";

const WORKSPACE_ID = "workspace";
const SCHEMA_VERSION = 8;

export class DesktopDatabaseService {
  readonly #dataDirectory: string;
  #client: PrismaClient | undefined;
  #campaigns: DiscoveryCampaignRepository | undefined;
  #clients: ClientRepository | undefined;
  #discovery: PageDiscoveryService | undefined;
  #initializedAt: string | undefined;
  #history: AuditHistoryRepository | undefined;
  #jobs: AuditJobRepository | undefined;
  #pages: PageInventoryRepository | undefined;
  #prospects: ProspectRepository | undefined;
  #scopes: AuditScopeRepository | undefined;

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
    for (const statement of SCOPE_SCHEMA_STATEMENTS) {
      await this.#client.$executeRawUnsafe(statement);
    }
    for (const statement of JOB_SCHEMA_STATEMENTS) {
      await this.#client.$executeRawUnsafe(statement);
    }
    for (const statement of HISTORY_SCHEMA_STATEMENTS) {
      await this.#client.$executeRawUnsafe(statement);
    }
    for (const statement of PROSPECT_SCHEMA_STATEMENTS) {
      await this.#client.$executeRawUnsafe(statement);
    }
    const campaignColumns = await this.#client.$queryRawUnsafe<{ name: string }[]>(
      'PRAGMA table_info("DiscoveryCampaign")',
    );
    const existingCampaignColumns = new Set(campaignColumns.map((column) => column.name));
    for (const column of CAMPAIGN_SCHEMA_COLUMNS) {
      if (!existingCampaignColumns.has(column.name)) {
        await this.#client.$executeRawUnsafe(
          `ALTER TABLE "DiscoveryCampaign" ADD COLUMN ${column.definition}`,
        );
      }
    }
    const prospectColumns = await this.#client.$queryRawUnsafe<{ name: string }[]>(
      'PRAGMA table_info("Prospect")',
    );
    const existingProspectColumns = new Set(prospectColumns.map((column) => column.name));
    for (const column of PROSPECT_SCHEMA_COLUMNS) {
      if (!existingProspectColumns.has(column.name)) {
        await this.#client.$executeRawUnsafe(
          `ALTER TABLE "Prospect" ADD COLUMN ${column.definition}`,
        );
      }
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
    this.#campaigns = new DiscoveryCampaignRepository(this.#client);
    this.#pages = new PageInventoryRepository(this.#client);
    this.#discovery = new PageDiscoveryService(this.#pages);
    this.#scopes = new AuditScopeRepository(this.#client);
    this.#history = new AuditHistoryRepository(this.#client);
    this.#jobs = new AuditJobRepository(this.#client, path.join(this.#dataDirectory, "audits"));
    this.#prospects = new ProspectRepository(this.#client);
    await this.#campaigns.markInterrupted();
    await this.#prospects.deleteExpired();
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
      audits: await this.jobs.count(),
      clients: await this.#requireClients().count(),
      prospects: await this.#requireProspects().count(),
      reports: await this.history.countArtifacts(),
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

  listProspects(query: ProspectListQuery): Promise<ProspectListResult> {
    return this.#requireProspects().list(query);
  }

  listDiscoveryCampaigns(query: DiscoveryCampaignListQuery): Promise<DiscoveryCampaignListResult> {
    return this.campaigns.list(query);
  }

  getProspect(id: string): Promise<ProspectRecord | null> {
    return this.#requireProspects().get(id);
  }

  updateProspect(id: string, input: ProspectQualificationInput): Promise<ProspectMutationResult> {
    return this.#requireProspects().updateQualification(id, input);
  }

  verifyProspect(id: string): Promise<ProspectMutationResult> {
    return this.#requireProspects().verify(id);
  }

  promoteProspect(id: string, existingClientId?: string): Promise<ProspectPromotionResult> {
    return this.#requireProspects().promote(id, existingClientId);
  }

  setProspectState(id: string, state: ProspectState): Promise<ProspectMutationResult> {
    return this.#requireProspects().setState(id, state);
  }

  suppressProspect(
    id: string,
    reason: string,
    doNotContact: boolean,
  ): Promise<ProspectMutationResult> {
    return this.#requireProspects().suppress(id, reason, doNotContact);
  }

  deleteProspect(id: string, confirmation: string): Promise<ProspectActionResult> {
    return this.#requireProspects().delete(id, confirmation);
  }

  listWebsitePages(query: WebsitePageListQuery): Promise<WebsitePageListResult> {
    return this.#requirePages().list(query);
  }

  discoverWebsitePages(clientId: string, maxPages: number): Promise<DiscoveryResult> {
    return this.#requireDiscovery().discover(clientId, maxPages);
  }

  applyPageSelection(
    clientId: string,
    action: PageSelectionAction,
    pageIds: readonly string[],
  ): Promise<PageSelectionResult> {
    return this.#requireScopes().applySelection(clientId, action, pageIds);
  }

  createAuditScope(
    clientId: string,
    configuration: AuditScopeConfiguration,
    reportFormats: readonly AuditScopeReportFormat[],
  ): Promise<CreateAuditScopeResult> {
    return this.#requireScopes().createScope(clientId, configuration, reportFormats);
  }

  getAuditScope(id: string): Promise<AuditScopeRecord | null> {
    return this.#requireScopes().get(id);
  }

  get jobs(): AuditJobRepository {
    if (this.#jobs === undefined) throw new Error("Audit job repository is unavailable");
    return this.#jobs;
  }

  get campaigns(): DiscoveryCampaignRepository {
    if (this.#campaigns === undefined) {
      throw new Error("Discovery campaign repository is unavailable");
    }
    return this.#campaigns;
  }

  get prospects(): ProspectRepository {
    return this.#requireProspects();
  }

  get history(): AuditHistoryRepository {
    if (this.#history === undefined) throw new Error("Audit history repository is unavailable");
    return this.#history;
  }

  listAuditHistory(query: AuditHistoryListQuery): Promise<AuditHistoryListResult> {
    return this.history.listHistory(query);
  }

  listReportArtifacts(query: ReportArtifactListQuery): Promise<ReportArtifactListResult> {
    return this.history.listArtifacts(query);
  }

  async close(): Promise<void> {
    const client = this.#client;
    this.#client = undefined;
    this.#clients = undefined;
    this.#campaigns = undefined;
    this.#discovery = undefined;
    this.#history = undefined;
    this.#jobs = undefined;
    this.#pages = undefined;
    this.#prospects = undefined;
    this.#scopes = undefined;
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

  #requireProspects(): ProspectRepository {
    if (this.#prospects === undefined) throw new Error("Prospect repository is unavailable");
    return this.#prospects;
  }

  #requireDiscovery(): PageDiscoveryService {
    if (this.#discovery === undefined) throw new Error("Page discovery service is unavailable");
    return this.#discovery;
  }

  #requireScopes(): AuditScopeRepository {
    if (this.#scopes === undefined) throw new Error("Audit scope repository is unavailable");
    return this.#scopes;
  }
}
