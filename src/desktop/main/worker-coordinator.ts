import path from "node:path";
import { randomUUID } from "node:crypto";

import { utilityProcess, type UtilityProcess } from "electron";
import type { Logger } from "pino";

import { workerResponseSchema } from "../shared/worker-contracts.js";

const STARTUP_TIMEOUT_MS = 10_000;
const SHUTDOWN_TIMEOUT_MS = 3_000;

export class WorkerCoordinator {
  readonly #logger: Logger;
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
