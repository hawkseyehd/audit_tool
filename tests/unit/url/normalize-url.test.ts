import { describe, expect, it } from "vitest";

import {
  deduplicateUrls,
  normalizeDiscoveredUrl,
  normalizeTargetUrl,
  UrlPolicyError,
} from "../../../src/index.js";

describe("normalizeTargetUrl", () => {
  it.each([
    ["example.com", "https://example.com/"],
    ["HTTP://EXAMPLE.COM:80/path/", "http://example.com/path"],
    ["https://example.com:443/path/#section", "https://example.com/path"],
    ["example.com:8080/path/", "https://example.com:8080/path"],
    ["https://example.com/?z=2&a=1", "https://example.com/?a=1&z=2"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeTargetUrl(input)).toBe(expected);
  });

  it.each(["", "ftp://example.com", "mailto:user@example.com", "https://u:p@example.com"])(
    "rejects unsupported target %s",
    (input) => {
      expect(() => normalizeTargetUrl(input)).toThrow(UrlPolicyError);
    },
  );
});

describe("normalizeDiscoveredUrl", () => {
  it("resolves a relative URL and removes its fragment", () => {
    expect(normalizeDiscoveredUrl("../contact/#form", "https://example.com/services/web/")).toBe(
      "https://example.com/services/contact",
    );
  });
});

describe("deduplicateUrls", () => {
  it("deduplicates canonical equivalents while preserving discovery order", () => {
    expect(
      deduplicateUrls(
        ["/about/", "/contact#form", "/about", "/contact", "/pricing?b=2&a=1"],
        "https://example.com/",
      ),
    ).toEqual([
      "https://example.com/about",
      "https://example.com/contact",
      "https://example.com/pricing?a=1&b=2",
    ]);
  });
});
