import path from "node:path";
import { randomUUID } from "node:crypto";

import { utilityProcess, type UtilityProcess } from "electron";
import type { Logger } from "pino";

import {
  workerResponseSchema,
  type WorkerAuditProgress,
  type WorkerAuditResult,
  type WorkerDiscoveryResult,
  type WorkerRequest,
} from "../shared/worker-contracts.js";

const STARTUP_TIMEOUT_MS = 10_000;
const SHUTDOWN_TIMEOUT_MS = 10_000;

type RunAuditRequest = Omit<Extract<WorkerRequest, { type: "run-audit" }>, "id" | "type">;
type RunDiscoveryRequest = Omit<
  Extract<WorkerRequest, { type: "run-discovery-page" }>,
  "id" | "type"
>;

export class WorkerCoordinator {
  readonly #logger: Logger;
  #active:
    | {
        id: string;
        jobId: string;
        reject: (error: Error) => void;
        type: "audit" | "discovery";
      }
    | undefined;
  #process: UtilityProcess | undefined;
  #ready = false;

  constructor(logger: Logger) {
    this.#logger = logger;
  }

  get ready(): boolean {
    return this.#ready;
  }

  async start(): Promise<void> {
    if (this.#process !== undefined) return;

    const child = utilityProcess.fork(path.join(__dirname, "worker.cjs"), [], {
      serviceName: "website-audit-worker",
      stdio: "pipe",
    });
    this.#process = child;
    child.stderr?.on("data", (data: Buffer) => {
      this.#logger.warn({ workerMessage: data.toString("utf8").trim() }, "Worker stderr");
    });
    child.on("exit", (code) => {
      this.#ready = false;
      this.#process = undefined;
      this.#active?.reject(new Error("Desktop worker exited during job execution"));
      this.#active = undefined;
      this.#logger.info({ code }, "Desktop worker exited");
    });

    const requestId = randomUUID();
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Desktop worker startup timed out"));
      }, STARTUP_TIMEOUT_MS);
      const onMessage = (message: unknown): void => {
        const parsed = workerResponseSchema.safeParse(message);
        if (!parsed.success || parsed.data.id !== requestId) return;
        if (parsed.data.type === "pong") {
          clearTimeout(timeout);
          child.off("message", onMessage);
          this.#ready = true;
          resolve();
        }
      };
      child.on("message", onMessage);
      child.postMessage({ id: requestId, type: "ping" });
    });
  }

  async runAudit(
    request: RunAuditRequest,
    onProgress: (progress: WorkerAuditProgress) => void,
  ): Promise<WorkerAuditResult> {
    const child = this.#process;
    if (!this.#ready || child === undefined) {
      throw new WorkerUnavailableError("Desktop audit worker is unavailable");
    }
    if (this.#active !== undefined) {
      throw new WorkerUnavailableError("Desktop audit worker is already processing a job");
    }

    const id = randomUUID();
    return new Promise<WorkerAuditResult>((resolve, reject) => {
      const cleanup = (): void => {
        child.off("message", onMessage);
        if (this.#active?.id === id) this.#active = undefined;
      };
      const onMessage = (message: unknown): void => {
        const parsed = workerResponseSchema.safeParse(message);
        if (!parsed.success || parsed.data.id !== id) return;
        if (parsed.data.type === "audit-progress") {
          onProgress(parsed.data);
          return;
        }
        if (
          parsed.data.type === "audit-completed" ||
          parsed.data.type === "audit-cancelled" ||
          parsed.data.type === "audit-failed"
        ) {
          cleanup();
          resolve(parsed.data);
          return;
        }
        if (parsed.data.type === "error") {
          cleanup();
          reject(new Error(parsed.data.message));
        }
      };

      this.#active = {
        id,
        jobId: request.jobId,
        type: "audit",
        reject: (error) => {
          cleanup();
          reject(error);
        },
      };
      child.on("message", onMessage);
      child.postMessage({ ...request, id, type: "run-audit" });
    });
  }

  cancelAudit(jobId: string): boolean {
    const child = this.#process;
    const active = this.#active;
    if (!this.#ready || child === undefined || active?.type !== "audit" || active.jobId !== jobId) {
      return false;
    }
    child.postMessage({ id: randomUUID(), jobId, type: "cancel-audit" });
    return true;
  }

  async runDiscoveryPage(request: RunDiscoveryRequest): Promise<WorkerDiscoveryResult> {
    const child = this.#process;
    if (!this.#ready || child === undefined) {
      throw new WorkerUnavailableError("Desktop discovery worker is unavailable");
    }
    if (this.#active !== undefined) {
      throw new WorkerUnavailableError("Desktop worker is already processing another job");
    }

    const id = randomUUID();
    return new Promise<WorkerDiscoveryResult>((resolve, reject) => {
      const cleanup = (): void => {
        child.off("message", onMessage);
        if (this.#active?.id === id) this.#active = undefined;
      };
      const onMessage = (message: unknown): void => {
        const parsed = workerResponseSchema.safeParse(message);
        if (!parsed.success || parsed.data.id !== id) return;
        if (
          parsed.data.type === "discovery-page-completed" ||
          parsed.data.type === "discovery-cancelled" ||
          parsed.data.type === "discovery-failed"
        ) {
          cleanup();
          resolve(parsed.data);
          return;
        }
        if (parsed.data.type === "error") {
          cleanup();
          reject(new Error(parsed.data.message));
        }
      };

      this.#active = {
        id,
        jobId: request.campaignId,
        reject: (error) => {
          cleanup();
          reject(error);
        },
        type: "discovery",
      };
      child.on("message", onMessage);
      child.postMessage({ ...request, id, type: "run-discovery-page" });
    });
  }

  cancelDiscovery(campaignId: string): boolean {
    const child = this.#process;
    const active = this.#active;
    if (
      !this.#ready ||
      child === undefined ||
      active?.type !== "discovery" ||
      active.jobId !== campaignId
    ) {
      return false;
    }
    child.postMessage({ campaignId, id: randomUUID(), type: "cancel-discovery" });
    return true;
  }

  async stop(): Promise<void> {
    const child = this.#process;
    if (child === undefined) return;

    const requestId = randomUUID();
    const stopped = new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, SHUTDOWN_TIMEOUT_MS);
      const onMessage = (message: unknown): void => {
        const parsed = workerResponseSchema.safeParse(message);
        if (parsed.success && parsed.data.id === requestId && parsed.data.type === "stopped") {
          clearTimeout(timeout);
          child.off("message", onMessage);
          resolve();
        }
      };
      child.on("message", onMessage);
    });

    child.postMessage({ id: requestId, type: "shutdown" });
    await stopped;
    if (this.#process !== undefined) child.kill();
    this.#process = undefined;
    this.#ready = false;
  }
}

export class WorkerUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkerUnavailableError";
  }
}
