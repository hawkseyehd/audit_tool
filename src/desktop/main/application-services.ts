import { app } from "electron";
import type { Logger } from "pino";

import { desktopBootstrapSchema, type DesktopBootstrap } from "../shared/contracts.js";
import { DesktopDatabaseService } from "./database-service.js";
import { WorkerCoordinator } from "./worker-coordinator.js";

export class ApplicationServices {
  readonly #database: DesktopDatabaseService;
  readonly #logger: Logger;
  readonly #worker: WorkerCoordinator;
  #databaseReady = false;

  constructor(options: { dataDirectory: string; logger: Logger }) {
    this.#database = new DesktopDatabaseService(options.dataDirectory);
    this.#logger = options.logger;
    this.#worker = new WorkerCoordinator(options.logger);
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

  async close(): Promise<void> {
    await Promise.allSettled([this.#worker.stop(), this.#database.close()]);
  }
}
