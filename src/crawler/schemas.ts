import { z } from "zod";

import { scannedPageSchema } from "../core/schemas.js";

export const CRAWL_SCHEMA_VERSION = "1.0.0" as const;

const utcTimestampSchema = z.iso
  .datetime()
  .refine((timestamp) => timestamp.endsWith("Z"), "Timestamp must be in UTC");

export const crawlStatsSchema = z
  .object({
    attemptedPages: z.number().int().nonnegative(),
    successfulPages: z.number().int().nonnegative(),
    failedPages: z.number().int().nonnegative(),
    discoveredUrls: z.number().int().nonnegative(),
    rejectedLinks: z.number().int().nonnegative(),
  })
  .strict();

export const crawlResultSchema = z
  .object({
    schemaVersion: z.literal(CRAWL_SCHEMA_VERSION),
    startedAt: utcTimestampSchema,
    completedAt: utcTimestampSchema,
    targetUrl: z.url(),
    pages: z.array(scannedPageSchema),
    rejectionCounts: z.record(z.string(), z.number().int().nonnegative()),
    stats: crawlStatsSchema,
  })
  .strict()
  .refine(
    (result) => result.stats.attemptedPages === result.pages.length,
    "Attempted page count must match recorded pages",
  )
  .refine(
    (result) =>
      result.stats.successfulPages + result.stats.failedPages === result.stats.attemptedPages,
    "Successful and failed page counts must equal attempted pages",
  );
