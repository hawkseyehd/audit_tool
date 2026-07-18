import { z } from "zod";

import { pageTypeSchema, scannedPageErrorSchema } from "../../core/schemas.js";

const boundedTextSchema = z.string().trim().max(500);

export const seoHeadingSchema = z
  .object({
    level: z.number().int().min(1).max(6),
    text: boundedTextSchema,
  })
  .strict();

export const seoPageSnapshotSchema = z
  .object({
    url: z.url(),
    pageType: pageTypeSchema,
    title: boundedTextSchema.optional(),
    metaDescription: z.string().trim().max(1_000).optional(),
    canonicalUrl: z.url().optional(),
    hasCanonical: z.boolean(),
    hasInvalidCanonical: z.boolean(),
    robotsDirectives: z.array(z.string().trim().min(1).max(100)).max(30),
    headings: z.array(seoHeadingSchema).max(200),
    imageCount: z.number().int().nonnegative(),
    missingAltCount: z.number().int().nonnegative(),
    missingAltSelectors: z.array(z.string().trim().min(1).max(200)).max(10),
    internalLinks: z.array(z.url()).max(1_000),
    uncrawlableLinkCount: z.number().int().nonnegative(),
    uncrawlableLinkSelectors: z.array(z.string().trim().min(1).max(200)).max(10),
    structuredDataCount: z.number().int().nonnegative(),
    invalidStructuredDataCount: z.number().int().nonnegative(),
  })
  .strict();

export const seoSiteResourceSchema = z
  .object({
    requestedUrl: z.url(),
    finalUrl: z.url().optional(),
    statusCode: z.number().int().min(100).max(599).optional(),
    body: z.string().max(1_000_000).optional(),
    error: scannedPageErrorSchema.optional(),
  })
  .strict();

export const seoSiteResourcesSchema = z
  .object({
    robotsTxt: seoSiteResourceSchema,
    sitemap: seoSiteResourceSchema,
  })
  .strict();
