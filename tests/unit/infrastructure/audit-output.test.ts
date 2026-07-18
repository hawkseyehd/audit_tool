import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createAuditId, createAuditOutputDirectories } from "../../../src/index.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("createAuditId", () => {
  it("creates a deterministic, path-safe ID with injected dependencies", () => {
    const auditId = createAuditId({
      now: () => new Date("2026-07-18T10:20:30.456Z"),
      randomUUID: () => "123e4567-e89b-12d3-a456-426614174000",
    });

    expect(auditId).toBe("audit-20260718T102030456Z-123e4567-e89b-12d3-a456-426614174000");
    expect(auditId).not.toMatch(/[\\/:]/u);
  });

  it("rejects an unsafe injected UUID", () => {
    expect(() => createAuditId({ randomUUID: () => "../escape" })).toThrow(/safe path segment/u);
  });
});

describe("createAuditOutputDirectories", () => {
  it("creates audit-specific screenshot, JSON, and Markdown directories", async () => {
    const outputRoot = await createTemporaryDirectory();
    const directories = await createAuditOutputDirectories(outputRoot, "audit-safe-id");

    await expect(access(directories.screenshotsDirectory)).resolves.toBeUndefined();
    await expect(access(directories.jsonDirectory)).resolves.toBeUndefined();
    await expect(access(directories.markdownDirectory)).resolves.toBeUndefined();

    const relativeAuditPath = relative(directories.rootDirectory, directories.auditDirectory);
    expect(relativeAuditPath.startsWith("..")).toBe(false);
    expect(isAbsolute(relativeAuditPath)).toBe(false);
  });

  it.each([
    "../escape",
    "nested/id",
    "nested\\id",
    "invalid:id",
    "CON",
    "trailing.",
    ".",
    "..",
    "",
  ])("rejects unsafe audit ID %s", async (auditId) => {
    const outputRoot = await createTemporaryDirectory();

    await expect(createAuditOutputDirectories(outputRoot, auditId)).rejects.toThrow(
      /safe path segment/u,
    );
  });
});

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "website-audit-tool-"));
  temporaryDirectories.push(directory);
  return directory;
}
