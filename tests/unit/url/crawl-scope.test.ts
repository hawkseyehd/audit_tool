import { describe, expect, it } from "vitest";

import { createCrawlScope, evaluateCrawlCandidate } from "../../../src/index.js";

const scope = createCrawlScope("https://example.com", ["help.example.net"]);

describe("evaluateCrawlCandidate", () => {
  it("accepts and canonicalizes relative same-scope pages", () => {
    expect(evaluateCrawlCandidate("/contact/#form", "https://example.com/about", scope)).toEqual({
      accepted: true,
      url: "https://example.com/contact",
    });
  });

  it("allows configured domains on their default port", () => {
    expect(
      evaluateCrawlCandidate("https://help.example.net/docs", "https://example.com", scope),
    ).toMatchObject({ accepted: true });
  });

  it.each([
    ["", "empty"],
    ["mailto:user@example.com", "unsupported-scheme"],
    ["tel:+123456789", "unsupported-scheme"],
    ["javascript:alert(1)", "unsupported-scheme"],
    ["data:text/plain,hello", "unsupported-scheme"],
    ["/brochure.pdf", "download"],
    ["/asset%2Epdf", "download"],
    ["https://www.linkedin.com/company/example", "social-media"],
    ["https://other.example/about", "external-domain"],
    ["https://example.com:8443/admin", "port-mismatch"],
    ["https://help.example.net:8443/docs", "port-mismatch"],
    ["https://user:secret@example.com", "embedded-credentials"],
  ])("rejects %s as %s", (input, reason) => {
    expect(evaluateCrawlCandidate(input, "https://example.com", scope)).toMatchObject({
      accepted: false,
      reason,
    });
  });
});

describe("createCrawlScope", () => {
  it("retains the target explicit port", () => {
    const portScope = createCrawlScope("https://example.com:8443");
    expect(portScope.targetPort).toBe("8443");
    expect(evaluateCrawlCandidate("/page", "https://example.com:8443", portScope)).toMatchObject({
      accepted: true,
    });
    expect(
      evaluateCrawlCandidate("https://example.com/page", "https://example.com:8443", portScope),
    ).toMatchObject({ accepted: false, reason: "port-mismatch" });
  });
});
