import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { DesktopDatabaseService } from "../../src/desktop/main/database-service.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directory) => {
      await rm(directory, { force: true, recursive: true });
    }),
  );
});

describe("DesktopDatabaseService", () => {
  it("initializes and reopens an application-owned SQLite workspace", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "audit-tool-desktop-"));
    temporaryDirectories.push(directory);

    const first = new DesktopDatabaseService(directory);
    await first.initialize();
    const initializedAt = first.initializedAt;
    expect(first.getWorkspaceSummary()).toEqual({
      audits: 0,
      clients: 0,
      prospects: 0,
      reports: 0,
    });
    await first.close();

    const reopened = new DesktopDatabaseService(directory);
    await reopened.initialize();
    expect(reopened.initializedAt).toBe(initializedAt);
    await reopened.close();
  });

  it("does not expose a summary before initialization", () => {
    const service = new DesktopDatabaseService(path.join(tmpdir(), "unused-audit-tool-database"));
    expect(() => service.getWorkspaceSummary()).toThrow("unavailable");
  });
});
