import { describe, expect, it } from "vitest";

import {
  auditFindingSchema,
  createSeoScanner,
  extractSeoPageSnapshot,
  scanSeo,
  type SeoScanInput,
  type SeoPageSnapshot,
  type SeoSiteResources,
} from "../../../../src/index.js";

const context = { detectedAt: "2026-07-18T13:00:00.000Z" };

describe("SEO scanner", () => {
  it("emits validated findings for metadata and document-structure failures", () => {
    const page = extractSeoPageSnapshot({
      html: `
        <meta name="robots" content="noindex">
        <link rel="canonical" href="https://other.example/pricing">
        <h2>Pricing</h2><h4>Enterprise</h4>
        <img src="price.png">
        <a href="#">Choose a plan</a>
        <script type="application/ld+json">{broken}</script>
      `,
      page: { pageType: "pricing", url: "https://example.com/pricing" },
      targetUrl: "https://example.com/",
    });

    const findings = scanSeo(
      {
        crawlPages: [{ url: page.url, pageType: page.pageType, statusCode: 200 }],
        pages: [page],
        siteResources: successfulResources(),
      },
      context,
    );
    const ruleIds = findings.map((finding) => finding.ruleId);

    expect(ruleIds).toEqual(
      expect.arrayContaining([
        "title-missing",
        "meta-description-missing",
        "canonical-origin-mismatch",
        "important-page-noindex",
        "h1-missing",
        "heading-level-skips",
        "image-alt-missing",
        "uncrawlable-internal-links",
        "structured-data-invalid",
      ]),
    );
    expect(findings.find((finding) => finding.ruleId === "important-page-noindex")?.severity).toBe(
      "high",
    );
    for (const finding of findings) {
      expect(() => auditFindingSchema.parse(finding)).not.toThrow();
      expect(finding.category).toBe("seo");
      expect(finding.scanner).toBe("seo");
    }
  });

  it("returns no findings for a complete, well-structured page and healthy resources", () => {
    const page = extractSeoPageSnapshot({
      html: `
        <title>Professional Website Audit Services</title>
        <meta name="description" content="Get a detailed website audit with clear priorities that improve search visibility, accessibility, trust, and conversion performance.">
        <link rel="canonical" href="https://example.com/services/audit">
        <h1>Professional website audits</h1><h2>What the audit covers</h2>
        <img src="report.png" alt="Example website audit report">
        <a href="/contact">Contact us</a>
        <script type="application/ld+json">{"@context":"https://schema.org","@type":"Service"}</script>
      `,
      page: { pageType: "service", url: "https://example.com/services/audit" },
      targetUrl: "https://example.com/",
    });

    expect(
      scanSeo(
        {
          crawlPages: [
            { url: page.url, pageType: page.pageType, statusCode: 200 },
            { url: "https://example.com/contact", pageType: "contact", statusCode: 200 },
          ],
          pages: [page],
          siteResources: successfulResources(),
        },
        context,
      ),
    ).toEqual([]);
  });

  it("reports only internal links with known failed crawl outcomes", () => {
    const input: SeoScanInput = {
      crawlPages: [
        { url: "https://example.com/", pageType: "home", statusCode: 200 },
        { url: "https://example.com/missing", pageType: "unknown", statusCode: 404 },
      ],
      pages: [
        {
          ...emptySnapshot("https://example.com/", "home"),
          internalLinks: ["https://example.com/missing", "https://example.com/not-crawled"],
        },
      ],
      siteResources: successfulResources(),
    };

    const first = scanSeo(input, context).filter(
      (finding) => finding.ruleId === "broken-internal-link",
    );
    const second = scanSeo(input, context).filter(
      (finding) => finding.ruleId === "broken-internal-link",
    );

    expect(first).toHaveLength(1);
    expect(first[0]?.evidence?.value).toBe("https://example.com/missing");
    expect(second[0]?.id).toBe(first[0]?.id);
  });

  it("implements the shared scanner contract", async () => {
    const scanner = createSeoScanner();
    const input: SeoScanInput = {
      crawlPages: [],
      pages: [],
      siteResources: successfulResources(),
    };

    expect(scanner.name).toBe("seo");
    await expect(scanner.scan(input, context)).resolves.toEqual([]);
  });

  it("reports unavailable robots and sitemap resources independently", () => {
    const findings = scanSeo(
      {
        crawlPages: [],
        pages: [],
        siteResources: {
          robotsTxt: {
            requestedUrl: "https://example.com/robots.txt",
            statusCode: 404,
          },
          sitemap: {
            requestedUrl: "https://example.com/sitemap.xml",
            error: { code: "network", message: "Connection failed" },
          },
        },
      },
      context,
    );

    expect(findings.map((finding) => finding.ruleId)).toEqual([
      "robots-txt-missing",
      "sitemap-missing",
    ]);
  });
});

function successfulResources(): SeoSiteResources {
  return {
    robotsTxt: {
      requestedUrl: "https://example.com/robots.txt",
      finalUrl: "https://example.com/robots.txt",
      statusCode: 200,
      body: "User-agent: *",
    },
    sitemap: {
      requestedUrl: "https://example.com/sitemap.xml",
      finalUrl: "https://example.com/sitemap.xml",
      statusCode: 200,
      body: "<urlset></urlset>",
    },
  };
}

function emptySnapshot(url: string, pageType: "home"): SeoPageSnapshot {
  return {
    url,
    pageType,
    title: "Professional Website Audit Services",
    metaDescription:
      "Get a detailed website audit with clear priorities that improve visibility and conversion performance for your business.",
    canonicalUrl: url,
    hasCanonical: true,
    hasInvalidCanonical: false,
    robotsDirectives: [],
    headings: [{ level: 1, text: "Professional website audits" }],
    imageCount: 0,
    missingAltCount: 0,
    missingAltSelectors: [],
    internalLinks: [],
    uncrawlableLinkCount: 0,
    uncrawlableLinkSelectors: [],
    structuredDataCount: 1,
    invalidStructuredDataCount: 0,
  };
}
