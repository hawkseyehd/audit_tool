import type { AuditFinding, ScannerName } from "../core/types.js";

export interface ScannerContext {
  readonly detectedAt: string;
}

export interface AuditScanner<TInput> {
  readonly name: ScannerName;
  scan(input: TInput, context: ScannerContext): Promise<readonly AuditFinding[]>;
}
