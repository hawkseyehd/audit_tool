import { describe, expect, it } from "vitest";

import { extractFormPageSnapshot } from "../../../../src/index.js";

describe("extractFormPageSnapshot", () => {
  it("extracts form quality facts without retaining field values", () => {
    const snapshot = extractFormPageSnapshot({
      html: `
        <form id="contact" action="/send-message" novalidate>
          <label for="email">Email</label>
          <input id="email" name="email" type="text" placeholder="you@example.com" required value="private@example.com">
          <input type="file" name="attachment">
          <button type="submit">Send message</button>
          <a href="/privacy">Privacy policy</a>
          <input name="honeypot">
        </form>
        <input name="phone" aria-label="Phone" value="555-0100">
      `,
      page: { pageType: "contact", url: "https://example.com/contact" },
    });

    expect(snapshot).toMatchObject({ totalFormCount: 1, totalOrphanFieldCount: 1 });
    expect(snapshot.forms[0]).toMatchObject({
      kind: "contact",
      totalFieldCount: 3,
      requiredFieldCount: 1,
      fileFieldCount: 1,
      hasSubmitControl: true,
      hasPrivacySignal: true,
      hasAntiSpamSignal: true,
      bypassesNativeValidation: true,
    });
    expect(snapshot.forms[0]?.fields[0]).toMatchObject({
      type: "text",
      expectedType: "email",
      hasAccessibleName: true,
      hasVisibleLabel: true,
      hasPlaceholder: true,
      isRequired: true,
      hasAutocomplete: false,
    });
    expect(JSON.stringify(snapshot)).not.toContain("private@example.com");
    expect(JSON.stringify(snapshot)).not.toContain("555-0100");
  });

  it("classifies booking, signup, checkout, lead, and generic forms", () => {
    const fixtures = [
      ["booking", '<form action="/appointment"><input type="date"></form>', "unknown"],
      ["signup", '<form><input type="password"></form>', "unknown"],
      ["checkout", '<form><input name="card_number"></form>', "unknown"],
      ["lead", '<form action="/request-quote"><input name="email"></form>', "unknown"],
      ["generic", '<form><textarea name="notes"></textarea></form>', "unknown"],
    ] as const;

    for (const [kind, html, pageType] of fixtures) {
      expect(
        extractFormPageSnapshot({
          html,
          page: { pageType, url: `https://example.com/${kind}` },
        }).forms[0]?.kind,
      ).toBe(kind);
    }
  });
});
