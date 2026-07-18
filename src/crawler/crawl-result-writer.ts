import { randomUUID } from "node:crypto";
import { rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { crawlResultSchema } from "./schemas.js";
import type { CrawlResult } from "./types.js";

export async function writeCrawlResult(
  jsonDirectory: string,
  crawlResult: CrawlResult,
): Promise<string> {
  const validatedResult = crawlResultSchema.parse(crawlResult);
  const destinationPath = resolve(jsonDirectory, "crawl-result.json");
  const temporaryPath = resolve(jsonDirectory, `.crawl-result-${randomUUID()}.tmp`);

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
