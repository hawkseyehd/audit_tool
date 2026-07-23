import { runAuditOrchestration } from "../../core/audit-orchestrator.js";
import { crawlWebsite } from "../../crawler/crawler.js";
import {
  workerRequestSchema,
  type WorkerRequest,
  type WorkerResponse,
} from "../shared/worker-contracts.js";

const parentPort = process.parentPort;
let active:
  | {
      controller: AbortController;
      jobId: string;
      promise: Promise<void>;
    }
  | undefined;

parentPort.on("message", (event) => {
  const parsed = workerRequestSchema.safeParse(event.data);
  if (!parsed.success) return;
  const request = parsed.data;

  if (request.type === "ping") {
    post({ id: request.id, type: "pong" });
    return;
  }
  if (request.type === "cancel-audit") {
    if (active?.jobId === request.jobId) active.controller.abort(new Error("Audit cancelled"));
    return;
  }
  if (request.type === "shutdown") {
    void shutdown(request);
    return;
  }
  if (active !== undefined) {
    post({
      code: "worker-busy",
      id: request.id,
      jobId: request.jobId,
      message: "The audit worker is already processing another job.",
      type: "audit-failed",
    });
    return;
  }

  const controller = new AbortController();
  const promise = runAudit(request, controller);
  active = { controller, jobId: request.jobId, promise };
  void promise.finally(() => {
    if (active?.jobId === request.jobId) active = undefined;
  });
});

async function runAudit(
  request: Extract<WorkerRequest, { type: "run-audit" }>,
  controller: AbortController,
): Promise<void> {
  let latestWarnings: readonly string[] = [];
  try {
    const outcome = await runAuditOrchestration(
      request.config,
      {
        crawl: (options) =>
          crawlWebsite({
            ...options,
            followLinks: false,
            seedUrls: request.pageUrls,
          }),
      },
      {
        onProgress: (progress) => {
          latestWarnings = progress.warnings;
          post({
            failedPageCount: progress.failedPageCount,
            id: request.id,
            jobId: request.jobId,
            pagesCompleted: progress.pagesCompleted,
            pagesTotal: progress.pagesTotal,
            stage: progress.stage,
            type: "audit-progress",
            warnings: [...progress.warnings],
          });
        },
        signal: controller.signal,
      },
    );
    const failedPageCount = outcome.auditResult.scannedPages.filter(
      (page) => page.error !== undefined,
    ).length;
    const operationalFailures = outcome.auditResult.findings.filter(
      (finding) => finding.scanner === "orchestrator" || finding.ruleId.endsWith("-scanner-failed"),
    ).length;
    post({
      auditResult: outcome.auditResult,
      id: request.id,
      jobId: request.jobId,
      outputDirectory: outcome.outputDirectory,
      partial: failedPageCount > 0 || operationalFailures > 0,
      type: "audit-completed",
      warnings: [...latestWarnings],
    });
  } catch (error: unknown) {
    if (controller.signal.aborted) {
      post({ id: request.id, jobId: request.jobId, type: "audit-cancelled" });
      return;
    }
    post({
      code: "audit-failed",
      id: request.id,
      jobId: request.jobId,
      message: safeMessage(error),
      type: "audit-failed",
    });
  }
}

async function shutdown(request: Extract<WorkerRequest, { type: "shutdown" }>): Promise<void> {
  active?.controller.abort(new Error("Desktop application is shutting down"));
  await active?.promise.catch(() => undefined);
  post({ id: request.id, type: "stopped" });
  setImmediate(() => process.exit(0));
}

function post(response: WorkerResponse): void {
  parentPort.postMessage(response);
}

function safeMessage(error: unknown): string {
  return (error instanceof Error ? error.message : "Unknown audit worker failure")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 1_000);
}
