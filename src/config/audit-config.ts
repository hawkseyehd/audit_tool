import { z } from "zod";

import { viewportSchema } from "../core/schemas.js";

export const AUDIT_LIMITS = {
  auditTimeoutMs: { default: 1_800_000, max: 3_600_000, min: 30_000 },
  concurrency: { default: 2, max: 3, min: 1 },
  crawlDelayMs: { default: 250, max: 60_000, min: 0 },
  maxPages: { default: 15, max: 100, min: 1 },
  maxRedirects: { default: 10, max: 20, min: 0 },
  maxResponseBytes: { default: 5_000_000, max: 25_000_000, min: 1_024 },
  maxRetries: { default: 2, max: 5, min: 0 },
  maxScreenshotsPerViewport: { default: 10, max: 50, min: 0 },
  navigationTimeoutMs: { default: 30_000, max: 120_000, min: 1_000 },
} as const;

const targetUrlSchema = z
  .string()
  .trim()
  .min(1, "Target URL is required")
  .max(2_048, "Target URL is too long")
  .refine(isValidHttpTarget, "Target must be an HTTP or HTTPS URL without credentials");

const hostnameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(253)
  .refine(isValidHostname, "Allowed domains must contain hostnames only");

const uniqueViewportsSchema = z
  .array(viewportSchema)
  .min(1, "At least one viewport is required")
  .max(2)
  .refine((viewports) => new Set(viewports).size === viewports.length, "Viewports must be unique");

const uniqueDomainsSchema = z
  .array(hostnameSchema)
  .max(20)
  .refine((domains) => new Set(domains).size === domains.length, "Allowed domains must be unique");

export const auditConfigSchema = z
  .object({
    targetUrl: targetUrlSchema,
    maxPages: z
      .number()
      .int()
      .min(AUDIT_LIMITS.maxPages.min)
      .max(AUDIT_LIMITS.maxPages.max)
      .default(AUDIT_LIMITS.maxPages.default),
    outputDir: z.string().trim().min(1).max(4_096).default("./reports"),
    viewports: uniqueViewportsSchema.default(["desktop"]),
    includeLighthouse: z.boolean().default(true),
    includeAccessibility: z.boolean().default(true),
    includeForms: z.boolean().default(true),
    includeSeo: z.boolean().default(true),
    includeSecurity: z.boolean().default(true),
    includeUxHeuristics: z.boolean().default(true),
    includeAnalytics: z.boolean().default(true),
    writeJson: z.boolean().default(true),
    writeMarkdown: z.boolean().default(true),
    submitForms: z.boolean().default(false),
    allowedDomains: uniqueDomainsSchema.default([]),
    crawlDelayMs: z
      .number()
      .int()
      .min(AUDIT_LIMITS.crawlDelayMs.min)
      .max(AUDIT_LIMITS.crawlDelayMs.max)
      .default(AUDIT_LIMITS.crawlDelayMs.default),
    concurrency: z
      .number()
      .int()
      .min(AUDIT_LIMITS.concurrency.min)
      .max(AUDIT_LIMITS.concurrency.max)
      .default(AUDIT_LIMITS.concurrency.default),
    navigationTimeoutMs: z
      .number()
      .int()
      .min(AUDIT_LIMITS.navigationTimeoutMs.min)
      .max(AUDIT_LIMITS.navigationTimeoutMs.max)
      .default(AUDIT_LIMITS.navigationTimeoutMs.default),
    auditTimeoutMs: z
      .number()
      .int()
      .min(AUDIT_LIMITS.auditTimeoutMs.min)
      .max(AUDIT_LIMITS.auditTimeoutMs.max)
      .default(AUDIT_LIMITS.auditTimeoutMs.default),
    maxRedirects: z
      .number()
      .int()
      .min(AUDIT_LIMITS.maxRedirects.min)
      .max(AUDIT_LIMITS.maxRedirects.max)
      .default(AUDIT_LIMITS.maxRedirects.default),
    maxResponseBytes: z
      .number()
      .int()
      .min(AUDIT_LIMITS.maxResponseBytes.min)
      .max(AUDIT_LIMITS.maxResponseBytes.max)
      .default(AUDIT_LIMITS.maxResponseBytes.default),
    maxRetries: z
      .number()
      .int()
      .min(AUDIT_LIMITS.maxRetries.min)
      .max(AUDIT_LIMITS.maxRetries.max)
      .default(AUDIT_LIMITS.maxRetries.default),
    maxScreenshotsPerViewport: z
      .number()
      .int()
      .min(AUDIT_LIMITS.maxScreenshotsPerViewport.min)
      .max(AUDIT_LIMITS.maxScreenshotsPerViewport.max)
      .default(AUDIT_LIMITS.maxScreenshotsPerViewport.default),
  })
  .strict();

export type AuditConfigInput = z.input<typeof auditConfigSchema>;
export type AuditConfig = z.output<typeof auditConfigSchema>;

export function parseAuditConfig(input: unknown): AuditConfig {
  return auditConfigSchema.parse(input);
}

export function safeParseAuditConfig(input: unknown): z.ZodSafeParseResult<AuditConfig> {
  return auditConfigSchema.safeParse(input);
}

function isValidHttpTarget(value: string): boolean {
  const candidate = value.includes("://") ? value : `https://${value}`;

  try {
    const url = new URL(candidate);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname.length > 0 &&
      url.username.length === 0 &&
      url.password.length === 0
    );
  } catch {
    return false;
  }
}

function isValidHostname(value: string): boolean {
  try {
    const url = new URL(`https://${value}`);
    return (
      url.hostname === value &&
      url.port.length === 0 &&
      url.pathname === "/" &&
      url.search.length === 0 &&
      url.hash.length === 0
    );
  } catch {
    return false;
  }
}
