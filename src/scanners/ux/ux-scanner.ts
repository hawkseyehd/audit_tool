import { createHash } from "node:crypto";
import { auditFindingSchema } from "../../core/schemas.js";
import type { AuditFinding, FindingSeverity } from "../../core/types.js";
import type { AuditScanner, ScannerContext } from "../types.js";
import type { UxPageSnapshot, UxScanInput } from "./types.js";
interface Details {
  ruleId: string;
  severity: FindingSeverity;
  title: string;
  description: string;
  impact: string;
  recommendation: string;
  metric: string;
  value: string | number;
  expected: string | number;
  selector?: string | undefined;
  screenshotPath?: string | undefined;
}
export function createUxScanner(): AuditScanner<UxScanInput> {
  return { name: "ux", scan: (input, context) => Promise.resolve(scanUx(input, context)) };
}
export function scanUx(input: UxScanInput, context: ScannerContext): AuditFinding[] {
  return [...input.pages]
    .sort((a, b) => a.url.localeCompare(b.url))
    .flatMap((page) => scanPage(page, context));
}
function scanPage(page: UxPageSnapshot, context: ScannerContext): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const conversionPage = ["home", "service", "product", "pricing", "contact", "booking"].includes(
    page.pageType,
  );
  if (conversionPage && page.primaryCtaCount === 0)
    findings.push(
      finding(page.url, context, {
        ruleId: "primary-cta-not-detected",
        severity: "high",
        title: "Primary call to action was not detected",
        description:
          "Heuristic review found no clearly worded primary conversion action in the static controls.",
        impact:
          "Visitors may be less certain about the next step, reducing enquiries or purchases.",
        recommendation:
          "Provide a specific, visually prominent action aligned with the page goal and verify it manually.",
        metric: "primary CTA controls",
        value: 0,
        expected: 1,
      }),
    );
  if (page.pageType === "service" && !page.hasPhone && !page.hasEmail)
    findings.push(
      finding(page.url, context, {
        ruleId: "service-contact-signal-missing",
        severity: "medium",
        title: "Direct contact details were not detected",
        description: "Heuristic review found no phone or email signal on this service page.",
        impact:
          "Prospects who prefer direct contact may abandon the page or question business accessibility.",
        recommendation:
          "Consider presenting an appropriate phone or email contact route where it supports the business workflow.",
        metric: "direct contact methods",
        value: 0,
        expected: 1,
      }),
    );
  if (
    ["home", "service"].includes(page.pageType) &&
    !page.hasContactNavigation &&
    !page.hasBookingNavigation
  )
    findings.push(
      finding(page.url, context, {
        ruleId: "conversion-page-navigation-missing",
        severity: "medium",
        title: "Contact or booking navigation was not detected",
        description:
          "Static header and navigation links did not expose a contact or booking destination.",
        impact: "Visitors may need extra effort to find a conversion path.",
        recommendation:
          "Add a clearly named contact or booking destination to persistent navigation when relevant.",
        metric: "navigation conversion links",
        value: 0,
        expected: 1,
      }),
    );
  const trustSignals =
    page.reviewSignals +
    page.testimonialSignals +
    page.certificationSignals +
    page.caseStudySignals +
    page.clientLogoSignals;
  if (conversionPage && trustSignals === 0)
    findings.push(
      finding(page.url, context, {
        ruleId: "trust-signals-not-detected",
        severity: "info",
        title: "Common trust signals were not detected",
        description:
          "Heuristic static review found no obvious review, testimonial, certification, case-study, or client-logo signals. Their relevance varies by business.",
        impact:
          "Some visitors may have less evidence to reduce perceived purchase or enquiry risk.",
        recommendation:
          "Review whether authentic, verifiable trust evidence would support this page; do not add unsupported claims.",
        metric: "common trust signals",
        value: 0,
        expected: "Review applicability",
      }),
    );
  if (page.unclearControlCount > 0)
    findings.push(
      finding(page.url, context, {
        ruleId: "unclear-control-labels",
        severity: "medium",
        title: "Interactive controls use vague labels",
        description: `${String(page.unclearControlCount)} controls are empty or use vague labels.`,
        impact:
          "Visitors may not predict the result of an action, reducing confidence and accessibility.",
        recommendation: "Use concise action labels that describe the destination or outcome.",
        metric: "unclear controls",
        value: page.unclearControlCount,
        expected: 0,
        selector: page.unclearControlSelectors[0],
      }),
    );
  for (const observation of page.rendered) {
    if (observation.primaryCtaAboveFold === false)
      findings.push(
        finding(page.url, context, {
          ruleId: `${observation.viewport}-cta-below-fold`,
          severity: "medium",
          title: `Primary CTA may not be visible above the fold on ${observation.viewport}`,
          description:
            "Rendered heuristic evidence did not place the primary CTA in the initial viewport.",
          impact: "Visitors may not immediately see the next step.",
          recommendation:
            "Review initial viewport hierarchy and make the primary action discoverable.",
          metric: "CTA above fold",
          value: "not observed",
          expected: "visible",
          screenshotPath: observation.screenshotPath,
        }),
      );
    if (observation.viewport === "mobile" && observation.navigationUsable === false)
      findings.push(
        finding(page.url, context, {
          ruleId: "mobile-navigation-usability",
          severity: "high",
          title: "Mobile navigation may be unusable",
          description: "Rendered heuristic evidence flagged mobile navigation for manual review.",
          impact: "Mobile visitors may be unable to reach important pages or conversion paths.",
          recommendation:
            "Test menu visibility, focus order, targets, and close behavior on representative devices.",
          metric: "mobile navigation",
          value: "flagged",
          expected: "usable",
          screenshotPath: observation.screenshotPath,
        }),
      );
    if (observation.viewport === "mobile" && observation.formUsable === false)
      findings.push(
        finding(page.url, context, {
          ruleId: "mobile-form-usability",
          severity: "high",
          title: "Mobile form may be difficult to use",
          description:
            "Rendered heuristic evidence flagged the form layout for manual mobile review.",
          impact: "Field entry or submission friction can directly reduce mobile conversions.",
          recommendation:
            "Review field sizing, labels, keyboard types, errors, and submit access on real devices.",
          metric: "mobile form",
          value: "flagged",
          expected: "usable",
          screenshotPath: observation.screenshotPath,
        }),
      );
    if (observation.hasHorizontalOverflow === true)
      findings.push(
        finding(page.url, context, {
          ruleId: `${observation.viewport}-horizontal-overflow`,
          severity: "high",
          title: `Horizontal page overflow detected on ${observation.viewport}`,
          description: "Rendered evidence indicates content extends beyond the viewport width.",
          impact:
            "Content or controls may be clipped, overlap, or require unintended horizontal scrolling.",
          recommendation: "Identify and correct the overflowing element.",
          metric: "horizontal overflow",
          value: "detected",
          expected: "none",
          screenshotPath: observation.screenshotPath,
        }),
      );
  }
  return findings;
}
function finding(url: string, context: ScannerContext, details: Details): AuditFinding {
  const digest = createHash("sha256").update(`${details.ruleId}|${url}`).digest("hex").slice(0, 12);
  return auditFindingSchema.parse({
    id: `ux-${details.ruleId}-${digest}`,
    ruleId: details.ruleId,
    url,
    category: "ux",
    severity: details.severity,
    title: details.title,
    description: details.description,
    impact: details.impact,
    recommendation: details.recommendation,
    scanner: "ux",
    detectedAt: context.detectedAt,
    evidence: {
      ...(details.selector === undefined ? {} : { selector: details.selector }),
      ...(details.screenshotPath === undefined ? {} : { screenshotPath: details.screenshotPath }),
      metric: details.metric,
      value: details.value,
      expected: details.expected,
      source: "heuristic",
    },
  });
}
