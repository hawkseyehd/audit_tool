import { runAuditOrchestration } from "../../core/audit-orchestrator.js";
import { crawlWebsite } from "../../crawler/crawler.js";
import { searchDataForSeoBusinesses } from "../../discovery/dataforseo-provider.js";
import {
  workerRequestSchema,
  type WorkerRequest,
  type WorkerResponse,
} from "../shared/worker-contracts.js";

const parentPort = process.parentPort;
let active:
  | {
      controller: AbortController;
      operationId: string;
      promise: Promise<void>;
      type: "audit" | "discovery";
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
    if (active?.type === "audit" && active.operationId === request.jobId) {
      active.controller.abort(new Error("Audit cancelled"));
    }
    return;
  }
  if (request.type === "cancel-discovery") {
    if (active?.type === "discovery" && active.operationId === request.campaignId) {
      active.controller.abort(new Error("Discovery cancelled"));
    }
    return;
  }
  if (request.type === "shutdown") {
    void shutdown(request);
    return;
  }
  if (active !== undefined) {
    if (request.type === "run-audit") {
      post({
        code: "worker-busy",
        id: request.id,
        jobId: request.jobId,
        message: "The desktop worker is already processing another job.",
        type: "audit-failed",
      });
    } else {
      post({
        campaignId: request.campaignId,
        code: "worker-busy",
        id: request.id,
        message: "The desktop worker is already processing another job.",
        type: "discovery-failed",
      });
    }
    return;
  }

  const controller = new AbortController();
  const isAudit = request.type === "run-audit";
  const operationId = isAudit ? request.jobId : request.campaignId;
  const promise = isAudit ? runAudit(request, controller) : runDiscoveryPage(request, controller);
  active = { controller, operationId, promise, type: isAudit ? "audit" : "discovery" };
  void promise.finally(() => {
    if (active?.operationId === operationId) active = undefined;
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

async function runDiscoveryPage(
  request: Extract<WorkerRequest, { type: "run-discovery-page" }>,
  controller: AbortController,
): Promise<void> {
  try {
    const page = await searchDataForSeoBusinesses(request.input, {
      signal: controller.signal,
    });
    post({
      campaignId: request.campaignId,
      id: request.id,
      page,
      type: "discovery-page-completed",
    });
  } catch (error: unknown) {
    if (controller.signal.aborted) {
      post({
        campaignId: request.campaignId,
        id: request.id,
        type: "discovery-cancelled",
      });
      return;
    }
    post({
      campaignId: request.campaignId,
      code: error instanceof Error ? error.name : "discovery-failed",
      id: request.id,
      message: safeMessage(error),
      type: "discovery-failed",
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
