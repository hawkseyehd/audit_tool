import { FINDING_CATEGORIES, FINDING_SEVERITIES, auditResultSchema } from "../core/schemas.js";
import type {
  AuditFinding,
  AuditResult,
  FindingCategory,
  FindingSeverity,
} from "../core/types.js";
import { SCORE_CATEGORIES } from "../scoring/scoring-engine.js";
import type { ScoreCategory } from "../scoring/scoring-engine.js";
import { resolveReportSiteName } from "./html-report.js";

const MAX_PRIORITY_ISSUES = 6;
const PRIORITY_ISSUES_PER_PAGE = 3;
const SUMMARY_TEXT_LIMIT = 260;

const SCORE_LABELS: Readonly<Record<ScoreCategory, string>> = {
  performance: "Performance",
  accessibility: "Accessibility",
  formsAndConversionUx: "Forms and conversion UX",
  seo: "SEO",
  securityPrivacy: "Security and privacy",
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
  info: "Informational",
};

const SEVERITY_ORDER = new Map<FindingSeverity, number>(
  FINDING_SEVERITIES.map((severity, index) => [severity, index]),
);

export function generatePdfSummaryReport(auditResult: AuditResult): string {
  const result = auditResultSchema.parse(auditResult);
  const siteName = resolveReportSiteName(result);
  const priorities = selectPriorityFindings(result);
  const priorityPages = chunk(priorities, PRIORITY_ISSUES_PER_PAGE);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
  <title>Audit Summary - ${escapeHtml(siteName)}</title>
  <style>${SUMMARY_STYLES}</style>
</head>
<body>
  <main class="summary">
    ${renderDecisionSnapshot(result, siteName)}
    ${renderIssueLandscape(result)}
    ${priorityPages.map((findings, index) => renderPriorityPage(findings, index, priorityPages.length)).join("")}
    ${renderActionAndScope(result, priorities.length)}
  </main>
</body>
</html>
`;
}

function renderDecisionSnapshot(result: AuditResult, siteName: string): string {
  const counts = result.summary.findingCounts;
  const actionable = counts.critical + counts.high + counts.medium + counts.low;
  const failedPages = result.scannedPages.filter((page) => page.error !== undefined).length;
  const scoreBand = getScoreBand(result.summary.overallScore);

  return `<section class="summary-page summary-page--cover" aria-labelledby="summary-title">
    <div class="top-rule"></div>
    <p class="eyebrow">Website audit | Client summary</p>
    <h1 id="summary-title">Audit Summary</h1>
    <p class="site-name">${escapeHtml(compactText(siteName, 160))}</p>
    <div class="decision-grid">
      <div class="score-block">
        <span class="label">Overall score</span>
        <strong>${formatScore(result.summary.overallScore)}<small>/100</small></strong>
        <span class="score-status score-status--${scoreBand.className}">${scoreBand.label}</span>
      </div>
      <dl class="audit-meta">
        ${metadataItem("Website", compactText(result.normalizedUrl, 140), result.normalizedUrl)}
        ${metadataItem("Completed", formatTimestamp(result.completedAt))}
        ${metadataItem("Pages reviewed", String(result.scannedPages.length))}
        ${metadataItem("Audit ID", result.auditId)}
      </dl>
    </div>
    <div class="snapshot-grid" aria-label="Audit snapshot">
      ${snapshotMetric("Actionable issues", actionable, "critical through low severity")}
      ${snapshotMetric("Immediate risks", counts.critical + counts.high, "critical and high severity")}
      ${snapshotMetric("Inspection failures", failedPages, "pages with incomplete inspection")}
    </div>
    <section class="meaning" aria-labelledby="what-this-means">
      <p class="section-kicker">Decision snapshot</p>
      <h2 id="what-this-means">What this means</h2>
      <p>${renderOutcomeStatement(result)}</p>
    </section>
    <div class="severity-strip" aria-label="Finding counts by severity">
      ${FINDING_SEVERITIES.map((severity) => severityMetric(severity, counts[severity])).join("")}
    </div>
    ${failedPages === 0 ? "" : `<div class="notice"><strong>Coverage note</strong><span>${String(failedPages)} page${failedPages === 1 ? "" : "s"} could not be fully inspected. Treat this as a partial assessment until those pages are reviewed.</span></div>`}
    <p class="document-note">This summary is designed for prioritization. See <strong>audit-report.pdf</strong> for affected pages, evidence, screenshots, and complete remediation detail.</p>
  </section>`;
}

function renderIssueLandscape(result: AuditResult): string {
  const findingRows = FINDING_CATEGORIES.map((category) => {
    const matching = result.findings.filter((finding) => finding.category === category);
    const count = (severity: FindingSeverity): number =>
      matching.filter((finding) => finding.severity === severity).length;
    return `<tr>
      <th scope="row">${CATEGORY_LABELS[category]}</th>
      <td>${String(count("critical"))}</td>
      <td>${String(count("high"))}</td>
      <td>${String(count("medium"))}</td>
      <td>${String(count("low"))}</td>
      <td>${String(count("info"))}</td>
      <td><strong>${String(matching.length)}</strong></td>
    </tr>`;
  }).join("");
  const scoreRows = SCORE_CATEGORIES.map((category) => {
    const score = result.summary.categoryScores[category];
    if (score === undefined) {
      return `<tr><th scope="row">${SCORE_LABELS[category]}</th><td colspan="2">Not available</td></tr>`;
    }
    const band = getScoreBand(score);
    return `<tr>
      <th scope="row">${SCORE_LABELS[category]}</th>
      <td><strong>${formatScore(score)}</strong> / 100</td>
      <td><span class="table-status table-status--${band.className}">${band.label}</span></td>
    </tr>`;
  }).join("");

  return `<section class="summary-page" aria-labelledby="issue-landscape">
    ${pageHeading("02", "Issue landscape", "issue-landscape", "Where risk is concentrated across the audited experience.")}
    <div class="landscape-grid">
      <section aria-labelledby="category-performance">
        <h3 id="category-performance">Category performance</h3>
        <table class="score-table">
          <thead><tr><th scope="col">Audit area</th><th scope="col">Score</th><th scope="col">Status</th></tr></thead>
          <tbody>${scoreRows}</tbody>
        </table>
      </section>
      <section aria-labelledby="findings-by-area">
        <div class="table-title-row">
          <h3 id="findings-by-area">Findings by area</h3>
          <span>${String(result.findings.length)} total</span>
        </div>
        <table class="landscape-table">
          <thead><tr><th scope="col">Area</th><th scope="col">Critical</th><th scope="col">High</th><th scope="col">Medium</th><th scope="col">Low</th><th scope="col">Info</th><th scope="col">Total</th></tr></thead>
          <tbody>${findingRows}</tbody>
        </table>
      </section>
    </div>
    <p class="accounting-note"><strong>Every finding is accounted for above.</strong> The next section highlights no more than six issues for immediate discussion; the technical report contains the full list.</p>
  </section>`;
}

function renderPriorityPage(
  findings: readonly AuditFinding[],
  pageIndex: number,
  totalPages: number,
): string {
  const label = totalPages === 1 ? "Priority issues" : `Priority issues ${String(pageIndex + 1)} of ${String(totalPages)}`;
  return `<section class="summary-page" aria-labelledby="priority-issues-${String(pageIndex)}">
    ${pageHeading(String(pageIndex + 3).padStart(2, "0"), label, `priority-issues-${String(pageIndex)}`, "The issues most likely to warrant action first, based on the canonical audit priorities and severity.")}
    <div class="priority-list">
      ${findings.map((finding, index) => renderPriorityIssue(finding, pageIndex * PRIORITY_ISSUES_PER_PAGE + index + 1)).join("")}
    </div>
    <p class="priority-note">The ordering supports triage, not a substitute for owner, cost, dependency, or legal review.</p>
  </section>`;
}

function renderPriorityIssue(finding: AuditFinding, index: number): string {
  return `<article class="priority-issue priority-issue--${finding.severity}">
    <header>
      <span class="priority-number">${String(index).padStart(2, "0")}</span>
      <div>
        <span class="severity severity--${finding.severity}">${SEVERITY_LABELS[finding.severity]}</span>
        <span class="category-label">${CATEGORY_LABELS[finding.category]}</span>
      </div>
    </header>
    <h3>${escapeHtml(compactText(finding.title, 180))}</h3>
    <div class="priority-detail"><strong>Why it matters</strong><p>${escapeHtml(compactText(finding.impact))}</p></div>
    <div class="priority-detail"><strong>Recommended next step</strong><p>${escapeHtml(compactText(finding.recommendation))}</p></div>
  </article>`;
}

function renderActionAndScope(result: AuditResult, priorityCount: number): string {
  const finalSectionNumber = priorityCount === 0 ? "03" : priorityCount <= 3 ? "04" : "05";
  const counts = result.summary.findingCounts;
  const failedPages = result.scannedPages.filter((page) => page.error !== undefined).length;
  const successfulPages = result.scannedPages.length - failedPages;

  return `<section class="summary-page" aria-labelledby="action-plan">
    ${pageHeading(finalSectionNumber, "30-day action plan", "action-plan", "A practical sequence for ownership, remediation, and verification.")}
    <div class="plan-list">
      ${planPhase("Days 1-7", "Stabilize", counts.critical, "critical", "Confirm scope, assign accountable owners, and contain any immediate risk.")}
      ${planPhase("Days 8-14", "Remove blockers", counts.high, "high", "Resolve high-severity trust, access, security, and conversion blockers.")}
      ${planPhase("Days 15-21", "Improve quality", counts.medium, "medium", "Address material usability, discoverability, performance, and content issues.")}
      ${planPhase("Days 22-30", "Complete and verify", counts.low, "low", "Finish lower-risk improvements, retest changed pages, and document residual risk.")}
    </div>
    <div class="closing-grid">
      <section aria-labelledby="scope-summary">
        <h2 id="scope-summary">Scope summary</h2>
        <dl class="scope-list">
          ${metadataItem("Requested target", compactText(result.targetUrl, 140), result.normalizedUrl)}
          ${metadataItem("Pages recorded", String(result.scannedPages.length))}
          ${metadataItem("Completed inspections", String(successfulPages))}
          ${metadataItem("Inspection failures", String(failedPages))}
          ${metadataItem("Audit window", `${formatTimestamp(result.startedAt)} to ${formatTimestamp(result.completedAt)}`)}
        </dl>
      </section>
      <section aria-labelledby="limitations">
        <h2 id="limitations">How to use this summary</h2>
        <p>This is a point-in-time automated assessment for prioritization. It is not a certification, legal opinion, security penetration test, or guarantee that every issue was detected.</p>
        <p>Validate fixes manually and rerun affected checks. Accessibility requires expert and assistive-technology review beyond automated coverage.</p>
      </section>
    </div>
    <div class="next-step"><strong>Recommended next step</strong><span>Assign an owner and target date to each priority issue, then use <strong>audit-report.pdf</strong> as the implementation and verification record.</span></div>
  </section>`;
}

function renderOutcomeStatement(result: AuditResult): string {
  const counts = result.summary.findingCounts;
  const actionable = counts.critical + counts.high + counts.medium + counts.low;
  const total = actionable + counts.info;

  if (counts.critical > 0) {
    return `Immediate attention is required. The assessment recorded ${String(counts.critical)} critical and ${String(counts.high)} high-severity ${pluralize(counts.critical + counts.high, "issue")}. Stabilize these areas before lower-risk improvements.`;
  }
  if (counts.high > 0) {
    return `The assessment found no critical issues, but ${String(counts.high)} high-severity ${pluralize(counts.high, "issue")} should be prioritized. Resolve these before working through the remaining ${String(Math.max(0, actionable - counts.high))} actionable ${pluralize(Math.max(0, actionable - counts.high), "issue")}.`;
  }
  if (actionable > 0) {
    return `No critical or high-severity issues were recorded. The ${String(actionable)} actionable ${pluralize(actionable, "issue")} are concentrated in medium- and lower-risk improvements that can be planned into normal delivery work.`;
  }
  if (total > 0) {
    return `No actionable automated issues were recorded. The ${String(total)} informational ${pluralize(total, "observation")} should be reviewed alongside the audit scope before deciding that no further work is needed.`;
  }
  return "No automated findings were recorded. Confirm that the audit scope completed successfully and perform manual review before treating this as assurance.";
}

function selectPriorityFindings(result: AuditResult): AuditFinding[] {
  const actionable = [...result.findings]
    .filter((finding) => finding.severity !== "info")
    .sort(compareFindings);
  const selected = new Set<AuditFinding>();
  const priorities: AuditFinding[] = [];

  for (const title of result.summary.topPriorities) {
    const finding = actionable.find(
      (candidate) => !selected.has(candidate) && candidate.title === title,
    );
    if (finding !== undefined) {
      selected.add(finding);
      priorities.push(finding);
    }
  }

  for (const finding of actionable) {
    if (!selected.has(finding)) priorities.push(finding);
  }

  return priorities.slice(0, MAX_PRIORITY_ISSUES);
}

function compareFindings(left: AuditFinding, right: AuditFinding): number {
  return (
    (SEVERITY_ORDER.get(left.severity) ?? FINDING_SEVERITIES.length) -
      (SEVERITY_ORDER.get(right.severity) ?? FINDING_SEVERITIES.length) ||
    left.category.localeCompare(right.category) ||
    left.title.localeCompare(right.title) ||
    left.url.localeCompare(right.url) ||
    left.ruleId.localeCompare(right.ruleId)
  );
}

function pageHeading(number: string, title: string, id: string, description: string): string {
  return `<header class="page-heading">
    <span>${escapeHtml(number)}</span>
    <div><h2 id="${escapeHtml(id)}">${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div>
  </header>`;
}

function metadataItem(label: string, value: string, href?: string): string {
  const escapedValue = escapeHtml(value);
  const content =
    href === undefined ? escapedValue : `<a href="${escapeHtml(href)}">${escapedValue}</a>`;
  return `<div><dt>${escapeHtml(label)}</dt><dd>${content}</dd></div>`;
}

function snapshotMetric(label: string, value: number, detail: string): string {
  return `<div><span>${escapeHtml(label)}</span><strong>${String(value)}</strong><small>${escapeHtml(detail)}</small></div>`;
}

function severityMetric(severity: FindingSeverity, count: number): string {
  return `<div class="severity-metric severity-metric--${severity}"><span>${SEVERITY_LABELS[severity]}</span><strong>${String(count)}</strong></div>`;
}

function planPhase(
  period: string,
  title: string,
  count: number,
  severity: Exclude<FindingSeverity, "info">,
  instruction: string,
): string {
  const countText = count === 0 ? `No ${severity}-severity issues recorded.` : `${String(count)} ${severity}-severity ${pluralize(count, "issue")} recorded.`;
  return `<article class="plan-phase">
    <span class="plan-period">${escapeHtml(period)}</span>
    <div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(instruction)}</p></div>
    <strong>${escapeHtml(countText)}</strong>
  </article>`;
}

function compactText(value: string, limit = SUMMARY_TEXT_LIMIT): string {
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (normalized.length <= limit) return normalized;

  const candidate = normalized.slice(0, limit - 3);
  const lastSpace = candidate.lastIndexOf(" ");
  const end = lastSpace >= Math.floor(limit * 0.7) ? lastSpace : candidate.length;
  return `${candidate.slice(0, end).trimEnd()}...`;
}

function chunk<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function getScoreBand(score: number): { readonly className: string; readonly label: string } {
  if (score >= 90) return { className: "strong", label: "Strong" };
  if (score >= 75) return { className: "good", label: "Good" };
  if (score >= 60) return { className: "attention", label: "Needs attention" };
  return { className: "priority", label: "Priority work" };
}

function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function formatTimestamp(timestamp: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "short",
    timeZone: "UTC",
    timeZoneName: "short",
    year: "numeric",
  }).format(new Date(timestamp));
}

function pluralize(count: number, noun: string): string {
  return count === 1 ? noun : `${noun}s`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const SUMMARY_STYLES = String.raw`
:root {
  color-scheme: light;
  --paper: #ffffff;
  --ink: #152033;
  --muted: #5d697a;
  --rule: #d8e0ea;
  --soft: #f5f7fa;
  --primary: #1f5fbf;
  --primary-tint: #eaf2ff;
  --critical: #b42318;
  --critical-tint: #feeceb;
  --high: #c2410c;
  --high-tint: #fff0e6;
  --medium: #8a5200;
  --medium-tint: #fff6d8;
  --low: #176b52;
  --low-tint: #e8f7f1;
  --info: #36618f;
  --info-tint: #edf4fb;
}

* { box-sizing: border-box; }

html { background: var(--paper); }

body {
  margin: 0;
  color: var(--ink);
  background: var(--paper);
  font-family: Arial, Helvetica, sans-serif;
  font-size: 10pt;
  line-height: 1.45;
  letter-spacing: 0;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

a { color: var(--primary); overflow-wrap: anywhere; text-decoration-thickness: 0.6px; }
p, h1, h2, h3, dl { margin-top: 0; }

.summary { width: 100%; }

.summary-page {
  break-after: page;
  min-height: 248mm;
  padding-top: 2mm;
}

.summary-page:last-child { break-after: auto; }

.summary-page--cover { padding-top: 6mm; }

.top-rule { width: 28mm; height: 2.5mm; margin-bottom: 15mm; background: var(--primary); }

.eyebrow, .section-kicker {
  margin-bottom: 3mm;
  color: var(--primary);
  font-size: 8.5pt;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

h1 { margin-bottom: 2mm; font-size: 30pt; line-height: 1.05; letter-spacing: 0; }
.site-name { max-width: 150mm; margin-bottom: 12mm; color: var(--muted); font-size: 17pt; line-height: 1.2; overflow-wrap: anywhere; }

.decision-grid { display: grid; grid-template-columns: 58mm 1fr; gap: 12mm; align-items: stretch; margin-bottom: 8mm; }
.score-block { display: flex; min-height: 48mm; flex-direction: column; justify-content: center; padding: 7mm; border-left: 2.5mm solid var(--primary); background: var(--primary-tint); }
.score-block .label { color: var(--muted); font-size: 8.5pt; font-weight: 700; }
.score-block > strong { margin: 1mm 0 2mm; font-size: 29pt; line-height: 1; }
.score-block small { color: var(--muted); font-size: 10pt; font-weight: 500; }
.score-status { align-self: flex-start; padding: 1mm 2.5mm; border-radius: 4px; font-size: 8pt; font-weight: 700; }
.score-status--strong, .table-status--strong { color: var(--low); background: var(--low-tint); }
.score-status--good, .table-status--good { color: var(--primary); background: var(--primary-tint); }
.score-status--attention, .table-status--attention { color: var(--medium); background: var(--medium-tint); }
.score-status--priority, .table-status--priority { color: var(--critical); background: var(--critical-tint); }

.audit-meta { display: grid; grid-template-columns: 1fr; margin: 0; border-top: 1px solid var(--rule); }
.audit-meta > div, .scope-list > div { display: grid; grid-template-columns: 35mm 1fr; gap: 3mm; padding: 2.5mm 0; border-bottom: 1px solid var(--rule); }
dt { color: var(--muted); font-size: 8pt; font-weight: 700; }
dd { margin: 0; font-size: 9pt; overflow-wrap: anywhere; }

.snapshot-grid { display: grid; grid-template-columns: repeat(3, 1fr); margin-bottom: 10mm; border: 1px solid var(--rule); }
.snapshot-grid > div { min-height: 26mm; padding: 4mm; border-right: 1px solid var(--rule); }
.snapshot-grid > div:last-child { border-right: 0; }
.snapshot-grid span, .snapshot-grid small { display: block; color: var(--muted); font-size: 8pt; }
.snapshot-grid strong { display: block; margin: 1mm 0; font-size: 20pt; line-height: 1; }

.meaning { max-width: 155mm; margin-bottom: 7mm; }
.meaning h2 { margin-bottom: 2mm; font-size: 17pt; line-height: 1.2; }
.meaning p:last-child { font-size: 11pt; line-height: 1.55; }

.severity-strip { display: grid; grid-template-columns: repeat(5, 1fr); margin-bottom: 7mm; }
.severity-metric { min-height: 18mm; padding: 3mm; border-top: 1.5mm solid var(--info); background: var(--info-tint); }
.severity-metric + .severity-metric { margin-left: 1.5mm; }
.severity-metric span { display: block; font-size: 7.5pt; font-weight: 700; }
.severity-metric strong { display: block; margin-top: 1mm; font-size: 15pt; }
.severity-metric--critical { border-color: var(--critical); background: var(--critical-tint); color: var(--critical); }
.severity-metric--high { border-color: var(--high); background: var(--high-tint); color: var(--high); }
.severity-metric--medium { border-color: var(--medium); background: var(--medium-tint); color: var(--medium); }
.severity-metric--low { border-color: var(--low); background: var(--low-tint); color: var(--low); }

.notice { display: grid; grid-template-columns: 32mm 1fr; gap: 4mm; margin-bottom: 5mm; padding: 3.5mm 4mm; border-left: 1.5mm solid var(--medium); background: var(--medium-tint); color: #694100; font-size: 8.5pt; }
.document-note, .accounting-note, .priority-note { margin-bottom: 0; color: var(--muted); font-size: 8.5pt; }

.page-heading { display: grid; grid-template-columns: 15mm 1fr; gap: 4mm; align-items: start; margin-bottom: 8mm; padding: 5mm 0; border-top: 2mm solid var(--primary); border-bottom: 1px solid var(--rule); }
.page-heading > span { color: var(--primary); font-size: 10pt; font-weight: 700; }
.page-heading h2 { margin-bottom: 1mm; font-size: 20pt; line-height: 1.15; }
.page-heading p { max-width: 125mm; margin-bottom: 0; color: var(--muted); font-size: 9pt; }

.landscape-grid { display: grid; gap: 8mm; }
.landscape-grid h3, .closing-grid h2 { margin-bottom: 3mm; font-size: 12pt; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th, td { padding: 2.1mm 2.3mm; border-bottom: 1px solid var(--rule); text-align: left; vertical-align: middle; }
thead th { color: var(--muted); background: var(--soft); font-size: 7.5pt; font-weight: 700; }
tbody th { font-size: 8.5pt; }
tbody td { font-size: 8.5pt; }
.score-table th:first-child { width: 52%; }
.score-table td:nth-child(2) { width: 23%; }
.table-status { display: inline-block; padding: 0.8mm 2mm; border-radius: 4px; font-size: 7.5pt; font-weight: 700; white-space: nowrap; }
.table-title-row { display: flex; align-items: baseline; justify-content: space-between; }
.table-title-row > span { color: var(--muted); font-size: 8pt; font-weight: 700; }
.landscape-table th:first-child { width: 31%; }
.landscape-table th:not(:first-child), .landscape-table td:not(:first-child) { text-align: center; }
.landscape-table th:not(:first-child), .landscape-table td:not(:first-child) { border-left: 1px solid var(--rule); font-variant-numeric: tabular-nums; }
.accounting-note { margin-top: 6mm; padding: 4mm; border-left: 1.5mm solid var(--primary); background: var(--primary-tint); color: #244a79; }

.priority-list { display: grid; gap: 5mm; }
.priority-issue { break-inside: avoid; padding: 5mm 5.5mm; border: 1px solid var(--rule); border-left: 2mm solid var(--info); border-radius: 6px; }
.priority-issue--critical { border-left-color: var(--critical); }
.priority-issue--high { border-left-color: var(--high); }
.priority-issue--medium { border-left-color: var(--medium); }
.priority-issue--low { border-left-color: var(--low); }
.priority-issue header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2mm; }
.priority-issue header > div { display: flex; gap: 2mm; align-items: center; }
.priority-number { color: var(--muted); font-size: 8pt; font-weight: 700; }
.severity { display: inline-block; padding: 0.8mm 2.1mm; border-radius: 4px; font-size: 7.5pt; font-weight: 700; }
.severity--critical { color: var(--critical); background: var(--critical-tint); }
.severity--high { color: var(--high); background: var(--high-tint); }
.severity--medium { color: var(--medium); background: var(--medium-tint); }
.severity--low { color: var(--low); background: var(--low-tint); }
.category-label { color: var(--muted); font-size: 8pt; font-weight: 700; }
.priority-issue h3 { margin-bottom: 3mm; font-size: 13pt; line-height: 1.25; overflow-wrap: anywhere; }
.priority-detail { display: grid; grid-template-columns: 37mm 1fr; gap: 4mm; padding-top: 2.5mm; border-top: 1px solid var(--rule); }
.priority-detail + .priority-detail { margin-top: 2.5mm; }
.priority-detail strong { color: var(--muted); font-size: 8pt; }
.priority-detail p { margin-bottom: 0; font-size: 9pt; }
.priority-note { margin-top: 6mm; }

.plan-list { margin-bottom: 9mm; border-top: 1px solid var(--rule); }
.plan-phase { display: grid; grid-template-columns: 25mm 1fr 42mm; gap: 5mm; align-items: center; min-height: 24mm; padding: 3.5mm 0; border-bottom: 1px solid var(--rule); }
.plan-period { color: var(--primary); font-size: 8.5pt; font-weight: 700; }
.plan-phase h3 { margin-bottom: 1mm; font-size: 11pt; }
.plan-phase p { margin-bottom: 0; color: var(--muted); font-size: 8.5pt; }
.plan-phase > strong { font-size: 8pt; line-height: 1.35; }
.closing-grid { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 10mm; margin-bottom: 8mm; }
.scope-list { margin-bottom: 0; }
.scope-list > div { grid-template-columns: 36mm 1fr; padding: 2mm 0; }
.closing-grid section:last-child { padding: 5mm; background: var(--soft); }
.closing-grid section:last-child p { color: var(--muted); font-size: 8.5pt; }
.closing-grid section:last-child p:last-child { margin-bottom: 0; }
.next-step { display: grid; grid-template-columns: 38mm 1fr; gap: 5mm; padding: 4mm; border-left: 1.5mm solid var(--primary); background: var(--primary-tint); color: #244a79; font-size: 9pt; }

@page { size: A4; }

@media print {
  html, body { background: #ffffff; }
  .summary-page { min-height: 248mm; }
}
`;
