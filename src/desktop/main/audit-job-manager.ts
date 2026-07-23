import path from "node:path";

import type { Logger } from "pino";

import { parseAuditConfig } from "../../config/audit-config.js";
import {
  auditJobMutationResultSchema,
  type AuditJobListQuery,
  type AuditJobListResult,
  type AuditJobMutationResult,
  type AuditJobRecord,
} from "../shared/contracts.js";
import type { WorkerAuditProgress } from "../shared/worker-contracts.js";
import type { DesktopDatabaseService } from "./database-service.js";
import { AuditJobTransitionError } from "./audit-job-repository.js";
import { WorkerUnavailableError } from "./worker-coordinator.js";
import type { WorkerCoordinator } from "./worker-coordinator.js";

export class AuditJobManager {
  readonly #database: DesktopDatabaseService;
  readonly #logger: Logger;
  readonly #outputRoot: string;
  readonly #queue = new Set<string>();
  readonly #worker: WorkerCoordinator;
  #activeJobId: string | undefined;
  #drainPromise: Promise<void> | undefined;
  #draining = false;
  #stopping = false;

  constructor(options: {
    dataDirectory: string;
    database: DesktopDatabaseService;
    logger: Logger;
    worker: WorkerCoordinator;
  }) {
    this.#database = options.database;
    this.#logger = options.logger;
    this.#outputRoot = path.join(path.resolve(options.dataDirectory), "audits");
    this.#worker = options.worker;
  }

  async initialize(): Promise<void> {
    const recovered = await this.#database.jobs.recoverInterrupted();
    if (recovered > 0) {
      this.#logger.warn({ recovered }, "Recovered interrupted audit jobs");
    }
    for (const id of await this.#database.jobs.listQueuedIds()) this.#queue.add(id);
    this.#startDrain();
  }

  async start(scopeId: string): Promise<AuditJobMutationResult> {
    if (!this.#worker.ready) {
      return mutationError("worker-unavailable", "The audit worker is currently unavailable.");
    }
    const result = await this.#database.jobs.createForScope(scopeId);
    if (result.ok && result.job.state === "queued") {
      this.#queue.add(result.job.id);
      this.#startDrain();
    }
    return result;
  }

  get(id: string): Promise<AuditJobRecord | null> {
    return this.#database.jobs.get(id);
  }

  list(query: AuditJobListQuery): Promise<AuditJobListResult> {
    return this.#database.jobs.list(query);
  }

  async cancel(id: string): Promise<AuditJobMutationResult> {
    const result = await this.#database.jobs.requestCancellation(id);
    if (!result.ok || result.job.state === "cancelled") {
      this.#queue.delete(id);
      return result;
    }
    if (!this.#worker.cancelAudit(id)) {
      const cancelled = await this.#database.jobs.markCancelled(id);
      return auditJobMutationResultSchema.parse({ job: cancelled, ok: true });
    }
    return result;
  }

  async retry(id: string): Promise<AuditJobMutationResult> {
    if (!this.#worker.ready) {
      return mutationError("worker-unavailable", "The audit worker is currently unavailable.");
    }
    const result = await this.#database.jobs.retry(id);
    if (result.ok) {
      this.#queue.add(result.job.id);
      this.#startDrain();
    }
    return result;
  }

  async stop(): Promise<void> {
    this.#stopping = true;
    if (this.#activeJobId !== undefined) this.#worker.cancelAudit(this.#activeJobId);
    await this.#drainPromise;
  }

  #startDrain(): void {
    if (this.#draining || this.#stopping) return;
    this.#draining = true;
    const drainPromise = this.#drain().finally(() => {
      this.#draining = false;
      if (this.#drainPromise === drainPromise) this.#drainPromise = undefined;
      if (this.#queue.size > 0 && !this.#stopping) this.#startDrain();
    });
    this.#drainPromise = drainPromise;
  }

  async #drain(): Promise<void> {
    while (this.#queue.size > 0 && !this.#stopping) {
      const id = this.#queue.values().next().value;
      if (id === undefined) return;
      this.#queue.delete(id);
      const job = await this.#database.jobs.get(id);
      if (job?.state !== "queued") continue;
      await this.#execute(id);
    }
  }

  async #execute(id: string): Promise<void> {
    const execution = await this.#database.jobs.getExecution(id);
    if (execution === null) {
      await this.#database.jobs.fail(
        id,
        "invalid-scope",
        "The immutable audit scope was not found.",
      );
      return;
    }

    this.#activeJobId = id;
    let progressWrites = Promise.resolve();
    try {
      await this.#database.jobs.markStarted(id);
      const config = parseAuditConfig({
        ...execution.configuration,
        allowedDomains: [execution.normalizedDomain],
        maxLighthousePages: Math.min(3, execution.pageUrls.length),
        maxPages: execution.pageUrls.length,
        outputDir: this.#outputRoot,
        writeClientSummaryPdf: execution.reportFormats.includes("client-summary-pdf"),
        writeHtml: execution.reportFormats.includes("html"),
        writeJson: execution.reportFormats.includes("json"),
        writeMarkdown: execution.reportFormats.includes("markdown"),
        writePdf: execution.reportFormats.includes("pdf"),
        writePdfSummary: execution.reportFormats.includes("summary-pdf"),
        targetUrl: execution.targetUrl,
      });
      const result = await this.#worker.runAudit(
        {
          config,
          jobId: id,
          pageUrls: [...execution.pageUrls],
        },
        (progress) => {
          progressWrites = progressWrites.then(() => this.#writeProgress(id, progress));
        },
      );
      await progressWrites;

      if (result.type === "audit-cancelled") {
        await this.#database.jobs.markCancelled(id);
      } else if (result.type === "audit-failed") {
        await this.#database.jobs.fail(id, result.code, result.message);
      } else {
        await this.#database.jobs.complete(
          id,
          result.auditResult,
          result.outputDirectory,
          result.partial,
          result.warnings,
        );
      }
    } catch (error: unknown) {
      if (error instanceof AuditJobTransitionError) {
        this.#logger.warn({ error, jobId: id }, "Audit job transition was superseded");
      } else {
        const code =
          error instanceof WorkerUnavailableError ? "worker-unavailable" : "audit-failed";
        await this.#database.jobs
          .fail(id, code, safeMessage(error))
          .catch((failureError: unknown) => {
            this.#logger.error(
              { error: failureError, jobId: id },
              "Audit job failure could not be persisted",
            );
          });
      }
    } finally {
      this.#activeJobId = undefined;
    }
  }

  async #writeProgress(id: string, progress: WorkerAuditProgress): Promise<void> {
    try {
      await this.#database.jobs.updateProgress(
        id,
        progress.stage,
        progress.pagesCompleted,
        progress.failedPageCount,
        progress.warnings,
      );
    } catch (error: unknown) {
      if (!(error instanceof AuditJobTransitionError)) throw error;
    }
  }
}

function mutationError(
  code: "worker-unavailable" | "transition-conflict",
  message: string,
): AuditJobMutationResult {
  return auditJobMutationResultSchema.parse({ error: { code, message }, ok: false });
}

function safeMessage(error: unknown): string {
  return (error instanceof Error ? error.message : "Unknown audit job failure")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 1_000);
}
