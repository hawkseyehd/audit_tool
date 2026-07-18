import { auditEvidenceSchema } from "../core/schemas.js";
import type { AuditEvidence, EvidenceSource } from "../core/types.js";
import type { BrowserPageInspection } from "../browser/types.js";

export type AuditEvidenceInput = Omit<AuditEvidence, "source">;

export function createAuditEvidence(
  source: EvidenceSource,
  input: AuditEvidenceInput,
): AuditEvidence {
  return auditEvidenceSchema.parse({ ...input, source });
}

export function createBrowserScreenshotEvidence(
  inspection: BrowserPageInspection,
): AuditEvidence | undefined {
  return inspection.screenshotPath === undefined
    ? undefined
    : createAuditEvidence("playwright", { screenshotPath: inspection.screenshotPath });
}
