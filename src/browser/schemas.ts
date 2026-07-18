import { z } from "zod";

import { scannedPageErrorSchema, viewportSchema } from "../core/schemas.js";

export const BROWSER_INSPECTION_SCHEMA_VERSION = "1.0.0" as const;

const utcTimestampSchema = z.iso
  .datetime()
  .refine((timestamp) => timestamp.endsWith("Z"), "Timestamp must be in UTC");
const runtimeMessageSchema = z.string().trim().min(1).max(1_000);
const relativeArtifactPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(4_096)
  .refine(
    (artifactPath) =>
      !artifactPath.includes("\\") &&
      !artifactPath.startsWith("/") &&
      !/^[A-Za-z]:/u.test(artifactPath) &&
      !artifactPath.split("/").includes(".."),
    "Artifact path must be a portable path relative to the audit directory",
  );

export const browserPageInspectionSchema = z
  .object({
    requestedUrl: z.url(),
    finalUrl: z.url().optional(),
    viewport: viewportSchema,
    title: z.string().trim().max(500).optional(),
    statusCode: z.number().int().min(100).max(599).optional(),
    screenshotPath: relativeArtifactPathSchema.optional(),
    durationMs: z.number().int().nonnegative(),
    consoleErrors: z.array(runtimeMessageSchema).max(50),
    pageErrors: z.array(runtimeMessageSchema).max(20),
    error: scannedPageErrorSchema.optional(),
  })
  .strict();

export const browserInspectionStatsSchema = z
  .object({
    sourcePages: z.number().int().nonnegative(),
    skippedPages: z.number().int().nonnegative(),
    attemptedInspections: z.number().int().nonnegative(),
    successfulInspections: z.number().int().nonnegative(),
    failedInspections: z.number().int().nonnegative(),
    screenshotsCaptured: z.number().int().nonnegative(),
  })
  .strict();

export const browserInspectionResultSchema = z
  .object({
    schemaVersion: z.literal(BROWSER_INSPECTION_SCHEMA_VERSION),
    startedAt: utcTimestampSchema,
    completedAt: utcTimestampSchema,
    targetUrl: z.url(),
    pages: z.array(browserPageInspectionSchema),
    runErrors: z.array(scannedPageErrorSchema).max(10),
    stats: browserInspectionStatsSchema,
  })
  .strict()
  .refine(
    (result) => Date.parse(result.completedAt) >= Date.parse(result.startedAt),
    "completedAt must not be earlier than startedAt",
  )
  .refine(
    (result) => result.stats.skippedPages <= result.stats.sourcePages,
    "Skipped page count cannot exceed source page count",
  )
  .refine(
    (result) => result.stats.attemptedInspections === result.pages.length,
    "Attempted inspection count must match recorded inspections",
  )
  .refine(
    (result) =>
      result.stats.successfulInspections + result.stats.failedInspections ===
      result.stats.attemptedInspections,
    "Successful and failed inspection counts must equal attempted inspections",
  )
  .refine(
    (result) =>
      result.stats.screenshotsCaptured ===
      result.pages.filter((page) => page.screenshotPath !== undefined).length,
    "Screenshot count must match recorded screenshot paths",
  );
