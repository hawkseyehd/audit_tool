import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  BROWSER_INSPECTION_SCHEMA_VERSION,
  browserInspectionResultSchema,
  writeBrowserInspectionResult,
  type BrowserInspectionResult,
} from "../../../src/index.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("writeBrowserInspectionResult", () => {
  it("atomically writes validated browser inspection JSON", async () => {
    const directory = await mkdtemp(join(tmpdir(), "browser-inspection-"));
    temporaryDirectories.push(directory);
    const result = createResult();

    const outputPath = await writeBrowserInspectionResult(directory, result);
    const stored = JSON.parse(await readFile(outputPath, "utf8")) as unknown;

    expect(browserInspectionResultSchema.parse(stored)).toEqual(result);
  });
});

function createResult(): BrowserInspectionResult {
  return {
    schemaVersion: BROWSER_INSPECTION_SCHEMA_VERSION,
    startedAt: "2026-07-18T12:00:00.000Z",
    completedAt: "2026-07-18T12:00:01.000Z",
    targetUrl: "https://example.com/",
    pages: [
      {
        requestedUrl: "https://example.com/",
        finalUrl: "https://example.com/",
        viewport: "desktop",
        durationMs: 100,
        consoleErrors: [],
        pageErrors: [],
        screenshotPath: "screenshots/example-com-desktop-aabbccddeeff.png",
        statusCode: 200,
      },
    ],
    runErrors: [],
    stats: {
      sourcePages: 1,
      skippedPages: 0,
      attemptedInspections: 1,
      successfulInspections: 1,
      failedInspections: 0,
      screenshotsCaptured: 1,
    },
  };
}
