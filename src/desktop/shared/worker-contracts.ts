import { z } from "zod";

import { auditConfigSchema } from "../../config/audit-config.js";
import { auditResultSchema } from "../../core/schemas.js";

const requestIdSchema = z.uuid();
const jobIdSchema = z.uuid();
const workerStageSchema = z.enum(["discovering", "scanning", "generating-reports"]);
const workerProgressSchema = z
  .object({
    failedPageCount: z.number().int().nonnegative().max(100),
    id: requestIdSchema,
    jobId: jobIdSchema,
    pagesCompleted: z.number().int().nonnegative().max(100),
    pagesTotal: z.number().int().positive().max(100),
    stage: workerStageSchema,
    type: z.literal("audit-progress"),
    warnings: z.array(z.string().trim().min(1).max(500)).max(50),
  })
  .strict()
  .superRefine((progress, context) => {
    if (progress.pagesCompleted > progress.pagesTotal) {
      context.addIssue({
        code: "custom",
        message: "Completed page count cannot exceed the job total",
        path: ["pagesCompleted"],
      });
    }
    if (progress.failedPageCount > progress.pagesCompleted) {
      context.addIssue({
        code: "custom",
        message: "Failed page count cannot exceed completed pages",
        path: ["failedPageCount"],
      });
    }
  });

export const workerRequestSchema = z.discriminatedUnion("type", [
  z.object({ id: requestIdSchema, type: z.literal("ping") }).strict(),
  z.object({ id: requestIdSchema, type: z.literal("shutdown") }).strict(),
  z
    .object({
      config: auditConfigSchema,
      id: requestIdSchema,
      jobId: jobIdSchema,
      pageUrls: z
        .array(z.url())
        .min(1)
        .max(100)
        .refine((urls) => new Set(urls).size === urls.length, "Page URLs must be unique"),
      type: z.literal("run-audit"),
    })
    .strict(),
  z
    .object({
      id: requestIdSchema,
      jobId: jobIdSchema,
      type: z.literal("cancel-audit"),
    })
    .strict(),
]);

export const workerResponseSchema = z.discriminatedUnion("type", [
  z.object({ id: requestIdSchema, type: z.literal("ready") }).strict(),
  z.object({ id: requestIdSchema, type: z.literal("pong") }).strict(),
  z.object({ id: requestIdSchema, type: z.literal("stopped") }).strict(),
  workerProgressSchema,
  z
    .object({
      auditResult: auditResultSchema,
      id: requestIdSchema,
      jobId: jobIdSchema,
      outputDirectory: z.string().trim().min(1).max(4_096),
      partial: z.boolean(),
      type: z.literal("audit-completed"),
      warnings: z.array(z.string().trim().min(1).max(500)).max(50),
    })
    .strict(),
  z
    .object({
      id: requestIdSchema,
      jobId: jobIdSchema,
      type: z.literal("audit-cancelled"),
    })
    .strict(),
  z
    .object({
      code: z.string().trim().min(1).max(80),
      id: requestIdSchema,
      jobId: jobIdSchema,
      message: z.string().trim().min(1).max(1_000),
      type: z.literal("audit-failed"),
    })
    .strict(),
  z
    .object({
      id: requestIdSchema,
      message: z.string().trim().min(1).max(500),
      type: z.literal("error"),
    })
    .strict(),
]);

export type WorkerRequest = z.infer<typeof workerRequestSchema>;
export type WorkerResponse = z.infer<typeof workerResponseSchema>;
export type WorkerAuditProgress = Extract<WorkerResponse, { type: "audit-progress" }>;
export type WorkerAuditResult = Extract<
  WorkerResponse,
  { type: "audit-cancelled" | "audit-completed" | "audit-failed" }
>;
