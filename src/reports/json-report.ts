import { randomUUID } from "node:crypto";
import { rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { auditResultSchema } from "../core/schemas.js";
import type { AuditResult } from "../core/types.js";

export function generateJsonReport(auditResult: unknown): string {
  const validatedResult = auditResultSchema.parse(auditResult);
  return `${JSON.stringify(validatedResult, null, 2)}\n`;
}

export async function writeJsonReport(
  jsonDirectory: string,
  auditResult: unknown,
): Promise<AuditResult> {
  const validatedResult = auditResultSchema.parse(auditResult);
  const destinationPath = resolve(jsonDirectory, "audit-result.json");
  const temporaryPath = resolve(jsonDirectory, `.audit-result-${randomUUID()}.tmp`);
  const resultWithOutput = auditResultSchema.parse({
    ...validatedResult,
    outputs: { ...validatedResult.outputs, jsonReportPath: destinationPath },
  });

  try {
    await writeFile(temporaryPath, generateJsonReport(resultWithOutput), {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temporaryPath, destinationPath);
    return resultWithOutput;
  } finally {
    await rm(temporaryPath, { force: true });
  }
}
