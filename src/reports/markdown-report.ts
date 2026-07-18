import { randomUUID } from "node:crypto";
import { rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { ACCESSIBILITY_AUTOMATION_DISCLAIMER } from "../scanners/accessibility/accessibility-scanner.js";
import { SCORE_CATEGORIES, SCORE_CATEGORY_WEIGHTS } from "../scoring/scoring-engine.js";
import { auditResultSchema, FINDING_CATEGORIES, FINDING_SEVERITIES } from "../core/schemas.js";
import type {
  AuditEvidence,
  AuditFinding,
  AuditResult,
  FindingCategory,
  FindingSeverity,
  ScannedPage,
} from "../core/types.js";
import type { ScoreCategory } from "../scoring/scoring-engine.js";

const SCORE_LABELS: Readonly<Record<ScoreCategory, string>> = {
  performance: "Performance",
  accessibility: "Accessibility",
  formsAndConversionUx: "Forms and conversion UX",
  seo: "SEO",
  securityPrivacy: "Security and privacy basics",
  technicalContentQuality: "Technical and content quality",
};

const CATEGORY_LABELS: Readonly<Record<FindingCategory, string>> = {
  business: "Business",
  ux: "Conversion UX",
  forms: "Forms",
  performance: "Performance",
  accessibility: "Accessibility",
  seo: "SEO",
  security: "Security",
  privacy: "Privacy",
  analytics: "Analytics",
  technical: "Technical",
};

const SEVERITY_LABELS: Readonly<Record<FindingSeverity, string>> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

export function generateMarkdownReport(auditResult: AuditResult): string {
  const result = auditResultSchema.parse(auditResult);
  const lines: string[] = [];

  lines.push(
    "# Website Audit Report",
    "",
    `**Target:** ${escapeInline(result.normalizedUrl)}`,
    `**Audit ID:** ${escapeInline(result.auditId)}`,
    `**Completed:** ${escapeInline(result.completedAt)}`,
    "",
    "> This is a point-in-time automated assessment. Use the findings as evidence for prioritization, not as a certification or guarantee.",
    "",
  );

  renderExecutiveSummary(lines, result);
  renderOverallScore(lines, result);
  renderCategoryScores(lines, result);
  renderTopPriorities(lines, result);
  renderScope(lines, result);
  renderFindingsBySeverity(lines, result.findings);
  renderFindingsByCategory(lines, result.findings);
  renderFocusedSummary(lines, "Form Audit Summary", result.findings, ["forms"]);
  renderFocusedSummary(lines, "Performance Summary", result.findings, ["performance"]);
  renderFocusedSummary(lines, "Accessibility Summary", result.findings, ["accessibility"]);
  renderFocusedSummary(lines, "SEO Summary", result.findings, ["seo"]);
  renderFocusedSummary(lines, "Security and Privacy Summary", result.findings, [
    "security",
    "privacy",
  ]);
  renderActionPlan(lines, result.findings);
  renderLimitations(lines, result);

  return `${lines.join("\n").trimEnd()}\n`;
}

export async function writeMarkdownReport(
  markdownDirectory: string,
  auditResult: AuditResult,
): Promise<AuditResult> {
  const validatedResult = auditResultSchema.parse(auditResult);
  const destinationPath = resolve(markdownDirectory, "audit-report.md");
  const temporaryPath = resolve(markdownDirectory, `.audit-report-${randomUUID()}.tmp`);
  const resultWithOutput = auditResultSchema.parse({
    ...validatedResult,
    outputs: { ...validatedResult.outputs, markdownReportPath: destinationPath },
  });

  try {
    await writeFile(temporaryPath, generateMarkdownReport(resultWithOutput), {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temporaryPath, destinationPath);
    return resultWithOutput;
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

function renderExecutiveSummary(lines: string[], result: AuditResult): void {
  const counts = result.summary.findingCounts;
  const actionable = counts.critical + counts.high + counts.medium + counts.low;
  const failedPages = result.scannedPages.filter((page) => page.error !== undefined).length;
  lines.push(
    "## Executive Summary",
    "",
    `The audit scored **${formatScore(result.summary.overallScore)} out of 100** across ${String(result.scannedPages.length)} scanned pages. It identified **${String(actionable)} actionable findings**, including ${String(counts.critical)} critical and ${String(counts.high)} high-severity issues.`,
    "",
  );
  if (failedPages > 0) {
    lines.push(
      `Results are partial: ${String(failedPages)} page${failedPages === 1 ? "" : "s"} recorded an inspection error. Those failures are listed in the scope section and should be reviewed before treating the audit as complete.`,
      "",
    );
  }
}

function renderOverallScore(lines: string[], result: AuditResult): void {
  lines.push(
    "## Overall Score",
    "",
    `**${formatScore(result.summary.overallScore)} / 100**`,
    "",
    "The overall score is the weighted combination of the six category scores. Findings subtract points according to severity, and scores are capped between 0 and 100.",
    "",
  );
}

function renderCategoryScores(lines: string[], result: AuditResult): void {
  lines.push("## Category Scores", "", "| Category | Weight | Score |", "| --- | ---: | ---: |");
  for (const category of SCORE_CATEGORIES) {
    lines.push(
      `| ${SCORE_LABELS[category]} | ${String(SCORE_CATEGORY_WEIGHTS[category] * 100)}% | ${formatOptionalScore(result.summary.categoryScores[category])} |`,
    );
  }
  lines.push("");
}

function renderTopPriorities(lines: string[], result: AuditResult): void {
  lines.push("## Top Priority Fixes", "");
  if (result.summary.topPriorities.length === 0) {
    lines.push("No actionable automated findings were prioritized.", "");
    return;
  }
  result.summary.topPriorities.forEach((priority, index) => {
    lines.push(`${String(index + 1)}. ${escapeInline(priority)}`);
  });
  lines.push("");
}

function renderScope(lines: string[], result: AuditResult): void {
  lines.push(
    "## Scope and Scanned Pages",
    "",
    `- Requested target: ${escapeInline(result.targetUrl)}`,
    `- Normalized target: ${escapeInline(result.normalizedUrl)}`,
    `- Audit started: ${escapeInline(result.startedAt)}`,
    `- Audit completed: ${escapeInline(result.completedAt)}`,
    `- Pages recorded: ${String(result.scannedPages.length)}`,
    "",
    "| Page | Type | HTTP status | Inspection status |",
    "| --- | --- | ---: | --- |",
  );
  if (result.scannedPages.length === 0) {
    lines.push("| No pages were recorded | Not available | Not available | Incomplete |", "");
    return;
  }
  for (const page of result.scannedPages) lines.push(renderPageRow(page));
  lines.push("");
}

function renderPageRow(page: ScannedPage): string {
  const status =
    page.error === undefined
      ? "Completed"
      : `Failed: ${escapeTableCell(page.error.message)}${page.error.code === undefined ? "" : ` (${escapeTableCell(page.error.code)})`}`;
  return `| ${escapeTableCell(page.url)} | ${escapeTableCell(page.pageType)} | ${page.statusCode === undefined ? "Not available" : String(page.statusCode)} | ${status} |`;
}

function renderFindingsBySeverity(lines: string[], findings: readonly AuditFinding[]): void {
  lines.push("## Findings by Severity", "");
  for (const severity of FINDING_SEVERITIES) {
    const matching = findings.filter((finding) => finding.severity === severity);
    lines.push(`### ${SEVERITY_LABELS[severity]} (${String(matching.length)})`, "");
    if (matching.length === 0) {
      lines.push(`No ${severity}-severity findings were recorded.`, "");
      continue;
    }
    for (const finding of matching) renderFinding(lines, finding);
  }
}

function renderFinding(lines: string[], finding: AuditFinding): void {
  lines.push(
    `#### ${SEVERITY_LABELS[finding.severity]}: ${escapeInline(finding.title)}`,
    "",
    `**Page:** ${escapeInline(finding.url)}`,
    `**Category:** ${CATEGORY_LABELS[finding.category]}`,
    `**Rule:** ${escapeInline(finding.ruleId)}`,
    "",
    escapeParagraph(finding.description),
    "",
    "**Impact**",
    "",
    escapeParagraph(finding.impact),
    "",
    "**Recommendation**",
    "",
    escapeParagraph(finding.recommendation),
    "",
  );
  if (finding.evidence !== undefined) renderEvidence(lines, finding.evidence);
}

function renderEvidence(lines: string[], evidence: AuditEvidence): void {
  lines.push("**Evidence**", "", `- Source: ${escapeInline(evidence.source)}`);
  if (evidence.selector !== undefined)
    lines.push(`- Selector: ${codeSpan(evidence.selector)}`);
  if (evidence.screenshotPath !== undefined)
    lines.push(`- Screenshot: ${codeSpan(evidence.screenshotPath)}`);
  if (evidence.metric !== undefined) lines.push(`- Metric: ${escapeInline(evidence.metric)}`);
  if (evidence.value !== undefined) lines.push(`- Observed: ${escapeInline(String(evidence.value))}`);
  if (evidence.expected !== undefined)
    lines.push(`- Expected: ${escapeInline(String(evidence.expected))}`);
  lines.push("");
}

function renderFindingsByCategory(lines: string[], findings: readonly AuditFinding[]): void {
  lines.push("## Findings by Category", "");
  for (const category of FINDING_CATEGORIES) {
    const matching = findings.filter((finding) => finding.category === category);
    lines.push(`### ${CATEGORY_LABELS[category]} (${String(matching.length)})`, "");
    if (matching.length === 0) {
      lines.push("No findings were recorded in this category.", "");
      continue;
    }
    for (const finding of matching) {
      lines.push(
        `- **${SEVERITY_LABELS[finding.severity]}:** ${escapeInline(finding.title)} (${escapeInline(finding.url)})`,
      );
    }
    lines.push("");
  }
}

function renderFocusedSummary(
  lines: string[],
  heading: string,
  findings: readonly AuditFinding[],
  categories: readonly FindingCategory[],
): void {
  const matching = findings.filter((finding) => categories.includes(finding.category));
  const actionable = matching.filter((finding) => finding.severity !== "info");
  lines.push(`## ${heading}`, "");
  if (matching.length === 0) {
    lines.push("No automated findings were recorded for this area.", "");
    return;
  }
  lines.push(
    `${String(matching.length)} findings were recorded, including ${String(actionable.length)} actionable issues.`,
    "",
  );
  for (const finding of matching.slice(0, 10)) {
    lines.push(`- **${SEVERITY_LABELS[finding.severity]}:** ${escapeInline(finding.title)}`);
  }
  if (matching.length > 10) lines.push(`- ${String(matching.length - 10)} additional findings`);
  lines.push("");
}

function renderActionPlan(lines: string[], findings: readonly AuditFinding[]): void {
  lines.push("## Recommended 30-Day Action Plan", "");
  if (!findings.some((finding) => finding.severity !== "info")) {
    lines.push(
      "1. **Days 1-7:** Manually validate the automated results and confirm the audit scope.",
      "2. **Days 8-14:** Complete keyboard, screen-reader, conversion-path, security, and analytics reviews.",
      "3. **Days 15-21:** Establish monitoring for performance, forms, crawl health, and regressions.",
      "4. **Days 22-30:** Re-run the audit, compare evidence, and document accepted residual risk.",
      "",
    );
    return;
  }
  renderPlanPhase(lines, "Days 1-7", "Confirm scope, assign owners, and resolve critical risks", findings, [
    "critical",
  ]);
  renderPlanPhase(lines, "Days 8-14", "Resolve high-severity trust and conversion blockers", findings, [
    "high",
  ]);
  renderPlanPhase(lines, "Days 15-21", "Address medium-severity quality and usability issues", findings, [
    "medium",
  ]);
  renderPlanPhase(lines, "Days 22-30", "Complete lower-risk improvements and retest all changes", findings, [
    "low",
  ]);
  lines.push("");
}

function renderPlanPhase(
  lines: string[],
  period: string,
  objective: string,
  findings: readonly AuditFinding[],
  severities: readonly FindingSeverity[],
): void {
  const titles = uniqueTitles(
    findings.filter((finding) => severities.includes(finding.severity)),
  ).slice(0, 3);
  const examples =
    titles.length === 0 ? " No issues at this severity were recorded; use the time for manual review." : ` Priorities: ${titles.map(escapeInline).join("; ")}.`;
  lines.push(`- **${period}:** ${objective}.${examples}`);
}

function renderLimitations(lines: string[], result: AuditResult): void {
  const failedPages = result.scannedPages.filter((page) => page.error !== undefined).length;
  lines.push(
    "## Disclaimer and Audit Limitations",
    "",
    `- ${ACCESSIBILITY_AUTOMATION_DISCLAIMER}`,
    "- Lighthouse values are controlled lab measurements, not field data or a guarantee of real-user performance.",
    "- Conversion UX, analytics, content, and technical heuristics require business and user validation.",
    "- Security checks cover observable basics and do not replace penetration testing, code review, or compliance assessment.",
    "- Results reflect the pages, viewports, permissions, and site state available during this audit; authenticated and dynamic workflows may be outside scope.",
    "- The audit is non-destructive by default and does not prove that forms or transactional workflows function after submission.",
  );
  if (failedPages > 0)
    lines.push(`- ${String(failedPages)} page${failedPages === 1 ? "" : "s"} failed inspection, so this report contains partial results.`);
  lines.push("");
}

function uniqueTitles(findings: readonly AuditFinding[]): string[] {
  return [...new Set(findings.map((finding) => finding.title))];
}

function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(2).replace(/0+$/u, "");
}

function formatOptionalScore(score: number | undefined): string {
  return score === undefined ? "Not available" : formatScore(score);
}

function escapeParagraph(value: string): string {
  return value
    .split(/\r?\n/u)
    .map((line) => escapeInline(line))
    .join("  \n");
}

function escapeInline(value: string): string {
  return value
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/([\\`*_[\]<>#|])/gu, "\\$1")
    .replace(/^([-+>])/u, "\\$1")
    .replace(/^(\d+)\./u, "$1\\.");
}

function escapeTableCell(value: string): string {
  return escapeInline(value);
}

function codeSpan(value: string): string {
  const normalized = value.replace(/\s+/gu, " ").trim();
  const longestRun = Math.max(0, ...(normalized.match(/`+/gu) ?? []).map((run) => run.length));
  const delimiter = "`".repeat(longestRun + 1);
  return `${delimiter}${normalized}${delimiter}`;
}
