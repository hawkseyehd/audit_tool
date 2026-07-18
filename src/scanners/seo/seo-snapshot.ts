import { load, type CheerioAPI } from "cheerio";

import { createCrawlScope, evaluateCrawlCandidate } from "../../url/crawl-scope.js";
import { seoPageSnapshotSchema } from "./schemas.js";
import type { SeoPageSnapshot, SeoSnapshotInput } from "./types.js";

const MAX_HEADINGS = 200;
const MAX_INTERNAL_LINKS = 1_000;
const MAX_SAMPLE_SELECTORS = 10;

export function extractSeoPageSnapshot(input: SeoSnapshotInput): SeoPageSnapshot {
  const document = load(input.html);
  const scope = createCrawlScope(input.targetUrl, input.allowedDomains);
  const title = cleanText(document("title").first().text(), 500);
  const metaDescription = findMetaContent(document, "description");
  const robotsDirectives = collectRobotsDirectives(document);
  const canonical = extractCanonical(document, input.page.url);
  const headings = document("h1, h2, h3, h4, h5, h6")
    .slice(0, MAX_HEADINGS)
    .toArray()
    .map((element) => ({
      level: Number(element.tagName.slice(1)),
      text: cleanText(document(element).text(), 500),
    }));
  const imageFacts = extractImageFacts(document);
  const linkFacts = extractLinkFacts(document, input.page.url, scope);
  const structuredDataFacts = extractStructuredDataFacts(document);

  return seoPageSnapshotSchema.parse({
    url: input.page.url,
    pageType: input.page.pageType,
    ...(title.length === 0 ? {} : { title }),
    ...(metaDescription === undefined ? {} : { metaDescription }),
    ...canonical,
    robotsDirectives,
    headings,
    ...imageFacts,
    ...linkFacts,
    ...structuredDataFacts,
  });
}

function findMetaContent(document: CheerioAPI, name: string): string | undefined {
  let content: string | undefined;
  document("meta[name]").each((_index, element) => {
    if (document(element).attr("name")?.trim().toLowerCase() !== name || content !== undefined) {
      return;
    }
    const value = cleanText(document(element).attr("content") ?? "", 1_000);
    if (value.length > 0) {
      content = value;
    }
  });
  return content;
}

function collectRobotsDirectives(document: CheerioAPI): string[] {
  const directives = new Set<string>();
  document("meta[name]").each((_index, element) => {
    const name = document(element).attr("name")?.trim().toLowerCase();
    if (name !== "robots" && name !== "googlebot") {
      return;
    }
    const content = document(element).attr("content") ?? "";
    for (const directive of content.toLowerCase().split(/[\s,]+/u)) {
      if (directive.length > 0 && directives.size < 30) {
        directives.add(directive.slice(0, 100));
      }
    }
  });
  return [...directives];
}

function extractCanonical(
  document: CheerioAPI,
  pageUrl: string,
): {
  readonly canonicalUrl?: string;
  readonly hasCanonical: boolean;
  readonly hasInvalidCanonical: boolean;
} {
  let rawCanonical: string | undefined;
  document("link[rel][href]").each((_index, element) => {
    const rel = document(element).attr("rel")?.toLowerCase().split(/\s+/u) ?? [];
    if (rawCanonical === undefined && rel.includes("canonical")) {
      rawCanonical = document(element).attr("href")?.trim();
    }
  });

  if (rawCanonical === undefined || rawCanonical.length === 0) {
    return { hasCanonical: false, hasInvalidCanonical: false };
  }

  try {
    const canonicalUrl = new URL(rawCanonical, pageUrl);
    if (canonicalUrl.protocol !== "http:" && canonicalUrl.protocol !== "https:") {
      return { hasCanonical: true, hasInvalidCanonical: true };
    }
    canonicalUrl.hash = "";
    return {
      canonicalUrl: canonicalUrl.toString(),
      hasCanonical: true,
      hasInvalidCanonical: false,
    };
  } catch {
    return { hasCanonical: true, hasInvalidCanonical: true };
  }
}

function extractImageFacts(document: CheerioAPI): {
  readonly imageCount: number;
  readonly missingAltCount: number;
  readonly missingAltSelectors: readonly string[];
} {
  let missingAltCount = 0;
  const missingAltSelectors: string[] = [];
  const images = document("img");
  images.each((_index, element) => {
    if (document(element).attr("alt") !== undefined) {
      return;
    }
    missingAltCount += 1;
    if (missingAltSelectors.length === 0) {
      missingAltSelectors.push("img:not([alt])");
    }
  });
  return { imageCount: images.length, missingAltCount, missingAltSelectors };
}

function extractLinkFacts(
  document: CheerioAPI,
  pageUrl: string,
  scope: ReturnType<typeof createCrawlScope>,
): {
  readonly internalLinks: readonly string[];
  readonly uncrawlableLinkCount: number;
  readonly uncrawlableLinkSelectors: readonly string[];
} {
  const internalLinks = new Set<string>();
  const uncrawlableLinkSelectors = new Set<string>();
  let uncrawlableLinkCount = 0;

  document("a[href], area[href]").each((_index, element) => {
    const href = document(element).attr("href")?.trim() ?? "";
    if (href.length === 0 || href === "#" || href.toLowerCase().startsWith("javascript:")) {
      uncrawlableLinkCount += 1;
      if (uncrawlableLinkSelectors.size < MAX_SAMPLE_SELECTORS) {
        uncrawlableLinkSelectors.add(
          href.length === 0
            ? 'a[href=""]'
            : href === "#"
              ? 'a[href="#"]'
              : 'a[href^="javascript:"]',
        );
      }
      return;
    }

    const decision = evaluateCrawlCandidate(href, pageUrl, scope);
    if (decision.accepted && internalLinks.size < MAX_INTERNAL_LINKS) {
      internalLinks.add(decision.url);
    }
  });

  return {
    internalLinks: [...internalLinks],
    uncrawlableLinkCount,
    uncrawlableLinkSelectors: [...uncrawlableLinkSelectors],
  };
}

function extractStructuredDataFacts(document: CheerioAPI): {
  readonly invalidStructuredDataCount: number;
  readonly structuredDataCount: number;
} {
  let invalidStructuredDataCount = 0;
  const scripts = document("script[type]").filter((_index, element) =>
    (document(element).attr("type") ?? "").toLowerCase().includes("ld+json"),
  );
  scripts.each((_index, element) => {
    try {
      JSON.parse(document(element).text());
    } catch {
      invalidStructuredDataCount += 1;
    }
  });
  return { invalidStructuredDataCount, structuredDataCount: scripts.length };
}

function cleanText(value: string, maxLength: number): string {
  return value.replace(/\s+/gu, " ").trim().slice(0, maxLength);
}
