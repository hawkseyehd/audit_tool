import { describe, expect, it } from "vitest";
import {
  auditFindingSchema,
  createSecurityScanner,
  extractSecurityPageSnapshot,
  scanSecurity,
} from "../../../../src/index.js";
const context = { detectedAt: "2026-07-18T15:00:00.000Z" };

describe("Security and Privacy Scanner", () => {
  it("extracts bounded evidence without retaining cookie values", () => {
    const snapshot = extractSecurityPageSnapshot({
      url: "https://example.com/",
      headers: { "Content-Security-Policy": "default-src 'self'; frame-ancestors 'none'" },
      setCookieHeaders: ["session=secret-token; Secure; HttpOnly; SameSite=Lax", "prefs=private"],
      html: '<img src="http://cdn.example.com/a.png"><a href="/privacy">Privacy</a><div class="cookie-consent">Cookie settings</div>',
    });
    expect(snapshot).toMatchObject({
      isHttps: true,
      mixedContentCount: 1,
      hasPrivacyPolicyLink: true,
      hasCookieConsentSignal: true,
    });
    expect(snapshot.cookies).toEqual([
      { name: "session", secure: true, httpOnly: true, sameSite: "lax" },
      { name: "prefs", secure: false, httpOnly: false },
    ]);
    expect(JSON.stringify(snapshot)).not.toContain("secret-token");
    expect(JSON.stringify(snapshot)).not.toContain("private");
  });

  it("emits validated findings and accepts CSP frame protection", () => {
    const page = extractSecurityPageSnapshot({
      url: "http://example.com/",
      finalUrl: "http://example.com/",
      httpRedirectsToHttps: false,
      headers: { "content-security-policy": "default-src 'self'; frame-ancestors 'none'" },
      setCookieHeaders: ["session=value"],
      html: "<main>No policy link</main>",
    });
    const findings = scanSecurity({ pages: [page] }, context);
    const rules = findings.map((finding) => finding.ruleId);
    expect(rules).toEqual(
      expect.arrayContaining([
        "https-missing",
        "http-redirect-missing",
        "hsts-missing",
        "cookie-secure-missing",
        "cookie-httponly-missing",
        "cookie-samesite-missing",
        "privacy-policy-not-detected",
        "cookie-consent-not-detected",
      ]),
    );
    expect(rules).not.toContain("frame-protection-missing");
    for (const finding of findings) expect(() => auditFindingSchema.parse(finding)).not.toThrow();
  });

  it("returns no findings for a hardened page without cookies", () => {
    const page = extractSecurityPageSnapshot({
      url: "https://example.com/",
      httpRedirectsToHttps: true,
      headers: {
        "strict-transport-security": "max-age=31536000",
        "content-security-policy": "default-src 'self'; frame-ancestors 'none'",
        "x-content-type-options": "nosniff",
        "referrer-policy": "strict-origin-when-cross-origin",
        "permissions-policy": "camera=()",
      },
      html: '<a href="/privacy">Privacy policy</a>',
    });
    expect(scanSecurity({ pages: [page] }, context)).toEqual([]);
  });

  it("implements the shared scanner contract", async () => {
    const scanner = createSecurityScanner();
    expect(scanner.name).toBe("security");
    await expect(scanner.scan({ pages: [] }, context)).resolves.toEqual([]);
  });
});
