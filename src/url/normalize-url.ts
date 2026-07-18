export type UrlPolicyErrorCode =
  | "empty-url"
  | "invalid-url"
  | "unsupported-protocol"
  | "embedded-credentials"
  | "unsafe-network"
  | "dns-resolution-failed";

export class UrlPolicyError extends Error {
  public readonly code: UrlPolicyErrorCode;

  public constructor(code: UrlPolicyErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "UrlPolicyError";
    this.code = code;
  }
}

export function normalizeTargetUrl(input: string): string {
  const value = input.trim();

  if (value.length === 0) {
    throw new UrlPolicyError("empty-url", "Target URL is required");
  }

  const parsedUrl = parseTargetUrl(value);
  return canonicalizeHttpUrl(parsedUrl);
}

export function normalizeDiscoveredUrl(input: string, baseUrl: string | URL): string {
  const value = input.trim();

  if (value.length === 0) {
    throw new UrlPolicyError("empty-url", "Discovered URL is empty");
  }

  try {
    return canonicalizeHttpUrl(new URL(value, baseUrl));
  } catch (error: unknown) {
    if (error instanceof UrlPolicyError) {
      throw error;
    }

    throw new UrlPolicyError("invalid-url", `Invalid discovered URL: ${value}`, {
      cause: error,
    });
  }
}

export function deduplicateUrls(inputs: Iterable<string>, baseUrl?: string | URL): string[] {
  const canonicalUrls = new Set<string>();

  for (const input of inputs) {
    const normalizedUrl =
      baseUrl === undefined ? normalizeTargetUrl(input) : normalizeDiscoveredUrl(input, baseUrl);
    canonicalUrls.add(normalizedUrl);
  }

  return [...canonicalUrls];
}

function parseTargetUrl(value: string): URL {
  const candidate = hasExplicitOrKnownScheme(value) ? value : `https://${value}`;

  try {
    return new URL(candidate);
  } catch (error: unknown) {
    throw new UrlPolicyError("invalid-url", `Invalid target URL: ${value}`, { cause: error });
  }
}

function hasExplicitOrKnownScheme(value: string): boolean {
  const lowerValue = value.toLowerCase();
  return (
    value.includes("://") ||
    lowerValue.startsWith("data:") ||
    lowerValue.startsWith("file:") ||
    lowerValue.startsWith("javascript:") ||
    lowerValue.startsWith("mailto:") ||
    lowerValue.startsWith("tel:")
  );
}

function canonicalizeHttpUrl(url: URL): string {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UrlPolicyError("unsupported-protocol", `Unsupported URL protocol: ${url.protocol}`);
  }

  if (url.username.length > 0 || url.password.length > 0) {
    throw new UrlPolicyError("embedded-credentials", "URLs must not contain credentials");
  }

  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  url.searchParams.sort();

  if (url.pathname !== "/") {
    url.pathname = url.pathname.replace(/\/+$/u, "") || "/";
  }

  return url.href;
}
