import { createHash } from "node:crypto";
import { load } from "cheerio";
import { z } from "zod";
import { auditFindingSchema } from "../../core/schemas.js";
import type { AuditFinding } from "../../core/types.js";
import type { AuditScanner, ScannerContext } from "../types.js";

export const ANALYTICS_PROVIDERS = [
  "google-analytics",
  "google-tag-manager",
  "meta-pixel",
  "linkedin-insight",
  "microsoft-clarity",
  "hotjar",
] as const;
export const analyticsProviderSchema = z.enum(ANALYTICS_PROVIDERS);
export const analyticsPageSnapshotSchema = z
  .object({
    url: z.url(),
    providers: z.array(analyticsProviderSchema),
    signalCount: z.number().int().nonnegative(),
  })
  .strict();
export type AnalyticsProvider = z.infer<typeof analyticsProviderSchema>;
export type AnalyticsPageSnapshot = z.infer<typeof analyticsPageSnapshotSchema>;
export interface AnalyticsScanInput {
  readonly pages: readonly AnalyticsPageSnapshot[];
}

const PATTERNS: Readonly<Record<AnalyticsProvider, readonly RegExp[]>> = {
  "google-analytics": [
    /google-analytics\.com\/analytics\.js/u,
    /googletagmanager\.com\/gtag\/js/u,
    /\bgtag\s*\(/u,
    /\bgoogleanalyticsobject\b/u,
  ],
  "google-tag-manager": [/googletagmanager\.com\/gtm\.js/u, /\bgtm-[a-z0-9]+\b/u],
  "meta-pixel": [/connect\.facebook\.net\/.*fbevents\.js/u, /\bfbq\s*\(/u],
  "linkedin-insight": [/snap\.licdn\.com\/li\.lms-analytics/u, /\b_linkedin_partner_id\b/u],
  "microsoft-clarity": [/clarity\.ms\/tag/u, /\bclarity\s*\(/u],
  hotjar: [/static\.hotjar\.com/u, /\bhj\s*\(/u],
};

export function extractAnalyticsPageSnapshot(html: string, url: string): AnalyticsPageSnapshot {
  const document = load(html);
  const signals: string[] = [];
  document("script")
    .slice(0, 500)
    .each((_index, element) => {
      const script = document(element);
      signals.push((script.attr("src") ?? "").toLowerCase().slice(0, 2_000));
      if (signals.join("").length < 500_000)
        signals.push(script.text().toLowerCase().slice(0, 20_000));
    });
  const content = signals.join("\n").slice(0, 500_000);
  const providers = ANALYTICS_PROVIDERS.filter((provider) =>
    PATTERNS[provider].some((pattern) => pattern.test(content)),
  );
  const signalCount = ANALYTICS_PROVIDERS.reduce(
    (total, provider) =>
      total + PATTERNS[provider].filter((pattern) => pattern.test(content)).length,
    0,
  );
  return analyticsPageSnapshotSchema.parse({ url, providers, signalCount });
}

export function createAnalyticsScanner(): AuditScanner<AnalyticsScanInput> {
  return {
    name: "analytics",
    scan: (input, context) => Promise.resolve(scanAnalytics(input, context)),
  };
}
export function scanAnalytics(input: AnalyticsScanInput, context: ScannerContext): AuditFinding[] {
  return [...input.pages]
    .sort((a, b) => a.url.localeCompare(b.url))
    .filter((page) => page.providers.length === 0)
    .map((page) => {
      const digest = createHash("sha256").update(page.url).digest("hex").slice(0, 12);
      return auditFindingSchema.parse({
        id: `analytics-common-tools-not-detected-${digest}`,
        ruleId: "common-analytics-not-detected",
        url: page.url,
        category: "analytics",
        severity: "info",
        title: "No common client-side analytics signal was detected",
        description:
          "The bounded static markup did not show a recognized analytics or tag-management signal. This does not prove analytics is absent: scripts may be consent-gated, blocked, delayed, dynamically injected, proxied, or server-side.",
        impact:
          "Without verified measurement, the business may have limited evidence about acquisition, behavior, and conversion performance.",
        recommendation:
          "Confirm the intended measurement plan, consent behavior, event delivery, and data quality in the authorized analytics and tag-management tools.",
        scanner: "analytics",
        detectedAt: context.detectedAt,
        evidence: {
          metric: "recognized analytics providers",
          value: 0,
          expected: "Manual implementation verification",
          source: "heuristic",
        },
      });
    });
}
