import { z } from "zod";

export const AUDIT_SCHEMA_VERSION = "1.0.0" as const;

export const FINDING_SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;
export const FINDING_CATEGORIES = [
  "business",
  "ux",
  "forms",
  "performance",
  "accessibility",
  "seo",
  "security",
  "privacy",
  "analytics",
  "technical",
] as const;
export const PAGE_TYPES = [
  "home",
  "contact",
  "service",
  "product",
  "pricing",
  "about",
  "blog",
  "form",
  "checkout",
  "booking",
  "auth",
  "unknown",
] as const;
export const VIEWPORTS = ["desktop", "mobile"] as const;
export const SCANNERS = [
  "lighthouse",
  "accessibility",
  "forms",
  "seo",
  "security",
  "ux",
  "analytics",
  "orchestrator",
] as const;
export const EVIDENCE_SOURCES = [
  "lighthouse",
  "axe",
  "playwright",
  "crawler",
  "headers",
  "heuristic",
] as const;

const nonEmptyTextSchema = z.string().trim().min(1);
const pathSchema = nonEmptyTextSchema.max(4_096);
const scoreSchema = z.number().min(0).max(100);
const utcTimestampSchema = z.iso
  .datetime()
  .refine((timestamp) => timestamp.endsWith("Z"), "Timestamp must be in UTC");

export const findingSeveritySchema = z.enum(FINDING_SEVERITIES);
export const findingCategorySchema = z.enum(FINDING_CATEGORIES);
export const pageTypeSchema = z.enum(PAGE_TYPES);
export const viewportSchema = z.enum(VIEWPORTS);
export const scannerSchema = z.enum(SCANNERS);
export const evidenceSourceSchema = z.enum(EVIDENCE_SOURCES);

export const auditEvidenceSchema = z
  .object({
    selector: nonEmptyTextSchema.max(2_000).optional(),
    screenshotPath: pathSchema.optional(),
    metric: nonEmptyTextSchema.max(200).optional(),
    value: z.union([z.string(), z.number()]).optional(),
    expected: z.union([z.string(), z.number()]).optional(),
    source: evidenceSourceSchema,
  })
  .strict();

export const auditFindingSchema = z
  .object({
    id: nonEmptyTextSchema.max(200),
    ruleId: nonEmptyTextSchema.max(200),
    url: z.url(),
    category: findingCategorySchema,
    severity: findingSeveritySchema,
    title: nonEmptyTextSchema.max(240),
    description: nonEmptyTextSchema.max(5_000),
    impact: nonEmptyTextSchema.max(5_000),
    recommendation: nonEmptyTextSchema.max(5_000),
    scanner: scannerSchema,
    detectedAt: utcTimestampSchema,
    evidence: auditEvidenceSchema.optional(),
  })
  .strict();

export const scannedPageErrorSchema = z
  .object({
    code: nonEmptyTextSchema.max(100).optional(),
    message: nonEmptyTextSchema.max(2_000),
  })
  .strict();

export const scannedPageSchema = z
  .object({
    url: z.url(),
    title: z.string().trim().max(500).optional(),
    pageType: pageTypeSchema,
    statusCode: z.number().int().min(100).max(599).optional(),
    screenshotPath: pathSchema.optional(),
    error: scannedPageErrorSchema.optional(),
  })
  .strict();

export const findingCountsSchema = z
  .object({
    critical: z.number().int().nonnegative(),
    high: z.number().int().nonnegative(),
    medium: z.number().int().nonnegative(),
    low: z.number().int().nonnegative(),
    info: z.number().int().nonnegative(),
  })
  .strict();

export const auditSummarySchema = z
  .object({
    overallScore: scoreSchema,
    categoryScores: z.record(z.string(), scoreSchema),
    findingCounts: findingCountsSchema,
    topPriorities: z.array(nonEmptyTextSchema.max(200)).max(20),
  })
  .strict();

export const auditOutputsSchema = z
  .object({
    htmlReportPath: pathSchema.optional(),
    markdownReportPath: pathSchema.optional(),
    jsonReportPath: pathSchema.optional(),
    screenshotDirectory: pathSchema.optional(),
  })
  .strict();

export const auditResultSchema = z
  .object({
    schemaVersion: z.literal(AUDIT_SCHEMA_VERSION),
    auditId: nonEmptyTextSchema.max(200),
    startedAt: utcTimestampSchema,
    completedAt: utcTimestampSchema,
    targetUrl: nonEmptyTextSchema.max(2_048),
    normalizedUrl: z.url(),
    scannedPages: z.array(scannedPageSchema),
    summary: auditSummarySchema,
    findings: z.array(auditFindingSchema),
    outputs: auditOutputsSchema,
  })
  .strict()
  .refine(
    (result) => Date.parse(result.completedAt) >= Date.parse(result.startedAt),
    "completedAt must not be earlier than startedAt",
  );
