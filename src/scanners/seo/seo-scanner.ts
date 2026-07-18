import { createHash } from "node:crypto";

import { auditFindingSchema } from "../../core/schemas.js";
import type { AuditEvidence, AuditFinding, FindingSeverity, PageType } from "../../core/types.js";
import type { AuditScanner, ScannerContext } from "../types.js";
import type { SeoPageSnapshot, SeoScanInput } from "./types.js";

const IMPORTANT_PAGE_TYPES = new Set<PageType>([
  "home",
  "contact",
  "service",
  "product",
  "pricing",
  "checkout",
  "booking",
]);
const STRUCTURED_DATA_PAGE_TYPES = new Set<PageType>([
  "home",
  "service",
  "product",
  "pricing",
  "blog",
]);

interface FindingDetails {
  readonly description: string;
  readonly evidence?: AuditEvidence;
  readonly identity?: string;
  readonly impact: string;
  readonly recommendation: string;
  readonly ruleId: string;
  readonly severity: FindingSeverity;
  readonly title: string;
  readonly url: string;
}

export function createSeoScanner(): AuditScanner<SeoScanInput> {
  return {
    name: "seo",
    scan: (input, context) => Promise.resolve(scanSeo(input, context)),
  };
}

export function scanSeo(input: SeoScanInput, context: ScannerContext): AuditFinding[] {
  const findings: AuditFinding[] = [];

  for (const page of [...input.pages].sort((left, right) => left.url.localeCompare(right.url))) {
    findings.push(...scanSeoPage(page, context));
  }

  findings.push(...scanBrokenInternalLinks(input, context));
  findings.push(...scanSiteResources(input, context));
  return findings;
}

function scanSeoPage(page: SeoPageSnapshot, context: ScannerContext): AuditFinding[] {
  const findings: AuditFinding[] = [];

  if (page.title === undefined) {
    findings.push(
      finding(context, {
        ruleId: "title-missing",
        url: page.url,
        severity: "high",
        title: "Page title is missing",
        description: "The page does not provide a non-empty HTML title.",
        impact:
          "Search results and browser tabs may not clearly explain the page, reducing discoverability and click confidence.",
        recommendation:
          "Add a unique, descriptive title that reflects the page purpose and primary topic.",
        evidence: {
          selector: "head > title",
          expected: "A unique non-empty title",
          source: "crawler",
        },
      }),
    );
  } else if (page.title.length < 30 || page.title.length > 60) {
    findings.push(
      finding(context, {
        ruleId: "title-length",
        url: page.url,
        severity: "medium",
        title: "Page title length may reduce search clarity",
        description: `The title contains ${String(page.title.length)} characters; a concise descriptive range is usually easier to present in search results.`,
        impact:
          "Very short titles provide little context, while long titles are more likely to be truncated or diluted.",
        recommendation:
          "Refine the title toward roughly 30-60 characters while keeping it accurate and unique.",
        evidence: {
          metric: "title characters",
          value: page.title.length,
          expected: "30-60",
          source: "crawler",
        },
      }),
    );
  }

  if (page.metaDescription === undefined) {
    findings.push(
      finding(context, {
        ruleId: "meta-description-missing",
        url: page.url,
        severity: "medium",
        title: "Meta description is missing",
        description: "The page does not provide a non-empty meta description.",
        impact:
          "Search engines may choose less persuasive page text for the result snippet, reducing message control and click-through potential.",
        recommendation:
          "Add a specific summary of the page value and intent for prospective visitors.",
        evidence: {
          selector: 'meta[name="description"]',
          expected: "A non-empty description",
          source: "crawler",
        },
      }),
    );
  } else if (page.metaDescription.length < 70 || page.metaDescription.length > 160) {
    findings.push(
      finding(context, {
        ruleId: "meta-description-length",
        url: page.url,
        severity: "low",
        title: "Meta description length may be ineffective",
        description: `The meta description contains ${String(page.metaDescription.length)} characters.`,
        impact:
          "A very short description may undersell the page, while a long description may be truncated in search results.",
        recommendation: "Use a clear, page-specific description of roughly 70-160 characters.",
        evidence: {
          metric: "description characters",
          value: page.metaDescription.length,
          expected: "70-160",
          source: "crawler",
        },
      }),
    );
  }

  findings.push(...scanCanonical(page, context));
  findings.push(...scanRobotsDirectives(page, context));
  findings.push(...scanHeadings(page, context));

  if (page.missingAltCount > 0) {
    findings.push(
      finding(context, {
        ruleId: "image-alt-missing",
        url: page.url,
        severity: "medium",
        title: "Images are missing alternative text attributes",
        description: `${String(page.missingAltCount)} of ${String(page.imageCount)} images do not include an alt attribute.`,
        impact:
          "Search engines and assistive technologies receive less context about meaningful images.",
        recommendation:
          "Add accurate alt text to informative images and an empty alt attribute to intentionally decorative images.",
        evidence: {
          selector: page.missingAltSelectors[0] ?? "img:not([alt])",
          metric: "images missing alt",
          value: page.missingAltCount,
          expected: 0,
          source: "crawler",
        },
      }),
    );
  }

  if (page.uncrawlableLinkCount > 0) {
    findings.push(
      finding(context, {
        ruleId: "uncrawlable-internal-links",
        url: page.url,
        severity: "low",
        title: "Placeholder links may not be crawlable",
        description: `${String(page.uncrawlableLinkCount)} links use an empty, hash-only, or JavaScript href.`,
        impact: "Visitors and crawlers may be unable to reach intended destinations consistently.",
        recommendation:
          "Replace placeholder href values with valid destinations or use buttons for non-navigation actions.",
        evidence: {
          selector: page.uncrawlableLinkSelectors[0] ?? "a[href]",
          metric: "uncrawlable links",
          value: page.uncrawlableLinkCount,
          expected: 0,
          source: "crawler",
        },
      }),
    );
  }

  if (page.invalidStructuredDataCount > 0) {
    findings.push(
      finding(context, {
        ruleId: "structured-data-invalid",
        url: page.url,
        severity: "medium",
        title: "Structured data contains invalid JSON",
        description: `${String(page.invalidStructuredDataCount)} JSON-LD blocks could not be parsed as JSON.`,
        impact:
          "Search engines may ignore invalid structured data and withhold eligible enhanced result features.",
        recommendation:
          "Correct the JSON syntax and validate the final JSON-LD against the applicable schema.org type.",
        evidence: {
          selector: 'script[type*="ld+json"]',
          metric: "invalid JSON-LD blocks",
          value: page.invalidStructuredDataCount,
          expected: 0,
          source: "crawler",
        },
      }),
    );
  } else if (page.structuredDataCount === 0 && STRUCTURED_DATA_PAGE_TYPES.has(page.pageType)) {
    findings.push(
      finding(context, {
        ruleId: "structured-data-not-detected",
        url: page.url,
        severity: "info",
        title: "No JSON-LD structured data was detected",
        description:
          "The static HTML did not contain a JSON-LD block. Structured data is optional and suitability depends on the page content.",
        impact:
          "The page may be missing an opportunity to communicate eligible business, product, service, or article details to search engines.",
        recommendation:
          "Review whether a relevant schema.org type applies, and add validated JSON-LD only when the visible page content supports it.",
        evidence: {
          metric: "JSON-LD blocks",
          value: 0,
          expected: "Review applicability",
          source: "crawler",
        },
      }),
    );
  }

  return findings;
}

function scanCanonical(page: SeoPageSnapshot, context: ScannerContext): AuditFinding[] {
  if (!page.hasCanonical) {
    return [
      finding(context, {
        ruleId: "canonical-missing",
        url: page.url,
        severity: "low",
        title: "Canonical URL is missing",
        description: "The page does not declare a canonical link.",
        impact:
          "Duplicate or parameterized variants may make preferred URL signals less explicit to search engines.",
        recommendation:
          "Add a valid canonical link that identifies the preferred public URL for this page.",
        evidence: { selector: 'link[rel="canonical"]', expected: page.url, source: "crawler" },
      }),
    ];
  }
  if (page.hasInvalidCanonical || page.canonicalUrl === undefined) {
    return [
      finding(context, {
        ruleId: "canonical-invalid",
        url: page.url,
        severity: "medium",
        title: "Canonical URL is invalid",
        description: "The canonical link cannot be resolved to a valid HTTP or HTTPS URL.",
        impact:
          "Search engines may ignore the canonical signal or consolidate the page incorrectly.",
        recommendation: "Use one absolute or correctly resolvable HTTP(S) canonical URL.",
        evidence: {
          selector: 'link[rel="canonical"]',
          expected: "A valid HTTP(S) URL",
          source: "crawler",
        },
      }),
    ];
  }
  if (new URL(page.canonicalUrl).origin !== new URL(page.url).origin) {
    return [
      finding(context, {
        ruleId: "canonical-origin-mismatch",
        url: page.url,
        severity: "medium",
        title: "Canonical URL points to another origin",
        description: "The declared canonical URL uses a different origin from the scanned page.",
        impact:
          "An unintended cross-origin canonical can transfer indexing signals away from this website.",
        recommendation:
          "Confirm the cross-origin canonical is intentional; otherwise point it to the preferred same-origin page.",
        evidence: {
          metric: "canonical URL",
          value: page.canonicalUrl,
          expected: new URL(page.url).origin,
          source: "crawler",
        },
      }),
    ];
  }
  return [];
}

function scanRobotsDirectives(page: SeoPageSnapshot, context: ScannerContext): AuditFinding[] {
  if (!page.robotsDirectives.includes("noindex")) {
    return [];
  }
  const isImportant = IMPORTANT_PAGE_TYPES.has(page.pageType);
  return [
    finding(context, {
      ruleId: "important-page-noindex",
      url: page.url,
      severity: isImportant ? "high" : "medium",
      title: isImportant ? "Important page is marked noindex" : "Page is marked noindex",
      description: "A robots meta directive asks compliant search engines not to index this page.",
      impact: isImportant
        ? "A key conversion or business page may be excluded from search results."
        : "The page may be excluded from search results even if it is linked internally.",
      recommendation:
        "Confirm the exclusion is intentional; remove the noindex directive when the page should appear in search.",
      evidence: {
        selector: 'meta[name="robots"]',
        metric: "robots directive",
        value: "noindex",
        expected: "index",
        source: "crawler",
      },
    }),
  ];
}

function scanHeadings(page: SeoPageSnapshot, context: ScannerContext): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const h1Count = page.headings.filter((heading) => heading.level === 1).length;
  if (h1Count !== 1) {
    findings.push(
      finding(context, {
        ruleId: h1Count === 0 ? "h1-missing" : "h1-multiple",
        url: page.url,
        severity: "medium",
        title: h1Count === 0 ? "Page has no H1 heading" : "Page has multiple H1 headings",
        description:
          h1Count === 0 ? "No H1 heading was found." : `${String(h1Count)} H1 headings were found.`,
        impact:
          "The main topic and document hierarchy may be less clear to search engines and assistive technologies.",
        recommendation:
          "Use one clear H1 for the primary page topic, then organize subsections with lower heading levels.",
        evidence: {
          selector: "h1",
          metric: "H1 count",
          value: h1Count,
          expected: 1,
          source: "crawler",
        },
      }),
    );
  }

  let skippedLevels = 0;
  for (let index = 1; index < page.headings.length; index += 1) {
    const previous = page.headings[index - 1];
    const current = page.headings[index];
    if (previous !== undefined && current !== undefined && current.level > previous.level + 1) {
      skippedLevels += 1;
    }
  }
  if (skippedLevels > 0) {
    findings.push(
      finding(context, {
        ruleId: "heading-level-skips",
        url: page.url,
        severity: "low",
        title: "Heading hierarchy skips levels",
        description: `${String(skippedLevels)} heading transitions skip one or more levels.`,
        impact:
          "An inconsistent hierarchy can make page structure harder to interpret and navigate.",
        recommendation:
          "Use heading levels in a logical nested order without choosing levels only for visual size.",
        evidence: {
          selector: "h1, h2, h3, h4, h5, h6",
          metric: "skipped heading transitions",
          value: skippedLevels,
          expected: 0,
          source: "crawler",
        },
      }),
    );
  }
  return findings;
}

function scanBrokenInternalLinks(input: SeoScanInput, context: ScannerContext): AuditFinding[] {
  const crawlPages = new Map(input.crawlPages.map((page) => [page.url, page]));
  const findings: AuditFinding[] = [];
  for (const source of [...input.pages].sort((left, right) => left.url.localeCompare(right.url))) {
    for (const targetUrl of [...new Set(source.internalLinks)].sort()) {
      const target = crawlPages.get(targetUrl);
      if (
        target === undefined ||
        (target.error === undefined && (target.statusCode ?? 200) < 400)
      ) {
        continue;
      }
      const status = target.error === undefined ? target.statusCode : "crawl failure";
      findings.push(
        finding(context, {
          ruleId: "broken-internal-link",
          identity: targetUrl,
          url: source.url,
          severity: target.statusCode !== undefined && target.statusCode < 500 ? "medium" : "high",
          title: "Internal link points to a failed page",
          description: `An internal link targets ${targetUrl}, which returned ${String(status)}.`,
          impact:
            "Broken internal navigation interrupts visitors, wastes crawl effort, and weakens confidence in the site.",
          recommendation:
            "Restore the destination, update the link to a working page, or remove the link when no replacement exists.",
          evidence: {
            metric: "internal link target",
            value: targetUrl,
            expected: "HTTP status below 400",
            source: "crawler",
          },
        }),
      );
    }
  }
  return findings;
}

function scanSiteResources(input: SeoScanInput, context: ScannerContext): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const { robotsTxt, sitemap } = input.siteResources;
  if (robotsTxt.error !== undefined || robotsTxt.statusCode !== 200) {
    findings.push(
      finding(context, {
        ruleId: "robots-txt-missing",
        url: robotsTxt.requestedUrl,
        severity: "low",
        title: "robots.txt was not available",
        description: "The standard robots.txt location did not return a successful response.",
        impact:
          "Crawler guidance and sitemap discovery are less explicit, although pages may still be indexed.",
        recommendation:
          "Publish a valid robots.txt file at the site root and reference the preferred sitemap.",
        evidence: {
          metric: "robots.txt status",
          value: robotsTxt.statusCode ?? robotsTxt.error?.code ?? "failed",
          expected: 200,
          source: "crawler",
        },
      }),
    );
  }
  if (sitemap.error !== undefined || sitemap.statusCode !== 200) {
    findings.push(
      finding(context, {
        ruleId: "sitemap-missing",
        url: sitemap.requestedUrl,
        severity: "low",
        title: "XML sitemap was not available",
        description: "No in-scope sitemap candidate returned a successful response.",
        impact: "Search engines may discover updated or deeply nested pages less efficiently.",
        recommendation: "Publish a current XML sitemap and reference it from robots.txt.",
        evidence: {
          metric: "sitemap status",
          value: sitemap.statusCode ?? sitemap.error?.code ?? "failed",
          expected: 200,
          source: "crawler",
        },
      }),
    );
  }
  return findings;
}

function finding(context: ScannerContext, details: FindingDetails): AuditFinding {
  const identity = `${details.ruleId}|${details.url}|${details.identity ?? ""}`;
  const digest = createHash("sha256").update(identity).digest("hex").slice(0, 12);
  return auditFindingSchema.parse({
    id: `seo-${details.ruleId}-${digest}`,
    ruleId: details.ruleId,
    url: details.url,
    category: "seo",
    severity: details.severity,
    title: details.title,
    description: details.description,
    impact: details.impact,
    recommendation: details.recommendation,
    scanner: "seo",
    detectedAt: context.detectedAt,
    ...(details.evidence === undefined ? {} : { evidence: details.evidence }),
  });
}
