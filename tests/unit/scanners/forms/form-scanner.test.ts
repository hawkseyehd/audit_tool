import { describe, expect, it } from "vitest";

import {
  auditFindingSchema,
  createFormScanner,
  extractFormPageSnapshot,
  scanForms,
} from "../../../../src/index.js";

const context = { detectedAt: "2026-07-18T14:00:00.000Z" };

describe("Form scanner", () => {
  it("emits validated findings for unsafe and low-quality form markup", () => {
    const page = extractFormPageSnapshot({
      html: `
        <form novalidate>
          <input name="email" type="text" placeholder="Email" required>
          <input name="phone" type="text" placeholder="Phone">
        </form>
        <input name="website" placeholder="Website">
      `,
      page: { pageType: "contact", url: "https://example.com/contact" },
    });

    const findings = scanForms({ pages: [page] }, context);
    const ruleIds = findings.map((finding) => finding.ruleId);

    expect(ruleIds).toEqual(
      expect.arrayContaining([
        "controls-outside-form",
        "field-label-missing",
        "placeholder-only-fields",
        "semantic-input-type-missing",
        "autocomplete-missing",
        "submit-control-missing",
        "native-validation-bypassed",
        "privacy-signal-missing",
        "anti-spam-not-detected",
      ]),
    );
    for (const finding of findings) {
      expect(() => auditFindingSchema.parse(finding)).not.toThrow();
      expect(finding.category).toBe("forms");
      expect(finding.evidence?.selector).toBeDefined();
    }
  });

  it("returns no findings for a complete contact form", () => {
    const page = extractFormPageSnapshot({
      html: `
        <form action="/contact">
          <label for="name">Name</label><input id="name" name="name" autocomplete="name" required>
          <label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required>
          <label for="message">Message</label><textarea id="message" name="message"></textarea>
          <p>Read our <a href="/privacy">privacy policy</a>.</p>
          <input type="hidden" name="honeypot">
          <button type="submit">Send message</button>
        </form>
      `,
      page: { pageType: "contact", url: "https://example.com/contact" },
    });

    expect(scanForms({ pages: [page] }, context)).toEqual([]);
  });

  it("records a manual-review limitation for sensitive controls", () => {
    const page = extractFormPageSnapshot({
      html: '<form><label for="password">Password</label><input id="password" type="password"><button>Sign up</button></form>',
      page: { pageType: "auth", url: "https://example.com/signup" },
    });

    const findings = scanForms({ pages: [page] }, context);

    expect(findings.some((finding) => finding.ruleId === "sensitive-form-manual-review")).toBe(
      true,
    );
  });

  it("implements the shared scanner contract", async () => {
    const scanner = createFormScanner();

    expect(scanner.name).toBe("forms");
    await expect(scanner.scan({ pages: [] }, context)).resolves.toEqual([]);
  });
});
