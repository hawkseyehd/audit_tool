import { copyFile, lstat, mkdir, realpath } from "node:fs/promises";
import path from "node:path";

import { dialog, shell, type BrowserWindow } from "electron";

import {
  reportArtifactActionResultSchema,
  type ReportArtifactActionResult,
  type ReportArtifactListQuery,
  type ReportArtifactListResult,
} from "../shared/contracts.js";
import type { ReportArtifactAccess } from "./audit-history-repository.js";

type DialogApi = Pick<typeof dialog, "showSaveDialog">;
type ShellApi = Pick<typeof shell, "openPath" | "showItemInFolder">;
interface ReportArtifactStore {
  getArtifactAccess(id: string): Promise<ReportArtifactAccess | null>;
  listArtifacts(query: ReportArtifactListQuery): Promise<ReportArtifactListResult>;
  setArtifactStatus(
    id: string,
    status: ReportArtifactAccess["status"],
    verifiedAt: Date,
  ): Promise<void>;
}

export class ReportArtifactService {
  readonly #history: ReportArtifactStore;
  readonly #reportRoot: string;
  readonly #dialog: DialogApi;
  readonly #shell: ShellApi;

  constructor(options: {
    dataDirectory: string;
    dialogApi?: DialogApi;
    history: ReportArtifactStore;
    shellApi?: ShellApi;
  }) {
    this.#dialog = options.dialogApi ?? dialog;
    this.#history = options.history;
    this.#reportRoot = path.join(path.resolve(options.dataDirectory), "audits");
    this.#shell = options.shellApi ?? shell;
  }

  async initialize(): Promise<void> {
    await mkdir(this.#reportRoot, { recursive: true });
  }

  list(query: ReportArtifactListQuery): Promise<ReportArtifactListResult> {
    return this.#history.listArtifacts(query);
  }

  async open(artifactId: string): Promise<ReportArtifactActionResult> {
    const resolved = await this.#resolve(artifactId);
    if (!resolved.ok) return resolved.result;
    const failure = await this.#shell.openPath(resolved.path);
    return failure.length === 0
      ? actionSuccess("opened")
      : actionError("open-failed", "The report could not be opened by the system.");
  }

  async reveal(artifactId: string): Promise<ReportArtifactActionResult> {
    const resolved = await this.#resolve(artifactId);
    if (!resolved.ok) return resolved.result;
    this.#shell.showItemInFolder(resolved.path);
    return actionSuccess("revealed");
  }

  async export(artifactId: string, window: BrowserWindow): Promise<ReportArtifactActionResult> {
    const resolved = await this.#resolve(artifactId);
    if (!resolved.ok) return resolved.result;
    const selection = await this.#dialog.showSaveDialog(window, {
      defaultPath: resolved.fileName,
      title: "Export audit report",
    });
    if (selection.canceled) {
      return actionError("cancelled", "Report export was cancelled.");
    }
    try {
      await copyFile(resolved.path, selection.filePath);
      return actionSuccess("exported");
    } catch {
      return actionError("export-failed", "The report could not be exported to that location.");
    }
  }

  async #resolve(
    artifactId: string,
  ): Promise<
    { fileName: string; ok: true; path: string } | { ok: false; result: ReportArtifactActionResult }
  > {
    const artifact = await this.#history.getArtifactAccess(artifactId);
    if (artifact === null) {
      return { ok: false, result: actionError("not-found", "The report was not found.") };
    }
    const stateError = await this.#validateState(artifact);
    if (stateError !== null) return { ok: false, result: stateError };
    if (artifact.storedPath === null || path.isAbsolute(artifact.storedPath)) {
      return {
        ok: false,
        result: actionError("unsafe-path", "The stored report location is not trusted."),
      };
    }

    const candidate = path.resolve(this.#reportRoot, artifact.storedPath);
    if (!isWithin(this.#reportRoot, candidate)) {
      return {
        ok: false,
        result: actionError(
          "unsafe-path",
          "The stored report location is outside application data.",
        ),
      };
    }

    try {
      const [trustedRoot, source] = await Promise.all([
        realpath(this.#reportRoot),
        realpath(candidate),
      ]);
      if (!isWithin(trustedRoot, source)) {
        return {
          ok: false,
          result: actionError("unsafe-path", "The report resolves outside application data."),
        };
      }
      const details = await lstat(source);
      if (!details.isFile()) {
        await this.#history.setArtifactStatus(artifact.id, "missing", new Date());
        return {
          ok: false,
          result: actionError("unavailable", "The report file is no longer available."),
        };
      }
      await this.#history.setArtifactStatus(artifact.id, "available", new Date());
      return { fileName: artifact.fileName, ok: true, path: source };
    } catch (error: unknown) {
      if (isMissingFileError(error)) {
        await this.#history.setArtifactStatus(artifact.id, "missing", new Date());
        return {
          ok: false,
          result: actionError("unavailable", "The report file is no longer available."),
        };
      }
      return {
        ok: false,
        result: actionError("open-failed", "The report location could not be verified."),
      };
    }
  }

  async #validateState(artifact: ReportArtifactAccess): Promise<ReportArtifactActionResult | null> {
    if (artifact.retainedUntil !== null && artifact.retainedUntil.getTime() <= Date.now()) {
      await this.#history.setArtifactStatus(artifact.id, "expired", new Date());
      return actionError("expired", "This report has passed its retention date.");
    }
    if (artifact.status === "expired") {
      return actionError("expired", "This report has passed its retention date.");
    }
    if (artifact.status !== "available") {
      return actionError("unavailable", "This report is not available.");
    }
    return null;
  }
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative.length === 0 || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ENOTDIR")
  );
}

function actionSuccess(action: "opened" | "revealed" | "exported"): ReportArtifactActionResult {
  return reportArtifactActionResultSchema.parse({ action, ok: true });
}

function actionError(
  code:
    | "not-found"
    | "unavailable"
    | "expired"
    | "unsafe-path"
    | "cancelled"
    | "open-failed"
    | "export-failed",
  message: string,
): ReportArtifactActionResult {
  return reportArtifactActionResultSchema.parse({ error: { code, message }, ok: false });
}
