import path from "node:path";

import { Prisma, type AuditJob, type PrismaClient } from "@prisma/client";

import { auditResultSchema } from "../../core/schemas.js";
import type { AuditResult } from "../../core/types.js";
import {
  auditJobListResultSchema,
  auditJobMutationResultSchema,
  auditJobRecordSchema,
  auditScopeConfigurationSchema,
  auditScopeReportFormatSchema,
  type AuditJobListQuery,
  type AuditJobListResult,
  type AuditJobMutationResult,
  type AuditJobRecord,
  type AuditJobState,
  type AuditScopeConfiguration,
  type AuditScopeReportFormat,
  type ReportArtifactFormat,
} from "../shared/contracts.js";

const ACTIVE_STATES: readonly AuditJobState[] = [
  "queued",
  "discovering",
  "scanning",
  "generating-reports",
];
const RUNNING_STATES: readonly AuditJobState[] = ["discovering", "scanning", "generating-reports"];
const RETRYABLE_STATES: readonly AuditJobState[] = ["failed", "cancelled"];
const RECOVERY_WARNING = "Audit resumed after the desktop application was interrupted.";

export interface AuditJobExecution {
  readonly configuration: AuditScopeConfiguration;
  readonly jobId: string;
  readonly normalizedDomain: string;
  readonly pageUrls: readonly string[];
  readonly reportFormats: readonly AuditScopeReportFormat[];
  readonly targetUrl: string;
}

export class AuditJobRepository {
  readonly #database: PrismaClient;
  readonly #outputRoot: string;

  constructor(database: PrismaClient, outputRoot: string) {
    this.#database = database;
    this.#outputRoot = path.resolve(outputRoot);
  }

  async createForScope(scopeId: string): Promise<AuditJobMutationResult> {
    const existing = await this.#database.auditJob.findUnique({ where: { scopeId } });
    if (existing !== null) {
      return auditJobMutationResultSchema.parse({ job: toAuditJob(existing), ok: true });
    }

    const scope = await this.#database.auditScope.findUnique({
      select: {
        clientBusinessName: true,
        clientId: true,
        id: true,
        selectedPageCount: true,
        targetUrl: true,
        websiteId: true,
      },
      where: { id: scopeId },
    });
    if (scope === null) return jobError("not-found", "The selected audit scope was not found.");

    let created: AuditJob;
    try {
      created = await this.#database.$transaction(async (transaction) => {
        const job = await transaction.auditJob.create({
          data: {
            clientBusinessName: scope.clientBusinessName,
            clientId: scope.clientId,
            pagesTotal: scope.selectedPageCount,
            scopeId: scope.id,
            targetUrl: scope.targetUrl,
            websiteId: scope.websiteId,
          },
        });
        await transaction.clientActivity.create({
          data: {
            clientId: scope.clientId,
            kind: "audit-job-created",
            summary: `Audit queued for ${String(scope.selectedPageCount)} pages`,
          },
        });
        return job;
      });
    } catch (error: unknown) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }
      created = await this.#database.auditJob.findUniqueOrThrow({ where: { scopeId } });
    }
    return auditJobMutationResultSchema.parse({ job: toAuditJob(created), ok: true });
  }

  async get(id: string): Promise<AuditJobRecord | null> {
    const job = await this.#database.auditJob.findUnique({ where: { id } });
    return job === null ? null : toAuditJob(job);
  }

  async list(query: AuditJobListQuery): Promise<AuditJobListResult> {
    const where = {
      ...(query.clientId === undefined ? {} : { clientId: query.clientId }),
      ...(query.states.length === 0 ? {} : { state: { in: query.states } }),
    };
    const [items, total] = await Promise.all([
      this.#database.auditJob.findMany({
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        where,
      }),
      this.#database.auditJob.count({ where }),
    ]);
    return auditJobListResultSchema.parse({
      items: items.map(toAuditJob),
      page: query.page,
      pageSize: query.pageSize,
      total,
    });
  }

  async getExecution(id: string): Promise<AuditJobExecution | null> {
    const job = await this.#database.auditJob.findUnique({
      include: {
        scope: {
          include: { pages: { orderBy: { normalizedUrl: "asc" } } },
        },
      },
      where: { id },
    });
    if (job === null) return null;
    return {
      configuration: auditScopeConfigurationSchema.parse(
        JSON.parse(job.scope.configurationJson) as unknown,
      ),
      jobId: job.id,
      normalizedDomain: job.scope.normalizedDomain,
      pageUrls: job.scope.pages.map((page) => page.normalizedUrl),
      reportFormats: auditScopeReportFormatSchema
        .array()
        .min(1)
        .parse(JSON.parse(job.scope.reportFormatsJson) as unknown),
      targetUrl: job.scope.targetUrl,
    };
  }

  async listQueuedIds(): Promise<string[]> {
    const jobs = await this.#database.auditJob.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true },
      where: { state: "queued" },
    });
    return jobs.map((job) => job.id);
  }

  async recoverInterrupted(): Promise<number> {
    const jobs = await this.#database.auditJob.findMany({
      where: { state: { in: [...RUNNING_STATES] } },
    });
    await Promise.all(
      jobs.map(async (job) => {
        const warnings = appendWarning(parseWarnings(job.warningsJson), RECOVERY_WARNING);
        await this.#database.auditJob.update({
          data: {
            attempt: { increment: 1 },
            cancelRequestedAt: null,
            failureCode: null,
            failureMessage: null,
            pagesCompleted: 0,
            state: "queued",
            warningCount: warnings.length,
            warningsJson: JSON.stringify(warnings),
          },
          where: { id: job.id },
        });
      }),
    );
    return jobs.length;
  }

  async markStarted(id: string): Promise<AuditJobRecord> {
    return this.#transition(id, ["queued"], {
      completedAt: null,
      failureCode: null,
      failureMessage: null,
      startedAt: new Date(),
      state: "discovering",
    });
  }

  async updateProgress(
    id: string,
    state: Extract<AuditJobState, "discovering" | "scanning" | "generating-reports">,
    pagesCompleted: number,
    failedPageCount: number,
    warnings: readonly string[],
  ): Promise<AuditJobRecord> {
    const allowedFrom: Record<typeof state, AuditJobState[]> = {
      discovering: ["discovering"],
      scanning: ["discovering", "scanning"],
      "generating-reports": ["scanning", "generating-reports"],
    };
    const boundedWarnings = warnings.map(safeWarning).filter(Boolean).slice(0, 50);
    return this.#transition(id, allowedFrom[state], {
      failedPageCount,
      pagesCompleted,
      state,
      warningCount: boundedWarnings.length,
      warningsJson: JSON.stringify(boundedWarnings),
    });
  }

  async complete(
    id: string,
    result: AuditResult,
    outputDirectory: string,
    partial: boolean,
    warnings: readonly string[],
  ): Promise<AuditJobRecord> {
    const parsedResult = auditResultSchema.parse(result);
    const boundedWarnings = warnings.map(safeWarning).filter(Boolean).slice(0, 50);
    const failedPageCount = parsedResult.scannedPages.filter(
      (page) => page.error !== undefined,
    ).length;
    const state: AuditJobState = partial ? "partially-completed" : "completed";
    const completedAt = new Date(parsedResult.completedAt);
    const job = await this.#database.$transaction(async (transaction) => {
      const changed = await transaction.auditJob.updateMany({
        data: {
          completedAt,
          failedPageCount,
          outputDirectory,
          pagesCompleted: parsedResult.scannedPages.length,
          resultJson: JSON.stringify(parsedResult),
          state,
          warningCount: boundedWarnings.length,
          warningsJson: JSON.stringify(boundedWarnings),
        },
        where: { id, state: { in: [...RUNNING_STATES] } },
      });
      if (changed.count !== 1) throw new AuditJobTransitionError(id, RUNNING_STATES);

      const completedJob = await transaction.auditJob.findUniqueOrThrow({
        include: { scope: { select: { reportFormatsJson: true } } },
        where: { id },
      });
      const formats = auditScopeReportFormatSchema
        .array()
        .min(1)
        .parse(JSON.parse(completedJob.scope.reportFormatsJson) as unknown);
      const resultRecord = await transaction.auditResultRecord.create({
        data: {
          auditId: parsedResult.auditId,
          canonicalResultJson: JSON.stringify(parsedResult),
          categoryScoresJson: JSON.stringify(parsedResult.summary.categoryScores),
          clientId: completedJob.clientId,
          completedAt,
          findingCountsJson: JSON.stringify(parsedResult.summary.findingCounts),
          jobId: completedJob.id,
          overallScore: parsedResult.summary.overallScore,
          resultState: state,
          schemaVersion: parsedResult.schemaVersion,
          scopeId: completedJob.scopeId,
          startedAt: new Date(parsedResult.startedAt),
          websiteId: completedJob.websiteId,
        },
      });
      await transaction.reportArtifact.createMany({
        data: formats.map((format) =>
          createArtifactRecord(
            format,
            parsedResult,
            this.#outputRoot,
            resultRecord.id,
            completedJob,
          ),
        ),
      });
      await transaction.clientActivity.create({
        data: {
          clientId: completedJob.clientId,
          kind: "audit-job-completed",
          summary:
            state === "completed"
              ? `Audit completed for ${String(completedJob.pagesTotal)} pages`
              : `Audit partially completed with ${String(failedPageCount)} failed pages`,
        },
      });
      return completedJob;
    });
    return toAuditJob(job);
  }

  async fail(id: string, code: string, message: string): Promise<AuditJobRecord> {
    return this.#transition(id, [...ACTIVE_STATES], {
      completedAt: new Date(),
      failureCode: safeFailureCode(code),
      failureMessage: safeFailureMessage(message),
      state: "failed",
    });
  }

  async requestCancellation(id: string): Promise<AuditJobMutationResult> {
    const current = await this.#database.auditJob.findUnique({ where: { id } });
    if (current === null) return jobError("not-found", "The audit job was not found.");
    if (!ACTIVE_STATES.includes(current.state as AuditJobState)) {
      return jobError("not-cancellable", "This audit is no longer running or queued.");
    }

    const updated =
      current.state === "queued"
        ? await this.#database.auditJob.update({
            data: { cancelRequestedAt: new Date(), completedAt: new Date(), state: "cancelled" },
            where: { id },
          })
        : await this.#database.auditJob.update({
            data: { cancelRequestedAt: new Date() },
            where: { id },
          });
    return auditJobMutationResultSchema.parse({ job: toAuditJob(updated), ok: true });
  }

  async markCancelled(id: string): Promise<AuditJobRecord> {
    return this.#transition(id, [...ACTIVE_STATES], {
      cancelRequestedAt: new Date(),
      completedAt: new Date(),
      state: "cancelled",
    });
  }

  async retry(id: string): Promise<AuditJobMutationResult> {
    const current = await this.#database.auditJob.findUnique({ where: { id } });
    if (current === null) return jobError("not-found", "The audit job was not found.");
    if (!RETRYABLE_STATES.includes(current.state as AuditJobState)) {
      return jobError("not-retryable", "Only failed or cancelled audits can be retried.");
    }

    const updated = await this.#database.auditJob.update({
      data: {
        attempt: { increment: 1 },
        cancelRequestedAt: null,
        completedAt: null,
        failedPageCount: 0,
        failureCode: null,
        failureMessage: null,
        outputDirectory: null,
        pagesCompleted: 0,
        resultJson: null,
        startedAt: null,
        state: "queued",
      },
      where: { id },
    });
    return auditJobMutationResultSchema.parse({ job: toAuditJob(updated), ok: true });
  }

  async count(): Promise<number> {
    return this.#database.auditJob.count();
  }

  async #transition(
    id: string,
    allowedFrom: readonly AuditJobState[],
    data: Parameters<PrismaClient["auditJob"]["update"]>[0]["data"],
  ): Promise<AuditJobRecord> {
    const changed = await this.#database.auditJob.updateMany({
      data,
      where: { id, state: { in: [...allowedFrom] } },
    });
    if (changed.count !== 1) {
      throw new AuditJobTransitionError(id, allowedFrom);
    }
    const updated = await this.#database.auditJob.findUniqueOrThrow({ where: { id } });
    return toAuditJob(updated);
  }
}

export class AuditJobTransitionError extends Error {
  constructor(id: string, allowedFrom: readonly AuditJobState[]) {
    super(`Audit job ${id} cannot transition from its current state`);
    this.name = "AuditJobTransitionError";
    Object.defineProperty(this, "allowedFrom", { value: [...allowedFrom] });
  }
}

function toAuditJob(job: AuditJob): AuditJobRecord {
  const state = job.state as AuditJobState;
  const warnings = parseWarnings(job.warningsJson);
  return auditJobRecordSchema.parse({
    attempt: job.attempt,
    cancelAvailable: ACTIVE_STATES.includes(state) && job.cancelRequestedAt === null,
    cancelRequestedAt: job.cancelRequestedAt?.toISOString() ?? null,
    clientBusinessName: job.clientBusinessName,
    clientId: job.clientId,
    completedAt: job.completedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    failedPageCount: job.failedPageCount,
    failure:
      job.failureCode === null || job.failureMessage === null
        ? null
        : { code: job.failureCode, message: job.failureMessage },
    id: job.id,
    pagesCompleted: job.pagesCompleted,
    pagesTotal: job.pagesTotal,
    scopeId: job.scopeId,
    startedAt: job.startedAt?.toISOString() ?? null,
    state,
    targetUrl: job.targetUrl,
    updatedAt: job.updatedAt.toISOString(),
    warningCount: warnings.length,
    warnings,
    websiteId: job.websiteId,
  });
}

function parseWarnings(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map(safeWarning)
      .filter(Boolean)
      .slice(0, 50);
  } catch {
    return [];
  }
}

function appendWarning(warnings: readonly string[], warning: string): string[] {
  return [...new Set([...warnings, safeWarning(warning)])].filter(Boolean).slice(0, 50);
}

function safeWarning(value: string): string {
  return value.replace(/\s+/gu, " ").trim().slice(0, 500);
}

function safeFailureCode(value: string): string {
  return (
    value
      .replace(/[^a-z0-9-]/giu, "-")
      .toLowerCase()
      .slice(0, 80) || "audit-failed"
  );
}

function safeFailureMessage(value: string): string {
  return value.replace(/\s+/gu, " ").trim().slice(0, 1_000) || "The audit could not complete.";
}

const ARTIFACT_FILE_NAMES: Record<ReportArtifactFormat, string> = {
  "client-summary-pdf": "client-summary.pdf",
  "summary-pdf": "audit-summary.pdf",
  html: "audit-report.html",
  json: "audit-result.json",
  markdown: "audit-report.md",
  pdf: "audit-report.pdf",
};

function createArtifactRecord(
  format: ReportArtifactFormat,
  result: AuditResult,
  outputRoot: string,
  resultId: string,
  job: AuditJob,
) {
  const outputPath = outputPathForFormat(format, result);
  const storedPath = outputPath === undefined ? null : safeRelativePath(outputRoot, outputPath);
  return {
    clientId: job.clientId,
    fileName: ARTIFACT_FILE_NAMES[format],
    format,
    jobId: job.id,
    resultId,
    status: storedPath === null ? "generation-failed" : "available",
    storedPath,
    websiteId: job.websiteId,
  };
}

function outputPathForFormat(
  format: ReportArtifactFormat,
  result: AuditResult,
): string | undefined {
  const paths: Record<ReportArtifactFormat, string | undefined> = {
    "client-summary-pdf": result.outputs.clientSummaryPdfReportPath,
    "summary-pdf": result.outputs.summaryPdfReportPath,
    html: result.outputs.htmlReportPath,
    json: result.outputs.jsonReportPath,
    markdown: result.outputs.markdownReportPath,
    pdf: result.outputs.pdfReportPath,
  };
  return paths[format];
}

function safeRelativePath(root: string, candidate: string): string | null {
  const relative = path.relative(root, path.resolve(candidate));
  if (relative.length === 0 || relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return relative;
}

function jobError(
  code:
    | "not-found"
    | "worker-unavailable"
    | "not-cancellable"
    | "not-retryable"
    | "transition-conflict",
  message: string,
): AuditJobMutationResult {
  return auditJobMutationResultSchema.parse({ error: { code, message }, ok: false });
}
