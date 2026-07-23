import { app } from "electron";
import type { Logger } from "pino";

import { desktopBootstrapSchema, type DesktopBootstrap } from "../shared/contracts.js";
import { AuditJobManager } from "./audit-job-manager.js";
import { DesktopDatabaseService } from "./database-service.js";
import { ReportArtifactService } from "./report-artifact-service.js";
import { WorkerCoordinator } from "./worker-coordinator.js";

export class ApplicationServices {
  readonly #database: DesktopDatabaseService;
  readonly #jobs: AuditJobManager;
  readonly #logger: Logger;
  readonly #dataDirectory: string;
  readonly #worker: WorkerCoordinator;
  #databaseReady = false;
  #reports: ReportArtifactService | undefined;

  constructor(options: { dataDirectory: string; logger: Logger }) {
    this.#dataDirectory = options.dataDirectory;
    this.#database = new DesktopDatabaseService(options.dataDirectory);
    this.#logger = options.logger;
    this.#worker = new WorkerCoordinator(options.logger);
    this.#jobs = new AuditJobManager({
      dataDirectory: options.dataDirectory,
      database: this.#database,
      logger: options.logger,
      worker: this.#worker,
    });
  }

  async initialize(): Promise<void> {
    const [databaseResult, workerResult] = await Promise.allSettled([
      this.#database.initialize(),
      this.#worker.start(),
    ]);

    this.#databaseReady = databaseResult.status === "fulfilled";
    if (databaseResult.status === "rejected") {
      this.#logger.error({ error: databaseResult.reason }, "Desktop database failed to initialize");
    }
    if (workerResult.status === "rejected") {
      this.#logger.error({ error: workerResult.reason }, "Desktop worker failed to initialize");
    }
    if (databaseResult.status === "fulfilled" && workerResult.status === "fulfilled") {
      await this.#jobs.initialize();
    }
    if (databaseResult.status === "fulfilled") {
      this.#reports = new ReportArtifactService({
        dataDirectory: this.#dataDirectory,
        history: this.#database.history,
      });
      await this.#reports.initialize();
    }
  }

  async getBootstrap(): Promise<DesktopBootstrap> {
    const workspace = this.#databaseReady
      ? await this.#database.getWorkspaceSummary()
      : { audits: 0, clients: 0, prospects: 0, reports: 0 };

    return desktopBootstrapSchema.parse({
      app: {
        name: app.getName(),
        platform: process.platform,
        version: app.getVersion(),
      },
      initializedAt: this.#databaseReady ? this.#database.initializedAt : new Date().toISOString(),
      services: {
        database: this.#databaseReady ? "ready" : "unavailable",
        worker: this.#worker.ready ? "ready" : "unavailable",
      },
      workspace,
    });
  }

  get database(): DesktopDatabaseService {
    return this.#database;
  }

  get jobs(): AuditJobManager {
    return this.#jobs;
  }

  get reports(): ReportArtifactService {
    if (this.#reports === undefined) throw new Error("Report service is unavailable");
    return this.#reports;
  }

  async close(): Promise<void> {
    await this.#jobs.stop();
    await this.#worker.stop();
    this.#reports = undefined;
    await this.#database.close();
  }
}
