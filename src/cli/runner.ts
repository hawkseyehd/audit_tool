import type { AuditConfig } from "../config/audit-config.js";
import { createAuditId, createAuditOutputDirectories } from "../infrastructure/audit-output.js";

export interface AuditRunReceipt {
  readonly status: "initialized" | "completed";
  readonly auditId: string;
  readonly scannedPageCount: number;
  readonly outputDirectory: string;
  readonly markdownReportPath?: string;
  readonly jsonReportPath?: string;
}

export type AuditRunner = (config: AuditConfig) => Promise<AuditRunReceipt>;

export const runFoundationAudit: AuditRunner = async (config) => {
  const auditId = createAuditId();
  const directories = await createAuditOutputDirectories(config.outputDir, auditId);

  return {
    status: "initialized",
    auditId,
    scannedPageCount: 0,
    outputDirectory: directories.auditDirectory,
  };
};
