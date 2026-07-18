import { load } from "cheerio";
import { securityPageSnapshotSchema } from "./schemas.js";
import type { SecurityPageSnapshot, SecuritySnapshotInput } from "./types.js";

export function extractSecurityPageSnapshot(input: SecuritySnapshotInput): SecurityPageSnapshot {
  const document = load(input.html);
  const finalUrl = input.finalUrl ?? input.url;
  const isHttps = new URL(finalUrl).protocol === "https:";
  const headers = Object.fromEntries(
    Object.entries(input.headers)
      .filter((entry): entry is [string, string] => entry[1] !== undefined)
      .map(([name, value]) => [name.toLowerCase(), value.slice(0, 5_000)]),
  );
  const mixedContentSelectors = new Set<string>();
  let mixedContentCount = 0;
  if (isHttps)
    document("[src], [href]").each((_index, element) => {
      const source = document(element).attr("src") ?? document(element).attr("href") ?? "";
      if (source.trim().toLowerCase().startsWith("http://")) {
        mixedContentCount += 1;
        if (mixedContentSelectors.size < 10)
          mixedContentSelectors.add(
            `${element.tagName.toLowerCase()}[${document(element).attr("src") === undefined ? "href" : "src"}^="http://"]`,
          );
      }
    });
  const bodyText = document("body").text().toLowerCase().replace(/\s+/gu, " ").slice(0, 20_000);
  return securityPageSnapshotSchema.parse({
    url: input.url,
    finalUrl,
    ...(input.statusCode === undefined ? {} : { statusCode: input.statusCode }),
    isHttps,
    ...(input.httpRedirectsToHttps === undefined
      ? {}
      : { httpRedirectsToHttps: input.httpRedirectsToHttps }),
    headers,
    cookies: (input.setCookieHeaders ?? []).slice(0, 100).map(parseCookieFact),
    mixedContentCount,
    mixedContentSelectors: [...mixedContentSelectors],
    hasPrivacyPolicyLink: document("a[href*='privacy']").length > 0,
    hasCookieConsentSignal:
      /\b(?:cookie settings|cookie preferences|accept cookies|reject cookies|manage consent)\b/u.test(
        bodyText,
      ) ||
      document(
        "[class*='cookie'][class*='consent'], [id*='cookie'][id*='consent'], [class*='cookie-banner']",
      ).length > 0,
  });
}

function parseCookieFact(header: string): {
  name: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite?: "strict" | "lax" | "none";
} {
  const parts = header.split(";").map((part) => part.trim());
  const name = (parts[0]?.split("=", 1)[0] ?? "unnamed").slice(0, 200);
  const attributes = parts.slice(1).map((part) => part.toLowerCase());
  const sameSitePart = attributes.find((part) => part.startsWith("samesite="));
  const value = sameSitePart?.slice("samesite=".length);
  const sameSite = value === "strict" || value === "lax" || value === "none" ? value : undefined;
  return {
    name: name.length > 0 ? name : "unnamed",
    secure: attributes.includes("secure"),
    httpOnly: attributes.includes("httponly"),
    ...(sameSite === undefined ? {} : { sameSite }),
  };
}
