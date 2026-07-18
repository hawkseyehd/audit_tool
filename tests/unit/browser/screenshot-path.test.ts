import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createScreenshotTarget } from "../../../src/index.js";

describe("createScreenshotTarget", () => {
  it("creates deterministic, portable, viewport-specific paths", () => {
    const auditDirectory = resolve("reports", "audit-1");
    const screenshotsDirectory = resolve(auditDirectory, "screenshots");

    const desktop = createScreenshotTarget(
      auditDirectory,
      screenshotsDirectory,
      "https://example.com/Pricing Plans?region=us",
      "desktop",
    );
    const repeated = createScreenshotTarget(
      auditDirectory,
      screenshotsDirectory,
      "https://example.com/Pricing Plans?region=us",
      "desktop",
    );
    const mobile = createScreenshotTarget(
      auditDirectory,
      screenshotsDirectory,
      "https://example.com/Pricing Plans?region=us",
      "mobile",
    );

    expect(desktop).toEqual(repeated);
    expect(desktop.relativePath).toMatch(/^screenshots\/pricing-plans-desktop-[a-f0-9]{12}\.png$/u);
    expect(mobile.relativePath).not.toBe(desktop.relativePath);
    expect(desktop.absolutePath.startsWith(screenshotsDirectory)).toBe(true);
  });

  it("uses the hostname for root-page screenshots", () => {
    const auditDirectory = resolve("reports", "audit-1");
    const result = createScreenshotTarget(
      auditDirectory,
      resolve(auditDirectory, "screenshots"),
      "https://www.example.com/",
      "desktop",
    );

    expect(result.relativePath).toContain("www-example-com-desktop-");
  });

  it("rejects a screenshot directory outside the audit directory", () => {
    expect(() =>
      createScreenshotTarget(
        resolve("reports", "audit-1"),
        resolve("outside"),
        "https://example.com/",
        "desktop",
      ),
    ).toThrow("Screenshot path must remain inside the audit directory");
  });
});
