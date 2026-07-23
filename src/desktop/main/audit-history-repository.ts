import type { Prisma, PrismaClient, ReportArtifact } from "@prisma/client";

import {
  auditHistoryListResultSchema,
  auditJobRecordSchema,
  auditResultSummarySchema,
  reportArtifactListResultSchema,
  reportArtifactRecordSchema,
  type AuditHistoryListQuery,
  type AuditHistoryListResult,
  type AuditJobState,
  type ReportArtifactListQuery,
  type ReportArtifactListResult,
  type ReportArtifactStatus,
} from "../shared/contracts.js";

export interface ReportArtifactAccess {
  readonly fileName: string;
  readonly id: string;
  readonly retainedUntil: Date | null;
  readonly status: ReportArtifactStatus;
  readonly storedPath: string | null;
}

export class AuditHistoryRepository {
  readonly #database: PrismaClient;

  constructor(database: PrismaClient) {
    this.#database = database;
  }

  async listHistory(query: AuditHistoryListQuery): Promise<AuditHistoryListResult> {
    const where: Prisma.AuditJobWhereInput = {
      ...(query.clientId === undefined ? {} : { clientId: query.clientId }),
      ...(query.state === "all" ? {} : { state: query.state }),
      ...(query.search.length === 0
        ? {}
        : {
            OR: [
              { clientBusinessName: { contains: query.search } },
              { targetUrl: { contains: query.search } },
            ],
          }),
      ...buildHistoryDateFilter(query),
      ...buildResultStateFilter(query.resultState),
    };
    const [items, total] = await Promise.all([
      this.#database.auditJob.findMany({
        include: {
          resultRecord: {
            include: {
              artifacts: { select: { status: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        where,
      }),
      this.#database.auditJob.count({ where }),
    ]);

    return auditHistoryListResultSchema.parse({
      items: items.map((item) => ({
        job: toHistoryJob(item),
        result:
          item.resultRecord === null
            ? null
            : auditResultSummarySchema.parse({
                artifactCount: item.resultRecord.artifacts.length,
                auditId: item.resultRecord.auditId,
                availableArtifactCount: item.resultRecord.artifacts.filter(
                  (artifact) => artifact.status === "available",
                ).length,
                categoryScores: parseObject(item.resultRecord.categoryScoresJson),
                completedAt: item.resultRecord.completedAt.toISOString(),
                findingCounts: parseObject(item.resultRecord.findingCountsJson),
                overallScore: item.resultRecord.overallScore,
                resultState: item.resultRecord.resultState,
                schemaVersion: item.resultRecord.schemaVersion,
              }),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    });
  }

  async listArtifacts(query: ReportArtifactListQuery): Promise<ReportArtifactListResult> {
    const where: Prisma.ReportArtifactWhereInput = {
      ...(query.clientId === undefined ? {} : { clientId: query.clientId }),
      ...(query.format === "all" ? {} : { format: query.format }),
      ...(query.jobId === undefined ? {} : { jobId: query.jobId }),
      ...(query.status === "all" ? {} : { status: query.status }),
      ...(query.search.length === 0
        ? {}
        : {
            OR: [
              { job: { clientBusinessName: { contains: query.search } } },
              { job: { targetUrl: { contains: query.search } } },
              { fileName: { contains: query.search } },
            ],
          }),
    };
    const [items, total] = await Promise.all([
      this.#database.reportArtifact.findMany({
        include: {
          job: { select: { clientBusinessName: true, targetUrl: true } },
          result: { select: { auditId: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        where,
      }),
      this.#database.reportArtifact.count({ where }),
    ]);
    return reportArtifactListResultSchema.parse({
      items: items.map((item) =>
        reportArtifactRecordSchema.parse({
          auditId: item.result.auditId,
          clientBusinessName: item.job.clientBusinessName,
          clientId: item.clientId,
          createdAt: item.createdAt.toISOString(),
          fileName: item.fileName,
          format: item.format,
          id: item.id,
          jobId: item.jobId,
          retainedUntil: item.retainedUntil?.toISOString() ?? null,
          status: item.status,
          targetUrl: item.job.targetUrl,
          updatedAt: item.updatedAt.toISOString(),
          verifiedAt: item.verifiedAt?.toISOString() ?? null,
          websiteId: item.websiteId,
        }),
      ),
      page: query.page,
      pageSize: query.pageSize,
      total,
    });
  }

  async getArtifactAccess(id: string): Promise<ReportArtifactAccess | null> {
    const artifact = await this.#database.reportArtifact.findUnique({ where: { id } });
    return artifact === null ? null : toArtifactAccess(artifact);
  }

  async setArtifactStatus(
    id: string,
    status: ReportArtifactStatus,
    verifiedAt: Date,
  ): Promise<void> {
    await this.#database.reportArtifact.updateMany({
      data: { status, verifiedAt },
      where: { id },
    });
  }

  countArtifacts(): Promise<number> {
    return this.#database.reportArtifact.count();
  }
}

function buildHistoryDateFilter(query: AuditHistoryListQuery): Prisma.AuditJobWhereInput {
  if (query.dateFrom === undefined && query.dateTo === undefined) return {};
  return {
    createdAt: {
      ...(query.dateFrom === undefined ? {} : { gte: new Date(query.dateFrom) }),
      ...(query.dateTo === undefined ? {} : { lte: new Date(query.dateTo) }),
    },
  };
}

function buildResultStateFilter(
  resultState: AuditHistoryListQuery["resultState"],
): Prisma.AuditJobWhereInput {
  if (resultState === "all") return {};
  if (resultState === "unavailable") return { resultRecord: { is: null } };
  return { resultRecord: { is: { resultState } } };
}

function toHistoryJob(job: {
  attempt: number;
  cancelRequestedAt: Date | null;
  clientBusinessName: string;
  clientId: string;
  completedAt: Date | null;
  createdAt: Date;
  failedPageCount: number;
  failureCode: string | null;
  failureMessage: string | null;
  id: string;
  pagesCompleted: number;
  pagesTotal: number;
  scopeId: string;
  startedAt: Date | null;
  state: string;
  targetUrl: string;
  updatedAt: Date;
  warningCount: number;
  warningsJson: string;
  websiteId: string;
}) {
  const state = job.state as AuditJobState;
  const warnings = parseWarnings(job.warningsJson);
  return auditJobRecordSchema.parse({
    attempt: job.attempt,
    cancelAvailable:
      ["queued", "discovering", "scanning", "generating-reports"].includes(state) &&
      job.cancelRequestedAt === null,
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

function toArtifactAccess(artifact: ReportArtifact): ReportArtifactAccess {
  return {
    fileName: artifact.fileName,
    id: artifact.id,
    retainedUntil: artifact.retainedUntil,
    status: artifact.status as ReportArtifactStatus,
    storedPath: artifact.storedPath,
  };
}

function parseObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function parseWarnings(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.replace(/\s+/gu, " ").trim().slice(0, 500))
      .filter(Boolean)
      .slice(0, 50);
  } catch {
    return [];
  }
}
