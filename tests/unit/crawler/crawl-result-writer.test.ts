import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  CRAWL_SCHEMA_VERSION,
  crawlResultSchema,
  writeCrawlResult,
  type CrawlResult,
} from "../../../src/index.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("writeCrawlResult", () => {
  it("atomically writes validated crawl JSON", async () => {
    const directory = await mkdtemp(join(tmpdir(), "crawl-result-"));
    temporaryDirectories.push(directory);
    const result = createResult();

    const outputPath = await writeCrawlResult(directory, result);
    const stored = JSON.parse(await readFile(outputPath, "utf8")) as unknown;

    expect(crawlResultSchema.parse(stored)).toEqual(result);
  });
});

function createResult(): CrawlResult {
  return {
    schemaVersion: CRAWL_SCHEMA_VERSION,
    startedAt: "2026-07-18T10:00:00.000Z",
    completedAt: "2026-07-18T10:00:01.000Z",
    targetUrl: "https://example.com/",
    pages: [{ url: "https://example.com/", pageType: "unknown", statusCode: 200 }],
    rejectionCounts: {},
    stats: {
      attemptedPages: 1,
      successfulPages: 1,
      failedPages: 0,
      discoveredUrls: 1,
      rejectedLinks: 0,
    },
  };
}
