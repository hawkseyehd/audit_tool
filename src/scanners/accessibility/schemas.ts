import { z } from "zod";

import { viewportSchema } from "../../core/schemas.js";

export const axeImpactSchema = z.enum(["critical", "serious", "moderate", "minor"]).nullable();

export const axeViolationSchema = z
  .object({
    id: z.string().trim().min(1).max(200),
    impact: axeImpactSchema,
    description: z.string().trim().min(1).max(5_000),
    help: z.string().trim().min(1).max(500),
    helpUrl: z.url().optional(),
    nodes: z
      .array(
        z
          .object({
            target: z.array(z.string().trim().min(1).max(2_000)).max(50),
          })
          .strict(),
      )
      .max(10_000),
  })
  .strict();

export const accessibilityPageResultSchema = z
  .object({
    url: z.url(),
    viewport: viewportSchema,
    violations: z.array(axeViolationSchema),
    error: z
      .object({
        code: z.string().trim().min(1).max(100).optional(),
        message: z.string().trim().min(1).max(2_000),
      })
      .strict()
      .optional(),
  })
  .strict();
