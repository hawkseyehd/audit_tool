import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";
import { prioritizePagesForScanning } from "../../classifiers/page-scan-priority.js";
import { assertPublicNetworkTarget } from "../../url/network-safety.js";
import { lighthousePageResultSchema } from "./schemas.js";
import type {
  LighthouseAuditDependencies,
  LighthouseAuditOptions,
  LighthouseChromeLauncher,
  LighthousePageResult,
  LighthouseRunner,
} from "./types.js";

const OPPORTUNITY_IDS = [
  "modern-image-formats",
  "uses-optimized-images",
  "render-blocking-resources",
  "unused-javascript",
  "unused-css",
] as const;

export async function runLighthouseAudits(
  options: LighthouseAuditOptions,
  dependencies: LighthouseAuditDependencies = {},
): Promise<LighthousePageResult[]> {
  const launchChrome = dependencies.launchChrome ?? defaultChromeLauncher;
  const runLighthouse = dependencies.runLighthouse ?? defaultLighthouseRunner;
  const assertSafeTarget = dependencies.assertSafeTarget ?? assertPublicNetworkTarget;
  const pages = prioritizePagesForScanning(
    options.pages.filter((page) => page.error === undefined),
  ).slice(0, options.config.maxLighthousePages);
  if (pages.length === 0) return [];
  const chrome = await launchChrome();
  const results: LighthousePageResult[] = [];
  try {
    for (const page of pages)
      for (const viewport of options.config.viewports) {
        options.signal?.throwIfAborted();
        try {
          await assertSafeTarget(page.url);
          const result = await runLighthouse({ url: page.url, viewport, port: chrome.port });
          results.push(
            lighthousePageResultSchema.parse({
              url: page.url,
              finalUrl: result.finalUrl,
              viewport,
              metrics: result.metrics,
              opportunities: result.opportunities,
            }),
          );
        } catch (error: unknown) {
          options.signal?.throwIfAborted();
          results.push(
            lighthousePageResultSchema.parse({
              url: page.url,
              viewport,
              opportunities: [],
              error: { code: "lighthouse-failed", message: safeMessage(error) },
            }),
          );
        }
      }
  } finally {
    await chrome.kill();
  }
  return results;
}

const defaultChromeLauncher: LighthouseChromeLauncher = async () => {
  const chrome = await launch({
    chromeFlags: ["--headless=new", "--no-first-run", "--disable-gpu"],
  });
  return {
    port: chrome.port,
    kill: () => {
      chrome.kill();
    },
  };
};

const defaultLighthouseRunner: LighthouseRunner = async ({ url, viewport, port }) => {
  const mobile = viewport === "mobile";
  const result = await lighthouse(url, {
    port,
    output: "json",
    logLevel: "error",
    onlyCategories: ["performance"],
    formFactor: mobile ? "mobile" : "desktop",
    screenEmulation: mobile
      ? { mobile: true, width: 390, height: 844, deviceScaleFactor: 1, disabled: false }
      : { mobile: false, width: 1440, height: 900, deviceScaleFactor: 1, disabled: false },
  });
  if (result === undefined) throw new Error("Lighthouse returned no result");
  const { lhr } = result;
  const audit = (id: string): number => lhr.audits[id]?.numericValue ?? 0;
  const score = lhr.categories.performance?.score;
  if (score === null || score === undefined)
    throw new Error("Lighthouse performance score is missing");
  const opportunities = OPPORTUNITY_IDS.flatMap((ruleId) => {
    const item = lhr.audits[ruleId];
    const itemScore = item?.score;
    if (item === undefined || itemScore === null || itemScore === undefined || itemScore === 1)
      return [];
    const { savingsBytes, savingsMs } = extractOpportunitySavings(item.details);
    return [
      {
        ruleId,
        title: item.title,
        ...(savingsMs === undefined ? {} : { savingsMs }),
        ...(savingsBytes === undefined ? {} : { savingsBytes }),
      },
    ];
  });
  return {
    finalUrl: lhr.finalDisplayedUrl,
    metrics: {
      performanceScore: Math.round(score * 100),
      largestContentfulPaintMs: audit("largest-contentful-paint"),
      cumulativeLayoutShift: audit("cumulative-layout-shift"),
      totalBlockingTimeMs: audit("total-blocking-time"),
      speedIndexMs: audit("speed-index"),
      firstContentfulPaintMs: audit("first-contentful-paint"),
    },
    opportunities,
  };
};
function safeMessage(error: unknown): string {
  return (error instanceof Error ? error.message : "Unknown Lighthouse failure")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 2_000);
}

function extractOpportunitySavings(details: unknown): {
  readonly savingsBytes?: number;
  readonly savingsMs?: number;
} {
  if (!isRecord(details)) return {};
  const metricSavings = details.metricSavings;
  const lcpSavings = isRecord(metricSavings) ? metricSavings.LCP : undefined;
  const savingsBytes = details.overallSavingsBytes;
  return {
    ...(typeof savingsBytes === "number" ? { savingsBytes } : {}),
    ...(typeof lcpSavings === "number" ? { savingsMs: lcpSavings } : {}),
  };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
