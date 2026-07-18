import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { parseAuditConfig, runFoundationAudit } from "../../../src/index.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("runFoundationAudit", () => {
  it("creates a safe audit workspace without claiming pages were scanned", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "website-audit-cli-"));
    temporaryDirectories.push(outputDir);
    const config = parseAuditConfig({ targetUrl: "example.com", outputDir });

    const receipt = await runFoundationAudit(config);

    expect(receipt.status).toBe("initialized");
    expect(receipt.scannedPageCount).toBe(0);
    expect(receipt.auditId).toMatch(/^audit-/u);
    await expect(access(receipt.outputDirectory)).resolves.toBeUndefined();
  });
});
