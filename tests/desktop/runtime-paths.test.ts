import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { configurePackagedBrowserEnvironment } from "../../src/desktop/main/runtime-paths.js";

const originalBrowserPath = process.env.PLAYWRIGHT_BROWSERS_PATH;

afterEach(() => {
  if (originalBrowserPath === undefined) delete process.env.PLAYWRIGHT_BROWSERS_PATH;
  else process.env.PLAYWRIGHT_BROWSERS_PATH = originalBrowserPath;
});

describe("packaged browser environment", () => {
  it("points Playwright at the bundled browser resource only in packaged builds", () => {
    delete process.env.PLAYWRIGHT_BROWSERS_PATH;
    configurePackagedBrowserEnvironment(false, "C:\\Program Files\\Website Audit Tool\\resources");
    expect(process.env.PLAYWRIGHT_BROWSERS_PATH).toBeUndefined();

    configurePackagedBrowserEnvironment(true, "C:\\Program Files\\Website Audit Tool\\resources");
    expect(process.env.PLAYWRIGHT_BROWSERS_PATH).toBe(
      path.join("C:\\Program Files\\Website Audit Tool\\resources", ".playwright-browsers"),
    );
  });
});
