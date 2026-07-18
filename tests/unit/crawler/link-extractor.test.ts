import { describe, expect, it } from "vitest";

import { createCrawlScope, extractPageLinks } from "../../../src/index.js";

describe("extractPageLinks", () => {
  it("extracts a clean title, canonical links, and rejection counts", () => {
    const html = `
      <html>
        <head><title>  Example   Company  </title></head>
        <body>
          <a href="/contact/">Contact</a>
          <a href="/contact#form">Contact duplicate</a>
          <a href="/brochure.pdf">Brochure</a>
          <a href="mailto:hello@example.com">Email</a>
          <a href="https://external.example/">External</a>
        </body>
      </html>
    `;
    const scope = createCrawlScope("https://example.com");

    const result = extractPageLinks(html, "https://example.com/", scope);

    expect(result.title).toBe("Example Company");
    expect(result.links).toEqual(["https://example.com/contact"]);
    expect(result.rejectionCounts).toMatchObject({
      download: 1,
      "external-domain": 1,
      "unsupported-scheme": 1,
    });
  });
});
