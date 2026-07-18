import { describe, expect, it } from "vitest";

import { classifyPage, type PageType } from "../../../src/index.js";

describe("classifyPage", () => {
  it.each<[PageType, string]>([
    ["home", "https://example.com/"],
    ["contact", "https://example.com/contact-us"],
    ["service", "https://example.com/services/design"],
    ["product", "https://example.com/products/widget"],
    ["pricing", "https://example.com/pricing"],
    ["about", "https://example.com/about-us"],
    ["blog", "https://example.com/blog/article"],
    ["checkout", "https://example.com/checkout"],
    ["booking", "https://example.com/book-an-appointment"],
    ["auth", "https://example.com/sign-in"],
  ])("classifies %s pages from their URL path", (pageType, url) => {
    expect(classifyPage({ url }).pageType).toBe(pageType);
  });

  it("combines title and heading evidence and reports non-sensitive reasons", () => {
    const result = classifyPage({
      url: "https://example.com/connect",
      title: "Contact our specialists",
      headings: ["Get in touch"],
    });

    expect(result).toMatchObject({
      confidence: "medium",
      matchedSignals: ["title", "heading"],
      pageType: "contact",
      score: 9,
    });
  });

  it("uses stronger URL evidence to resolve ambiguous pages deterministically", () => {
    const result = classifyPage({
      url: "https://example.com/pricing",
      headings: ["Contact us"],
    });

    expect(result).toMatchObject({ pageType: "pricing", score: 8 });
  });

  it("uses rule precedence when equally strong evidence is ambiguous", () => {
    const result = classifyPage({ url: "https://example.com/contact/pricing" });

    expect(result).toMatchObject({ pageType: "contact", score: 8 });
  });

  it("classifies a generic form when no more specific signal wins", () => {
    expect(classifyPage({ url: "https://example.com/apply", formCount: 1 })).toMatchObject({
      pageType: "form",
      score: 4,
    });
  });

  it("detects auth pages from password controls", () => {
    expect(
      classifyPage({
        url: "https://example.com/access",
        formCount: 1,
        inputTypes: ["email", "password"],
      }),
    ).toMatchObject({
      matchedSignals: ["control:password"],
      pageType: "auth",
      score: 10,
    });
  });

  it("detects checkout pages from payment autocomplete controls", () => {
    expect(
      classifyPage({
        url: "https://example.com/order",
        autocompleteValues: ["cc-number", "cc-csc"],
        formCount: 1,
      }),
    ).toMatchObject({ pageType: "checkout", score: 10 });
  });

  it("detects booking pages from date or time controls", () => {
    expect(
      classifyPage({
        url: "https://example.com/request",
        formCount: 1,
        inputTypes: ["date", "time"],
      }),
    ).toMatchObject({ pageType: "booking", score: 7 });
  });

  it("detects specific flows from form actions and interactive labels", () => {
    expect(
      classifyPage({
        url: "https://example.com/order",
        formActions: ["/payments/checkout"],
        formCount: 1,
      }).pageType,
    ).toBe("checkout");
    expect(
      classifyPage({
        url: "https://example.com/request",
        formCount: 1,
        interactiveLabels: ["Schedule an appointment"],
      }).pageType,
    ).toBe("booking");
  });

  it("classifies an empty unmatched page as unknown", () => {
    expect(classifyPage({ url: "https://example.com/legal" })).toEqual({
      confidence: "low",
      matchedSignals: [],
      pageType: "unknown",
      score: 0,
    });
  });
});
