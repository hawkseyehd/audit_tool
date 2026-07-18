import { createHash } from "node:crypto";
import { auditFindingSchema } from "../../core/schemas.js";
import type { AuditFinding, FindingSeverity } from "../../core/types.js";
import type { AuditScanner, ScannerContext } from "../types.js";
import type { LighthousePageResult, LighthouseScanInput } from "./types.js";
interface Details {
  ruleId: string;
  severity: FindingSeverity;
  title: string;
  description: string;
  impact: string;
  recommendation: string;
  metric: string;
  value: number;
  expected: string | number;
}
export function createLighthouseScanner(): AuditScanner<LighthouseScanInput> {
  return {
    name: "lighthouse",
    scan: (input, context) => Promise.resolve(scanLighthouse(input, context)),
  };
}
export function scanLighthouse(
  input: LighthouseScanInput,
  context: ScannerContext,
): AuditFinding[] {
  return input.results.flatMap((result) =>
    result.metrics === undefined ? [] : scanResult(result, context),
  );
}
function scanResult(result: LighthousePageResult, context: ScannerContext): AuditFinding[] {
  const metrics = result.metrics;
  if (metrics === undefined) return [];
  const findings: AuditFinding[] = [];
  if (metrics.performanceScore < 50)
    findings.push(
      finding(result, context, {
        ruleId: "performance-score-low",
        severity: result.viewport === "mobile" ? "high" : "medium",
        title: `Lighthouse ${result.viewport} performance score is low`,
        description: "The Lighthouse lab performance score is below 50 for this run.",
        impact:
          "Slow or unstable experiences can reduce engagement, conversion, and search performance.",
        recommendation:
          "Prioritize the largest measured bottlenecks, retest under consistent conditions, and confirm gains with field data.",
        metric: "performance score",
        value: metrics.performanceScore,
        expected: 50,
      }),
    );
  if (metrics.largestContentfulPaintMs > 2_500)
    findings.push(
      finding(result, context, {
        ruleId: "largest-contentful-paint",
        severity: metrics.largestContentfulPaintMs > 4_000 ? "high" : "medium",
        title: "Largest Contentful Paint is slow",
        description: "The Lighthouse lab LCP exceeds the 2.5 second good-experience threshold.",
        impact: "Visitors may wait too long for the main content to appear.",
        recommendation:
          "Optimize the LCP resource, server response, critical rendering path, and above-fold asset delivery.",
        metric: "LCP (ms)",
        value: Math.round(metrics.largestContentfulPaintMs),
        expected: "<=2500",
      }),
    );
  if (metrics.cumulativeLayoutShift > 0.1)
    findings.push(
      finding(result, context, {
        ruleId: "cumulative-layout-shift",
        severity: metrics.cumulativeLayoutShift > 0.25 ? "high" : "medium",
        title: "Cumulative Layout Shift is elevated",
        description: "The Lighthouse lab CLS exceeds the 0.1 good-experience threshold.",
        impact: "Unexpected movement can cause reading disruption and accidental clicks.",
        recommendation:
          "Reserve media and component space, stabilize fonts, and avoid inserting content above existing content.",
        metric: "CLS",
        value: metrics.cumulativeLayoutShift,
        expected: "<=0.1",
      }),
    );
  if (metrics.totalBlockingTimeMs > 200)
    findings.push(
      finding(result, context, {
        ruleId: "total-blocking-time",
        severity: metrics.totalBlockingTimeMs > 600 ? "high" : "medium",
        title: "Total Blocking Time is elevated",
        description: "The Lighthouse lab TBT exceeds 200 milliseconds.",
        impact: "Long main-thread tasks can delay interaction and make controls feel unresponsive.",
        recommendation:
          "Reduce long JavaScript tasks, defer non-critical work, and ship less unused code.",
        metric: "TBT (ms)",
        value: Math.round(metrics.totalBlockingTimeMs),
        expected: "<=200",
      }),
    );
  for (const opportunity of result.opportunities) {
    const significant =
      (opportunity.savingsMs ?? 0) >= 100 || (opportunity.savingsBytes ?? 0) >= 100_000;
    if (significant)
      findings.push(
        finding(result, context, {
          ruleId: `opportunity-${opportunity.ruleId}`,
          severity: "low",
          title: opportunity.title,
          description: "Lighthouse identified a measurable lab optimization opportunity.",
          impact:
            "Addressing the opportunity may improve load or interaction performance, subject to implementation tradeoffs.",
          recommendation:
            "Review the Lighthouse opportunity details, fix the underlying resources, and verify the change with repeatable tests.",
          metric:
            opportunity.savingsMs !== undefined
              ? "estimated savings (ms)"
              : "estimated savings (bytes)",
          value: Math.round(opportunity.savingsMs ?? opportunity.savingsBytes ?? 0),
          expected: 0,
        }),
      );
  }
  return findings;
}
function finding(
  result: LighthousePageResult,
  context: ScannerContext,
  details: Details,
): AuditFinding {
  const digest = createHash("sha256")
    .update(`${details.ruleId}|${result.url}|${result.viewport}`)
    .digest("hex")
    .slice(0, 12);
  return auditFindingSchema.parse({
    id: `performance-${details.ruleId}-${digest}`,
    ruleId: details.ruleId,
    url: result.url,
    category: "performance",
    severity: details.severity,
    title: details.title,
    description: details.description,
    impact: details.impact,
    recommendation: details.recommendation,
    scanner: "lighthouse",
    detectedAt: context.detectedAt,
    evidence: {
      metric: `${details.metric} (${result.viewport})`,
      value: details.value,
      expected: details.expected,
      source: "lighthouse",
    },
  });
}
