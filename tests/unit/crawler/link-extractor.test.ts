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

  it("extracts bounded classification signals without retaining entered field values", () => {
    const html = `
      <html>
        <body>
          <h1>Secure checkout</h1>
          <form action="/orders/payment">
            <input name="card_number" autocomplete="cc-number" value="4111111111111111">
            <input type="date" name="delivery_date">
            <button aria-label="Complete checkout">Pay now</button>
          </form>
        </body>
      </html>
    `;
    const scope = createCrawlScope("https://example.com");

    const result = extractPageLinks(html, "https://example.com/order", scope);

    expect(result.classificationSignals).toMatchObject({
      autocompleteValues: ["cc-number"],
      formActions: ["/orders/payment"],
      formCount: 1,
      headings: ["Secure checkout"],
      inputNames: ["card_number", "delivery_date"],
      inputTypes: ["date"],
      interactiveLabels: ["Pay now", "Complete checkout"],
    });
    expect(JSON.stringify(result.classificationSignals)).not.toContain("4111111111111111");
  });

  it("bounds repeated DOM signals", () => {
    const headings = Array.from(
      { length: 60 },
      (_, index) => `<h2>Heading ${String(index)}</h2>`,
    ).join("");
    const controls = Array.from(
      { length: 300 },
      (_, index) => `<input name="field_${String(index)}">`,
    ).join("");
    const scope = createCrawlScope("https://example.com");

    const result = extractPageLinks(
      `<html><body>${headings}<form>${controls}</form></body></html>`,
      "https://example.com/apply",
      scope,
    );

    expect(result.classificationSignals.headings).toHaveLength(50);
    expect(result.classificationSignals.inputNames).toHaveLength(250);
  });
});
