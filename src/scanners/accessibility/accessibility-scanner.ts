import { createHash } from "node:crypto";
import { auditFindingSchema } from "../../core/schemas.js";
import type { AuditFinding, FindingSeverity } from "../../core/types.js";
import type { AuditScanner, ScannerContext } from "../types.js";
import type {
  AccessibilityPageResult,
  AccessibilityScanInput,
  AxeImpact,
  AxeViolation,
} from "./types.js";

export const ACCESSIBILITY_AUTOMATION_DISCLAIMER =
  "Automated accessibility checks identify only a subset of potential barriers and do not prove WCAG conformance. Complete review requires manual keyboard, screen-reader, visual, cognitive, and user testing.";
export function createAccessibilityScanner(): AuditScanner<AccessibilityScanInput> {
  return {
    name: "accessibility",
    scan: (input, context) => Promise.resolve(scanAccessibility(input, context)),
  };
}
export function scanAccessibility(
  input: AccessibilityScanInput,
  context: ScannerContext,
): AuditFinding[] {
  return input.results.flatMap((result) =>
    result.violations.map((violation) => normalize(result, violation, context)),
  );
}
function normalize(
  result: AccessibilityPageResult,
  violation: AxeViolation,
  context: ScannerContext,
): AuditFinding {
  const selector = violation.nodes
    .flatMap((node) => node.target)
    .slice(0, 10)
    .join(", ");
  const digest = createHash("sha256")
    .update(`${violation.id}|${result.url}|${result.viewport}`)
    .digest("hex")
    .slice(0, 12);
  return auditFindingSchema.parse({
    id: `accessibility-${violation.id}-${digest}`,
    ruleId: violation.id,
    url: result.url,
    category: "accessibility",
    severity: severity(violation.impact),
    title: violation.help,
    description: `${violation.description} Detected in the ${result.viewport} automated axe scan.`,
    impact:
      "The issue may prevent or complicate access for people with disabilities and can increase legal, trust, and conversion risk.",
    recommendation: `Correct the affected markup, retest automatically, and include the change in manual accessibility review.${violation.helpUrl === undefined ? "" : ` Guidance: ${violation.helpUrl}`}`,
    scanner: "accessibility",
    detectedAt: context.detectedAt,
    evidence: {
      ...(selector.length === 0 ? {} : { selector }),
      metric: "affected nodes",
      value: violation.nodes.length,
      expected: 0,
      source: "axe",
    },
  });
}
function severity(impact: AxeImpact): FindingSeverity {
  if (impact === "critical") return "critical";
  if (impact === "serious") return "high";
  if (impact === "moderate") return "medium";
  if (impact === "minor") return "low";
  return "info";
}
