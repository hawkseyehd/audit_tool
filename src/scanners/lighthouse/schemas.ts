import { z } from "zod";
import { scannedPageErrorSchema, viewportSchema } from "../../core/schemas.js";
export const lighthouseMetricsSchema = z
  .object({
    performanceScore: z.number().min(0).max(100),
    largestContentfulPaintMs: z.number().nonnegative(),
    cumulativeLayoutShift: z.number().nonnegative(),
    totalBlockingTimeMs: z.number().nonnegative(),
    speedIndexMs: z.number().nonnegative(),
    firstContentfulPaintMs: z.number().nonnegative(),
  })
  .strict();
export const lighthouseOpportunitySchema = z
  .object({
    ruleId: z.string().trim().min(1).max(200),
    title: z.string().trim().min(1).max(500),
    savingsMs: z.number().nonnegative().optional(),
    savingsBytes: z.number().nonnegative().optional(),
  })
  .strict();
export const lighthousePageResultSchema = z
  .object({
    url: z.url(),
    finalUrl: z.url().optional(),
    viewport: viewportSchema,
    metrics: lighthouseMetricsSchema.optional(),
    opportunities: z.array(lighthouseOpportunitySchema).max(20),
    error: scannedPageErrorSchema.optional(),
  })
  .strict()
  .refine(
    (result) => result.metrics !== undefined || result.error !== undefined,
    "Lighthouse result requires metrics or an error",
  );
