import { describe, expect, it } from "vitest";

import { AUDIT_LIMITS, parseAuditConfig, safeParseAuditConfig } from "../../../src/index.js";

describe("parseAuditConfig", () => {
  it("applies conservative defaults", () => {
    const config = parseAuditConfig({ targetUrl: "example.com" });

    expect(config).toMatchObject({
      targetUrl: "example.com",
      maxPages: 15,
      outputDir: "./reports",
      viewports: ["desktop"],
      includeLighthouse: true,
      includeAccessibility: true,
      includeForms: true,
      includeSeo: true,
      includeSecurity: true,
      includeUxHeuristics: true,
      includeAnalytics: true,
      writeJson: true,
      writeMarkdown: true,
      submitForms: false,
      allowedDomains: [],
      crawlDelayMs: 250,
      concurrency: 2,
      maxRedirects: 10,
      maxResponseBytes: 5_000_000,
      maxRetries: 2,
    });
  });

  it.each(["https://example.com", "http://example.com", "example.com", "example.com:8080"])(
    "accepts supported target %s",
    (targetUrl) => {
      expect(parseAuditConfig({ targetUrl }).targetUrl).toBe(targetUrl);
    },
  );

  it.each(["", "ftp://example.com", "https://user:password@example.com", "not a url"])(
    "rejects invalid target %s",
    (targetUrl) => {
      expect(safeParseAuditConfig({ targetUrl }).success).toBe(false);
    },
  );

  it("accepts form submission only through explicit configuration", () => {
    expect(parseAuditConfig({ targetUrl: "example.com" }).submitForms).toBe(false);
    expect(parseAuditConfig({ targetUrl: "example.com", submitForms: true }).submitForms).toBe(
      true,
    );
  });

  it("normalizes allowed domains to lowercase", () => {
    const config = parseAuditConfig({
      targetUrl: "example.com",
      allowedDomains: ["WWW.EXAMPLE.COM"],
    });

    expect(config.allowedDomains).toEqual(["www.example.com"]);
  });

  it("rejects duplicate viewports and domains", () => {
    expect(
      safeParseAuditConfig({ targetUrl: "example.com", viewports: ["mobile", "mobile"] }).success,
    ).toBe(false);
    expect(
      safeParseAuditConfig({
        targetUrl: "example.com",
        allowedDomains: ["example.com", "example.com"],
      }).success,
    ).toBe(false);
  });

  it("enforces configured safety limits", () => {
    expect(
      safeParseAuditConfig({ targetUrl: "example.com", maxPages: AUDIT_LIMITS.maxPages.max + 1 })
        .success,
    ).toBe(false);
    expect(
      safeParseAuditConfig({
        targetUrl: "example.com",
        concurrency: AUDIT_LIMITS.concurrency.max + 1,
      }).success,
    ).toBe(false);
    expect(safeParseAuditConfig({ targetUrl: "example.com", navigationTimeoutMs: 0 }).success).toBe(
      false,
    );
  });

  it("rejects unknown configuration keys", () => {
    expect(safeParseAuditConfig({ targetUrl: "example.com", unexpectedOption: true }).success).toBe(
      false,
    );
  });
});
