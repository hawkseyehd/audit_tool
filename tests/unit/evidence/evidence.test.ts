import { describe, expect, it } from "vitest";

import {
  createAuditEvidence,
  createBrowserScreenshotEvidence,
  type BrowserPageInspection,
} from "../../../src/index.js";

describe("evidence factories", () => {
  it("creates validated selector and metric evidence", () => {
    expect(
      createAuditEvidence("playwright", {
        selector: "main form",
        metric: "visible labels",
        value: 2,
        expected: 3,
      }),
    ).toEqual({
      selector: "main form",
      metric: "visible labels",
      value: 2,
      expected: 3,
      source: "playwright",
    });
  });

  it("creates screenshot evidence only when an inspection captured one", () => {
    const inspection = createInspection({ screenshotPath: "screenshots/home.png" });

    expect(createBrowserScreenshotEvidence(inspection)).toEqual({
      screenshotPath: "screenshots/home.png",
      source: "playwright",
    });
    expect(createBrowserScreenshotEvidence(createInspection())).toBeUndefined();
  });
});

function createInspection(overrides: Partial<BrowserPageInspection> = {}): BrowserPageInspection {
  return {
    requestedUrl: "https://example.com/",
    finalUrl: "https://example.com/",
    viewport: "desktop",
    durationMs: 10,
    consoleErrors: [],
    pageErrors: [],
    ...overrides,
  };
}
