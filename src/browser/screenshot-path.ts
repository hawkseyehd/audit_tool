import { createHash } from "node:crypto";
import { isAbsolute, relative, resolve } from "node:path";

import type { Viewport } from "../core/types.js";

export interface ScreenshotTarget {
  readonly absolutePath: string;
  readonly relativePath: string;
}

export function createScreenshotTarget(
  auditDirectory: string,
  screenshotsDirectory: string,
  url: string,
  viewport: Viewport,
): ScreenshotTarget {
  const parsedUrl = new URL(url);
  const slug = createPageSlug(parsedUrl);
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 12);
  const filename = `${slug}-${viewport}-${hash}.png`;
  const resolvedAuditDirectory = resolve(auditDirectory);
  const resolvedScreenshotsDirectory = resolve(screenshotsDirectory);
  const absolutePath = resolve(resolvedScreenshotsDirectory, filename);
  assertInsideDirectory(resolvedAuditDirectory, resolvedScreenshotsDirectory);
  assertInsideDirectory(resolvedScreenshotsDirectory, absolutePath);

  return {
    absolutePath,
    relativePath: relative(resolvedAuditDirectory, absolutePath).replaceAll("\\", "/"),
  };
}

function createPageSlug(url: URL): string {
  const decodedPath = safeDecode(url.pathname);
  const source = decodedPath === "/" ? url.hostname : decodedPath;
  const slug = source
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 60)
    .replace(/-+$/gu, "");

  return slug.length > 0 ? slug : "page";
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function assertInsideDirectory(parent: string, candidate: string): void {
  const relativePath = relative(parent, candidate);
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new TypeError("Screenshot path must remain inside the audit directory");
  }
}
