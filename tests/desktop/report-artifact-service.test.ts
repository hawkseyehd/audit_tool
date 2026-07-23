import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReportArtifactAccess } from "../../src/desktop/main/audit-history-repository.js";
import { ReportArtifactService } from "../../src/desktop/main/report-artifact-service.js";
import type {
  ReportArtifactListQuery,
  ReportArtifactListResult,
  ReportArtifactStatus,
} from "../../src/desktop/shared/contracts.js";

const artifactId = "58c4439a-30fd-42b7-b742-28d5b6f66781";
let artifact: ReportArtifactAccess;
let directory: string;
let statuses: ReportArtifactStatus[];

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "audit-tool-reports-"));
  await mkdir(path.join(directory, "audits", "audit-one"), { recursive: true });
  await writeFile(path.join(directory, "audits", "audit-one", "audit-report.pdf"), "report");
  artifact = {
    fileName: "audit-report.pdf",
    id: artifactId,
    retainedUntil: null,
    status: "available",
    storedPath: path.join("audit-one", "audit-report.pdf"),
  };
  statuses = [];
});

afterEach(async () => {
  await rm(directory, { force: true, recursive: true });
  vi.restoreAllMocks();
});

function createStore() {
  return {
    getArtifactAccess(id: string): Promise<ReportArtifactAccess | null> {
      return Promise.resolve(id === artifactId ? artifact : null);
    },
    listArtifacts(_query: ReportArtifactListQuery): Promise<ReportArtifactListResult> {
      return Promise.resolve({ items: [], page: 1, pageSize: 25, total: 0 });
    },
    setArtifactStatus(_id: string, status: ReportArtifactStatus, _verifiedAt: Date): Promise<void> {
      statuses.push(status);
      return Promise.resolve();
    },
  };
}

describe("ReportArtifactService", () => {
  it("opens a verified app-owned artifact from an opaque identifier", async () => {
    const openPath = vi.fn().mockResolvedValue("");
    const service = new ReportArtifactService({
      dataDirectory: directory,
      history: createStore(),
      shellApi: { openPath, showItemInFolder: vi.fn() },
    });
    await service.initialize();

    await expect(service.open(artifactId)).resolves.toEqual({ action: "opened", ok: true });
    expect(openPath).toHaveBeenCalledWith(
      path.join(directory, "audits", "audit-one", "audit-report.pdf"),
    );
    expect(statuses).toEqual(["available"]);
  });

  it("blocks stored paths that escape the trusted audit root", async () => {
    artifact = { ...artifact, storedPath: path.join("..", "outside.pdf") };
    const openPath = vi.fn().mockResolvedValue("");
    const service = new ReportArtifactService({
      dataDirectory: directory,
      history: createStore(),
      shellApi: { openPath, showItemInFolder: vi.fn() },
    });
    await service.initialize();

    await expect(service.open(artifactId)).resolves.toMatchObject({
      error: { code: "unsafe-path" },
      ok: false,
    });
    expect(openPath).not.toHaveBeenCalled();
  });

  it("exports through a main-process save choice without a renderer destination path", async () => {
    const exportPath = path.join(directory, "exported-report.pdf");
    const service = new ReportArtifactService({
      dataDirectory: directory,
      dialogApi: {
        showSaveDialog: vi.fn().mockResolvedValue({ canceled: false, filePath: exportPath }),
      },
      history: createStore(),
      shellApi: { openPath: vi.fn(), showItemInFolder: vi.fn() },
    });
    await service.initialize();

    await expect(service.export(artifactId, {} as never)).resolves.toEqual({
      action: "exported",
      ok: true,
    });
    await expect(readFile(exportPath, "utf8")).resolves.toBe("report");
  });

  it("marks a deleted artifact missing and returns an actionable state", async () => {
    artifact = { ...artifact, storedPath: path.join("audit-one", "missing.pdf") };
    const service = new ReportArtifactService({
      dataDirectory: directory,
      history: createStore(),
      shellApi: { openPath: vi.fn(), showItemInFolder: vi.fn() },
    });
    await service.initialize();

    await expect(service.open(artifactId)).resolves.toMatchObject({
      error: { code: "unavailable" },
      ok: false,
    });
    expect(statuses).toEqual(["missing"]);
  });
});
