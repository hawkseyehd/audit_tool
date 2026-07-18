import { z } from "zod";
import { pageTypeSchema, viewportSchema } from "../../core/schemas.js";
export const uxRenderedObservationSchema = z
  .object({
    viewport: viewportSchema,
    primaryCtaAboveFold: z.boolean().optional(),
    navigationUsable: z.boolean().optional(),
    formUsable: z.boolean().optional(),
    hasHorizontalOverflow: z.boolean().optional(),
    screenshotPath: z.string().trim().min(1).max(4_096).optional(),
  })
  .strict();
export const uxPageSnapshotSchema = z
  .object({
    url: z.url(),
    pageType: pageTypeSchema,
    primaryCtaCount: z.number().int().nonnegative(),
    unclearControlCount: z.number().int().nonnegative(),
    unclearControlSelectors: z.array(z.string().max(200)).max(10),
    hasPhone: z.boolean(),
    hasEmail: z.boolean(),
    hasContactNavigation: z.boolean(),
    hasBookingNavigation: z.boolean(),
    reviewSignals: z.number().int().nonnegative(),
    testimonialSignals: z.number().int().nonnegative(),
    certificationSignals: z.number().int().nonnegative(),
    caseStudySignals: z.number().int().nonnegative(),
    clientLogoSignals: z.number().int().nonnegative(),
    rendered: z.array(uxRenderedObservationSchema).max(2),
  })
  .strict();
