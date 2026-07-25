import { z } from "zod";

const optionalBoundedText = (maximum: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value),
    z.string().trim().max(maximum).optional(),
  );

export const providerSearchInputSchema = z
  .object({
    category: optionalBoundedText(120),
    continuationToken: optionalBoundedText(4_096),
    country: z
      .string()
      .trim()
      .regex(/^[A-Z]{2}$/u),
    exclusions: z.array(z.string().trim().min(1).max(200)).max(20),
    keywords: z.array(z.string().trim().min(1).max(100)).max(20),
    latitude: z.number().min(-90).max(90).optional(),
    limit: z.number().int().min(1).max(1_000),
    locality: optionalBoundedText(120),
    longitude: z.number().min(-180).max(180).optional(),
    radiusKm: z.number().min(1).max(500).optional(),
    region: optionalBoundedText(120),
    requireWebsite: z.boolean(),
  })
  .strict();

export const providerBusinessRecordSchema = z
  .object({
    addressLine: optionalBoundedText(300),
    businessName: z.string().trim().min(1).max(200),
    category: optionalBoundedText(120),
    country: optionalBoundedText(100),
    locality: optionalBoundedText(120),
    postalCode: optionalBoundedText(30),
    providerRecordId: z.string().trim().min(1).max(300),
    publicPhone: optionalBoundedText(50),
    region: optionalBoundedText(120),
    sourceUpdatedAt: z.iso.datetime().optional(),
    sourceUrl: z.url().max(2_048).optional(),
    websiteUrl: z.url().max(2_048).optional(),
  })
  .strict();

export const providerSearchPageSchema = z
  .object({
    continuationToken: z.string().trim().min(1).max(4_096).nullable(),
    providerRequestCount: z.number().int().min(1).max(3),
    records: z.array(providerBusinessRecordSchema).max(1_000),
    totalAvailable: z.number().int().nonnegative(),
    warning: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export type ProviderBusinessRecord = z.infer<typeof providerBusinessRecordSchema>;
export type ProviderSearchInput = z.infer<typeof providerSearchInputSchema>;
export type ProviderSearchPage = z.infer<typeof providerSearchPageSchema>;
