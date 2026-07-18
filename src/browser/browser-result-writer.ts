import { randomUUID } from "node:crypto";
import { rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { browserInspectionResultSchema } from "./schemas.js";
import type { BrowserInspectionResult } from "./types.js";

export async function writeBrowserInspectionResult(
  jsonDirectory: string,
  inspectionResult: BrowserInspectionResult,
): Promise<string> {
  const validatedResult = browserInspectionResultSchema.parse(inspectionResult);
  const destinationPath = resolve(jsonDirectory, "browser-inspection.json");
  const temporaryPath = resolve(jsonDirectory, `.browser-inspection-${randomUUID()}.tmp`);

  try {
    await writeFile(temporaryPath, `${JSON.stringify(validatedResult, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temporaryPath, destinationPath);
    return destinationPath;
  } finally {
    await rm(temporaryPath, { force: true });
  }
}
