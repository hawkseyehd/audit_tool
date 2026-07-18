import { z } from "zod";

import { pageTypeSchema } from "../../core/schemas.js";

export const FORM_KINDS = ["contact", "booking", "signup", "checkout", "lead", "generic"] as const;
export const formKindSchema = z.enum(FORM_KINDS);

export const formFieldFactSchema = z
  .object({
    selector: z.string().trim().min(1).max(300),
    type: z.string().trim().min(1).max(50),
    expectedType: z.string().trim().min(1).max(50).optional(),
    hasAccessibleName: z.boolean(),
    hasVisibleLabel: z.boolean(),
    hasPlaceholder: z.boolean(),
    isRequired: z.boolean(),
    hasAutocomplete: z.boolean(),
  })
  .strict();

export const formFactSchema = z
  .object({
    selector: z.string().trim().min(1).max(300),
    kind: formKindSchema,
    fields: z.array(formFieldFactSchema).max(100),
    totalFieldCount: z.number().int().nonnegative(),
    requiredFieldCount: z.number().int().nonnegative(),
    fileFieldCount: z.number().int().nonnegative(),
    passwordFieldCount: z.number().int().nonnegative(),
    paymentFieldCount: z.number().int().nonnegative(),
    hasSubmitControl: z.boolean(),
    hasPrivacySignal: z.boolean(),
    hasAntiSpamSignal: z.boolean(),
    bypassesNativeValidation: z.boolean(),
  })
  .strict();

export const formPageSnapshotSchema = z
  .object({
    url: z.url(),
    pageType: pageTypeSchema,
    forms: z.array(formFactSchema).max(50),
    totalFormCount: z.number().int().nonnegative(),
    orphanFields: z.array(formFieldFactSchema).max(100),
    totalOrphanFieldCount: z.number().int().nonnegative(),
  })
  .strict();
