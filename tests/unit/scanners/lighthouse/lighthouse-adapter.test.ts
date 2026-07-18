import { describe, expect, it } from "vitest";
import {
  parseAuditConfig,
  runLighthouseAudits,
  type LighthouseRunRequest,
} from "../../../../src/index.js";
describe("runLighthouseAudits", () => {
  it("prioritizes, bounds, and runs pages sequentially across viewports", async () => {
    const requests: LighthouseRunRequest[] = [];
    let killed = 0;
    const config = parseAuditConfig({
      targetUrl: "example.com",
      viewports: ["desktop", "mobile"],
      maxLighthousePages: 2,
    });
    const results = await runLighthouseAudits(
      {
        config,
        pages: [
          { url: "https://example.com/blog", pageType: "blog" },
          { url: "https://example.com/", pageType: "home" },
          { url: "https://example.com/pricing", pageType: "pricing" },
        ],
      },
      {
        assertSafeTarget: () => Promise.resolve(),
        launchChrome: () =>
          Promise.resolve({
            port: 9222,
            kill: () => {
              killed += 1;
              return Promise.resolve();
            },
          }),
        runLighthouse: (request) => {
          requests.push(request);
          return Promise.resolve({
            finalUrl: request.url,
            metrics: {
              performanceScore: 90,
              largestContentfulPaintMs: 1_000,
              cumulativeLayoutShift: 0,
              totalBlockingTimeMs: 0,
              speedIndexMs: 1_000,
              firstContentfulPaintMs: 500,
            },
            opportunities: [],
          });
        },
      },
    );
    expect(requests.map((request) => `${request.url}:${request.viewport}`)).toEqual([
      "https://example.com/:desktop",
      "https://example.com/:mobile",
      "https://example.com/pricing:desktop",
      "https://example.com/pricing:mobile",
    ]);
    expect(results).toHaveLength(4);
    expect(killed).toBe(1);
  });
  it("records individual failures and still closes Chrome", async () => {
    let killed = 0;
    const config = parseAuditConfig({
      targetUrl: "example.com",
      viewports: ["desktop"],
      maxLighthousePages: 1,
    });
    const results = await runLighthouseAudits(
      { config, pages: [{ url: "https://example.com/", pageType: "home" }] },
      {
        assertSafeTarget: () => Promise.resolve(),
        launchChrome: () =>
          Promise.resolve({
            port: 1,
            kill: () => {
              killed += 1;
              return Promise.resolve();
            },
          }),
        runLighthouse: () => Promise.reject(new Error("Audit failed")),
      },
    );
    expect(results[0]?.error).toMatchObject({ code: "lighthouse-failed", message: "Audit failed" });
    expect(killed).toBe(1);
  });
});
