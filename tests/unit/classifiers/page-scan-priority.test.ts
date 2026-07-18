import { describe, expect, it } from "vitest";

import {
  getPageScanPriority,
  prioritizePagesForScanning,
  type ScannedPage,
} from "../../../src/index.js";

describe("page scan priority", () => {
  it("assigns high-value pages a higher priority than generic pages", () => {
    expect(getPageScanPriority("home")).toBeGreaterThan(getPageScanPriority("unknown"));
    expect(getPageScanPriority("contact")).toBeGreaterThan(getPageScanPriority("blog"));
  });

  it("sorts stably without mutating the crawl order", () => {
    const pages: ScannedPage[] = [
      { pageType: "blog", url: "https://example.com/blog/one" },
      { pageType: "contact", url: "https://example.com/contact" },
      { pageType: "blog", url: "https://example.com/blog/two" },
      { pageType: "home", url: "https://example.com/" },
    ];

    const prioritized = prioritizePagesForScanning(pages);

    expect(prioritized.map((page) => page.url)).toEqual([
      "https://example.com/",
      "https://example.com/contact",
      "https://example.com/blog/one",
      "https://example.com/blog/two",
    ]);
    expect(pages[0]?.url).toBe("https://example.com/blog/one");
  });
});
