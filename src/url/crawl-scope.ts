import { extname } from "node:path";

import { normalizeDiscoveredUrl, normalizeTargetUrl, UrlPolicyError } from "./normalize-url.js";

const DOWNLOAD_EXTENSIONS = new Set([
  ".7z",
  ".apk",
  ".avi",
  ".css",
  ".csv",
  ".dmg",
  ".doc",
  ".docx",
  ".exe",
  ".gif",
  ".gz",
  ".ico",
  ".iso",
  ".jpeg",
  ".jpg",
  ".js",
  ".json",
  ".mov",
  ".mp3",
  ".mp4",
  ".pdf",
  ".png",
  ".ppt",
  ".pptx",
  ".rar",
  ".svg",
  ".tar",
  ".tgz",
  ".webm",
  ".webp",
  ".wmv",
  ".xls",
  ".xlsx",
  ".xml",
  ".zip",
]);

const SOCIAL_HOSTNAMES = new Set([
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "pinterest.com",
  "tiktok.com",
  "twitter.com",
  "whatsapp.com",
  "x.com",
  "youtube.com",
  "youtu.be",
]);

export type CrawlRejectionReason =
  | "empty"
  | "invalid-url"
  | "unsupported-scheme"
  | "embedded-credentials"
  | "download"
  | "social-media"
  | "external-domain"
  | "port-mismatch";

export interface CrawlScope {
  readonly targetHostname: string;
  readonly targetPort: string;
  readonly allowedHostnames: ReadonlySet<string>;
}

export type CrawlUrlDecision =
  | { readonly accepted: true; readonly url: string }
  | {
      readonly accepted: false;
      readonly reason: CrawlRejectionReason;
      readonly detail?: string;
    };

export function createCrawlScope(
  targetUrl: string,
  allowedDomains: readonly string[] = [],
): CrawlScope {
  const target = new URL(normalizeTargetUrl(targetUrl));
  const allowedHostnames = new Set<string>([target.hostname]);

  for (const domain of allowedDomains) {
    allowedHostnames.add(normalizeHostname(domain));
  }

  return {
    targetHostname: target.hostname,
    targetPort: target.port,
    allowedHostnames,
  };
}

export function evaluateCrawlCandidate(
  input: string,
  baseUrl: string | URL,
  scope: CrawlScope,
): CrawlUrlDecision {
  let normalizedUrl: string;

  try {
    normalizedUrl = normalizeDiscoveredUrl(input, baseUrl);
  } catch (error: unknown) {
    return rejectedFromPolicyError(error);
  }

  const url = new URL(normalizedUrl);

  if (isSocialHostname(url.hostname)) {
    return { accepted: false, reason: "social-media" };
  }

  if (isDownloadPath(url.pathname)) {
    return { accepted: false, reason: "download" };
  }

  if (!scope.allowedHostnames.has(url.hostname)) {
    return { accepted: false, reason: "external-domain", detail: url.hostname };
  }

  const expectedPort = url.hostname === scope.targetHostname ? scope.targetPort : "";
  if (url.port !== expectedPort) {
    return { accepted: false, reason: "port-mismatch", detail: url.port };
  }

  return { accepted: true, url: normalizedUrl };
}

function normalizeHostname(domain: string): string {
  const value = domain.trim().toLowerCase();

  try {
    const url = new URL(`https://${value}`);
    if (url.hostname !== value || url.port.length > 0 || url.pathname !== "/") {
      throw new TypeError("Allowed domain must contain a hostname only");
    }
    return url.hostname;
  } catch (error: unknown) {
    throw new TypeError(`Invalid allowed domain: ${domain}`, { cause: error });
  }
}

function isSocialHostname(hostname: string): boolean {
  for (const socialHostname of SOCIAL_HOSTNAMES) {
    if (hostname === socialHostname || hostname.endsWith(`.${socialHostname}`)) {
      return true;
    }
  }
  return false;
}

function isDownloadPath(pathname: string): boolean {
  let decodedPathname = pathname;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    // A malformed escape remains non-executable text and is checked as-is.
  }

  return DOWNLOAD_EXTENSIONS.has(extname(decodedPathname).toLowerCase());
}

function rejectedFromPolicyError(error: unknown): CrawlUrlDecision {
  if (!(error instanceof UrlPolicyError)) {
    return { accepted: false, reason: "invalid-url" };
  }

  switch (error.code) {
    case "empty-url":
      return { accepted: false, reason: "empty" };
    case "unsupported-protocol":
      return { accepted: false, reason: "unsupported-scheme", detail: error.message };
    case "embedded-credentials":
      return { accepted: false, reason: "embedded-credentials" };
    default:
      return { accepted: false, reason: "invalid-url", detail: error.message };
  }
}
