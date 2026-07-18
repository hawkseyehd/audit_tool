import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

const SAFE_PATH_SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/u;
const WINDOWS_RESERVED_NAMES = new Set([
  "aux",
  "con",
  "nul",
  "prn",
  ...Array.from({ length: 9 }, (_, index) => `com${String(index + 1)}`),
  ...Array.from({ length: 9 }, (_, index) => `lpt${String(index + 1)}`),
]);

export interface AuditOutputDirectories {
  readonly rootDirectory: string;
  readonly auditDirectory: string;
  readonly screenshotsDirectory: string;
  readonly jsonDirectory: string;
  readonly htmlDirectory: string;
  readonly markdownDirectory: string;
  readonly pdfDirectory: string;
}

export interface AuditIdDependencies {
  readonly now?: () => Date;
  readonly randomUUID?: () => string;
}

export function createAuditId(dependencies: AuditIdDependencies = {}): string {
  const now = dependencies.now?.() ?? new Date();
  const uuid = dependencies.randomUUID?.() ?? randomUUID();

  if (Number.isNaN(now.getTime())) {
    throw new TypeError("Audit timestamp must be a valid date");
  }

  assertSafePathSegment(uuid, "Audit UUID");

  const timestamp = now.toISOString().replaceAll("-", "").replaceAll(":", "").replace(".", "");

  return `audit-${timestamp}-${uuid}`;
}

export async function createAuditOutputDirectories(
  outputRoot: string,
  auditId: string,
): Promise<AuditOutputDirectories> {
  if (outputRoot.trim().length === 0) {
    throw new TypeError("Output root is required");
  }

  assertSafePathSegment(auditId, "Audit ID");

  const rootDirectory = resolve(outputRoot);
  const auditDirectory = resolve(rootDirectory, auditId);
  assertPathInsideRoot(rootDirectory, auditDirectory);

  const screenshotsDirectory = resolve(auditDirectory, "screenshots");
  const jsonDirectory = resolve(auditDirectory, "json");
  const htmlDirectory = resolve(auditDirectory, "html");
  const markdownDirectory = resolve(auditDirectory, "markdown");
  const pdfDirectory = resolve(auditDirectory, "pdf");

  await Promise.all([
    mkdir(screenshotsDirectory, { recursive: true }),
    mkdir(jsonDirectory, { recursive: true }),
    mkdir(htmlDirectory, { recursive: true }),
    mkdir(markdownDirectory, { recursive: true }),
    mkdir(pdfDirectory, { recursive: true }),
  ]);

  return {
    rootDirectory,
    auditDirectory,
    screenshotsDirectory,
    jsonDirectory,
    htmlDirectory,
    markdownDirectory,
    pdfDirectory,
  };
}

function assertSafePathSegment(value: string, label: string): void {
  const normalizedValue = value.toLowerCase();

  if (
    !SAFE_PATH_SEGMENT_PATTERN.test(value) ||
    value.endsWith(".") ||
    WINDOWS_RESERVED_NAMES.has(normalizedValue)
  ) {
    throw new TypeError(`${label} must be a safe path segment`);
  }
}

function assertPathInsideRoot(root: string, candidate: string): void {
  const relativePath = relative(root, candidate);

  if (relativePath.length === 0 || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new TypeError("Audit output path must remain inside the configured output root");
  }
}
