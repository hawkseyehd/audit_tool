import type { z } from "zod";

import type {
  auditEvidenceSchema,
  auditFindingSchema,
  auditOutputsSchema,
  auditResultSchema,
  auditSummarySchema,
  evidenceSourceSchema,
  findingCategorySchema,
  findingCountsSchema,
  findingSeveritySchema,
  pageTypeSchema,
  scannedPageErrorSchema,
  scannedPageSchema,
  scannerSchema,
  viewportSchema,
} from "./schemas.js";

export type FindingSeverity = z.infer<typeof findingSeveritySchema>;
export type FindingCategory = z.infer<typeof findingCategorySchema>;
export type PageType = z.infer<typeof pageTypeSchema>;
export type Viewport = z.infer<typeof viewportSchema>;
export type ScannerName = z.infer<typeof scannerSchema>;
export type EvidenceSource = z.infer<typeof evidenceSourceSchema>;
export type AuditEvidence = z.infer<typeof auditEvidenceSchema>;
export type AuditFinding = z.infer<typeof auditFindingSchema>;
export type ScannedPageError = z.infer<typeof scannedPageErrorSchema>;
export type ScannedPage = z.infer<typeof scannedPageSchema>;
export type FindingCounts = z.infer<typeof findingCountsSchema>;
export type AuditSummary = z.infer<typeof auditSummarySchema>;
export type AuditOutputs = z.infer<typeof auditOutputsSchema>;
export type AuditResult = z.infer<typeof auditResultSchema>;
