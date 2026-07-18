import { describe, expect, it } from "vitest";

import { extractSeoPageSnapshot } from "../../../../src/index.js";

describe("extractSeoPageSnapshot", () => {
  it("extracts bounded metadata, structure, links, images, and JSON-LD facts", () => {
    const html = `
      <html>
        <head>
          <title>  Professional   Audit Services  </title>
          <meta name="description" content="A clear description for this service page.">
          <meta name="robots" content="index, follow">
          <link rel="alternate canonical" href="/services/audit#details">
          <script type="application/ld+json">{"@type":"Service"}</script>
          <script type="application/ld+json">{invalid}</script>
        </head>
        <body>
          <h1>Audit services</h1><h3>What is included</h3>
          <img src="hero.jpg"><img src="decorative.svg" alt="">
          <a href="/contact#form">Contact</a>
          <a href="#">Placeholder</a>
          <a href="javascript:void(0)">Action</a>
          <a href="mailto:hello@example.com">Email</a>
        </body>
      </html>
    `;

    const snapshot = extractSeoPageSnapshot({
      html,
      page: { pageType: "service", url: "https://example.com/services/audit" },
      targetUrl: "https://example.com/",
    });

    expect(snapshot).toMatchObject({
      title: "Professional Audit Services",
      metaDescription: "A clear description for this service page.",
      canonicalUrl: "https://example.com/services/audit",
      hasCanonical: true,
      hasInvalidCanonical: false,
      robotsDirectives: ["index", "follow"],
      imageCount: 2,
      missingAltCount: 1,
      missingAltSelectors: ["img:not([alt])"],
      internalLinks: ["https://example.com/contact"],
      uncrawlableLinkCount: 2,
      structuredDataCount: 2,
      invalidStructuredDataCount: 1,
    });
    expect(snapshot.headings).toEqual([
      { level: 1, text: "Audit services" },
      { level: 3, text: "What is included" },
    ]);
  });

  it("records invalid canonical URLs without retaining their raw value", () => {
    const snapshot = extractSeoPageSnapshot({
      html: '<link rel="canonical" href="mailto:private@example.com">',
      page: { pageType: "unknown", url: "https://example.com/legal" },
      targetUrl: "https://example.com/",
    });

    expect(snapshot).toMatchObject({ hasCanonical: true, hasInvalidCanonical: true });
    expect(snapshot.canonicalUrl).toBeUndefined();
    expect(JSON.stringify(snapshot)).not.toContain("private@example.com");
  });
});
